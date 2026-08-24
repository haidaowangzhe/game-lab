import AVFoundation
import Foundation
import UIKit

@MainActor
enum GameHaptics {
    // 反馈发生器全局复用。频繁创建并 prepare 会在连续点击时占用主线程，
    // 尤其真机上容易让按钮产生“按下去卡一下”的感觉。
    private static let lightGenerator = UIImpactFeedbackGenerator(style: .light)
    private static let mediumGenerator = UIImpactFeedbackGenerator(style: .medium)
    private static let heavyGenerator = UIImpactFeedbackGenerator(style: .heavy)
    private static let softGenerator = UIImpactFeedbackGenerator(style: .soft)
    private static let rigidGenerator = UIImpactFeedbackGenerator(style: .rigid)
    private static let notificationGenerator = UINotificationFeedbackGenerator()

    static func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle, enabled: Bool) {
        guard enabled else { return }
        let generator: UIImpactFeedbackGenerator
        switch style {
        case .light: generator = lightGenerator
        case .medium: generator = mediumGenerator
        case .heavy: generator = heavyGenerator
        case .soft: generator = softGenerator
        case .rigid: generator = rigidGenerator
        @unknown default: generator = lightGenerator
        }
        generator.impactOccurred()
    }

    static func notification(_ type: UINotificationFeedbackGenerator.FeedbackType, enabled: Bool) {
        guard enabled else { return }
        notificationGenerator.notificationOccurred(type)
    }
}

final class AudioManager: ObservableObject {
    private var bgmPlayer: AVAudioPlayer?
    private var sfxPlayers: [AVAudioPlayer] = []
    private var currentBGM: String?

    func playBGM(_ name: String, settings: SettingsProfile) {
        guard settings.musicVolume > 0 else { stopBGM(); return }
        if currentBGM == name, let player = bgmPlayer {
            player.volume = Float(settings.musicVolume) / 10
            if !player.isPlaying { player.play() }
            return
        }
        guard let url = Bundle.main.url(forResource: name, withExtension: "wav", subdirectory: "Audio") ?? Bundle.main.url(forResource: name, withExtension: "wav") else { return }
        bgmPlayer = try? AVAudioPlayer(contentsOf: url)
        bgmPlayer?.numberOfLoops = -1
        bgmPlayer?.volume = Float(settings.musicVolume) / 10
        bgmPlayer?.prepareToPlay()
        bgmPlayer?.play()
        currentBGM = name
    }

    func update(settings: SettingsProfile) {
        bgmPlayer?.volume = Float(settings.musicVolume) / 10
        if settings.musicVolume == 0 { bgmPlayer?.pause() } else if currentBGM != nil { bgmPlayer?.play() }
    }

    func stopBGM() { bgmPlayer?.stop(); currentBGM = nil }

    func playSFX(_ name: String, settings: SettingsProfile) {
        guard settings.soundVolume > 0,
              let url = Bundle.main.url(forResource: name, withExtension: "wav", subdirectory: "Audio") ?? Bundle.main.url(forResource: name, withExtension: "wav"),
              let player = try? AVAudioPlayer(contentsOf: url) else { return }
        sfxPlayers.removeAll { !$0.isPlaying }
        player.volume = Float(settings.soundVolume) / 10
        player.play()
        sfxPlayers.append(player)
    }
}
