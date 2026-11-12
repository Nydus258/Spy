# Spy: Odak ve Ekran Süresi · Google Play yayın rehberi

Bu klasördeki her şey Play Console'a girilecek haliyle hazır. Sıra: 1 → 10.

## Hazır olanlar (bu depoda)

| Ne | Nerede |
|---|---|
| Yüklenecek paket (imzalı AAB) | `android/dist/Spy-1.4.5-play.aab` |
| Uygulama içi satın alma kodu | `src/com/spyapp/mobile/PlayBilling.java` (ürün kimliği: `spy_pro`) |
| Mağaza metinleri | `store/listing-tr.md`, `store/listing-en.md` |
| Simge 512×512 | `store/graphics/icon-512.png` |
| Öne çıkan görsel 1024×500 | `store/graphics/tr/feature-1024x500.png`, `store/graphics/en/…` |
| Telefon ekran görüntüleri 1080×1920 (6 adet/dil) | `store/graphics/tr/phone-*.png`, `store/graphics/en/phone-*.png` |
| Gizlilik politikası sayfası | `privacy.html` → https://nydus258.github.io/Spy/privacy.html (**bu dal `main`'e birleşince yayında olur**) |

**Yükleme anahtarı:** AAB, `spy-upload.jks` ile imzalı (anahtar bilgileri sana ayrıca verildi). Bu dosyayı ve parolasını yedekle, depoya koyma. Play Uygulama İmzalama açıkken asıl imza anahtarını Google saklar; yükleme anahtarını kaybedersen Google desteği sıfırlayabilir.

---

## 1. Geliştirici hesabı
1. https://play.google.com/console → Google hesabınla giriş.
2. **Kişisel** ya da **Kuruluş** hesabı seç. 25 $ tek seferlik kayıt ücreti, kimlik doğrulaması (birkaç gün sürebilir).
3. **Kişisel hesapsa** yayından önce *kapalı testte en az 12 test kullanıcısıyla 14 gün* kesintisiz test şartı vardır (Console'da "Production access" bölümünde görürsün). Kuruluş hesabında yok, ama D-U-N-S numarası ister.

## 2. Ödeme profili (ücretli satış için şart)
Console → **Ödeme profili**: vergi, banka ve adres bilgisi. Türkiye'den satış için vergi mükellefiyeti gerekebilir; **mali müşavire danış**. Komisyon genelde ilk 1 milyon $ gelire kadar %15.

## 3. Uygulamayı oluştur
**Uygulama oluştur** → Ad: `Spy: Odak ve Ekran Süresi` · Varsayılan dil: Türkçe · **Uygulama** · **Ücretsiz** (satın alma uygulama içi olacak; ücretsizden ücretliye sonradan geçilemez) · Politika onay kutuları.

## 4. Paketi yükle
**Test et ve yayınla → Dahili test → Yeni sürüm oluştur** → `Spy-1.4.5-play.aab` dosyasını sürükle. "Play Uygulama İmzalama"ya **kayıt ol/devam** de. Sürüm notunu `listing-tr.md`'den yapıştır.
Her yeni sürümde `build.gradle` içindeki `spyVersionCode` değerini artır.

## 5. Uygulama içi ürün (Spy Pro)
**Para kazanma → Ürünler → Uygulama içi ürünler (tek seferlik) → Ürün oluştur**
- Ürün kimliği: **`spy_pro`** (kodla birebir aynı olmalı, sonradan değişmez)
- Ad: `Spy Pro` · Açıklama: `Sınırsız takip ve tüm özellikler. Tek seferlik ödeme.`
- Satın alma seçeneği: **Satın al**, fiyat: **149,99 TRY**; "Fiyatları diğer ülkelere uygula" ile ABD için **4,99 USD** (ülke başına düzenleyebilirsin).
- **Etkinleştir.** (Etkin olmayan ürün uygulamada görünmez.)

## 6. Mağaza girdisi
**Büyüme → Mağaza varlığı → Ana mağaza girdisi**
- Türkçe (varsayılan): ad, kısa ve tam açıklama → `store/listing-tr.md`
- **Çeviri ekle → İngilizce**: `store/listing-en.md`
- Simge: `icon-512.png` · Öne çıkan görsel: `tr/feature-1024x500.png` (İngilizce girdide `en/…`)
- Telefon ekran görüntüleri: `phone-1…6` (en az 2, en çok 8)
- Kategori: **Üretkenlik** · E-posta: spyisletme@gmail.com · Web sitesi: https://nydus258.github.io/Spy/
- Gizlilik politikası URL'si: **https://nydus258.github.io/Spy/privacy.html** (sayfa yayında olmadan Console bunu kabul etmeyebilir: önce dalı `main`'e birleştir)

