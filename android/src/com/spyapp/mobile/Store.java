package com.spyapp.mobile;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.database.sqlite.SQLiteStatement;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Yerel veritabanı. events/meta/sessions tabloları masaüstü Spy'daki spy_store şemasıyla aynıdır
 * (start/end epoch saniye, app = paket adı); apps tablosu uygulama adlarını saklar (silinen uygulamaların adı kaybolmasın).
 */
public final class Store extends SQLiteOpenHelper {
    private static Store instance;

    public static synchronized Store get(Context context) {
        if (instance == null) instance = new Store(context.getApplicationContext());
        return instance;
    }

    private Store(Context context) {
        super(context, "spy.db", null, 1);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE IF NOT EXISTS events ("
                + "id INTEGER PRIMARY KEY AUTOINCREMENT, start REAL NOT NULL, end REAL NOT NULL, app TEXT NOT NULL,"
                + "title TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '', afk INTEGER NOT NULL DEFAULT 0, side INTEGER NOT NULL DEFAULT 0)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_events_start ON events(start)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_events_end ON events(end)");
        db.execSQL("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)");
        db.execSQL("CREATE TABLE IF NOT EXISTS sessions ("
                + "id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, start REAL NOT NULL, end REAL NOT NULL,"
                + "duration INTEGER NOT NULL, interruptions INTEGER NOT NULL DEFAULT 0)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_sessions_start ON sessions(start)");
        db.execSQL("CREATE TABLE IF NOT EXISTS apps (pkg TEXT PRIMARY KEY, label TEXT NOT NULL DEFAULT '', hint TEXT NOT NULL DEFAULT '')");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
    }

    public synchronized String getMeta(String key, String fallback) {
        Cursor c = getReadableDatabase().rawQuery("SELECT value FROM meta WHERE key=?", new String[]{key});
        try {
            return c.moveToFirst() && !c.isNull(0) ? c.getString(0) : fallback;
        } finally {
            c.close();
        }
    }

    public synchronized void setMeta(String key, String value) {
        ContentValues v = new ContentValues();
        v.put("key", key);
        v.put("value", value);
        getWritableDatabase().insertWithOnConflict("meta", null, v, SQLiteDatabase.CONFLICT_REPLACE);
    }

    /** cursorMs anından sonraki (henüz kesinleşmemiş) kayıtları silip yenilerini yazar. Eklenen satır sayısını döndürür. */
    public synchronized int replaceTail(long cursorMs, List<SessionBuilder.Session> sessions) {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            db.execSQL("DELETE FROM events WHERE start >= ?", new Object[]{cursorMs / 1000.0 - 0.0005});
            SQLiteStatement st = db.compileStatement("INSERT INTO events(start,end,app) VALUES(?,?,?)");
            for (SessionBuilder.Session s : sessions) {
                st.bindDouble(1, s.start / 1000.0);
                st.bindDouble(2, s.end / 1000.0);
                st.bindString(3, s.pkg);
                st.executeInsert();
            }
            st.close();
            db.setTransactionSuccessful();
            return sessions.size();
        } finally {
            db.endTransaction();
        }
    }

    /** [start, end] (epoch sn) ile kesişen kayıtlar: [[start,end,"paket"],...] */
    public synchronized String queryEventsJson(double start, double end) {
        StringBuilder sb = new StringBuilder(4096);
        sb.append('[');
        Cursor c = getReadableDatabase().rawQuery(
                "SELECT start,end,app FROM events WHERE end > ? AND start < ? AND afk=0 AND side=0 ORDER BY start",
                new String[]{Double.toString(start), Double.toString(end)});
        try {
            boolean first = true;
            while (c.moveToNext()) {
                if (!first) sb.append(',');
                first = false;
                sb.append('[').append(c.getDouble(0)).append(',').append(c.getDouble(1)).append(',')
                        .append(JSONObject.quote(c.getString(2))).append(']');
            }
        } finally {
            c.close();
        }
        return sb.append(']').toString();
    }

    public synchronized List<String> distinctApps() {
        List<String> out = new ArrayList<String>();
        Cursor c = getReadableDatabase().rawQuery("SELECT DISTINCT app FROM events", null);
        try {
            while (c.moveToNext()) out.add(c.getString(0));
        } finally {
            c.close();
        }
        return out;
    }

    public synchronized void putApp(String pkg, String label, String hint) {
        ContentValues v = new ContentValues();
        v.put("pkg", pkg);
        v.put("label", label);
        v.put("hint", hint);
        getWritableDatabase().insertWithOnConflict("apps", null, v, SQLiteDatabase.CONFLICT_REPLACE);
    }

    /** {"paket": {"l": ad, "h": ipucu}} */
    public synchronized String appsJson() {
        JSONObject root = new JSONObject();
        Cursor c = getReadableDatabase().rawQuery("SELECT pkg,label,hint FROM apps", null);
        try {
            while (c.moveToNext()) {
                JSONObject o = new JSONObject();
                o.put("l", c.getString(1));
                o.put("h", c.getString(2));
                root.put(c.getString(0), o);
            }
        } catch (Exception ignored) {
        } finally {
            c.close();
        }
        return root.toString();
    }

    private long scalar(String sql, String[] args) {
        Cursor c = getReadableDatabase().rawQuery(sql, args);
        try {
            return c.moveToFirst() ? c.getLong(0) : 0;
        } finally {
            c.close();
        }
    }

    public synchronized long countEvents() {
        return scalar("SELECT COUNT(*) FROM events", null);
    }

    public synchronized long countOlderThan(double cutoff) {
        return scalar("SELECT COUNT(*) FROM events WHERE end < ?", new String[]{Double.toString(cutoff)});
    }

    public synchronized int deleteOlderThan(double cutoff) {
        return getWritableDatabase().delete("events", "end < ?", new String[]{Double.toString(cutoff)});
    }

    public synchronized int clearEvents() {
        return getWritableDatabase().delete("events", "1", null);
    }

    public synchronized int deleteApp(String pkg) {
        return getWritableDatabase().delete("events", "app = ?", new String[]{pkg});
    }
}
