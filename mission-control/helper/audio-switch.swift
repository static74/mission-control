import CoreAudio
import Foundation

// Read a CFString device property (name / uid). Returns nil on any error.
func cfStringProp(_ id: AudioObjectID, _ selector: AudioObjectPropertySelector) -> String? {
    var addr = AudioObjectPropertyAddress(
        mSelector: selector,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain)
    var size = UInt32(0)
    if AudioObjectGetPropertyDataSize(id, &addr, 0, nil, &size) != noErr { return nil }
    var cf: Unmanaged<CFString>?
    let status = AudioObjectGetPropertyData(id, &addr, 0, nil, &size, &cf)
    if status != noErr { return nil }
    return cf?.takeRetainedValue() as String?
}

func deviceName(_ id: AudioDeviceID) -> String? { cfStringProp(id, kAudioObjectPropertyName) }
func deviceUID(_ id: AudioDeviceID) -> String? { cfStringProp(id, kAudioDevicePropertyDeviceUID) }

func defaultOutputDevice() -> AudioDeviceID? {
    var addr = AudioObjectPropertyAddress(
        mSelector: kAudioHardwarePropertyDefaultOutputDevice,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain)
    var dev = AudioDeviceID(0)
    var size = UInt32(MemoryLayout<AudioDeviceID>.size)
    let status = AudioObjectGetPropertyData(
        AudioObjectID(kAudioObjectSystemObject), &addr, 0, nil, &size, &dev)
    if status != noErr || dev == 0 { return nil }
    return dev
}

@discardableResult
func setDefaultOutputDevice(_ id: AudioDeviceID) -> Bool {
    var addr = AudioObjectPropertyAddress(
        mSelector: kAudioHardwarePropertyDefaultOutputDevice,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain)
    var dev = id
    let size = UInt32(MemoryLayout<AudioDeviceID>.size)
    return AudioObjectSetPropertyData(
        AudioObjectID(kAudioObjectSystemObject), &addr, 0, nil, size, &dev) == noErr
}

func allDevices() -> [AudioDeviceID] {
    var addr = AudioObjectPropertyAddress(
        mSelector: kAudioHardwarePropertyDevices,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain)
    var size = UInt32(0)
    let sys = AudioObjectID(kAudioObjectSystemObject)
    if AudioObjectGetPropertyDataSize(sys, &addr, 0, nil, &size) != noErr { return [] }
    let count = Int(size) / MemoryLayout<AudioDeviceID>.size
    var ids = [AudioDeviceID](repeating: 0, count: count)
    if AudioObjectGetPropertyData(sys, &addr, 0, nil, &size, &ids) != noErr { return [] }
    return ids
}

// True if the device exposes at least one OUTPUT stream (i.e. it can play audio).
func hasOutput(_ id: AudioDeviceID) -> Bool {
    var addr = AudioObjectPropertyAddress(
        mSelector: kAudioDevicePropertyStreams,
        mScope: kAudioObjectPropertyScopeOutput,
        mElement: kAudioObjectPropertyElementMain)
    var size = UInt32(0)
    if AudioObjectGetPropertyDataSize(id, &addr, 0, nil, &size) != noErr { return false }
    return size > 0
}

func findOutputDevice(matching target: String) -> AudioDeviceID? {
    for id in allDevices() where hasOutput(id) {
        if deviceUID(id) == target || deviceName(id) == target { return id }
    }
    return nil
}

func emit(_ id: AudioDeviceID) {
    let u = deviceUID(id) ?? ""
    let n = deviceName(id) ?? ""
    print("\(u)\t\(n)")
}

func fail(_ msg: String, _ code: Int32) -> Never {
    FileHandle.standardError.write((msg + "\n").data(using: .utf8)!)
    exit(code)
}

let args = CommandLine.arguments
guard args.count >= 2 else { fail("usage: audio-switch get|set <device>|list", 2) }

switch args[1] {
case "get":
    guard let id = defaultOutputDevice() else { fail("no default output device", 1) }
    emit(id)
case "list":
    for id in allDevices() where hasOutput(id) { emit(id) }
case "set":
    guard args.count >= 3 else { fail("set requires a device uid or name", 2) }
    guard let id = findOutputDevice(matching: args[2]) else { fail("device not found: \(args[2])", 1) }
    if !setDefaultOutputDevice(id) { fail("failed to set default output", 1) }
    // Read back the device that is ACTUALLY current now, so the caller never assumes.
    guard let cur = defaultOutputDevice() else { fail("read-back failed", 1) }
    emit(cur)
default:
    fail("unknown command: \(args[1])", 2)
}
