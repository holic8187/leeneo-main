import Foundation

/// Pure timing rules shared by scheduling and the macOS regression runner.
enum GameNotificationPolicy {
    static func deliveryDate(at: Date, now: Date, expiresAt: Date?, quietEnabled: Bool,
                             quietStart: Int, quietEnd: Int, behavior: String,
                             calendar: Calendar = .current) -> Date? {
        var result = max(at, now.addingTimeInterval(1))
        if quietEnabled {
            let hour = calendar.component(.hour, from: result)
            let isQuiet = quietStart < quietEnd
                ? hour >= quietStart && hour < quietEnd
                : hour >= quietStart || hour < quietEnd
            if isQuiet {
                guard behavior != "skip" else { return nil }
                guard let end = calendar.nextDate(after: result, matching: DateComponents(hour: quietEnd, minute: 0, second: 0),
                                                  matchingPolicy: .nextTime) else { return nil }
                result = end
            }
        }
        if let expiry = expiresAt, result > expiry { return nil }
        return result
    }
}
