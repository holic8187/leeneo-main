package com.hoicompany.carddesk;

import android.content.ClipData;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.os.SystemClock;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URL;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "AndroidUpdater")
public class AndroidUpdaterPlugin extends Plugin {

    private static final String RELEASE_OWNER = "holic8187";
    private static final String RELEASE_REPOSITORY = "leeneo-main";
    private static final String APK_MIME_TYPE = "application/vnd.android.package-archive";
    private static final String UPDATE_FILE_NAME = "hoi-card-desk-update.apk";
    private static final long MAX_APK_BYTES = 256L * 1024L * 1024L;
    private static final long MAX_DOWNLOAD_DURATION_MS = 6L * 60L * 1000L;
    private static final int DOWNLOAD_CONNECT_TIMEOUT_MS = 30_000;
    private static final int DOWNLOAD_READ_TIMEOUT_MS = 30_000;
    private static final int MAX_DOWNLOAD_ATTEMPTS = 2;
    private static final int MAX_DOWNLOAD_REDIRECTS = 5;
    private static final int DOWNLOAD_BUFFER_BYTES = 64 * 1024;
    private static final Pattern TAG_PATTERN = Pattern.compile("^tcg-android-v(\\d+\\.\\d+\\.\\d+)$");
    private static final Pattern ASSET_PATTERN = Pattern.compile(
        "^Hoi-Card-Desk-(\\d+\\.\\d+\\.\\d+)-android-release\\.apk$",
        Pattern.CASE_INSENSITIVE
    );
    private static final String PREFERENCES_NAME = "android-updater";
    private static final String PENDING_VERSION_KEY = "pending-version";
    private static final String AWAITING_PERMISSION_KEY = "awaiting-permission";

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean operationRunning = new AtomicBoolean(false);

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String rawUrl = call.getString("url");
        ReleaseAsset releaseAsset;
        try {
            releaseAsset = validateReleaseAssetUrl(rawUrl);
        } catch (UpdateException error) {
            call.reject(error.getMessage(), error.code);
            return;
        }

        if (!operationRunning.compareAndSet(false, true)) {
            call.reject("이미 업데이트 파일을 받고 있습니다.", "UPDATE_ALREADY_RUNNING");
            return;
        }

