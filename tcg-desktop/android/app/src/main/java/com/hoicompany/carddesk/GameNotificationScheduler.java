package com.hoicompany.carddesk;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Iterator;
import java.util.List;
import org.json.JSONException;
import org.json.JSONObject;

final class GameNotificationScheduler {

    static final String TYPE_EXPEDITION = "expedition";
    static final String TYPE_INCIDENT = "incident";
    static final String QUIET_DELAY = "delay";
    static final String QUIET_SKIP = "skip";

    static final String EXTRA_NOTIFICATION_ID = "game_notification_id";
    static final String EXTRA_NOTIFICATION_TYPE = "game_notification_type";
    static final String EXTRA_NOTIFICATION_PAYLOAD = "game_notification_payload";
    static final String ACTION_DELIVER = "com.hoicompany.carddesk.DELIVER_GAME_NOTIFICATION";
    static final String ACTION_OPEN = "com.hoicompany.carddesk.OPEN_GAME_NOTIFICATION";

    private static final String PREFERENCES_NAME = "game-notifications";
    private static final String SCHEDULES_KEY = "schedules";
    private static final String ENABLED_KEY = "enabled";
    private static final String QUIET_ENABLED_KEY = "quiet-enabled";
    private static final String QUIET_START_KEY = "quiet-start-hour";
    private static final String QUIET_END_KEY = "quiet-end-hour";
    private static final String PERMISSION_REQUESTED_KEY = "permission-requested";
    private static final String LAST_OPENED_KEY = "last-opened";

    private static final String CHANNEL_ID = "game-events";
    private static final String CHANNEL_NAME = "게임 알림";
    private static final String CHANNEL_DESCRIPTION = "모험 완료와 돌발 임무를 알려드립니다.";
    private static final String NOTIFICATION_GROUP = "game-events";
    private static final long MIN_ALARM_DELAY_MS = 250L;

    private GameNotificationScheduler() {}

    static final class NotificationSpec {
        final String id;
        final String type;
        final String title;
        final String body;
        final long at;
        final long expiresAt;
        final String quietBehavior;
        final String payloadJson;

        NotificationSpec(
            String id,
            String type,
            String title,
            String body,
            long at,
            long expiresAt,
            String quietBehavior,
            String payloadJson
        ) {
            this.id = id;
            this.type = type;
            this.title = title;
            this.body = body;
            this.at = at;
            this.expiresAt = expiresAt;
            this.quietBehavior = quietBehavior;
            this.payloadJson = payloadJson;
        }

        NotificationSpec withAt(long nextAt) {
            return new NotificationSpec(id, type, title, body, nextAt, expiresAt, quietBehavior, payloadJson);
        }

        JSONObject toJson() throws JSONException {
            JSONObject value = new JSONObject();
            value.put("id", id);
            value.put("type", type);
            value.put("title", title);
            value.put("body", body);
            value.put("at", at);
            value.put("expiresAt", expiresAt);
            value.put("quietBehavior", quietBehavior);
            value.put("payload", new JSONObject(payloadJson));
            return value;
        }

        static NotificationSpec fromJson(JSONObject value) throws JSONException {
            return new NotificationSpec(
                value.getString("id"),
                value.optString("type", TYPE_EXPEDITION),
                value.optString("title", "게임 알림"),
                value.optString("body", "새로운 소식이 있습니다."),
                value.getLong("at"),
                value.optLong("expiresAt", 0L),
                value.optString("quietBehavior", QUIET_DELAY),
                value.optJSONObject("payload") == null ? "{}" : value.optJSONObject("payload").toString()
            );
        }
    }

