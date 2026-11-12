import com.spyapp.mobile.SessionBuilder;
import com.spyapp.mobile.SessionBuilder.Session;

import java.util.List;

/** SessionBuilder testleri (Android gerektirmez): bash tests/run_java_tests.sh */
public class SessionBuilderTest {
    static int passed;

    static void eq(Object got, Object want, String what) {
        if (!String.valueOf(got).equals(String.valueOf(want))) throw new AssertionError(what + ": beklenen " + want + ", gelen " + got);
    }

    static String dump(List<Session> list) {
        StringBuilder sb = new StringBuilder();
        for (Session s : list) sb.append(s.pkg).append(':').append(s.start / 1000).append('-').append(s.end / 1000).append(s.open ? "*" : "").append(' ');
        return sb.toString().trim();
    }

    static final int R = SessionBuilder.RESUMED, P = SessionBuilder.PAUSED, OFF = SessionBuilder.SCREEN_NON_INTERACTIVE,
            LOCK = SessionBuilder.KEYGUARD_SHOWN, DOWN = SessionBuilder.DEVICE_SHUTDOWN, UP = SessionBuilder.DEVICE_STARTUP;

    static long s(long seconds) {
        return seconds * 1000;
    }

    public static void main(String[] args) {
        // 1) Uygulamalar arası geçiş: A -> ana ekran -> B, sonra ekran kapanır.
        SessionBuilder b = new SessionBuilder();
        b.add(R, "a", s(100)); b.add(P, "a", s(160)); b.add(R, "home", s(160)); b.add(P, "home", s(163));
        b.add(R, "b", s(163)); b.add(P, "b", s(300)); b.add(OFF, null, s(300)); b.add(LOCK, null, s(300));
        eq(dump(b.finish(s(999))), "a:100-160 home:160-163 b:163-300", "temel akış");
        eq(b.openStart(), 0L, "açık kayıt yok");
        passed++;

        // 2) Aynı uygulamanın ekranları arasında geçiş kaydı bölmez (pause -> hemen resume).
        b = new SessionBuilder();
        b.add(R, "a", s(10)); b.add(P, "a", s(20)); b.add(R, "a", s(20)); b.add(P, "a", s(50)); b.add(R, "a", s(51)); b.add(P, "a", s(90)); b.add(R, "b", s(90));
        eq(dump(b.finish(s(120))), "a:10-90 b:90-120*", "aynı uygulama birleşir + açık kayıt");
        eq(b.openStart(), s(90), "açık kaydın başlangıcı");
        passed++;

        // 3) Aynı uygulama uzun aradan sonra dönerse iki ayrı kayıt olur; ara sayılmaz.
        b = new SessionBuilder();
        b.add(R, "a", s(10)); b.add(P, "a", s(20)); b.add(R, "a", s(500)); b.add(P, "a", s(560));
        eq(dump(b.finish(s(900))), "a:10-20 a:500-560", "uzun ara");
        passed++;

        // 4) Pause gelmeden ekran kapanırsa kapanma anına kadar sayılır; ekran açılınca yeniden başlar.
        b = new SessionBuilder();
        b.add(R, "video", s(0)); b.add(OFF, null, s(3600)); b.add(R, "video", s(7200)); b.add(DOWN, null, s(7260));
        eq(dump(b.finish(s(9999))), "video:0-3600 video:7200-7260", "ekran kapanması / kapatma");
        passed++;

        // 5) Kapanış yazılamadan yeniden başlatma: son görülen olaya kadar sayılır (gece boyu şişmez).
        b = new SessionBuilder();
        b.add(R, "a", s(0)); b.add(P, "a", s(5)); b.add(R, "b", s(5)); b.add(UP, null, s(50000)); b.add(R, "home", s(50010));
        eq(dump(b.finish(s(50020))), "a:0-5 home:50010-50020*", "1 sn'den kısa kalan b atılır, açılış sonrası yeni kayıt");
        passed++;

        // 6) 1 saniyeden kısa görünmeler atılır; zaman geri giderse düzeltilir.
        b = new SessionBuilder();
        b.add(R, "a", s(10)); b.add(R, "flash", 10400); b.add(R, "c", 10900); b.add(P, "c", s(5)); b.add(R, "d", s(40));
        eq(dump(b.finish(s(40))), "", "kısa görünmeler ve geri giden zaman damgası kayıt üretmez");
        eq(b.openStart(), s(40), "çok kısa açık kayıt da bir sonraki senkronun başlangıcıdır");
        passed++;

        // 7) Artımlı senkron: açık kaydın başından yeniden okununca aynı sonuç çıkar.
        b = new SessionBuilder();
        b.add(R, "a", s(90)); b.add(P, "a", s(130)); b.add(R, "spy", s(130));
        eq(dump(b.finish(s(200))), "a:90-130 spy:130-200*", "ikinci senkron");
        passed++;

        // 8) Boş girdi.
        b = new SessionBuilder();
        eq(b.finish(s(1)).size(), 0, "boş");
        b = new SessionBuilder();
        b.add(P, "x", s(1)); b.add(OFF, null, s(2)); b.add(R, null, s(3));
        eq(b.finish(s(9)).size(), 0, "yalnızca pause/ekran olayları");
        passed++;

        // 9) Aynı uygulamanın bir ekranı kapanırken diğeri açıksa (üst üste ekranlar) uygulama önde sayılır.
        b = new SessionBuilder();
        b.add(R, "a", "Main", s(0)); b.add(R, "a", "Dialog", s(10)); b.add(P, "a", "Main", s(11)); b.add(R, "b", "X", s(300)); b.add(P, "a", "Dialog", s(301));
        eq(dump(b.finish(s(400))), "a:0-300 b:300-400*", "üst üste ekranlar");
        passed++;

        System.out.println(passed + " SessionBuilder testi geçti.");
    }
}
