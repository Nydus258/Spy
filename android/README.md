# Spy Mobile (Android)

Masaüstü **Spy 1.4.5**'in telefon sürümü. Hangi uygulamada ne kadar zaman geçirdiğini telefonda kaydeder ve gösterir;
veriler telefonda kalır (uygulamanın internet izni yoktur).

Hazır paket: [`dist/Spy-1.4.5.apk`](dist/Spy-1.4.5.apk) — Android 6.0 ve üzeri.

## Kurulum (telefonda)

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
| 3 günlük deneme + Ed25519 lisans anahtarı | Aynı açık anahtar: masaüstü anahtarları telefonda da geçerli |
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

```sh
apt-get install aapt apksigner zipalign dalvik-exchange android-sdk-platform-23   # + JDK, python3, node
./build.sh                       # dist/Spy-<sürüm>.apk
node tests/core.test.js          # çekirdek (masaüstü referans değerleriyle karşılaştırır)
bash tests/run_java_tests.sh     # kullanım kaydı kurucu
node tests/ui.test.js            # arayüz (Playwright + Chromium gerekir)
```

Arayüzü bilgisayarda görmek için `assets/www/index.html` dosyasını tarayıcıda açmak yeterli (örnek veriyle çalışır).

### İmza

`build.sh`, `SPY_KEYSTORE` / `SPY_KEY_ALIAS` / `SPY_KEYSTORE_PASS` verilmezse yerel bir deneme anahtarıyla imzalar.
Depodaki APK böyle bir deneme anahtarıyla imzalıdır. Dağıtım için kendi anahtarınla yeniden derle: farklı anahtarla
imzalı bir sürüm eskisinin üzerine kurulamaz (önce eskisini kaldırmak gerekir, kayıtlar silinir).
