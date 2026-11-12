# Spy · iPhone önizlemesi

Android uygulamasının aynı arayüzü (`android/assets/www`) bir iPhone kabuğunda (SwiftUI + WKWebView) çalışır.

**Sınırlar:** iPhone, başka uygulamaların kullanımını okumaya izin vermez (Apple'ın Ekran Süresi API'si özel izin ister ve
ham veri vermez). Bu yüzden uygulamadaki **kullanım verileri örnektir**; **odak oturumu, Pomodoro (bildirimli), Spy gözü,
sesler ve dışa aktarma gerçekten çalışır**. Mağaza sürümü değil, deneme paketidir.

## .ipa nasıl üretilir
GitHub → **Actions → "iOS .ipa (imzasız)" → Run workflow** (ya da `ios/` ya da `android/assets/www/` değişince otomatik).
Bittiğinde çalışmanın altındaki **Artifacts → Spy-ios-ipa** dosyasını indir; içinden `Spy-1.4.5-ios.ipa` çıkar.

## Telefona kurmak (Windows, Mac gerekmez)
Paket imzasızdır; kendi (ücretsiz) Apple kimliğinle imzalayıp kurarsın. İmza **7 gün** geçerlidir, sonra yeniden kurulur.
1. Bilgisayara **iTunes** ve **iCloud**'u Apple'ın sitesinden (Microsoft Store sürümü değil) kur.
2. **Sideloadly**'yi (sideloadly.io) kur ve aç.
3. iPhone'u kabloyla bağla, telefonda "Bu bilgisayara güven"e dokun.
4. Sideloadly'de `.ipa` dosyasını sürükle, Apple kimliğini (e-posta) yaz, **Start**'a bas, parolayı gir.
5. iPhone: **Ayarlar → Genel → VPN ve Aygıt Yönetimi** → Apple kimliğine dokun → **Güven**.
6. iPhone'da Ayarlar → Gizlilik ve Güvenlik → **Geliştirici Modu**'nu aç (iOS 16+; telefon yeniden başlar).
7. Spy'ı aç.

(Alternatif: AltStore.) Mac'in varsa `ios/` klasöründe `brew install xcodegen && xcodegen generate` ile Xcode projesi üretilir.

## Yapı
- `project.yml` — XcodeGen proje tanımı (Xcode dosyası depoda tutulmaz)
- `Sources/` — `SpyApp.swift` (uygulama), `WebContainer.swift` (WKWebView, bildirim, titreşim, paylaşma köprüsü)
- `Resources/` — simge
