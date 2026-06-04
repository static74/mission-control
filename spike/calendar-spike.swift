import EventKit
import Foundation

let store = EKEventStore()
let sema = DispatchSemaphore(value: 0)
var granted = false
var reqError: Error?

// macOS 14+ full-access request. Requires NSCalendarsFullAccessUsageDescription in the
// embedded Info.plist, otherwise the process is killed with a TCC violation.
store.requestFullAccessToEvents { ok, err in
    granted = ok
    reqError = err
    sema.signal()
}
sema.wait()

guard granted else {
    FileHandle.standardError.write(
        "ACCESS DENIED: \(String(describing: reqError))\n".data(using: .utf8)!)
    exit(2)
}

struct OutEvent: Codable {
    let title: String
    let start: Double           // epoch milliseconds
    let end: Double
    let allDay: Bool
    let calendarName: String
    let attendeeCount: Int      // attendees who are not the current user
    let hasLink: Bool
    let declined: Bool
}

func hasVideoLink(_ e: EKEvent) -> Bool {
    let blob = [e.location, e.notes, e.url?.absoluteString]
        .compactMap { $0 }.joined(separator: " ").lowercased()
    return ["zoom.us", "meet.google", "teams.microsoft", "webex.com"].contains { blob.contains($0) }
}

func isDeclined(_ e: EKEvent) -> Bool {
    guard let me = e.attendees?.first(where: { $0.isCurrentUser }) else { return false }
    return me.participantStatus == .declined
}

let now = Date()
let end = Calendar.current.date(byAdding: .hour, value: 24, to: now)!
let predicate = store.predicateForEvents(withStart: now, end: end, calendars: nil)
let events = store.events(matching: predicate).sorted { $0.startDate < $1.startDate }

let out = events.map { e in
    OutEvent(
        title: e.title ?? "(no title)",
        start: e.startDate.timeIntervalSince1970 * 1000,
        end: (e.endDate ?? e.startDate).timeIntervalSince1970 * 1000,
        allDay: e.isAllDay,
        calendarName: e.calendar?.title ?? "",
        attendeeCount: (e.attendees ?? []).filter { !$0.isCurrentUser }.count,
        hasLink: hasVideoLink(e),
        declined: isDeclined(e)
    )
}

let data = try JSONEncoder().encode(out)
FileHandle.standardOutput.write(data)
FileHandle.standardOutput.write("\n".data(using: .utf8)!)
