import SwiftUI

struct LoadingView: View {
    @EnvironmentObject private var state: GameAppState
    @State private var progress: CGFloat = 0

    var body: some View {
        ZStack {
            AssetImage(path: AssetPath.loadingBackground, contentMode: .fill).ignoresSafeArea()
            ProportionalCanvas(size: CGSize(width: 1378, height: 921)) {
                GeometryReader { geo in
                    ZStack {
                        AssetImage(path: "加载页/2d像素文字信息.png")
                            .frame(width: geo.size.width * 0.67, height: 500)
                            .position(x: geo.size.width / 2, y: geo.size.height / 2 + 28)

                        ZStack(alignment: .leading) {
                            AssetImage(path: "加载页/进度条/进度框不透明版.png")
                                .frame(width: geo.size.width * 0.66, height: 70)
                            if let progressImage = AssetPath.image("加载页/进度条/中间蓝色进度条01.png") {
                                Image(uiImage: progressImage)
                                    .resizable()
                                    .frame(width: max(24, geo.size.width * 0.61 * progress), height: 34)
                                    .padding(.leading, 35)
                            }
                        }
                        .frame(width: geo.size.width * 0.66, height: 70)
                        .position(x: geo.size.width / 2, y: geo.size.height * 0.82)

                        Text("22世纪传来了一封神秘来信……")
                            .pixelText(44)
                            .frame(width: geo.size.width)
                            .position(x: geo.size.width / 2, y: geo.size.height * 0.91)
                    }
                }
            }
        }
        .task {
            #if DEBUG
            if ProcessInfo.processInfo.arguments.contains("-uiTestLoading") {
                progress = 0.68
                return
            }
            #endif
            for value in 1...30 {
                try? await Task.sleep(nanoseconds: 45_000_000)
                progress = CGFloat(value) / 30
            }
            state.completeLoading()
        }
    }
}

struct ResourceBadge: View {
    let value: Int
    let diamonds: Bool
    var width: CGFloat = 170
    var height: CGFloat = 52
    var fontSize: CGFloat = 22
    var body: some View {
        ZStack {
            AssetImage(path: diamonds ? "首页/货币显示框/043-长款-圆角蓝框白底-钻石.png" : "首页/货币显示框/041-长款-圆角金框白底-金币.png")
            Text("\(value)").font(.system(size: fontSize, weight: .black, design: .rounded)).foregroundColor(.black).padding(.leading, 10)
        }.frame(width: width, height: height)
    }
}

struct HomeView: View {
    @EnvironmentObject private var state: GameAppState
    var body: some View {
        ZStack {
            AssetImage(path: AssetPath.homeBackground, contentMode: .fill).ignoresSafeArea()
            ProportionalCanvas(size: CGSize(width: 967, height: 547)) {
                ZStack {
                    VStack {
                        HStack(alignment: .top) {
                            HStack(alignment: .top) {
                                AssetImage(path: state.selectedCharacter.portraitPath).frame(width: 86, height: 96)
                                VStack(spacing: 2) { ResourceBadge(value: state.profile.diamonds, diamonds: true); ResourceBadge(value: state.profile.coins, diamonds: false) }
                            }
                            .offset(x: -40)
                            Spacer()
                            artButton("首页/按钮/首页商城卡片.png", size: CGSize(width: 76, height: 96)) { state.openShop(from: .home) }
                            artButton("首页/按钮/首页背包卡片.png", size: CGSize(width: 76, height: 96)) { state.openInventory(from: .home) }
                        }
                        .padding(.horizontal, 18).padding(.top, 14)
                        Spacer()
                        VStack(spacing: 10) {
                            artButton("首页/按钮/首页开始游戏按钮.png", size: CGSize(width: 250, height: 64)) { state.startLevel(min(state.profile.unlockedLevel, 20)) }
                            artButton("首页/按钮/首页关卡选择按钮.png", size: CGSize(width: 250, height: 64)) { state.navigate(.levels) }
                            artButton("首页/按钮/首页设置按钮.png", size: CGSize(width: 250, height: 64)) { state.openSettings(from: .home) }
                        }
                        .padding(.bottom, 56)
                        .offset(y: -30)
                    }
                    .offset(y: 24)
                }
            }
        }.onAppear { state.audio.playBGM("bgm_home", settings: state.profile.settings) }
    }

