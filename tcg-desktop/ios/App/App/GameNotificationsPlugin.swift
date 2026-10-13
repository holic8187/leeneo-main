import Foundation
import UIKit
import UserNotifications
import Capacitor

/// Set as the notification delegate before the web view exists so cold-start taps survive.
final class GameNotificationCenter: NSObject, UNUserNotificationCenterDelegate {
    static let shared = GameNotificationCenter()
    let center = UNUserNotificationCenter.current()
    private let defaults = UserDefaults.standard
    private let settingsKey = "hoi.game-notifications.settings"
    private let specsKey = "hoi.game-notifications.specs"
    private let openedKey = "hoi.game-notifications.last-opened"
    private let prefix = "hoi.game."
    var onOpen: (([String: Any]) -> Void)?

    var settings: [String: Any] {
        get { defaults.dictionary(forKey: settingsKey) ?? ["enabled": true, "quietHoursEnabled": false, "quietStartHour": 22, "quietEndHour": 6] }
        set { defaults.set(newValue, forKey: settingsKey) }
    }
    private var specs: [String: [String: Any]] {
        get {
            guard let data = defaults.data(forKey: specsKey),
                  let value = try? JSONSerialization.jsonObject(with: data) as? [String: [String: Any]] else { return [:] }
            return value
        }
        set { defaults.set(try? JSONSerialization.data(withJSONObject: newValue), forKey: specsKey) }
    }

    func install() { center.delegate = self }

    func permission(_ completion: @escaping ([String: Any]) -> Void) {
        center.getNotificationSettings { status in
            let allowed = [.authorized, .provisional, .ephemeral].contains(status.authorizationStatus)
            let display = allowed ? "granted" : status.authorizationStatus == .notDetermined ? "prompt" : "denied"
            DispatchQueue.main.async { completion(["display": display, "granted": allowed]) }
        }
    }

    func schedule(_ spec: [String: Any], completion: @escaping (Bool, Error?) -> Void) {
        guard let id = spec["id"] as? String, let milliseconds = spec["at"] as? Double else {
            completion(false, nil); return
        }
        var records = specs
        // An unchanged notification already delivered by iOS must never reappear on resume.
        if let previous = records[id], let delivery = previous["deliveryAt"] as? Double,
           delivery <= Date().timeIntervalSince1970 * 1000,
           previous["at"] as? Double == milliseconds {
            completion(false, nil); return
        }
        let previousRequest = records[id]?["requestIdentifier"] as? String ?? prefix + id
        var submission = spec
        // Each replacement gets its own native identifier. A late native callback
        // can then remove only its stale request, never a newer quiet-hours schedule.
        let requestIdentifier = prefix + id + "." + UUID().uuidString
        submission["requestIdentifier"] = requestIdentifier
        records[id] = submission
        specs = records
        center.removePendingNotificationRequests(withIdentifiers: [previousRequest])
        guard settings["enabled"] as? Bool ?? true else { completion(false, nil); return }
        permission { status in
            guard status["granted"] as? Bool == true else { completion(false, nil); return }
            self.submit(submission, completion: completion)
        }
    }

