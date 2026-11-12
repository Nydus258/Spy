import SwiftUI
import UIKit
import WebKit
import UserNotifications

/// Spy'ın arayüzü (android/assets/www ile aynı HTML/JS) bir WKWebView içinde çalışır.
/// iPhone başka uygulamaların kullanımını okutmadığı için veri örnektir (native.js tarayıcı kopyası);
/// bildirim, titreşim, dosya paylaşma ve bağlantı açma Swift tarafına iletilir.
struct WebContainer: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.mediaTypesRequiringUserActionForPlayback = []
        config.allowsInlineMediaPlayback = true
        let controller = WKUserContentController()
        controller.addUserScript(WKUserScript(source: "window.SPY_IOS = true;", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        controller.add(context.coordinator, name: "spy")
        config.userContentController = controller

        let web = WKWebView(frame: .zero, configuration: config)
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 0.11, green: 0.10, blue: 0.31, alpha: 1)
        web.scrollView.backgroundColor = web.backgroundColor
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.navigationDelegate = context.coordinator
        context.coordinator.web = web

        if let www = Bundle.main.url(forResource: "www", withExtension: nil) {
            web.loadFileURL(www.appendingPathComponent("index.html"), allowingReadAccessTo: www)
        }
        NotificationCenter.default.addObserver(context.coordinator, selector: #selector(Coordinator.becameActive),
                                               name: UIApplication.didBecomeActiveNotification, object: nil)
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        weak var web: WKWebView?

        @objc func becameActive() {
            web?.evaluateJavaScript("window.onSpyResume&&window.onSpyResume()", completionHandler: nil)
        }

        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if let url = action.request.url, url.scheme == "http" || url.scheme == "https" || url.scheme == "mailto" {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any], let type = body["t"] as? String else { return }
            let center = UNUserNotificationCenter.current()
            switch type {
            case "permission":
                center.requestAuthorization(options: [.alert, .sound]) { _, _ in }
            case "alarm":
                guard let slot = body["slot"] as? Int else { return }
                let atMs = (body["at"] as? Double) ?? 0
                let delay = max(1, atMs / 1000 - Date().timeIntervalSince1970)
                center.requestAuthorization(options: [.alert, .sound]) { _, _ in }
                let content = UNMutableNotificationContent()
                content.title = (body["title"] as? String) ?? "Spy"
                content.body = (body["text"] as? String) ?? ""
                content.sound = .default
                let trigger = UNTimeIntervalNotificationTrigger(timeInterval: delay, repeats: false)
                center.add(UNNotificationRequest(identifier: "spy.alarm.\(slot)", content: content, trigger: trigger))
            case "cancel":
                center.removeAllPendingNotificationRequests()
            case "notify":
                let content = UNMutableNotificationContent()
                content.title = (body["title"] as? String) ?? "Spy"
                content.body = (body["text"] as? String) ?? ""
                content.sound = .default
                center.add(UNNotificationRequest(identifier: UUID().uuidString, content: content,
                                                 trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)))
            case "haptic":
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            case "open":
                if let s = body["url"] as? String, let url = URL(string: s) { UIApplication.shared.open(url) }
            case "save":
                share(name: (body["name"] as? String) ?? "spy.txt", content: (body["content"] as? String) ?? "")
            default:
                break
            }
        }

        private func share(name: String, content: String) {
            let safe = name.replacingOccurrences(of: "/", with: "_")
            let file = FileManager.default.temporaryDirectory.appendingPathComponent(safe)
            var ok = false
            if (try? content.write(to: file, atomically: true, encoding: .utf8)) != nil {
                ok = true
                DispatchQueue.main.async {
                    let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
                    let root = UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.keyWindow }.first?.rootViewController
                    sheet.popoverPresentationController?.sourceView = root?.view
                    root?.present(sheet, animated: true)
                }
            }
            web?.evaluateJavaScript("window.onSpySaved&&window.onSpySaved(\(ok))", completionHandler: nil)
        }
    }
}
