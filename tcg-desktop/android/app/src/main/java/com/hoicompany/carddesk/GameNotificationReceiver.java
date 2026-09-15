package com.hoicompany.carddesk;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class GameNotificationReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !GameNotificationScheduler.ACTION_DELIVER.equals(intent.getAction())) return;
        String id = intent.getStringExtra(GameNotificationScheduler.EXTRA_NOTIFICATION_ID);
        if (id == null || id.trim().isEmpty()) return;
        GameNotificationScheduler.handleAlarm(context.getApplicationContext(), id);
    }
}
