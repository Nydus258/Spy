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
}