    static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            CHANNEL_NAME,
            NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription(CHANNEL_DESCRIPTION);
        channel.enableVibration(true);
        manager.createNotificationChannel(channel);
    }

    static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
    }

    static boolean isEnabled(Context context) {
        return preferences(context).getBoolean(ENABLED_KEY, true);
    }

    static boolean quietHoursEnabled(Context context) {
        return preferences(context).getBoolean(QUIET_ENABLED_KEY, false);
    }

    static int quietStartHour(Context context) {
        return preferences(context).getInt(QUIET_START_KEY, 22);
    }

    static int quietEndHour(Context context) {
        return preferences(context).getInt(QUIET_END_KEY, 6);
    }

    static boolean permissionWasRequested(Context context) {
        return preferences(context).getBoolean(PERMISSION_REQUESTED_KEY, false);
    }

    static void markPermissionRequested(Context context) {
        preferences(context).edit().putBoolean(PERMISSION_REQUESTED_KEY, true).commit();
    }

    static void configure(Context context, boolean enabled, boolean quietEnabled, int quietStart, int quietEnd) {
        preferences(context).edit()
            .putBoolean(ENABLED_KEY, enabled)
            .putBoolean(QUIET_ENABLED_KEY, quietEnabled)
            .putInt(QUIET_START_KEY, quietStart)
            .putInt(QUIET_END_KEY, quietEnd)
            .commit();
        cancelAllAlarms(context);
        if (enabled) rescheduleAll(context);
    }

    static synchronized void schedule(Context context, NotificationSpec spec) {
        putSpec(context, spec);
        cancelAlarm(context, spec.id);
        if (isEnabled(context)) scheduleAlarm(context, spec);
    }

    static synchronized boolean cancel(Context context, String id) {
        boolean existed = getSpec(context, id) != null;
        cancelAlarm(context, id);
        NotificationManagerCompat.from(context).cancel(requestCode(id));
        removeSpec(context, id);
        return existed;
    }

    static synchronized int cancelType(Context context, String type) {
        List<NotificationSpec> specs = getAllSpecs(context);
        int cancelled = 0;
        for (NotificationSpec spec : specs) {
            if (!type.equals(spec.type)) continue;
            cancelAlarm(context, spec.id);
            removeSpec(context, spec.id);
            cancelled += 1;
        }
        return cancelled;
    }

    static synchronized int cancelAll(Context context) {
        List<NotificationSpec> specs = getAllSpecs(context);
        for (NotificationSpec spec : specs) cancelAlarm(context, spec.id);
        NotificationManagerCompat.from(context).cancelAll();
        preferences(context).edit().remove(SCHEDULES_KEY).commit();
        return specs.size();
    }

    static synchronized List<NotificationSpec> getPending(Context context) {
        pruneExpired(context, System.currentTimeMillis());
        return getAllSpecs(context);
    }

    static synchronized void rescheduleAll(Context context) {
        if (!isEnabled(context)) return;
        long now = System.currentTimeMillis();
        pruneExpired(context, now);
        for (NotificationSpec spec : getAllSpecs(context)) scheduleAlarm(context, spec);
    }

    static synchronized void handleAlarm(Context context, String id) {
        NotificationSpec spec = getSpec(context, id);
        if (spec == null || !isEnabled(context)) return;

        long now = System.currentTimeMillis();
        if (spec.expiresAt > 0L && now > spec.expiresAt) {
            removeSpec(context, spec.id);
            return;
        }

        if (quietHoursEnabled(context) && isQuietTime(context, now)) {
            if (QUIET_SKIP.equals(spec.quietBehavior)) {
                removeSpec(context, spec.id);
                return;
            }
            NotificationSpec deferred = spec.withAt(nextQuietEnd(context, now));
            putSpec(context, deferred);
            scheduleAlarm(context, deferred);
            return;
        }

        if (!canPostNotifications(context)) return;
        ensureChannel(context);
        showNotification(context, spec);
        removeSpec(context, spec.id);
    }

    static boolean canPostNotifications(Context context) {
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
        ) return false;
        return NotificationManagerCompat.from(context).areNotificationsEnabled();
    }

    static synchronized void rememberOpenedNotification(Context context, Intent intent) {
        String id = intent.getStringExtra(EXTRA_NOTIFICATION_ID);
        if (id == null || id.trim().isEmpty()) return;
        try {
            JSONObject opened = new JSONObject();
            opened.put("id", id);
            opened.put("type", intent.getStringExtra(EXTRA_NOTIFICATION_TYPE));
            opened.put("payload", new JSONObject(intent.getStringExtra(EXTRA_NOTIFICATION_PAYLOAD) == null
                ? "{}"
                : intent.getStringExtra(EXTRA_NOTIFICATION_PAYLOAD)));
            preferences(context).edit().putString(LAST_OPENED_KEY, opened.toString()).commit();
        } catch (JSONException ignored) {
            // A malformed optional payload should never prevent the app from opening.
        }
    }

    static synchronized JSONObject consumeOpenedNotification(Context context) {
        String raw = preferences(context).getString(LAST_OPENED_KEY, null);
        preferences(context).edit().remove(LAST_OPENED_KEY).commit();
        if (raw == null) return null;
        try {
            return new JSONObject(raw);
        } catch (JSONException ignored) {
            return null;
        }
    }

    private static void showNotification(Context context, NotificationSpec spec) {
        Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launchIntent == null) launchIntent = new Intent(context, MainActivity.class);
        launchIntent.setAction(ACTION_OPEN);
        launchIntent.setData(notificationUri(spec.id));
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        launchIntent.putExtra(EXTRA_NOTIFICATION_ID, spec.id);
        launchIntent.putExtra(EXTRA_NOTIFICATION_TYPE, spec.type);
        launchIntent.putExtra(EXTRA_NOTIFICATION_PAYLOAD, spec.payloadJson);
        PendingIntent contentIntent = PendingIntent.getActivity(
            context,
            requestCode(spec.id),
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_card_notification)
            .setContentTitle(spec.title)
            .setContentText(spec.body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(spec.body))
            .setContentIntent(contentIntent)
            .setAutoCancel(true)
            .setWhen(spec.at)
            .setShowWhen(true)
            .setGroup(NOTIFICATION_GROUP)
            .setCategory(NotificationCompat.CATEGORY_EVENT)
            .setPriority(TYPE_INCIDENT.equals(spec.type)
                ? NotificationCompat.PRIORITY_HIGH
                : NotificationCompat.PRIORITY_DEFAULT);
        try {
            NotificationManagerCompat.from(context).notify(requestCode(spec.id), builder.build());
        } catch (SecurityException ignored) {
            // Permission can be revoked between the check and this call.
        }
    }

    private static void scheduleAlarm(Context context, NotificationSpec spec) {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (manager == null) return;
        long deliveryAt = Math.max(System.currentTimeMillis() + MIN_ALARM_DELAY_MS, spec.at);
        manager.setAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP,
            deliveryAt,
            alarmPendingIntent(context, spec.id, PendingIntent.FLAG_UPDATE_CURRENT)
        );
    }

    private static void cancelAlarm(Context context, String id) {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (manager == null) return;
        PendingIntent pending = alarmPendingIntent(context, id, PendingIntent.FLAG_NO_CREATE);
        if (pending != null) {
            manager.cancel(pending);
            pending.cancel();
        }
    }

    private static void cancelAllAlarms(Context context) {
        for (NotificationSpec spec : getAllSpecs(context)) cancelAlarm(context, spec.id);
    }

    private static PendingIntent alarmPendingIntent(Context context, String id, int baseFlags) {
        Intent intent = new Intent(context, GameNotificationReceiver.class);
        intent.setAction(ACTION_DELIVER);
        intent.setData(notificationUri(id));
        intent.putExtra(EXTRA_NOTIFICATION_ID, id);
        return PendingIntent.getBroadcast(
            context,
            requestCode(id),
            intent,
            baseFlags | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private static Uri notificationUri(String id) {
        return Uri.parse("hoi-card-desk://game-notification/" + Uri.encode(id));
    }

    private static int requestCode(String id) {
        return id.hashCode() & 0x7fffffff;
    }

    private static boolean isQuietTime(Context context, long timestamp) {
        Calendar calendar = Calendar.getInstance();
        calendar.setTimeInMillis(timestamp);
        int hour = calendar.get(Calendar.HOUR_OF_DAY);
        int start = quietStartHour(context);
        int end = quietEndHour(context);
        return start < end ? hour >= start && hour < end : hour >= start || hour < end;
    }

    private static long nextQuietEnd(Context context, long timestamp) {
        Calendar calendar = Calendar.getInstance();
        calendar.setTimeInMillis(timestamp);
        int currentHour = calendar.get(Calendar.HOUR_OF_DAY);
        int start = quietStartHour(context);
        int end = quietEndHour(context);
        if (start > end && currentHour >= start) calendar.add(Calendar.DAY_OF_YEAR, 1);
        calendar.set(Calendar.HOUR_OF_DAY, end);
        calendar.set(Calendar.MINUTE, 0);
        calendar.set(Calendar.SECOND, 0);
        calendar.set(Calendar.MILLISECOND, 0);
        if (calendar.getTimeInMillis() <= timestamp) calendar.add(Calendar.DAY_OF_YEAR, 1);
        return calendar.getTimeInMillis();
    }

    private static synchronized void pruneExpired(Context context, long now) {
        for (NotificationSpec spec : getAllSpecs(context)) {
            if (spec.expiresAt > 0L && now > spec.expiresAt) {
                cancelAlarm(context, spec.id);
                removeSpec(context, spec.id);
            }
        }
    }

    private static synchronized void putSpec(Context context, NotificationSpec spec) {
        JSONObject schedules = readSchedules(context);
        try {
            schedules.put(spec.id, spec.toJson());
            writeSchedules(context, schedules);
        } catch (JSONException ignored) {
            // All fields are primitives or a validated JSON object, so this is defensive only.
        }
    }

    private static synchronized NotificationSpec getSpec(Context context, String id) {
        JSONObject value = readSchedules(context).optJSONObject(id);
        if (value == null) return null;
        try {
            return NotificationSpec.fromJson(value);
        } catch (JSONException ignored) {
            removeSpec(context, id);
            return null;
        }
    }

    private static synchronized List<NotificationSpec> getAllSpecs(Context context) {
        JSONObject schedules = readSchedules(context);
        List<NotificationSpec> specs = new ArrayList<>();
        Iterator<String> keys = schedules.keys();
        while (keys.hasNext()) {
            String id = keys.next();
            JSONObject value = schedules.optJSONObject(id);
            if (value == null) continue;
            try {
                specs.add(NotificationSpec.fromJson(value));
            } catch (JSONException ignored) {
                // Corrupt legacy entries are omitted and will be replaced by the next schedule.
            }
        }
        return specs;
    }

    private static synchronized void removeSpec(Context context, String id) {
        JSONObject schedules = readSchedules(context);
        schedules.remove(id);
        writeSchedules(context, schedules);
    }

    private static JSONObject readSchedules(Context context) {
        String raw = preferences(context).getString(SCHEDULES_KEY, "{}");
        try {
            return new JSONObject(raw);
        } catch (JSONException ignored) {
            return new JSONObject();
        }
    }

    private static void writeSchedules(Context context, JSONObject schedules) {
        preferences(context).edit().putString(SCHEDULES_KEY, schedules.toString()).commit();
    }
}
