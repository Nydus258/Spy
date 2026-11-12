package com.spyapp.mobile;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Android kullanım olaylarını (uygulama öne geldi / arkaya gitti / ekran kapandı) "şu uygulama şu aralıkta açıktı"
 * kayıtlarına çevirir. Masaüstü Spy'daki TrackerCore'un telefon karşılığıdır; Android'e bağımlı değildir (JVM'de test edilir).
 */
public final class SessionBuilder {
    // UsageEvents.Event sabitleri (API düzeyinden bağımsız olsun diye sayı olarak).
    public static final int RESUMED = 1;
    public static final int PAUSED = 2;
    public static final int SCREEN_NON_INTERACTIVE = 16;
    public static final int KEYGUARD_SHOWN = 17;
    public static final int DEVICE_SHUTDOWN = 26;
    public static final int DEVICE_STARTUP = 27;

    /** Aynı uygulama bu süre içinde yeniden öne gelirse (ekranlar arası geçiş) kayıt bölünmez. */
    static final long SAME_APP_GAP_MS = 10000;
    /** Bundan kısa görünmeler (geçiş animasyonları) kaydedilmez. */
    static final long MIN_MS = 1000;

    public static final class Session {
        public final String pkg;
        public final long start;
        public final long end;
        /** Senkron anında hâlâ öndeydi: bir sonraki senkronda yeniden kurulur. */
        public final boolean open;

        Session(String pkg, long start, long end, boolean open) {
            this.pkg = pkg;
            this.start = start;
            this.end = end;
            this.open = open;
        }
    }

    private final List<Session> out = new ArrayList<Session>();
    /** Öndeki uygulamanın o an açık (resumed) ekranları: biri kapanırken diğeri açıksa uygulama hâlâ öndedir. */
    private final Set<String> resumed = new HashSet<String>();
    private String curPkg;
    private long curStart;
    private long pausedAt;
    private long lastTs;

    public void add(int type, String pkg, long ts) {
        add(type, pkg, "", ts);
    }

    /** cls: olayın ait olduğu ekran (Activity) sınıfı; bilinmiyorsa "". */
    public void add(int type, String pkg, String cls, long ts) {
        if (ts < lastTs) ts = lastTs;
        if (cls == null) cls = "";
        switch (type) {
            case RESUMED:
                if (pkg == null) break;
                if (curPkg != null) {
                    if (curPkg.equals(pkg) && (pausedAt == 0 || ts - pausedAt <= SAME_APP_GAP_MS)) {
                        pausedAt = 0;
                        resumed.add(cls);
                        break;
                    }
                    close(pausedAt > 0 ? pausedAt : ts);
                }
                curPkg = pkg;
                curStart = ts;
                pausedAt = 0;
                resumed.add(cls);
                break;
            case PAUSED:
                if (curPkg != null && curPkg.equals(pkg)) {
                    resumed.remove(cls);
                    if (resumed.isEmpty() && pausedAt == 0) pausedAt = ts;
                }
                break;
            case SCREEN_NON_INTERACTIVE:
            case KEYGUARD_SHOWN:
            case DEVICE_SHUTDOWN:
                if (curPkg != null) close(pausedAt > 0 ? pausedAt : ts);
                break;
            case DEVICE_STARTUP:
                // Kapanış olayı yazılamadan kapanmış (pil bitti vb.): son görülen ana kadar say.
                if (curPkg != null) close(pausedAt > 0 ? pausedAt : lastTs);
                break;
            default:
                break;
        }
        lastTs = ts;
    }

    private void close(long end) {
        if (end - curStart >= MIN_MS) out.add(new Session(curPkg, curStart, end, false));
        curPkg = null;
        pausedAt = 0;
        resumed.clear();
    }

    /** Olaylar bitti. Hâlâ önde olan uygulama `now` anına kadar "açık" kayıt olarak eklenir. */
    public List<Session> finish(long now) {
        if (curPkg != null) {
            if (pausedAt > 0) {
                close(pausedAt);
            } else {
                if (now - curStart >= MIN_MS) out.add(new Session(curPkg, curStart, now, true));
                openStart = curStart;
                curPkg = null;
            }
        }
        return out;
    }

    private long openStart;

    /** Açık kaydın başlangıcı (yoksa 0): bir sonraki senkron buradan başlar. */
    public long openStart() {
        return openStart;
    }
}