    private func submit(_ spec: [String: Any], completion: @escaping (Bool, Error?) -> Void) {
        guard let id = spec["id"] as? String, let at = spec["at"] as? Double,
              let requestIdentifier = spec["requestIdentifier"] as? String else { completion(false, nil); return }
        // A permission callback may arrive after logout, disable or rescheduling.
        guard specs[id]?["requestIdentifier"] as? String == requestIdentifier,
              settings["enabled"] as? Bool ?? true else { completion(false, nil); return }
        let expiration = (spec["expiresAt"] as? Double).flatMap { $0 > 0 ? Date(timeIntervalSince1970: $0 / 1000) : nil }
        guard let fire = GameNotificationPolicy.deliveryDate(
            at: Date(timeIntervalSince1970: at / 1000), now: Date(), expiresAt: expiration,
            quietEnabled: settings["quietHoursEnabled"] as? Bool ?? false,
            quietStart: settings["quietStartHour"] as? Int ?? 22,
            quietEnd: settings["quietEndHour"] as? Int ?? 6,
            behavior: spec["quietBehavior"] as? String ?? "delay") else {
            var records = specs; records.removeValue(forKey: id); specs = records
            completion(false, nil); return
        }
        let content = UNMutableNotificationContent()
        content.title = spec["title"] as? String ?? "호이 카드 데스크"
        content.body = spec["body"] as? String ?? "모험을 완료했어요."
        content.sound = .default
        content.threadIdentifier = "hoi-expeditions"
        // Encode optional JSON as a string; NSNull is not a valid notification property-list value.
        let payload = spec["payload"] as? [String: Any] ?? [:]
        let payloadData = (try? JSONSerialization.data(withJSONObject: payload)) ?? Data("{}".utf8)
        content.userInfo = ["id": id, "type": "expedition", "payloadJSON": String(data: payloadData, encoding: .utf8) ?? "{}"]
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1, fire.timeIntervalSinceNow), repeats: false)
        center.add(UNNotificationRequest(identifier: requestIdentifier, content: content, trigger: trigger)) { error in
            DispatchQueue.main.async {
                let isCurrent = self.specs[id]?["requestIdentifier"] as? String == requestIdentifier
                if error == nil {
                    var records = self.specs
                    if isCurrent {
                        records[id]?["deliveryAt"] = fire.timeIntervalSince1970 * 1000
                        self.specs = records
                    } else {
                        self.center.removePendingNotificationRequests(withIdentifiers: [requestIdentifier])
                    }
                }
                completion(error == nil && isCurrent, error)
            }
        }
    }

    func reschedule() {
        let records = specs
        center.removePendingNotificationRequests(withIdentifiers: records.map { $0.value["requestIdentifier"] as? String ?? prefix + $0.key })
        for (_, var spec) in records {
            // Preserve the delivered marker; completed records must not be resubmitted.
            if let delivery = spec["deliveryAt"] as? Double, delivery <= Date().timeIntervalSince1970 * 1000 { continue }
            spec.removeValue(forKey: "deliveryAt")
            schedule(spec) { _, _ in }
        }
    }

    @discardableResult func cancel(id: String) -> Bool {
        var records = specs
        let previous = records.removeValue(forKey: id)
        let existed = previous != nil
        specs = records
        let nativeId = previous?["requestIdentifier"] as? String ?? prefix + id
        center.removePendingNotificationRequests(withIdentifiers: [nativeId])
        center.removeDeliveredNotifications(withIdentifiers: [nativeId])
        return existed
    }

    func cancel(type: String? = nil) -> Int {
        let ids = specs.filter { type == nil || $0.value["type"] as? String == type }.map(\.key)
        ids.forEach { _ = cancel(id: $0) }
        if type == nil {
            defaults.removeObject(forKey: openedKey)
            center.removeAllPendingNotificationRequests()
            center.removeAllDeliveredNotifications()
        }
        return ids.count
    }

    func pending() -> [[String: Any]] {
        specs.values.filter { spec in
            guard let delivery = spec["deliveryAt"] as? Double else { return true }
            return delivery > Date().timeIntervalSince1970 * 1000
        }.map { spec in
            var result = spec
            result.removeValue(forKey: "deliveryAt")
            result.removeValue(forKey: "requestIdentifier")
            return result
        }
    }

    func consumeOpened() -> [String: Any]? {
        defer { defaults.removeObject(forKey: openedKey) }
        guard let data = defaults.data(forKey: openedKey) else { return nil }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }

    private func recordOpened(_ notification: UNNotification) {
        let info = notification.request.content.userInfo
        guard info["type"] as? String == "expedition", let id = info["id"] as? String else { return }
        let data = (info["payloadJSON"] as? String ?? "{}").data(using: .utf8) ?? Data()
        let payload = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        let opened: [String: Any] = ["id": id, "type": "expedition", "payload": payload]
        defaults.set(try? JSONSerialization.data(withJSONObject: opened), forKey: openedKey)
        _ = cancel(id: id)
        onOpen?(opened)
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        DispatchQueue.main.async { self.recordOpened(response.notification); completionHandler() }
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        DispatchQueue.main.async {
            let enabled = self.settings["enabled"] as? Bool ?? true
            completionHandler(enabled ? [.banner, .list, .sound] : [])
        }
    }
}