## 7. Uygulama içeriği formları (Politika → Uygulama içeriği)
| Form | Cevap |
|---|---|
| Gizlilik politikası | yukarıdaki URL |
| Reklamlar | **Hayır**, reklam yok |
| Uygulama erişimi | Tüm işlevler hesap gerektirmeden kullanılabilir. Not: *"Takip için Android Ayarları > Kullanım erişimi'nde Spy'a izin verilmeli (uygulama ilk açılışta yönlendirir)."* |
| İçerik derecelendirme (IARC) | Kategori: *Yardımcı program / Üretkenlik*. Şiddet, cinsellik, kumar, uyuşturucu, kullanıcı etkileşimi, konum paylaşımı: hepsi **Hayır** → "Herkes" |
| Hedef kitle | **18 ve üzeri** (Aile Politikası kapsamına girmemek için) |
| Veri güvenliği | "Veri topluyor veya paylaşıyor musunuz?" → **Hayır** (veriler cihazdan çıkmaz, internet izni yok). Satın alma Google Play'de işlenir; ayrıca beyan gerekmez. |
| Haber uygulaması / COVID / Devlet / Finans / Sağlık | **Hayır** |
| Reklam kimliği | **Hayır** (kullanmıyor) |

## 8. Hassas izin beyanı: Kullanım erişimi (PACKAGE_USAGE_STATS)
Console → Uygulama içeriği → **Hassas uygulama izinleri**. Kullanım gerekçesi (İngilizce yapıştır):

> Spy is a personal screen-time and focus tracker. Its core functionality is to show the user how long they have used each app on their own device. It reads foreground-app usage events through UsageStatsManager (PACKAGE_USAGE_STATS) solely to build the user's own usage overview, category breakdown, timeline and focus-session score. The permission is granted manually by the user in Android Settings > Usage access after an in-app explanation, and can be revoked at any time. The data is stored only on the device; the app declares no INTERNET permission, has no ads or analytics, and shares nothing with anyone. The app is visible, has no hidden mode or remote access, and is not designed to monitor other people.

**Tanıtım videosu** (Console isteyebilir; YouTube'a "listelenmemiş" yükle, ~30 sn, telefon ekran kaydı):
1. Spy'ı aç → karşılama ekranındaki "İzni aç" düğmesine bas.
2. Android'in Kullanım erişimi listesinde Spy'ı aç → geri dön.
3. Genel, Analiz ve Odak sayfalarında kendi kullanımının görüntülendiğini göster.

## 9. Test, sonra üretim
1. **Dahili test**: kendi e-postanı test kullanıcısı yap, bağlantıdan yükle. Satın almayı dene: **Ayarlar → Lisans testi**'ne e-postanı ekle (kart çekilmez, "test kartı" seçeneği çıkar).
2. Kişisel hesapsa **Kapalı test**: 12+ kişiyi ekle, 14 gün bekle, ardından "Üretim erişimi için başvur".
3. **Üretim** → sürümü oluştur → incelemeye gönder. İlk inceleme birkaç günden bir haftaya sürebilir.
4. Test sırasında şunları kontrol et: karşılama → izin → veri geliyor mu, Pomodoro bildirimi, satın alma sonrası kilit açılıyor mu, Play yokken uyarı.

## 10. İncelemede takılırsa
- **Ad "Spy"**: Play, gizli takip yazılımlarına (stalkerware) sert bakar. Mağaza açıklamasındaki "yalnızca kendi telefonunu gösterir, gizli çalışmaz" cümlesi ve gizlilik politikası bunun için var. Yine de reddedilirse ad `Odak ve Ekran Süresi` gibi "Spy" içermeyen bir adla yeniden gönderilebilir (kodda değişiklik gerekmez; yalnızca mağaza adı ve `strings.xml`).
- **Kullanım erişimi reddi**: Bölüm 8'deki gerekçe + video ile yeniden gönder.
- **Satın alma ürünü görünmüyor**: `spy_pro` etkin mi, uygulama Play'den (dahili test bağlantısından) mi kuruldu, sürüm kodu yüklenenle aynı mı?

## Bilmen gerekenler
- Play'den kurulan sürüm farklı imzalı olduğu için telefonundaki mevcut (elle kurulmuş) Spy'ın **üzerine kurulmaz**; önce eskisini kaldır (kayıtlar silinir).
- Lisans anahtarı girişi bu sürümde yoktur: Play kuralları, uygulama içinden Play dışı ödemeyi yasaklar. Masaüstü sürümünün anahtarları masaüstünde çalışmaya devam eder.
- Fiyat önerisi: Türkiye 149,99 ₺ · ABD 4,99 $ (tek seferlik). Lansmanda 2 hafta 99,99 ₺ indirim deneyebilirsin.
