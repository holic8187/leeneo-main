import Foundation

@main struct NotificationPolicyTests {
    static func main() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Asia/Seoul")!
        let formatter = ISO8601DateFormatter()
        func date(_ value: String) -> Date { formatter.date(from: value)! }
        let now = date("2026-10-13T12:00:00+09:00")
        func delivery(_ at: String, quiet: Bool = true, behavior: String = "delay", expiry: String? = nil) -> Date? {
            GameNotificationPolicy.deliveryDate(at: date(at), now: now, expiresAt: expiry.map(date),
                quietEnabled: quiet, quietStart: 22, quietEnd: 6, behavior: behavior, calendar: calendar)
        }
        precondition(delivery("2026-10-13T23:00:00+09:00") == date("2026-10-14T06:00:00+09:00"))
        precondition(delivery("2026-10-14T03:00:00+09:00") == date("2026-10-14T06:00:00+09:00"))
        precondition(delivery("2026-10-14T06:00:00+09:00") == date("2026-10-14T06:00:00+09:00"))
        precondition(delivery("2026-10-13T22:00:00+09:00", behavior: "skip") == nil)
        precondition(delivery("2026-10-13T23:00:00+09:00", expiry: "2026-10-14T05:00:00+09:00") == nil)
        precondition(delivery("2026-10-13T23:00:00+09:00", quiet: false) == date("2026-10-13T23:00:00+09:00"))
        precondition(delivery("2026-10-13T11:00:00+09:00") == now.addingTimeInterval(1))
        precondition(delivery("2026-10-13T11:00:00+09:00", expiry: "2026-10-13T11:10:00+09:00") == nil)
        print("8 iOS notification timing checks passed.")
    }
}
