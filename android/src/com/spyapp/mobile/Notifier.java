package com.spyapp.mobile;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/** Bildirimler (Pomodoro aşamaları, odak oturumu). API 26+ kanalları yansıma ile kurulur (derleme hedefi API 23). */
final class Notifier {
    static final String CHANNEL = "spy_timer";

    private Notifier() {
    }

    static void show(Context context, int id, String title, String text) {
        try {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            Notification.Builder b = new Notification.Builder(context);
            if (Build.VERSION.SDK_INT >= 26) {
                Class<?> channelClass = Class.forName("android.app.NotificationChannel");
                Object channel = channelClass.getConstructor(String.class, CharSequence.class, int.class)
                        .newInstance(CHANNEL, context.getString(R.string.channel_name), 4);
                NotificationManager.class.getMethod("createNotificationChannel", channelClass).invoke(nm, channel);
                Notification.Builder.class.getMethod("setChannelId", String.class).invoke(b, CHANNEL);
            }
            Intent open = new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pi = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            b.setSmallIcon(R.drawable.ic_stat)
                    .setContentTitle(title)
                    .setContentText(text)
                    .setStyle(new Notification.BigTextStyle().bigText(text))
                    .setColor(0xFF7C4DFF)
                    .setAutoCancel(true)
                    .setShowWhen(true)
                    .setWhen(System.currentTimeMillis())
                    .setContentIntent(pi);
            if (Build.VERSION.SDK_INT < 26) {
                b.setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL);
            }
            nm.notify(id, b.build());
        } catch (Throwable ignored) {
            // Bildirim izni yoksa ya da kanal kurulamazsa sessizce geç: uygulama içi uyarı zaten gösterilir.
        }
    }

    static final String CHANNEL_ONGOING = "spy_ongoing";
    static final int ONGOING_ID = 80;

    private static PendingIntent actionIntent(Context context, int code, String action) {
        Intent i = new Intent(context, MainActivity.class)
                .setAction("com.spyapp.mobile.ACTION_" + action)
                .putExtra("spy_action", action)
                .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /**
     * Oturum sürerken bildirim çubuğunda duran kalıcı bildirim.
     * kind: "pomo" | "focus". chrono: sayaç göster; countdown: geri sayım (whenMs = bitiş), değilse ileri sayım (whenMs = başlangıç).
     * Düğmeler uygulamayı açıp ilgili eylemi yürütür (pauseLabel/stopLabel boşsa düğme eklenmez).
     */
    static void ongoing(Context context, String kind, String title, String text, long whenMs, boolean chrono, boolean countdown,
                        String pauseLabel, String stopLabel) {
        try {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            Notification.Builder b = new Notification.Builder(context);
            if (Build.VERSION.SDK_INT >= 26) {
                Class<?> channelClass = Class.forName("android.app.NotificationChannel");
                Object channel = channelClass.getConstructor(String.class, CharSequence.class, int.class)
                        .newInstance(CHANNEL_ONGOING, context.getString(R.string.channel_ongoing), 2);
                NotificationManager.class.getMethod("createNotificationChannel", channelClass).invoke(nm, channel);
                Notification.Builder.class.getMethod("setChannelId", String.class).invoke(b, CHANNEL_ONGOING);
            }
            Intent open = new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pi = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            b.setSmallIcon(R.drawable.ic_stat)
                    .setContentTitle(title)
                    .setContentText(text)
                    .setColor(0xFF7C4DFF)
                    .setOngoing(true)
                    .setOnlyAlertOnce(true)
                    .setAutoCancel(false)
                    .setContentIntent(pi);
            if (chrono) {
                b.setShowWhen(true).setWhen(whenMs).setUsesChronometer(true);
                if (countdown && Build.VERSION.SDK_INT >= 24) {
                    try {
                        Notification.Builder.class.getMethod("setChronometerCountDown", boolean.class).invoke(b, true);
                    } catch (Throwable ignored) {
                    }
                }
            } else {
                b.setShowWhen(false);
            }
            if (Build.VERSION.SDK_INT < 26) b.setPriority(Notification.PRIORITY_LOW);
            if (pauseLabel != null && pauseLabel.length() > 0) b.addAction(0, pauseLabel, actionIntent(context, 201, kind + "_pause"));
            if (stopLabel != null && stopLabel.length() > 0) b.addAction(0, stopLabel, actionIntent(context, 202, kind + "_stop"));
            nm.notify(ONGOING_ID, b.build());
        } catch (Throwable ignored) {
        }
    }

    static void clearOngoing(Context context) {
        try {
            ((NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(ONGOING_ID);
        } catch (Throwable ignored) {
        }
    }
}