@objc(GameNotificationsPlugin)
public class GameNotificationsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GameNotificationsPlugin"
    public let jsName = "GameNotifications"
    public let pluginMethods: [CAPPluginMethod] = [
        "getPermissionStatus", "requestPermission", "openNotificationSettings", "configure", "getSettings",
        "schedule", "cancel", "cancelType", "cancelAll", "getPending", "consumeLastOpenedNotification"
    ].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }
    private let notifications = GameNotificationCenter.shared

    public override func load() {
        notifications.install()
        notifications.onOpen = { [weak self] value in self?.notifyListeners("notificationOpened", data: ["notification": value], retainUntilConsumed: true) }
    }

    @objc func getPermissionStatus(_ call: CAPPluginCall) { notifications.permission { call.resolve($0) } }

    @objc func requestPermission(_ call: CAPPluginCall) {
        notifications.center.requestAuthorization(options: [.alert, .badge, .sound]) { _, error in
            DispatchQueue.main.async {
                if let error = error { call.reject("알림 권한을 요청하지 못했습니다.", "NOTIFICATION_PERMISSION_FAILED", error); return }
                self.notifications.reschedule()
                self.getPermissionStatus(call)
            }
        }
    }

    @objc func openNotificationSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let url = URL(string: UIApplication.openSettingsURLString) else { call.reject("알림 설정을 열지 못했습니다."); return }
            UIApplication.shared.open(url, options: [:]) { opened in
                if opened { self.getPermissionStatus(call) } else { call.reject("알림 설정을 열지 못했습니다.", "NOTIFICATION_SETTINGS_UNAVAILABLE") }
            }
        }
    }

    @objc func configure(_ call: CAPPluginCall) {
        let start = call.getInt("quietStartHour") ?? 22
        let end = call.getInt("quietEndHour") ?? 6
        guard (0...23).contains(start), (0...23).contains(end), start != end else {
            call.reject("야간 알림 중지 시간을 확인해 주세요.", "INVALID_QUIET_HOURS"); return
        }
        DispatchQueue.main.async {
            self.notifications.settings = ["enabled": call.getBool("enabled") ?? true,
                "quietHoursEnabled": call.getBool("quietHoursEnabled") ?? false, "quietStartHour": start, "quietEndHour": end]
            self.notifications.reschedule()
            self.getSettings(call)
        }
    }

    @objc func getSettings(_ call: CAPPluginCall) {
        notifications.permission { status in
            var settings = self.notifications.settings; settings["permission"] = status["display"]; call.resolve(settings)
        }
    }

    @objc func schedule(_ call: CAPPluginCall) {
        let id = (call.getString("id") ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let title = (call.getString("title") ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let body = (call.getString("body") ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let at = call.getDouble("at") ?? 0
        let expires = call.getDouble("expiresAt") ?? 0
        let behavior = call.getString("quietBehavior") ?? "delay"
        guard !id.isEmpty, id.count <= 160 else { call.reject("알림 식별자가 올바르지 않습니다.", "INVALID_NOTIFICATION_ID"); return }
        guard call.getString("type") == "expedition" else { call.reject("지원하지 않는 게임 알림 종류입니다.", "INVALID_NOTIFICATION_TYPE"); return }
        guard !title.isEmpty, !body.isEmpty, at.isFinite, at > 0 else { call.reject("알림 제목, 내용, 시간을 확인해 주세요.", "INVALID_NOTIFICATION_CONTENT"); return }
        guard expires.isFinite, expires == 0 || expires >= at else { call.reject("알림 만료 시간이 올바르지 않습니다.", "INVALID_NOTIFICATION_EXPIRY"); return }
        guard ["delay", "skip"].contains(behavior) else { call.reject("지원하지 않는 야간 알림 처리 방식입니다.", "INVALID_QUIET_BEHAVIOR"); return }
        let spec: [String: Any] = ["id": id, "type": "expedition", "title": title, "body": body, "at": at,
            "expiresAt": expires, "quietBehavior": behavior, "payload": call.getObject("payload") ?? [:]]
        DispatchQueue.main.async {
            self.notifications.schedule(spec) { scheduled, error in
                if let error = error { call.reject("모험 완료 알림을 예약하지 못했습니다.", "NOTIFICATION_SCHEDULE_FAILED", error); return }
                self.notifications.permission { status in
                    var result = spec; result["scheduled"] = scheduled; result["permission"] = status["display"]; call.resolve(result)
                }
            }
        }
    }

    @objc func cancel(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), !id.isEmpty else { call.reject("취소할 알림 식별자가 없습니다.", "INVALID_NOTIFICATION_ID"); return }
        DispatchQueue.main.async { call.resolve(["cancelled": self.notifications.cancel(id: id), "id": id]) }
    }
    @objc func cancelType(_ call: CAPPluginCall) {
        guard let type = call.getString("type"), ["expedition", "incident"].contains(type) else { call.reject("지원하지 않는 게임 알림 종류입니다.", "INVALID_NOTIFICATION_TYPE"); return }
        DispatchQueue.main.async { call.resolve(["cancelled": self.notifications.cancel(type: type), "type": type]) }
    }
    @objc func cancelAll(_ call: CAPPluginCall) { DispatchQueue.main.async { call.resolve(["cancelled": self.notifications.cancel()]) } }
    @objc func getPending(_ call: CAPPluginCall) { DispatchQueue.main.async { call.resolve(["notifications": self.notifications.pending()]) } }
    @objc func consumeLastOpenedNotification(_ call: CAPPluginCall) {
        DispatchQueue.main.async { call.resolve(["notification": self.notifications.consumeOpened() as Any? ?? NSNull()]) }
    }
}
