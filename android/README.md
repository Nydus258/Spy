# Spy: Odak ve Ekran Süresi (Android)

Masaüstü **Spy 1.4.5**'in telefon sürümü. Hangi uygulamada ne kadar zaman geçirdiğini telefonda kaydeder ve gösterir;
veriler telefonda kalır (uygulamanın internet izni yoktur).

Android 6.0 ve üzeri. **Google Play sürümü:** [`dist/Spy-1.4.5-play.aab`](dist/Spy-1.4.5-play.aab) — yayın adımları için
[`store/YAYIN-REHBERI.md`](store/YAYIN-REHBERI.md). Play sürümünde Spy Pro tek seferlik Google Play satın alımıdır
(lisans anahtarı girişi yoktur). `dist/Spy-1.4.5.apk`, Play öncesi elle kurulan eski deneme sürümüdür (lisans anahtarlı).

## Kurulum (telefonda, eski deneme APK'sı)

1. `dist/Spy-1.4.5.apk` dosyasını telefona indir ve aç; "bilinmeyen kaynaklardan yükleme" izni istenirse onayla.
2. Spy'ı aç, **İzni aç**'a dokun ve açılan listede Spy için **Kullanım erişimi**'ni etkinleştir.
3. Spy'a dön. Android son günlerin kullanım kayıtlarını sakladığı için ekranlar hemen dolar.

## Masaüstünden ne taşındı?

| Masaüstü (Windows) | Telefon (Android) |
| --- | --- |
| Ön plandaki pencereyi izleyen takipçi | Android "Kullanım erişimi" kayıtları (arka plan servisi yok, pil harcamaz) |
| Genel, Analiz, Timeline, Odak, Spy, Yönetim, Ayarlar | Aynı sayfalar, telefon düzeninde |
| Kategoriler ve kural veritabanı (v1.8) | Aynı kategoriler; kurallar Android paket adlarına uyarlandı |
| Odak skoru, kesinti tanımı, Pomodoro (4 tur) | Aynı formül ve durum makinesi |
| Spy sohbeti ve yerel analiz | Aynı sorular ve cevap mantığı |
| 3 günlük deneme + lisans | 3 günlük deneme aynı; satın alma Google Play (Spy Pro, tek seferlik) |
| 8 dil | Türkçe ve İngilizce |

Telefonda olmayanlar: tarayıcı adresi/sekme başlığı okuma (Android buna izin vermez; tarayıcılar "Potansiyel" sayılır),
yan yana pencere takibi, PDF raporu, odak oturumunda anlık kesinti bildirimi (kesintiler uygulamaya dönünce hesaplanır).

## Yapı

- `assets/www/` — arayüz ve mantık (HTML/CSS/JS, bağımlılık yok)
  - `core.js` — kategoriler, toplama, odak, Pomodoro, Spy cevapları, lisans (Node ile test edilir)
  - `app.js` — sayfalar; `native.js` — Java köprüsü (tarayıcıda açılırsa örnek veriyle çalışır)
  - `data.js` — `tools/gen_data.py` üretir (kurallar + İngilizce metinler)
- `src/com/spyapp/mobile/` — Android katmanı (WebView, kullanım kayıtları, SQLite, alarmlar)
- `tools/` — masaüstünden alınan kural veritabanı ve çeviri tablosu
- `tests/` — çekirdek, oturum kurucu ve arayüz testleri

## Derleme

Gradle projesidir (Android Studio bu klasörü doğrudan açabilir). Komut satırında:

```sh
# JDK 17+, Android SDK (platforms;android-36, build-tools;36.0.0), python3, node
export ANDROID_HOME=~/android-sdk
export SPY_UPLOAD_KEYSTORE=~/.spy-mobile/spy-upload.jks SPY_UPLOAD_ALIAS=upload SPY_UPLOAD_PASS=...
./build.sh                       # testler + dist/Spy-<sürüm>-play.aab (+ .apk)
node tests/core.test.js          # çekirdek (masaüstü referans değerleriyle karşılaştırır)
bash tests/run_java_tests.sh     # kullanım kaydı kurucu
node tests/ui.test.js            # arayüz (Playwright + Chromium gerekir)
node store/make_graphics.js      # mağaza görselleri (store/graphics)
```

Arayüzü bilgisayarda görmek için `assets/www/index.html` dosyasını tarayıcıda açmak yeterli (örnek veriyle çalışır;
`?owned=1`, `?billing=off`, `?billing=pending` ile satın alma durumları denenir).

### İmza

AAB, **yükleme anahtarıyla** imzalanır; Play Uygulama İmzalama, kullanıcılara giden asıl anahtarı Google'da tutar.
Yükleme anahtarını (`*.jks`) ve parolasını depoya koyma, yedekle. Anahtar verilmezse paket imzasız çıkar.
