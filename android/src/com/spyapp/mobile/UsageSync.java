package com.spyapp.mobile;

import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.os.Build;
import android.os.Process;

import org.json.JSONArray;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Android'in kullanım kayıtlarını (Kullanım erişimi izni) Spy veritabanına aktarır. Arka plan servisi gerekmez. */
public final class UsageSync {
    /** İlk açılışta geriye dönük okunacak süre (Android olayları yaklaşık bu kadar saklar). */
    static final long FIRST_LOOKBACK_MS = 10L * 24 * 3600 * 1000;

    private UsageSync() {
    }

    public static boolean hasAccess(Context context) {
        try {
            AppOpsManager ops = (AppOpsManager) context.getSystemService(Context.APP_OPS_SERVICE);
            int mode = ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.getPackageName());
            if (mode == AppOpsManager.MODE_DEFAULT) {
                return context.checkCallingOrSelfPermission("android.permission.PACKAGE_USAGE_STATS") == PackageManager.PERMISSION_GRANTED;
            }
            return mode == AppOpsManager.MODE_ALLOWED;
        } catch (Throwable t) {
            return false;
        }
    }

    /** Dönüş: eklenen kayıt sayısı; izin yoksa -1. */
    public static synchronized int sync(Context context) {
        if (!hasAccess(context)) return -1;
        Store store = Store.get(context);
        long now = System.currentTimeMillis();
        long cursor;
        try {
            cursor = Long.parseLong(store.getMeta("cursor", "0"));
        } catch (NumberFormatException e) {
            cursor = 0;
        }
        if (cursor <= 0 || cursor > now) cursor = now - FIRST_LOOKBACK_MS;

        Set<String> excluded = new HashSet<String>();
        try {
            JSONArray arr = new JSONArray(store.getMeta("excluded", "[]"));
            for (int i = 0; i < arr.length(); i++) excluded.add(arr.getString(i));
        } catch (Exception ignored) {
        }

        UsageStatsManager usm = (UsageStatsManager) context.getSystemService(Context.USAGE_STATS_SERVICE);
        UsageEvents events = usm.queryEvents(cursor, now);
        SessionBuilder builder = new SessionBuilder();
        if (events != null) {
            UsageEvents.Event e = new UsageEvents.Event();
            while (events.hasNextEvent()) {
                events.getNextEvent(e);
                builder.add(e.getEventType(), e.getPackageName(), e.getClassName(), e.getTimeStamp());
            }
        }
        List<SessionBuilder.Session> sessions = builder.finish(now);
        if (!excluded.isEmpty()) {
            for (int i = sessions.size() - 1; i >= 0; i--) {
                if (excluded.contains(sessions.get(i).pkg)) sessions.remove(i);
            }
        }
        int added = store.replaceTail(cursor, sessions);
        long next = builder.openStart() > 0 ? builder.openStart() : now;
        store.setMeta("cursor", Long.toString(next));
        refreshApps(context, store);
        return added;
    }

    /** Takip yeniden açıldığında: kapalı geçen süre kaydedilmesin. */
    public static synchronized void skipToNow(Context context) {
        Store.get(context).setMeta("cursor", Long.toString(System.currentTimeMillis()));
    }

    /** Kayıtlarda geçen her paketin görünen adını ve tür ipucunu günceller. */
    static void refreshApps(Context context, Store store) {
        PackageManager pm = context.getPackageManager();
        Set<String> homes = new HashSet<String>();
        try {
            Intent home = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME);
            for (ResolveInfo info : pm.queryIntentActivities(home, 0)) {
                if (info.activityInfo != null) homes.add(info.activityInfo.packageName);
            }
        } catch (Throwable ignored) {
        }
        for (String pkg : store.distinctApps()) {
            try {
                ApplicationInfo ai = pm.getApplicationInfo(pkg, 0);
                CharSequence label = pm.getApplicationLabel(ai);
                store.putApp(pkg, label == null ? pkg : label.toString(), hintFor(pm, ai, homes.contains(pkg)));
            } catch (Throwable notInstalled) {
                // Kaldırılmış uygulama: daha önce kaydedilen ad korunur.
            }
        }
    }

    private static String hintFor(PackageManager pm, ApplicationInfo ai, boolean isHome) {
        if (isHome) return "launcher";
        int category = -1;
        if (Build.VERSION.SDK_INT >= 26) {
            try {
                category = ApplicationInfo.class.getField("category").getInt(ai);
            } catch (Throwable ignored) {
            }
        }
        if (category == 0 || (ai.flags & ApplicationInfo.FLAG_IS_GAME) != 0) return "game";
        switch (category) {
            case 1:
                return "audio";
            case 2:
                return "video";
            case 4:
                return "social";
            case 5:
                return "news";
            case 6:
                return "maps";
            case 7:
                return "productivity";
            default:
                break;
        }
        if ((ai.flags & ApplicationInfo.FLAG_SYSTEM) != 0 && pm.getLaunchIntentForPackage(ai.packageName) == null) return "system";
        return "";
    }
}