        executor.execute(() -> {
            try {
                File apk = downloadedApk();
                String pendingVersion = preferences().getString(PENDING_VERSION_KEY, null);
                if (!releaseAsset.version.equals(pendingVersion) || !apk.isFile()) {
                    downloadApk(releaseAsset, apk);
                }
                verifyApk(apk, releaseAsset.version);
                rememberPendingUpdate(releaseAsset.version, false);
                call.resolve(requestInstall(apk, releaseAsset.version));
            } catch (UpdateException error) {
                emitStatus("error", null, error.getMessage(), error.code, true);
                call.reject(error.getMessage(), error.code);
            } catch (Exception error) {
                String message = "업데이트 파일을 처리하지 못했습니다.";
                emitStatus("error", null, message, "UPDATE_FAILED", true);
                call.reject(message, "UPDATE_FAILED", error);
            } finally {
                operationRunning.set(false);
            }
        });
    }

    private void downloadApk(ReleaseAsset releaseAsset, File destination) throws UpdateException {
        File directory = destination.getParentFile();
        if (directory == null || (!directory.isDirectory() && !directory.mkdirs())) {
            throw new UpdateException("UPDATE_STORAGE_FAILED", "업데이트 파일을 저장할 공간을 준비하지 못했습니다.");
        }
        File partial = new File(directory, UPDATE_FILE_NAME + ".part");
        deleteDownloadFile(destination);
        deleteDownloadFile(partial);
        // Clear identifiers left by the old DownloadManager implementation so
        // an Android-owned job can never be reused after this migration.
        preferences().edit().remove("download-id").remove("download-version").apply();
        emitDownloadProgress(0, 0L, -1L, "안드로이드가 업데이트 파일을 받고 있습니다.");
        try {
            long deadlineAt = SystemClock.elapsedRealtime() + MAX_DOWNLOAD_DURATION_MS;
            IOException lastNetworkError = null;
            for (int attempt = 1; attempt <= MAX_DOWNLOAD_ATTEMPTS; attempt += 1) {
                deleteDownloadFile(partial);
                try {
                    streamApk(releaseAsset.uri.toURL(), partial, deadlineAt);
                    lastNetworkError = null;
                    break;
                } catch (IOException error) {
                    lastNetworkError = error;
                    if (attempt >= MAX_DOWNLOAD_ATTEMPTS || SystemClock.elapsedRealtime() >= deadlineAt) {
                        throw new UpdateException(
                            "UPDATE_DOWNLOAD_FAILED",
                            "업데이트 파일을 받지 못했습니다. 네트워크를 확인해 주세요.",
                            error
                        );
                    }
                    emitDownloadProgress(0, 0L, -1L, "연결이 끊겨 업데이트 다운로드를 다시 시도합니다.");
                }
            }
            if (lastNetworkError != null) {
                throw new UpdateException(
                    "UPDATE_DOWNLOAD_FAILED",
                    "업데이트 파일을 받지 못했습니다. 네트워크를 확인해 주세요.",
                    lastNetworkError
                );
            }
            if (destination.exists() && !destination.delete()) {
                throw new UpdateException("UPDATE_STORAGE_FAILED", "이전 업데이트 파일을 교체하지 못했습니다.");
            }
            if (!partial.renameTo(destination)) {
                throw new UpdateException("UPDATE_STORAGE_FAILED", "받은 업데이트 파일을 저장하지 못했습니다.");
            }
            emitStatus("downloading", 100, "업데이트 파일을 모두 받았습니다.", null, false);
        } finally {
            deleteDownloadFile(partial);
        }
    }

    private void streamApk(URL initialUrl, File partial, long deadlineAt) throws IOException, UpdateException {
        int lastPercent = 0;
        URL currentUrl = initialUrl;
        for (int redirectCount = 0; redirectCount <= MAX_DOWNLOAD_REDIRECTS; redirectCount += 1) {
            long remainingMs = deadlineAt - SystemClock.elapsedRealtime();
            if (remainingMs <= 0L) {
                throw new UpdateException("UPDATE_TIMEOUT", "업데이트 시간이 너무 오래 걸립니다. 연결을 확인한 뒤 다시 시도해 주세요.");
            }
            HttpURLConnection connection = (HttpURLConnection) currentUrl.openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setUseCaches(false);
            connection.setConnectTimeout(boundedTimeout(DOWNLOAD_CONNECT_TIMEOUT_MS, remainingMs));
            connection.setReadTimeout(boundedTimeout(DOWNLOAD_READ_TIMEOUT_MS, remainingMs));
            connection.setRequestProperty("Accept", APK_MIME_TYPE + ", application/octet-stream");
            connection.setRequestProperty("Accept-Encoding", "identity");
            connection.setRequestProperty("User-Agent", "Hoi-Card-Desk-Android-Updater");
            try {
                int responseCode = connection.getResponseCode();
                if (responseCode >= 300 && responseCode < 400) {
                    String location = connection.getHeaderField("Location");
                    if (redirectCount == MAX_DOWNLOAD_REDIRECTS || location == null || location.trim().isEmpty()) {
                        throw new UpdateException("UPDATE_REDIRECT_FAILED", "업데이트 파일 주소를 따라가지 못했습니다.");
                    }
                    currentUrl = validatedRedirect(currentUrl, location);
                    continue;
                }
                if (responseCode != HttpURLConnection.HTTP_OK) {
                    throw new UpdateException(
                        "UPDATE_DOWNLOAD_FAILED",
                        "업데이트 서버가 파일을 보내지 못했습니다. (HTTP " + responseCode + ")"
                    );
                }

                long totalBytes = connection.getContentLengthLong();
                if (totalBytes > MAX_APK_BYTES) {
                    throw new UpdateException("UPDATE_TOO_LARGE", "업데이트 파일 크기가 허용 범위를 넘었습니다.");
                }
                long downloadedBytes = 0L;
                byte[] buffer = new byte[DOWNLOAD_BUFFER_BYTES];
                try (
                    InputStream input = new BufferedInputStream(connection.getInputStream());
                    BufferedOutputStream output = new BufferedOutputStream(new FileOutputStream(partial))
                ) {
                    int read;
                    while ((read = input.read(buffer)) != -1) {
                        if (Thread.currentThread().isInterrupted()) {
                            throw new UpdateException("UPDATE_CANCELLED", "업데이트 다운로드가 중단되었습니다.");
                        }
                        if (SystemClock.elapsedRealtime() >= deadlineAt) {
                            throw new UpdateException("UPDATE_TIMEOUT", "업데이트 시간이 너무 오래 걸립니다. 연결을 확인한 뒤 다시 시도해 주세요.");
                        }
                        downloadedBytes += read;
                        if (downloadedBytes > MAX_APK_BYTES) {
                            throw new UpdateException("UPDATE_TOO_LARGE", "업데이트 파일 크기가 허용 범위를 넘었습니다.");
                        }
                        output.write(buffer, 0, read);
                        int percent = totalBytes > 0L
                            ? (int) Math.max(1L, Math.min(99L, (downloadedBytes * 100L) / totalBytes))
                            : (int) Math.min(99L, 1L + downloadedBytes / (1024L * 1024L));
                        if (percent != lastPercent) {
                            emitDownloadProgress(
                                percent,
                                downloadedBytes,
                                totalBytes,
                                "업데이트 파일을 받고 있습니다."
                            );
                            lastPercent = percent;
                        }
                    }
                    output.flush();
                }
                if (downloadedBytes <= 0L || (totalBytes > 0L && downloadedBytes != totalBytes)) {
                    throw new UpdateException("UPDATE_INCOMPLETE", "업데이트 파일을 끝까지 받지 못했습니다.");
                }
                return;
            } finally {
                connection.disconnect();
            }
        }
        throw new UpdateException("UPDATE_REDIRECT_FAILED", "업데이트 파일 주소를 따라가지 못했습니다.");
    }

    private int boundedTimeout(int configuredTimeoutMs, long remainingMs) {
        return (int) Math.max(1L, Math.min((long) configuredTimeoutMs, remainingMs));
    }

    private URL validatedRedirect(URL source, String location) throws UpdateException {
        try {
            URL redirected = new URL(source, location);
            String host = redirected.getHost().toLowerCase();
            if (!"https".equalsIgnoreCase(redirected.getProtocol())
                || redirected.getUserInfo() != null
                || (redirected.getPort() != -1 && redirected.getPort() != 443)
                || !("github.com".equals(host) || "release-assets.githubusercontent.com".equals(host))) {
                throw new UpdateException("UPDATE_REDIRECT_NOT_ALLOWED", "업데이트 파일이 허용되지 않은 주소로 이동했습니다.");
            }
            return redirected;
        } catch (IOException error) {
            throw new UpdateException("UPDATE_REDIRECT_FAILED", "업데이트 파일 주소를 따라가지 못했습니다.", error);
        }
    }

    private void deleteDownloadFile(File file) throws UpdateException {
        if (file.exists() && !file.delete()) {
            throw new UpdateException("UPDATE_STORAGE_FAILED", "이전 업데이트 파일을 지우지 못했습니다.");
        }
    }

    private JSObject requestInstall(File apk, String version) throws UpdateException {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
            rememberPendingUpdate(version, true);
            Intent settingsIntent = new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName())
            );
            settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (settingsIntent.resolveActivity(getContext().getPackageManager()) == null) {
                rememberPendingUpdate(version, false);
                throw new UpdateException("UPDATE_PERMISSION_SCREEN_MISSING", "설치 권한 화면을 열지 못했습니다.");
            }
            launchActivity(settingsIntent, "UPDATE_PERMISSION_SCREEN_MISSING", "설치 권한 화면을 열지 못했습니다.");
            emitStatus(
                "permission-required",
                null,
                "이 출처 허용을 켜면 설치 확인 화면이 이어서 열립니다.",
                null,
                true
            );
            return statusObject(
                "permission-required",
                null,
                "이 출처 허용을 켜면 설치 확인 화면이 이어서 열립니다.",
                null
            );
        }

        Uri apkUri = FileProvider.getUriForFile(
            getContext(),
            getContext().getPackageName() + ".fileprovider",
            apk
        );
        Intent installIntent = new Intent(Intent.ACTION_INSTALL_PACKAGE);
        installIntent.setData(apkUri);
        installIntent.setClipData(ClipData.newRawUri("update-apk", apkUri));
        installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);

        rememberPendingUpdate(version, false);
        try {
            launchActivity(installIntent, "UPDATE_INSTALLER_MISSING", "안드로이드 설치 화면을 열지 못했습니다.");
        } catch (UpdateException primaryError) {
            // Some OEM package installers do not advertise ACTION_INSTALL_PACKAGE
            // even though they accept the older MIME-typed ACTION_VIEW contract.
            Intent fallbackIntent = new Intent(Intent.ACTION_VIEW);
            fallbackIntent.setDataAndType(apkUri, APK_MIME_TYPE);
            fallbackIntent.setClipData(ClipData.newRawUri("update-apk", apkUri));
            fallbackIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                launchActivity(fallbackIntent, "UPDATE_INSTALLER_MISSING", "안드로이드 설치 화면을 열지 못했습니다.");
            } catch (UpdateException fallbackError) {
                fallbackError.addSuppressed(primaryError);
                throw fallbackError;
            }
        }
        emitStatus("installing", 100, "안드로이드 설치 확인 화면을 열었습니다.", null, true);
        return statusObject("installing", 100, "안드로이드 설치 확인 화면을 열었습니다.", null);
    }

    private void launchActivity(Intent intent, String errorCode, String errorMessage) throws UpdateException {
        CountDownLatch launched = new CountDownLatch(1);
        AtomicReference<RuntimeException> launchError = new AtomicReference<>(null);
        getBridge().executeOnMainThread(() -> {
            try {
                if (getActivity() != null) getActivity().startActivity(intent);
                else getContext().startActivity(intent);
            } catch (RuntimeException error) {
                launchError.set(error);
            } finally {
                launched.countDown();
            }
        });
        try {
            if (!launched.await(10, TimeUnit.SECONDS)) {
                throw new UpdateException(errorCode, errorMessage);
            }
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new UpdateException("UPDATE_CANCELLED", "업데이트 화면 열기가 중단되었습니다.", error);
        }
        if (launchError.get() != null) {
            throw new UpdateException(errorCode, errorMessage, launchError.get());
        }
    }

    private void verifyApk(File apk, String expectedVersion) throws UpdateException {
        PackageManager packageManager = getContext().getPackageManager();
        int signingFlags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
            ? PackageManager.GET_SIGNING_CERTIFICATES
            : PackageManager.GET_SIGNATURES;
        PackageInfo candidate = packageManager.getPackageArchiveInfo(apk.getAbsolutePath(), signingFlags);
        if (candidate == null || candidate.applicationInfo == null) {
            deleteInvalidApk(apk);
            throw new UpdateException("UPDATE_INVALID_APK", "받은 파일이 올바른 앱 설치 파일이 아닙니다.");
        }
        candidate.applicationInfo.sourceDir = apk.getAbsolutePath();
        candidate.applicationInfo.publicSourceDir = apk.getAbsolutePath();
        if (!getContext().getPackageName().equals(candidate.packageName)) {
            deleteInvalidApk(apk);
            throw new UpdateException("UPDATE_PACKAGE_MISMATCH", "다른 앱의 설치 파일이어서 업데이트를 중단했습니다.");
        }
        if (!expectedVersion.equals(candidate.versionName)) {
            deleteInvalidApk(apk);
            throw new UpdateException("UPDATE_VERSION_MISMATCH", "게시된 버전과 설치 파일 버전이 일치하지 않습니다.");
        }

        PackageInfo installed;
        try {
            installed = packageManager.getPackageInfo(getContext().getPackageName(), signingFlags);
        } catch (PackageManager.NameNotFoundException error) {
            throw new UpdateException("UPDATE_APP_NOT_FOUND", "현재 설치된 앱 정보를 확인하지 못했습니다.", error);
        }
        if (longVersionCode(candidate) <= longVersionCode(installed)) {
            deleteInvalidApk(apk);
            throw new UpdateException("UPDATE_NOT_NEWER", "현재 버전보다 새로운 설치 파일이 아닙니다.");
        }
        if (!hasMatchingSigner(installed, candidate)) {
            deleteInvalidApk(apk);
            throw new UpdateException("UPDATE_SIGNATURE_MISMATCH", "앱 서명이 달라 안전하게 업데이트할 수 없습니다.");
        }
    }

    private boolean hasMatchingSigner(PackageInfo installed, PackageInfo candidate) throws UpdateException {
        try {
            List<byte[]> installedDigests = signerDigests(installed);
            List<byte[]> candidateDigests = signerDigests(candidate);
            if (installedDigests.isEmpty() || installedDigests.size() != candidateDigests.size()) return false;
            for (byte[] installedDigest : installedDigests) {
                boolean found = false;
                for (byte[] candidateDigest : candidateDigests) {
                    if (MessageDigest.isEqual(installedDigest, candidateDigest)) {
                        found = true;
                        break;
                    }
                }
                if (!found) return false;
            }
            return true;
        } catch (NoSuchAlgorithmException error) {
            throw new UpdateException("UPDATE_SIGNATURE_CHECK_FAILED", "앱 서명을 확인하지 못했습니다.", error);
        }
    }

    @SuppressWarnings("deprecation")
    private List<byte[]> signerDigests(PackageInfo packageInfo) throws NoSuchAlgorithmException {
        Signature[] signatures;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && packageInfo.signingInfo != null) {
            signatures = packageInfo.signingInfo.getApkContentsSigners();
        } else {
            signatures = packageInfo.signatures;
        }
        List<byte[]> digests = new ArrayList<>();
        if (signatures == null) return digests;
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        for (Signature signature : signatures) {
            digests.add(digest.digest(signature.toByteArray()));
            digest.reset();
        }
        return digests;
    }

    @SuppressWarnings("deprecation")
    private long longVersionCode(PackageInfo packageInfo) {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
            ? packageInfo.getLongVersionCode()
            : packageInfo.versionCode;
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (
            Build.VERSION.SDK_INT < Build.VERSION_CODES.O
            || !preferences().getBoolean(AWAITING_PERMISSION_KEY, false)
            || !getContext().getPackageManager().canRequestPackageInstalls()
            || !operationRunning.compareAndSet(false, true)
        ) return;

        executor.execute(() -> {
            try {
                File apk = downloadedApk();
                String version = preferences().getString(PENDING_VERSION_KEY, null);
                if (version == null || !apk.isFile()) {
                    throw new UpdateException("UPDATE_MISSING", "다운로드한 업데이트 파일을 찾지 못했습니다.");
                }
                verifyApk(apk, version);
                requestInstall(apk, version);
            } catch (UpdateException error) {
                rememberPendingUpdate(null, false);
                emitStatus("error", null, error.getMessage(), error.code, true);
            } finally {
                operationRunning.set(false);
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        executor.shutdownNow();
        super.handleOnDestroy();
    }

    private ReleaseAsset validateReleaseAssetUrl(String rawUrl) throws UpdateException {
        if (rawUrl == null || rawUrl.trim().isEmpty()) {
            throw new UpdateException("UPDATE_URL_REQUIRED", "업데이트 파일 주소가 없습니다.");
        }
        try {
            URI uri = new URI(rawUrl);
            if (
                !"https".equalsIgnoreCase(uri.getScheme())
                || !"github.com".equalsIgnoreCase(uri.getHost())
                || (uri.getPort() != -1 && uri.getPort() != 443)
                || uri.getUserInfo() != null
                || uri.getQuery() != null
                || uri.getFragment() != null
                || !uri.normalize().equals(uri)
            ) throw new UpdateException("UPDATE_URL_NOT_ALLOWED", "허용되지 않은 업데이트 파일 주소입니다.");

            String[] segments = uri.getPath().split("/");
            if (
                segments.length != 7
                || !RELEASE_OWNER.equals(segments[1])
                || !RELEASE_REPOSITORY.equals(segments[2])
                || !"releases".equals(segments[3])
                || !"download".equals(segments[4])
            ) throw new UpdateException("UPDATE_URL_NOT_ALLOWED", "공식 GitHub 배포 파일만 설치할 수 있습니다.");

            Matcher tagMatcher = TAG_PATTERN.matcher(segments[5]);
            Matcher assetMatcher = ASSET_PATTERN.matcher(segments[6]);
            if (!tagMatcher.matches() || !assetMatcher.matches() || !tagMatcher.group(1).equals(assetMatcher.group(1))) {
                throw new UpdateException("UPDATE_URL_NOT_ALLOWED", "공식 Android APK 배포 파일만 설치할 수 있습니다.");
            }
            return new ReleaseAsset(uri, tagMatcher.group(1));
        } catch (URISyntaxException error) {
            throw new UpdateException("UPDATE_URL_NOT_ALLOWED", "업데이트 파일 주소 형식이 올바르지 않습니다.", error);
        }
    }

    private File downloadedApk() {
        // The app itself now streams the APK. App-private cache avoids the
        // OEM-specific DownloadManager destination failures that left updates
        // indefinitely at 0%, and FileProvider grants the installer read access.
        File directory = new File(getContext().getCacheDir(), "updates");
        return new File(directory, UPDATE_FILE_NAME);
    }

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFERENCES_NAME, 0);
    }

    private void rememberPendingUpdate(String version, boolean awaitingPermission) {
        SharedPreferences.Editor editor = preferences().edit().putBoolean(AWAITING_PERMISSION_KEY, awaitingPermission);
        if (version == null) editor.remove(PENDING_VERSION_KEY);
        else editor.putString(PENDING_VERSION_KEY, version);
        // The activity can leave immediately for Android settings/installer.
        // Persist synchronously so handleOnResume can always continue the handoff.
        editor.commit();
    }

    private void deleteInvalidApk(File apk) {
        rememberPendingUpdate(null, false);
        if (apk.exists()) apk.delete();
    }

    private JSObject statusObject(String status, Integer progress, String detail, String code) {
        JSObject result = new JSObject();
        result.put("status", status);
        if (progress != null) result.put("progress", progress);
        if (progress != null) result.put("detail", progress);
        else if (detail != null) result.put("detail", detail);
        if (detail != null) result.put("message", detail);
        if (code != null) result.put("code", code);
        return result;
    }

    private void emitStatus(String status, Integer progress, String detail, String code, boolean retain) {
        JSObject payload = statusObject(status, progress, detail, code);
        getBridge().executeOnMainThread(() -> notifyListeners("updateStatus", payload, retain));
    }

    private void emitDownloadProgress(int progress, long downloadedBytes, long totalBytes, String message) {
        JSObject payload = statusObject("downloading", progress, message, null);
        payload.put("downloadedBytes", Math.max(0L, downloadedBytes));
        if (totalBytes > 0L) payload.put("totalBytes", totalBytes);
        getBridge().executeOnMainThread(() -> notifyListeners("updateStatus", payload, false));
    }

    private static class ReleaseAsset {
        final URI uri;
        final String version;

        ReleaseAsset(URI uri, String version) {
            this.uri = uri;
            this.version = version;
        }
    }

    private static class UpdateException extends Exception {
        final String code;

        UpdateException(String code, String message) {
            super(message);
            this.code = code;
        }

        UpdateException(String code, String message, Throwable cause) {
            super(message, cause);
            this.code = code;
        }
    }
}
