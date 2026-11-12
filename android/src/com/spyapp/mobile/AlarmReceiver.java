package com.spyapp.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Zamanlanmış Pomodoro aşama bildirimlerini gösterir (uygulama kapalıyken de). */
public final class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String title = intent.getStringExtra("title");
        String text = intent.getStringExtra("text");
        Notifier.show(context, intent.getIntExtra("id", 100), title == null ? "Spy" : title, text == null ? "" : text);
    }
}
