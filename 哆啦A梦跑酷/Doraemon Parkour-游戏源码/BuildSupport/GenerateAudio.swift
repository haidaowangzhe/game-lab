import Foundation

let sampleRate = 22_050

func little<T: FixedWidthInteger>(_ value: T) -> [UInt8] {
    withUnsafeBytes(of: value.littleEndian) { Array($0) }
}

func writeWAV(name: String, duration: Double, notes: [(Double, Double)], volume: Double) throws {
    let count = Int(duration * Double(sampleRate))
    var pcm = [Int16](repeating: 0, count: count)
    for i in 0..<count {
        let time = Double(i) / Double(sampleRate)
        let note = notes[Int(time / duration * Double(notes.count)) % notes.count]
        let phase = 2 * Double.pi * note.0 * time
        let envelope = min(1, min(time * 8, (duration - time) * 8))
        let value = (sin(phase) * 0.65 + sin(phase * 2) * 0.18 + sin(phase * 0.5) * 0.12) * volume * envelope
        pcm[i] = Int16(max(-1, min(1, value)) * Double(Int16.max))
    }
    let dataSize = UInt32(pcm.count * 2)
    var bytes = Array("RIFF".utf8) + little(UInt32(36) + dataSize) + Array("WAVEfmt ".utf8)
    bytes += little(UInt32(16)) + little(UInt16(1)) + little(UInt16(1))
    bytes += little(UInt32(sampleRate)) + little(UInt32(sampleRate * 2)) + little(UInt16(2)) + little(UInt16(16))
    bytes += Array("data".utf8) + little(dataSize)
    pcm.forEach { bytes += little($0) }
    let url = URL(fileURLWithPath: "DoraemonParkour/Resources/Audio/\(name).wav")
    try Data(bytes).write(to: url)
}

let songs: [(String, Double, [(Double, Double)], Double)] = [
    ("bgm_home", 8, [(261.6,0),(329.6,0),(392,0),(523.2,0),(392,0),(329.6,0),(293.7,0),(392,0)], 0.13),
    ("bgm_run", 6, [(329.6,0),(392,0),(440,0),(523.2,0),(440,0),(587.3,0),(523.2,0),(392,0)], 0.14),
    ("bgm_result", 5, [(392,0),(493.9,0),(587.3,0),(784,0),(587.3,0),(493.9,0)], 0.12),
    ("sfx_tap", 0.12, [(720,0)], 0.22),
    ("sfx_confirm", 0.28, [(523.2,0),(784,0)], 0.22),
    ("sfx_pickup", 0.22, [(880,0),(1174.7,0)], 0.20),
    ("sfx_hurt", 0.35, [(180,0),(120,0)], 0.28),
    ("sfx_jump", 0.22, [(330,0),(660,0)], 0.18),
    ("sfx_chest", 0.75, [(392,0),(523.2,0),(659.3,0),(784,0)], 0.22),
    ("sfx_win", 1.2, [(523.2,0),(659.3,0),(784,0),(1046.5,0)], 0.20)
]

for song in songs { try writeWAV(name: song.0, duration: song.1, notes: song.2, volume: song.3) }