    private func artButton(_ path: String, size: CGSize, action: @escaping () -> Void) -> some View {
        Button(action: { state.audio.playSFX("sfx_tap", settings: state.profile.settings); action() }) { AssetImage(path: path).frame(width: size.width, height: size.height) }
            .buttonStyle(GameHapticButtonStyle()).contentShape(Rectangle())
    }
}

struct LevelSelectView: View {
    @EnvironmentObject private var state: GameAppState
    @State private var page = 0
    var body: some View {
        ZStack {
            AssetImage(path: AssetPath.levelBackground, contentMode: .fill).ignoresSafeArea()
            ProportionalCanvas(size: CGSize(width: 1498, height: 847)) {
                ZStack {
                    VStack {
                        HStack(spacing: 100) {
                            Button { state.navigate(.home) } label: { AssetImage(path: "关卡选择页/按钮/关卡返回按钮.png").frame(width: 116, height: 116) }
                            Spacer()
                            ResourceBadge(value: state.profile.diamonds, diamonds: true, width: 270, height: 100, fontSize: 35)
                            ResourceBadge(value: state.profile.coins, diamonds: false, width: 270, height: 100, fontSize: 35)
                            Spacer()
                            Button { state.openSettings(from: .levels) } label: { AssetImage(path: "关卡选择页/按钮/关卡设置按钮.png").frame(width: 116, height: 116) }
                        }.padding(.horizontal, 60).padding(.top, 38)
                        levelRows.padding(.top, 40)
                        Spacer(minLength: 8)
                    }
                    .offset(y: 28)
                }
            }
        }
    }

    private var pageLevels: [Int] {
        let start = page * 15 + 1
        return start > 20 ? [] : Array(start...min(start + 14, 20))
    }

    private var levelRows: some View {
        VStack(spacing: 18) {
            row(Array(pageLevels.prefix(5)))
            HStack(spacing: 60) {
                Button { page = max(0, page - 1) } label: { AssetImage(path: "关卡选择页/页数/按钮框-上一页.png").frame(width: 126, height: 126) }.buttonStyle(GameHapticButtonStyle()).disabled(page == 0)
                row(Array(pageLevels.dropFirst(5).prefix(5)))
                Button { page = min(1, page + 1) } label: { AssetImage(path: "关卡选择页/页数/按钮框-下一页.png").frame(width: 126, height: 126) }.buttonStyle(GameHapticButtonStyle()).disabled(page == 1)
            }
            row(Array(pageLevels.dropFirst(10).prefix(5)))
        }
    }

    private func row(_ levels: [Int]) -> some View {
        HStack(spacing: 24) { ForEach(levels, id: \.self) { LevelTile(level: $0) } }
            .frame(height: levels.isEmpty ? 0 : 128)
    }

    private struct LevelTile: View {
        @EnvironmentObject var state: GameAppState
        let level: Int
        var unlocked: Bool { level <= state.profile.unlockedLevel }
        var stars: Int { state.profile.levelStars[String(level)] ?? 0 }
        var path: String { !unlocked ? "关卡选择页/页数/按钮框-锁定.png" : (stars > 0 ? "关卡选择页/页数/按钮框-空白白底.png" : "关卡选择页/页数/按钮框-空白灰底.png") }
        var body: some View {
            Button { state.startLevel(level) } label: {
                ZStack {
                    AssetImage(path: path)
                    if unlocked { Text("\(level)").font(.system(size: 42, weight: .black, design: .rounded)).foregroundColor(.black).offset(y: stars > 0 ? -12 : 0) }
                    if stars > 0 { HStack(spacing: 0) { ForEach(0..<3, id: \.self) { i in AssetImage(path: i < stars ? "关卡选择页/页数/金星.png" : "关卡选择页/页数/灰星.png").frame(width: 20, height: 20) } }.offset(y: 25) }
                }.frame(width: 124, height: 124)
            }.buttonStyle(GameHapticButtonStyle()).disabled(!unlocked)
        }
    }
}
