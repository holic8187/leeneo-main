package com.hoicompany.carddesk;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(
    name = "GameNotifications",
    permissions = {
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class GameNotificationsPlugin extends Plugin {

    private static final long DEFAULT_INCIDENT_LIFETIME_MS = 10L * 60L * 1000L;

    @Override
    public void load() {
        GameNotificationScheduler.ensureChannel(getContext());
        consumeNotificationIntent(getActivity() == null ? null : getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        consumeNotificationIntent(intent);
    }

    @PluginMethod
    public void getPermissionStatus(PluginCall call) {
        call.resolve(permissionStatus());
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            call.resolve(permissionStatus());
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationPermissionCallback");
    }

    @PermissionCallback
    private void notificationPermissionCallback(PluginCall call) {
        // Record the request only after Android has actually returned from its
        // permission UI. If the activity is interrupted before the dialog can
        // open, the next authenticated launch can offer the request again.
        GameNotificationScheduler.markPermissionRequested(getContext());
        if (GameNotificationScheduler.canPostNotifications(getContext())) {
            GameNotificationScheduler.rescheduleAll(getContext());
        }
        call.resolve(permissionStatus());
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
        intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        try {
            startActivityForResult(call, intent, "notificationSettingsClosed");
        } catch (RuntimeException error) {
            call.reject("알림 설정 화면을 열지 못했습니다.", "NOTIFICATION_SETTINGS_UNAVAILABLE", error);
        }
    }

    @ActivityCallback
    private void notificationSettingsClosed(PluginCall call, ActivityResult result) {
        if (GameNotificationScheduler.canPostNotifications(getContext())) {
            GameNotificationScheduler.rescheduleAll(getContext());
        }
        call.resolve(permissionStatus());
    }

    @PluginMethod
    public void configure(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", true));
        boolean quietEnabled = Boolean.TRUE.equals(call.getBoolean("quietHoursEnabled", false));
        int quietStart = call.getInt("quietStartHour", 22);
        int quietEnd = call.getInt("quietEndHour", 6);
        if (!validHour(quietStart) || !validHour(quietEnd) || quietStart == quietEnd) {
            call.reject("야간 알림 중지 시간을 확인해 주세요.", "INVALID_QUIET_HOURS");
            return;
        }
        GameNotificationScheduler.configure(getContext(), enabled, quietEnabled, quietStart, quietEnd);
        call.resolve(settingsObject());
    }

    @PluginMethod
    public void getSettings(PluginCall call) {
        call.resolve(settingsObject());
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        String id = trimmed(call.getString("id"));
        String type = trimmed(call.getString("type"));
        String title = trimmed(call.getString("title"));
        String body = trimmed(call.getString("body"));
        Long requestedAt = call.getLong("at");
        if (id.isEmpty() || id.length() > 160) {
            call.reject("알림 식별자가 올바르지 않습니다.", "INVALID_NOTIFICATION_ID");
            return;
        }
        if (!GameNotificationScheduler.TYPE_EXPEDITION.equals(type) && !GameNotificationScheduler.TYPE_INCIDENT.equals(type)) {
            call.reject("지원하지 않는 게임 알림 종류입니다.", "INVALID_NOTIFICATION_TYPE");
            return;
        }
        if (title.isEmpty() || body.isEmpty() || requestedAt == null || requestedAt <= 0L) {
            call.reject("알림 제목, 내용, 시간을 확인해 주세요.", "INVALID_NOTIFICATION_CONTENT");
            return;
        }

        long expiresAt = call.getLong("expiresAt", 0L);
        if (expiresAt <= 0L && GameNotificationScheduler.TYPE_INCIDENT.equals(type)) {
            expiresAt = requestedAt + DEFAULT_INCIDENT_LIFETIME_MS;
        }
        if (expiresAt > 0L && expiresAt < requestedAt) {
            call.reject("알림 만료 시간이 발생 시간보다 빠릅니다.", "INVALID_NOTIFICATION_EXPIRY");
            return;
        }
        String quietBehavior = trimmed(call.getString(
            "quietBehavior",
            GameNotificationScheduler.TYPE_INCIDENT.equals(type)
                ? GameNotificationScheduler.QUIET_SKIP
                : GameNotificationScheduler.QUIET_DELAY
        ));
        if (
            !GameNotificationScheduler.QUIET_DELAY.equals(quietBehavior)
            && !GameNotificationScheduler.QUIET_SKIP.equals(quietBehavior)
        ) {
            call.reject("지원하지 않는 야간 알림 처리 방식입니다.", "INVALID_QUIET_BEHAVIOR");
            return;
        }

        JSObject payload = call.getObject("payload", new JSObject());
        GameNotificationScheduler.NotificationSpec spec = new GameNotificationScheduler.NotificationSpec(
            id,
            type,
            title,
            body,
            requestedAt,
            expiresAt,
            quietBehavior,
            payload.toString()
        );
        GameNotificationScheduler.schedule(getContext(), spec);

        JSObject result = specObject(spec);
        result.put("scheduled", GameNotificationScheduler.isEnabled(getContext()));
        result.put("permission", permissionStatus().getString("display"));
        call.resolve(result);
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        String id = trimmed(call.getString("id"));
        if (id.isEmpty()) {
            call.reject("취소할 알림 식별자가 없습니다.", "INVALID_NOTIFICATION_ID");
            return;
        }
        JSObject result = new JSObject();
        result.put("cancelled", GameNotificationScheduler.cancel(getContext(), id));
        result.put("id", id);
        call.resolve(result);
    }

    @PluginMethod
    public void cancelType(PluginCall call) {
        String type = trimmed(call.getString("type"));
        if (!GameNotificationScheduler.TYPE_EXPEDITION.equals(type) && !GameNotificationScheduler.TYPE_INCIDENT.equals(type)) {
            call.reject("지원하지 않는 게임 알림 종류입니다.", "INVALID_NOTIFICATION_TYPE");
            return;
        }
        JSObject result = new JSObject();
        result.put("cancelled", GameNotificationScheduler.cancelType(getContext(), type));
        result.put("type", type);
        call.resolve(result);
    }

    @PluginMethod
    public void cancelAll(PluginCall call) {
        JSObject result = new JSObject();
        result.put("cancelled", GameNotificationScheduler.cancelAll(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void getPending(PluginCall call) {
        List<GameNotificationScheduler.NotificationSpec> specs = GameNotificationScheduler.getPending(getContext());
        JSONArray pending = new JSONArray();
        for (GameNotificationScheduler.NotificationSpec spec : specs) pending.put(specObject(spec));
        JSObject result = new JSObject();
        result.put("notifications", pending);
        call.resolve(result);
    }

    @PluginMethod
    public void consumeLastOpenedNotification(PluginCall call) {
        JSONObject opened = GameNotificationScheduler.consumeOpenedNotification(getContext());
        JSObject result = new JSObject();
        result.put("notification", opened == null ? JSONObject.NULL : opened);
        call.resolve(result);
    }

    private JSObject permissionStatus() {
        boolean granted = GameNotificationScheduler.canPostNotifications(getContext());
        String display;
        if (granted) display = "granted";
        else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && !GameNotificationScheduler.permissionWasRequested(getContext())) display = "prompt";
        else display = "denied";
        JSObject result = new JSObject();
        result.put("display", display);
        result.put("granted", granted);
        return result;
    }

    private JSObject settingsObject() {
        JSObject result = new JSObject();
        result.put("enabled", GameNotificationScheduler.isEnabled(getContext()));
        result.put("quietHoursEnabled", GameNotificationScheduler.quietHoursEnabled(getContext()));
        result.put("quietStartHour", GameNotificationScheduler.quietStartHour(getContext()));
        result.put("quietEndHour", GameNotificationScheduler.quietEndHour(getContext()));
        result.put("permission", permissionStatus().getString("display"));
        return result;
    }

    private JSObject specObject(GameNotificationScheduler.NotificationSpec spec) {
        JSObject result = new JSObject();
        result.put("id", spec.id);
        result.put("type", spec.type);
        result.put("title", spec.title);
        result.put("body", spec.body);
        result.put("at", spec.at);
        if (spec.expiresAt > 0L) result.put("expiresAt", spec.expiresAt);
        result.put("quietBehavior", spec.quietBehavior);
        try {
            result.put("payload", new JSONObject(spec.payloadJson));
        } catch (JSONException ignored) {
            result.put("payload", new JSObject());
        }
        return result;
    }

    private void consumeNotificationIntent(Intent intent) {
        if (intent == null || !GameNotificationScheduler.ACTION_OPEN.equals(intent.getAction())) return;
        GameNotificationScheduler.rememberOpenedNotification(getContext(), intent);
        JSONObject opened = GameNotificationScheduler.consumeOpenedNotification(getContext());
        if (opened == null) return;
        JSObject payload = new JSObject();
        payload.put("notification", opened);
        notifyListeners("notificationOpened", payload, true);
        try {
            GameNotificationScheduler.preferences(getContext())
                .edit()
                .putString("last-opened", opened.toString())
                .commit();
        } catch (RuntimeException ignored) {
            // The listener event is already retained; persistence is only a cold-start fallback.
        }
        intent.setAction(null);
        intent.removeExtra(GameNotificationScheduler.EXTRA_NOTIFICATION_ID);
        intent.removeExtra(GameNotificationScheduler.EXTRA_NOTIFICATION_TYPE);
        intent.removeExtra(GameNotificationScheduler.EXTRA_NOTIFICATION_PAYLOAD);
    }

    private static boolean validHour(int hour) {
        return hour >= 0 && hour <= 23;
    }

    private static String trimmed(String value) {
        return value == null ? "" : value.trim();
    }
}
