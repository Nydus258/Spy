package com.spyapp.mobile;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Vibrator;
import android.provider.Settings;
import android.webkit.JavascriptInterface;

import org.json.JSONArray;

import java.security.MessageDigest;
import java.util.Locale;

/** Arayüzün (WebView) çağırdığı yerel işlevler: window.SpyNative. Tüm süreler epoch saniye, alarm anları milisaniyedir. */
public final class Bridge {
    static final int ALARM_BASE = 100;
    static final int ALARM_SLOTS = 16;

    private final MainActivity activity;
    private final Context app;

    Bridge(MainActivity activity) {
        this.activity = activity;
        this.app = activity.getApplicationContext();
    }

    @JavascriptInterface
    public String version() {
        return BuildInfo.VERSION;
    }

    @JavascriptInterface
    public String ownPackage() {
        return app.getPackageName();
    }

    @JavascriptInterface
    public String deviceLang() {
        return Locale.getDefault().getLanguage();
    }

    @JavascriptInterface
    public boolean hasUsageAccess() {
        return UsageSync.hasAccess(app);
    }

    @JavascriptInterface
    public void openUsageSettings() {
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    Intent i = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
                    i.setData(Uri.parse("package:" + app.getPackageName()));
                    activity.startActivity(i);
                } catch (Throwable first) {
                    try {
                        activity.startActivity(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS));
                    } catch (Throwable ignored) {
                    }
                }
            }
        });
    }

    /** Kullanım kayıtlarını veritabanına aktarır. Dönüş: eklenen kayıt sayısı; izin yoksa -1; hata olursa -2. */
    @JavascriptInterface
    public int sync() {
        try {
            return UsageSync.sync(app);
        } catch (Throwable t) {
            return -2;
        }
    }

    @JavascriptInterface
    public void skipToNow() {
        UsageSync.skipToNow(app);
    }

    @JavascriptInterface
    public String queryEvents(double start, double end) {
        try {
            return Store.get(app).queryEventsJson(start, end);
        } catch (Throwable t) {
            return "[]";
        }
    }

    @JavascriptInterface
    public String apps() {
        try {
            return Store.get(app).appsJson();
        } catch (Throwable t) {
            return "{}";
        }
    }

    @JavascriptInterface
    public double countEvents() {
        return Store.get(app).countEvents();
    }

    @JavascriptInterface
    public double countOlderThan(double days) {
        return Store.get(app).countOlderThan(System.currentTimeMillis() / 1000.0 - days * 86400.0);
    }

    @JavascriptInterface
    public double deleteOlderThan(double days) {
        if (days < 1) return 0;
        return Store.get(app).deleteOlderThan(System.currentTimeMillis() / 1000.0 - days * 86400.0);
    }

    /** Tüm aktivite geçmişini siler; takip bu andan itibaren sürer. */
    @JavascriptInterface
    public double clearEvents() {
        int n = Store.get(app).clearEvents();
        UsageSync.skipToNow(app);
        return n;
    }

    /** Hariç tutulan paketler (JSON dizi): kaydedilmez, geçmiş kayıtları da silinir. */
    @JavascriptInterface
    public void setExcluded(String json) {
        try {
            JSONArray arr = new JSONArray(json);
            Store store = Store.get(app);
            store.setMeta("excluded", arr.toString());
            for (int i = 0; i < arr.length(); i++) store.deleteApp(arr.getString(i));
        } catch (Throwable ignored) {
        }
    }

    @JavascriptInterface
    public String sha512Hex(String hex) {
        try {
            byte[] data = new byte[hex.length() / 2];
            for (int i = 0; i < data.length; i++) data[i] = (byte) Integer.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
            byte[] digest = MessageDigest.getInstance("SHA-512").digest(data);
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) sb.append(Character.forDigit((b >> 4) & 15, 16)).append(Character.forDigit(b & 15, 16));
            return sb.toString();
        } catch (Throwable t) {
            return "";
        }
    }

    // ------------------------------------------------------------------ bildirim / alarm

    @JavascriptInterface
    public void requestNotifications() {
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                activity.askNotificationPermission();
            }
        });
    }

    @JavascriptInterface
    public void notify(String title, String text) {
        Notifier.show(app, 90, title, text);
    }

    private PendingIntent alarmIntent(int slot, String title, String text) {
        Intent i = new Intent(app, AlarmReceiver.class);
        i.setAction("com.spyapp.mobile.ALARM_" + slot);
        i.putExtra("id", ALARM_BASE + slot);
        if (title != null) i.putExtra("title", title);
        if (text != null) i.putExtra("text", text);
        return PendingIntent.getBroadcast(app, ALARM_BASE + slot, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** slot: 0..15. atMs anında bildirim gösterir (uygulama kapalı olsa da). */
    @JavascriptInterface
    public void scheduleAlarm(int slot, double atMs, String title, String text) {
        if (slot < 0 || slot >= ALARM_SLOTS) return;
        AlarmManager am = (AlarmManager) app.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pi = alarmIntent(slot, title, text);
        long at = (long) atMs;
        try {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        } catch (Throwable noExactPermission) {
            try {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            } catch (Throwable ignored) {
            }
        }
    }

    @JavascriptInterface
    public void cancelAlarms() {
        AlarmManager am = (AlarmManager) app.getSystemService(Context.ALARM_SERVICE);
        for (int slot = 0; slot < ALARM_SLOTS; slot++) {
            try {
                am.cancel(alarmIntent(slot, null, null));
            } catch (Throwable ignored) {
            }
        }
    }

    @JavascriptInterface
    public void vibrate(int ms) {
        try {
            Vibrator v = (Vibrator) app.getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null) v.vibrate(Math.max(1, Math.min(ms, 2000)));
        } catch (Throwable ignored) {
        }
    }

    // ------------------------------------------------------------------ dosya

    /** Kullanıcıya kayıt yeri sordurup metni yazar. Sonuç: window.onSpySaved(true|false). */
    @JavascriptInterface
    public void saveFile(final String name, final String mime, final String content) {
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                activity.startSave(name, mime, content);
            }
        });
    }

    /** Kullanıcıya dosya seçtirir. Sonuç: window.onSpyFile(metin | null). */
    @JavascriptInterface
    public void pickFile() {
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                activity.startPick();
            }
        });
    }

    @JavascriptInterface
    public void openUrl(final String url) {
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                activity.openExternal(url);
            }
        });
    }
}
