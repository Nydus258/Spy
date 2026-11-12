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
        // Kalıcı oturum bildirimi: sonraki aşamaya geçir ya da (set bittiyse) kaldır.
        if (intent.getBooleanExtra("ongoing", false)) {
            long nextEnd = intent.getLongExtra("nextEnd", 0);
            if (nextEnd > 0) {
                Notifier.ongoing(context, "pomo", intent.getStringExtra("nextTitle"), intent.getStringExtra("nextText"), nextEnd, true, true,
                        intent.getStringExtra("pauseLabel"), intent.getStringExtra("stopLabel"));
            } else {
                Notifier.clearOngoing(context);
            }
        }
    }
}
