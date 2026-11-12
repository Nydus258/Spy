import SwiftUI
import UserNotifications

@main
struct SpyApp: App {
    init() {
        UNUserNotificationCenter.current().delegate = NotificationHandler.shared
    }

    var body: some Scene {
        WindowGroup {
            WebContainer()
                .background(Color(red: 0.043, green: 0.059, blue: 0.102).ignoresSafeArea())
                .preferredColorScheme(.dark)
        }
    }
}

/// Uygulama açıkken de bildirimin şerit olarak görünmesini sağlar.
final class NotificationHandler: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationHandler()

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound])
    }
}
