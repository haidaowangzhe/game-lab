import SwiftUI
import Darwin

struct SettingsView: View {
    @EnvironmentObject private var state: GameAppState
    var embedded = false

    var body: some View {
        ZStack {
            if !embedded { Color(red: 0.01, green: 0.05, blue: 0.16).ignoresSafeArea() }
            ProportionalCanvas(size: CGSize(width: 708.5, height: 450.5)) {
                ZStack {
                    AssetImage(path: "设置页/面板/游戏设置面板.png").frame(width: 708.5, height: 450.5)
                    VStack(spacing: 18) {
                        Spacer().frame(height: 68)
                        volumeRow(icon: "设置页/图标文字内容/03_背景音乐图标文字.png", value: state.profile.settings.musicVolume, music: true)
                        volumeRow(icon: "设置页/图标文字内容/01_游戏音效图标文字.png", value: state.profile.settings.soundVolume, music: false)
                        HStack(spacing: 34) {
                            toggleRow(icon: "设置页/图标文字内容/02_震动反馈图标文字.png", value: state.profile.settings.vibrationEnabled) {
                                let willEnable = !state.profile.settings.vibrationEnabled
                                state.profile.settings.vibrationEnabled.toggle()
                                state.persistSettings()
                                // 关闭状态不会触发按钮样式的反馈；开启后补一次确认震动。
                                if willEnable { GameHaptics.impact(.medium, enabled: true) }
                            }
                            toggleRow(icon: "设置页/图标文字内容/04_温馨提示图标文字.png", value: state.profile.settings.tipsEnabled) { state.profile.settings.tipsEnabled.toggle(); state.persistSettings() }
                        }
                        HStack(spacing: 14) {
                            artButton("设置页/按钮/游戏信息/恢复默认按钮.png", 116, 40) { state.resetSettings() }
                            artButton("设置页/按钮/游戏信息/关于游戏按钮.png", 116, 40) { state.showAbout = true }
                            artButton("设置页/按钮/游戏信息/清理缓存按钮.png", 116, 40) { state.clearCache() }
                            artButton("设置页/按钮/游戏信息/隐私政策按钮.png", 116, 40) { state.showPrivacy = true }
                        }
                        HStack(spacing: 72) {
                            artButton("设置页/按钮/关闭设置按钮.png", 170, 50) { state.closeSettings() }
                            artButton("设置页/按钮/退出游戏按钮.png", 170, 50) { exit(EXIT_SUCCESS) }
                        }.padding(.top, 2)
                        Spacer().frame(height: 14)
                    }
                }
            }
        }
    }

    private func volumeRow(icon: String, value: Int, music: Bool) -> some View {
        HStack(spacing: 10) {
            AssetImage(path: icon).frame(width: 142, height: 45)
            ZStack {
                AssetImage(path: "设置页/音量图形素材/音量框.png")
                HStack(spacing: 0) {
                    ForEach(0..<min(10, max(0, value)), id: \.self) { _ in
                        AssetImage(path: "设置页/音量图形素材/蓝色六边形宝石.png")
                            .frame(width: 23, height: 16)
                            .offset(y: -0.5)
                    }
                    AssetImage(path: "设置页/音量图形素材/六边形宝石.png")
                        .frame(width: 26, height: 39)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.leading, 24)
            }.frame(width: 300, height: 39)
            artButton("设置页/按钮/加减/加号控制按钮.png", 42, 42) { state.changeVolume(music: music, delta: 1) }
            artButton("设置页/按钮/加减/减号控制按钮.png", 42, 42) { state.changeVolume(music: music, delta: -1) }
        }
    }

    private func toggleRow(icon: String, value: Bool, action: @escaping () -> Void) -> some View {
        HStack(spacing: 8) {
            AssetImage(path: icon).frame(width: 142, height: 45)
            artButton(value ? "设置页/按钮/开启按钮.png" : "设置页/按钮/关闭按钮.png", 92, 39, action: action)
        }
    }

    private func artButton(_ path: String, _ width: CGFloat, _ height: CGFloat, action: @escaping () -> Void) -> some View {
        Button(action: action) { AssetImage(path: path).frame(width: width, height: height) }.buttonStyle(GameHapticButtonStyle())
    }
}

enum InfoKind: Equatable { case about, privacy }

struct InfoTextModal: View {
    @EnvironmentObject private var state: GameAppState
    let kind: InfoKind

    var body: some View {
        ProportionalCanvas(size: CGSize(width: 650, height: 413)) {
            ZStack(alignment: .bottom) {
                AssetImage(path: kind == .about ? "游戏信息+隐私政策/面板/关于游戏弹窗.png" : "游戏信息+隐私政策/面板/隐私政策弹窗.png")
                    .frame(width: 650, height: 413)
                Button {
                    if kind == .about { state.showAbout = false } else { state.showPrivacy = false }
                } label: {
                    AssetImage(path: "游戏信息+隐私政策/确定按钮.png").frame(width: 145, height: 45)
                }.buttonStyle(GameHapticButtonStyle()).padding(.bottom, 49)
            }
        }
    }
}

struct RechargePromptView: View {
    @EnvironmentObject private var state: GameAppState

    var body: some View {
        ProportionalCanvas(size: CGSize(width: 300, height: 385)) {
            ZStack(alignment: .bottom) {
                AssetImage(path: "充值提示弹窗/提示弹窗.png").frame(width: 300, height: 385)
                Button { state.showRecharge = false } label: {
                    AssetImage(path: "充值提示弹窗/确定按钮.png").frame(width: 125, height: 45)
                }.buttonStyle(GameHapticButtonStyle()).padding(.bottom, 44)
            }
        }
    }
}
