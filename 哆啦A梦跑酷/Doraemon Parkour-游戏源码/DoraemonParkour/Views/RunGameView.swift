import SwiftUI

struct RunGameView: View {
    @EnvironmentObject private var state: GameAppState
    @StateObject private var vm: RunGameViewModel
    let sessionID: UUID
    @State private var didSettle = false

    init(sessionID: UUID, level: Int, character: CharacterDefinition, loadout: [String]) {
        self.sessionID = sessionID
        _vm = StateObject(wrappedValue: RunGameViewModel(level: level, character: character, loadout: loadout))
    }

    var body: some View {
        ZStack {
            GeometryReader { geo in
                scrollingBackground(size: geo.size)
            }
            .ignoresSafeArea()
            GeometryReader { geo in
                let sceneScale = max(0.001, geo.size.height / 637)
                let sceneSize = CGSize(width: geo.size.width / sceneScale, height: 637)
                ProportionalCanvas(size: sceneSize) {
                    world(size: sceneSize)
                }
                .onAppear {
                    vm.updateWorldScale(pointsPerMeter: Double(sceneSize.width * 0.70 / 34))
                }
                .onChange(of: sceneSize.width) { width in
                    vm.updateWorldScale(pointsPerMeter: Double(width * 0.70 / 34))
                }
            }
            .ignoresSafeArea()
            ProportionalCanvas(size: CGSize(width: 1024, height: 637)) {
                GeometryReader { geo in
                    ZStack {
                        hud(size: geo.size)
                        quickSlots
                        controls
                        if let message = vm.effectMessage {
                            Text(message).pixelText(20).padding(12).background(Color.black.opacity(0.45)).clipShape(Capsule()).position(x: geo.size.width / 2, y: geo.size.height * 0.72)
                        }
                    }
                }
            }
            if vm.isCompleting {
                ProportionalCanvas(size: CGSize(width: 1024, height: 637)) {
                    completionCelebration
                }
                .allowsHitTesting(false)
            }
            if vm.isPaused { ModalMask { PauseView(vm: vm) } }
        }
        .onChange(of: vm.finished) { value in
            guard let success = value, !didSettle else { return }
            didSettle = true
            state.settleRun(level: vm.level, success: success, stars: vm.stars, score: vm.score, pickupCoins: vm.pickupCoins, pickupDiamonds: vm.pickupDiamonds, items: vm.pickupItems, chests: vm.pickupChests, usedLoadout: vm.usedLoadout)
        }
        .onChange(of: state.showSettingsOverlay) { vm.isPaused = $0 }
        .onChange(of: state.showInventoryOverlay) { vm.isPaused = $0 }
        .onChange(of: vm.hapticSignal) { _ in
            let enabled = state.profile.settings.vibrationEnabled
            switch vm.hapticKind {
            case .shield: GameHaptics.impact(.rigid, enabled: enabled)
            case .damage: GameHaptics.impact(.heavy, enabled: enabled)
            case .success: GameHaptics.notification(.success, enabled: enabled)
            }
        }
        .onAppear { state.audio.playBGM("bgm_run", settings: state.profile.settings) }
    }

    private func world(size: CGSize) -> some View {
        let groundY = size.height * 0.875
        let visibleMeters = 34.0
        let cameraAnchorX = size.width * 0.30
        // 世界物件从角色摄像机锚点映射到屏幕右边缘，左侧按同比例回推。
        // 这样陷阱、奖励和障碍会从屏幕边缘进出，不在画面中途突然出现。
        let visibleWorldWidth = size.width - cameraAnchorX
        let visibleMetersBehind = visibleMeters * Double(cameraAnchorX / visibleWorldWidth)
        let flightBlend = CGFloat(vm.flightTransitionProgress)
        let tiltBlend = CGFloat(vm.flightTiltProgress)
        let playerSize = playerVisualSize(flightBlend: flightBlend, tiltBlend: tiltBlend)
        return ZStack {
            if vm.isMagnetEffectActive {
                magnetAttractionLines(
                    size: size,
                    groundY: groundY,
                    cameraAnchorX: cameraAnchorX,
                    visibleWorldWidth: visibleWorldWidth,
                    visibleMeters: visibleMeters,
                    playerSize: playerSize
                )
            }
            // 终点始终处于世界坐标中，会先从屏幕右侧缓慢进入；完整可见后 ViewModel 才锁住镜头。
            AssetImage(path: finishGatePath)
                .frame(width: 375, height: 380)
                .position(
                    x: cameraAnchorX + CGFloat((vm.targetDistance - vm.cameraDistance) / visibleMeters) * visibleWorldWidth,
                    y: groundY - 190 + 4
                )
            ForEach(vm.entities.filter {
                !$0.collected
                    && $0.isActive
                    && $0.x > vm.cameraDistance - visibleMetersBehind - 2
                    && $0.x < vm.cameraDistance + visibleMeters + 2
            }) { entity in
                let visualSize = entitySize(entity.kind)
                entityImage(entity.kind)
                    .frame(width: visualSize.width, height: visualSize.height)
                    .rotationEffect(.degrees(entity.rotation))
                    .position(x: cameraAnchorX + CGFloat((entity.x - vm.cameraDistance) / visibleMeters) * visibleWorldWidth,
                              y: entityScreenY(entity, visualSize: visualSize, groundY: groundY, canvasHeight: size.height))
            }
            playerWithItemEffects(playerSize: playerSize)
                .position(
                    x: playerScreenX(size: size),
                    y: playerScreenY(size: size, groundY: groundY, playerSize: playerSize)
                )
        }
    }

    private func playerScreenY(size: CGSize, groundY: CGFloat, playerSize: CGSize) -> CGFloat {
        groundY
            - CGFloat(vm.playerY - RunGameViewModel.groundLevel) * size.height
            - playerSize.height / 2
            + 8 * (1 - CGFloat(vm.flightTransitionProgress))
    }

    private func magnetAttractionLines(
        size: CGSize,
        groundY: CGFloat,
        cameraAnchorX: CGFloat,
        visibleWorldWidth: CGFloat,
        visibleMeters: Double,
        playerSize: CGSize
    ) -> some View {
        let playerPoint = CGPoint(
            x: playerScreenX(size: size),
            y: playerScreenY(size: size, groundY: groundY, playerSize: playerSize) - playerSize.height * 0.10
        )
        let targets = vm.entities.filter {
            !$0.collected && $0.isActive && isPickupEntity($0.kind) && abs($0.x - vm.distance) < 6
        }
        return Canvas { context, _ in
            for (index, entity) in targets.enumerated() {
                let visualSize = entitySize(entity.kind)
                let target = CGPoint(
                    x: cameraAnchorX + CGFloat((entity.x - vm.cameraDistance) / visibleMeters) * visibleWorldWidth,
                    y: entityScreenY(entity, visualSize: visualSize, groundY: groundY, canvasHeight: size.height)
                )
                var path = Path()
                path.move(to: playerPoint)
                path.addQuadCurve(
                    to: target,
                    control: CGPoint(x: (playerPoint.x + target.x) / 2, y: min(playerPoint.y, target.y) - 12)
                )
                context.stroke(
                    path,
                    with: .color(index.isMultiple(of: 2) ? .red.opacity(0.34) : .cyan.opacity(0.42)),
                    style: StrokeStyle(lineWidth: 1.5, dash: [5, 4])
                )
            }
        }
        .frame(width: size.width, height: size.height)
        .allowsHitTesting(false)
    }

    private func isPickupEntity(_ kind: WorldEntityKind) -> Bool {
        switch kind {
        case .hazard, .obstacle, .platform: return false
        default: return true
        }
    }

    /// 按《人物素材高度比例规范》保持：地面走动 : 直立飞行 : 倾斜飞行 = 1.5 : 2.35 : 2.2。
    /// 宽度同时按原素材画布比例推导，避免 aspectFit 因宽度不足再次缩小人物有效高度。
    private func playerVisualSize(flightBlend: CGFloat, tiltBlend: CGFloat) -> CGSize {
        let groundHeight: CGFloat = 120
        let groundSize = CGSize(width: groundHeight * 96 / 132, height: groundHeight)
        let uprightHeight = groundHeight * 2.35 / 1.5
        let uprightSize = CGSize(width: uprightHeight * 454 / 814, height: uprightHeight)
        let tiltedHeight = groundHeight * 2.2 / 1.5
        let tiltedSize = CGSize(width: tiltedHeight * 567 / 690, height: tiltedHeight)
        let flightSize = interpolate(uprightSize, tiltedSize, progress: tiltBlend)
        return interpolate(groundSize, flightSize, progress: flightBlend)
    }

    private func interpolate(_ start: CGSize, _ end: CGSize, progress: CGFloat) -> CGSize {
        let progress = min(1, max(0, progress))
        return CGSize(
            width: start.width + (end.width - start.width) * progress,
            height: start.height + (end.height - start.height) * progress
        )
    }

    private func entityScreenY(_ entity: WorldEntity, visualSize: CGSize, groundY: CGFloat, canvasHeight: CGFloat) -> CGFloat {
        if isGroundAnchored(entity.kind) {
            let animatedLift = CGFloat(max(0, entity.y - entity.originY)) * canvasHeight
            return groundY - animatedLift - visualSize.height / 2 + 4
        }
        return groundY - CGFloat(entity.y - RunGameViewModel.groundLevel) * canvasHeight - visualSize.height / 2
    }

    private func isGroundAnchored(_ kind: WorldEntityKind) -> Bool {
        switch kind {
        case .item, .chest, .obstacle:
            return true
        case .hazard(let name):
            return name.hasPrefix("石球") || name == "地刺_三连" || name == "圆形地刺盘" || name == "长矛"
        default:
            return false
        }
    }

    private func playerScreenX(size: CGSize) -> CGFloat {
        if vm.isFinishCameraLocked {
            let cameraAnchorX = size.width * 0.30
            let visibleWorldWidth = size.width - cameraAnchorX
            return cameraAnchorX + CGFloat((vm.distance - vm.cameraDistance) / 34) * visibleWorldWidth
        }
        let runInProgress = CGFloat(min(1, max(0, vm.distance / 12)))
        let startX = size.width * 0.12
        let cameraX = size.width * 0.30
        return startX + (cameraX - startX) * runInProgress
    }

    private func scrollingBackground(size: CGSize) -> some View {
        let tileWidth = size.height * (1850.0 / 850.0)
        let worldPointsPerMeter = size.width * 0.70 / 34.0
        let cycleWidth = tileWidth * 2
        let offset = (CGFloat(vm.cameraDistance) * worldPointsPerMeter).truncatingRemainder(dividingBy: cycleWidth)

        return ZStack {
            HStack(spacing: 0) {
                ForEach(0..<4, id: \.self) { index in
                    AssetImage(path: AssetPath.runBackground, contentMode: .fill)
                        .frame(width: tileWidth, height: size.height)
                        .clipped()
                        .scaleEffect(x: index.isMultiple(of: 2) ? 1 : -1, y: 1)
                }
            }
            .frame(width: tileWidth * 4, height: size.height)
            .position(x: tileWidth * 2 - offset, y: size.height / 2)
        }
        .frame(width: size.width, height: size.height)
        .clipped()
    }

    private var playerView: some View {
        let flightBlend = vm.flightTransitionProgress
        let tiltBlend = vm.flightTiltProgress
        return ZStack {
            groundPlayerView
                .scaleEffect(x: vm.facingDirection < 0 ? -1 : 1, y: 1)
                .opacity(1 - flightBlend)
            AssetImage(path: flightAssetPath(posture: "竖直"))
                .opacity(flightBlend * (1 - tiltBlend))
            AssetImage(path: flightAssetPath(posture: "倾斜"))
                .opacity(flightBlend * tiltBlend)
        }
    }

    private func playerWithItemEffects(playerSize: CGSize) -> some View {
        let stageSize = CGSize(
            width: max(260, playerSize.width * 2.35),
            height: max(270, playerSize.height * 1.72)
        )
        return ZStack {
            playerAuraEffects(playerSize: playerSize)
            playerMotionTrails(playerSize: playerSize)
            playerView
                .frame(width: playerSize.width, height: playerSize.height)
                .clipped()
                .opacity(vm.playerDamageOpacity)
                .rotationEffect(.degrees(vm.rockKnockbackTiltDegrees), anchor: .bottom)
                .offset(x: vm.rockKnockbackVisualOffset)
            playerForegroundEffects(playerSize: playerSize)
        }
        .frame(width: stageSize.width, height: stageSize.height)
        .allowsHitTesting(false)
    }

    @ViewBuilder
    private func playerAuraEffects(playerSize: CGSize) -> some View {
        let phase = CGFloat(vm.effectClock)
        let scale = max(0.72, playerSize.height / 120)

        if vm.isLuckyEffectActive {
            let radius = 80 * scale
            ForEach(0..<10, id: \.self) { index in
                let angle = phase * (.pi * 2 / 1.2) + CGFloat(index) * (.pi * 2 / 10)
                Circle()
                    .fill(index.isMultiple(of: 3) ? Color.yellow : Color.green.opacity(0.82))
                    .frame(width: index.isMultiple(of: 3) ? 7 : 5, height: index.isMultiple(of: 3) ? 7 : 5)
                    .shadow(color: .yellow.opacity(0.8), radius: 3)
                    .offset(x: cos(angle) * radius, y: sin(angle) * radius * 0.72)
            }
        }

        if vm.isMagnetEffectActive {
            let diameter = playerSize.height * 1.40 * (0.96 + 0.04 * sin(phase * .pi * 2 / 1.5))
            Circle()
                .fill(
                    LinearGradient(
                        colors: [.red.opacity(0.13), .clear, .blue.opacity(0.15)],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .frame(width: diameter, height: diameter)
            Circle()
                .trim(from: 0.02, to: 0.48)
                .stroke(Color.red.opacity(0.72), style: StrokeStyle(lineWidth: 5, lineCap: .round))
                .frame(width: diameter, height: diameter)
                .rotationEffect(.degrees(90))
            Circle()
                .trim(from: 0.52, to: 0.98)
                .stroke(Color.cyan.opacity(0.80), style: StrokeStyle(lineWidth: 5, lineCap: .round))
                .frame(width: diameter, height: diameter)
                .rotationEffect(.degrees(90))
        }

        if vm.isShieldEffectActive || vm.isShieldBreaking {
            let breakProgress = CGFloat(vm.shieldBreakEffectProgress)
            let diameter = playerSize.height * 1.30
            Circle()
                .fill(Color.blue.opacity(vm.isShieldBreaking ? 0.12 * (1 - breakProgress) : 0.16))
                .overlay(Circle().stroke(Color.cyan.opacity(0.78), lineWidth: 3))
                .frame(width: diameter, height: diameter)
                .scaleEffect(vm.isShieldBreaking ? 1 + breakProgress * 0.30 : 1 + 0.025 * sin(phase * .pi))
                .opacity(vm.isShieldBreaking ? 1 - breakProgress : 1)
            Text("★")
                .font(.system(size: playerSize.height * 0.30, weight: .bold))
                .foregroundColor(.white.opacity(vm.isShieldBreaking ? 0 : 0.58))
        }
    }

    @ViewBuilder
    private func playerMotionTrails(playerSize: CGSize) -> some View {
        let direction = vm.facingDirection < 0 ? 1.0 : -1.0

        if vm.isSpeedShoesEffectActive {
            ForEach(1..<3, id: \.self) { index in
                playerView
                    .frame(width: playerSize.width, height: playerSize.height)
                    .clipped()
                    .opacity(0.18 / Double(index))
                    .offset(x: direction * CGFloat(index) * 14, y: CGFloat(index) * 2)
            }
            ForEach(0..<4, id: \.self) { index in
                Capsule()
                    .fill(Color.red.opacity(0.75 - Double(index) * 0.12))
                    .frame(width: 30 + CGFloat(index) * 8, height: 3)
                    .offset(
                        x: direction * (playerSize.width * 0.56 + CGFloat(index) * 9),
                        y: playerSize.height * 0.40 + CGFloat(index % 2) * 7
                    )
            }
        }

    }

    @ViewBuilder
    private func playerForegroundEffects(playerSize: CGSize) -> some View {
        if vm.isFirstAidEffectActive {
            let progress = CGFloat(vm.firstAidEffectProgress)
            medicalCross(size: playerSize.height * 0.28, color: .red)
                .offset(y: -playerSize.height * 0.08)
                .shadow(color: .white, radius: 5)
            ForEach(0..<6, id: \.self) { index in
                let angle = CGFloat(index) * .pi * 2 / 6
                medicalCross(size: 12, color: .red.opacity(0.88))
                    .offset(x: cos(angle) * progress * 62, y: sin(angle) * progress * 48)
                    .opacity(1 - progress)
            }
            Circle()
                .stroke(Color.white.opacity(1 - progress), lineWidth: 4)
                .frame(width: 28 + progress * 115, height: 28 + progress * 115)
        }

        if vm.isVitalityEffectActive {
            ForEach(0..<3, id: \.self) { index in
                let rise = CGFloat((vm.effectClock * 0.75 + Double(index) * 0.31).truncatingRemainder(dividingBy: 1))
                Capsule()
                    .fill(LinearGradient(colors: [.red.opacity(0.08), .red.opacity(0.48), .white.opacity(0.08)], startPoint: .bottom, endPoint: .top))
                    .frame(width: 10, height: playerSize.height * 0.72)
                    .offset(x: CGFloat(index - 1) * 18, y: playerSize.height * (0.30 - rise * 0.52))
                    .opacity(1 - Double(rise) * 0.65)
            }
            if vm.isVitalityHealPulsing {
                medicalCross(size: 20, color: .red)
                    .offset(y: -playerSize.height * 0.08)
                    .shadow(color: .white, radius: 5)
            }
        }

        if vm.isLuckyCoinSparkActive {
            Text("✦")
                .font(.system(size: 28, weight: .black))
                .foregroundColor(.yellow)
                .shadow(color: .orange, radius: 4)
                .offset(x: playerSize.width * 0.35, y: -playerSize.height * 0.30)
        }

        if vm.isSpeedShoesEffectActive {
            Text(vm.facingDirection < 0 ? "◁" : "▷")
                .font(.system(size: 21, weight: .black))
                .foregroundColor(.white)
                .shadow(color: .red, radius: 3)
                .offset(x: -CGFloat(vm.facingDirection) * playerSize.width * 0.58, y: playerSize.height * 0.36)
        }

        if vm.isMilkEffectActive {
            let progress = CGFloat(vm.milkEffectProgress)
            Circle()
                .fill(Color.white.opacity(0.62 * (1 - Double(progress))))
                .frame(width: playerSize.height * 0.52, height: playerSize.height * 0.52)
                .blur(radius: 8)
                .offset(y: -playerSize.height * 0.08)
            ForEach(0..<3, id: \.self) { index in
                Circle()
                    .fill(Color.white.opacity(0.82 - Double(index) * 0.12))
                    .overlay(Circle().stroke(Color.cyan.opacity(0.35), lineWidth: 1))
                    .frame(width: 10 + CGFloat(index) * 3, height: 10 + CGFloat(index) * 3)
                    .offset(x: CGFloat(index - 1) * 18, y: 12 - progress * (54 + CGFloat(index) * 7))
                    .opacity(1 - progress)
            }
        }

        if vm.isShieldBreaking {
            let progress = CGFloat(vm.shieldBreakEffectProgress)
            ForEach(0..<8, id: \.self) { index in
                let angle = CGFloat(index) * .pi * 2 / 8
                DiamondShape()
                    .fill(Color.cyan.opacity(0.92))
                    .frame(width: 9, height: 13)
                    .offset(x: cos(angle) * (40 + progress * 60), y: sin(angle) * (40 + progress * 60))
                    .opacity(1 - progress)
            }
        }
    }

    private func medicalCross(size: CGFloat, color: Color) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.10)
                .fill(color)
                .frame(width: size * 0.38, height: size)
            RoundedRectangle(cornerRadius: size * 0.10)
                .fill(color)
                .frame(width: size, height: size * 0.38)
        }
        .frame(width: size, height: size)
    }

    @ViewBuilder private var groundPlayerView: some View {
        if let path = vm.character.walkPath {
            AnimatedAssetView(path: path, isAnimating: vm.isMoving)
        } else {
            AssetImage(path: vm.character.portraitPath)
        }
    }

    private func flightAssetPath(posture: String) -> String {
        // 原素材目录的左右命名与角色在画面中的实际朝向相反，这里按视觉朝向映射。
        let facesLeft = vm.movementDirection < 0
        let direction = facesLeft ? "面向右" : "面向左"
        let directionSuffix = facesLeft ? "向右" : "向左"
        let folder: String
        let characterName: String
        switch vm.character.id {
        case "nobita": folder = "大熊"; characterName = "大雄"
        case "shizuka": folder = "静香"; characterName = "静香"
        case "dorami": folder = "哆啦美"; characterName = "哆啦美"
        default: folder = "哆啦A梦"; characterName = "哆啦A梦"
        }
        return "游戏内主界面/人物运动/使用道具后的角色状态/飞行靴/\(folder)/\(direction)/\(characterName)-飞行靴-\(posture)-\(directionSuffix).png"
    }

    @ViewBuilder private func entityImage(_ kind: WorldEntityKind) -> some View {
        switch kind {
        case .coin: AssetImage(path: "游戏内主界面/游戏内随机掉落素材/货币/金币.png")
        case .blueGem: AssetImage(path: "游戏内主界面/游戏内随机掉落素材/货币/蓝宝石.png")
        case .greenGem: AssetImage(path: "游戏内主界面/游戏内随机掉落素材/货币/绿宝石.png")
        case .redGem: AssetImage(path: "游戏内主界面/游戏内随机掉落素材/货币/红宝石.png")
        case .purpleGem: AssetImage(path: "游戏内主界面/游戏内随机掉落素材/货币/紫宝石.png")
        case .item(let id): AssetImage(path: runItemPath(id))
        case .chest(let kind): AssetImage(path: GameData.chest(kind).iconPath)
        case .obstacle(let name): AssetImage(path: "游戏内主界面/关卡机关与障碍素材/障碍物/\(name).png")
        case .hazard(let name): AssetImage(path: "游戏内主界面/关卡机关与障碍素材/陷阱/\(name).png")
        case .platform(let file): AssetImage(path: "游戏内主界面/关卡机关与障碍素材/悬浮台/\(file)")
        }
    }

    private func entitySize(_ kind: WorldEntityKind) -> CGSize {
        switch kind {
        case .coin, .blueGem, .greenGem, .redGem, .purpleGem: return .init(width: 40, height: 40)
        case .obstacle: return .init(width: 54, height: 54)
        case .hazard(let name):
            if name == "石球_大型" { return .init(width: 64, height: 60) }
            if name == "石球_小型" { return .init(width: 50, height: 49) }
            if name == "石球_裂纹" { return .init(width: 50, height: 48) }
            if name == "地刺_三连" { return .init(width: 69, height: 38) }
            if name == "圆形地刺盘" { return .init(width: 54, height: 31) }
            if name == "吊链落刺" { return .init(width: 87, height: 78) }
            if name == "墙面侧刺" { return .init(width: 44, height: 110) }
            if name == "木板侧刺" { return .init(width: 58, height: 86) }
            if name == "箭矢_向下" { return .init(width: 22, height: 72) }
            if name == "箭矢_向左" || name == "箭矢_向右" { return .init(width: 72, height: 22) }
            if name == "长矛" { return .init(width: 28, height: 98) }
            return .init(width: 54, height: 54)
        case .platform: return .init(width: 110, height: 50)
        default: return .init(width: 58, height: 58)
        }
    }

    private func runItemPath(_ id: String) -> String {
        let root = "游戏内主界面/游戏内随机掉落素材"
        let utilityNames = ["energy_milk": "能量牛奶", "speed_shoes": "极速跑鞋", "shield": "防护盾", "magnet": "超级磁铁", "flight_boots": "飞行靴"]
        if let name = utilityNames[id] { return "\(root)/通用道具/\(name).png" }
        guard let item = GameData.item(id), item.category == .food else { return GameData.item(id)?.iconPath ?? "" }
        let folder: String
        switch item.owner ?? "" {
        case "nobita": folder = "大熊专用"
        case "shizuka": folder = "静香专用"
        case "dorami": folder = "哆啦美专用"
        default: folder = "哆啦A梦专用"
        }
        return "\(root)/食物道具/\(folder)/\(item.name).png"
    }

    private func hud(size: CGSize) -> some View {
        VStack {
            HStack(alignment: .top) {
                HStack(alignment: .top, spacing: 8) {
                    AssetImage(path: "游戏内主界面/血条+头像+能量条/人物头像（方形的）/角色卡_\(vm.character.name).png").frame(width: 100, height: 100)
                    VStack(alignment: .leading, spacing: 5) {
                        HStack(spacing: 2) { ForEach(0..<5, id: \.self) { i in AssetImage(path: i < vm.hearts ? "游戏内主界面/血条+头像+能量条/血量/红心.png" : "游戏内主界面/血条+头像+能量条/血量/灰心.png").frame(width: 34, height: 34) } }
                        ZStack {
                            AssetImage(path: "游戏内主界面/血条+头像+能量条/能量条/001-蓝色血条.png")
                            HStack(spacing: 0) {
                                ForEach(0..<5, id: \.self) { i in
                                    AssetImage(path: energyPath(index: i, active: i < vm.energy)).frame(width: 36, height: 24)
                                }
                            }.padding(.horizontal, 8)
                        }.frame(width: 200, height: 40)
                    }
                }
                .offset(x: -62)
                Spacer()
                VStack(spacing: 1) {
                    AssetImage(path: "游戏内主界面/得分距离文字/001-得分标签.png").frame(width: 64, height: 37)
                    Text("\(vm.score)").pixelText(22)
                    AssetImage(path: "游戏内主界面/得分距离文字/002-距离标签.png").frame(width: 64, height: 37)
                    Text("\(Int(vm.distance)) / \(Int(vm.targetDistance))m").pixelText(18)
                }
                Spacer()
                HStack(spacing: 8) {
                    navButton("游戏内主界面/按钮/导航按钮-背包.png") { state.openInventory(from: .run) }
                    navButton(state.profile.settings.musicVolume > 0 ? "游戏内主界面/按钮/音量开启:关闭/控制按钮-音量开启新版.png" : "游戏内主界面/按钮/音量开启:关闭/控制按钮-音量关闭新版.png") { state.toggleMusic() }
                    navButton("游戏内主界面/按钮/暂停:开始/控制按钮-暂停大图.png") { vm.togglePause() }
                    navButton("游戏内主界面/按钮/关卡设置按钮.png") { state.openSettings(from: .run) }
                    navButton("游戏内主界面/按钮/导航按钮-首页.png") { state.navigate(.home) }
                }
                .offset(x: 62)
            }.padding(.horizontal, 24).padding(.top, 42)
            Spacer()
        }
    }

    private var controls: some View {
        VStack {
            Spacer()
            HStack(alignment: .bottom) {
                HStack(spacing: 16) {
                    HoldArtButton(path: "游戏内主界面/按钮/方向键/方向按钮-左.png", size: 82, onPress: { vm.setHorizontal(-1) }, onRelease: vm.stopHorizontal)
                    HoldArtButton(path: "游戏内主界面/按钮/方向键/方向按钮-右.png", size: 82, onPress: { vm.setHorizontal(1) }, onRelease: vm.stopHorizontal)
                }
                .offset(x: -20)
                Spacer()
                VStack(spacing: 8) {
                    HoldArtButton(
                        path: "游戏内主界面/按钮/方向键/方向按钮-上.png",
                        size: 82,
                        onPress: {
                            vm.setVertical(1)
                            state.audio.playSFX("sfx_jump", settings: state.profile.settings)
                        },
                        onRelease: vm.stopVertical
                    )
                    HoldArtButton(
                        path: "游戏内主界面/按钮/方向键/方向按钮-下.png",
                        size: 82,
                        onPress: { vm.setVertical(-1) },
                        onRelease: vm.stopVertical
                    )
                    .opacity(vm.flyingRemaining > 0 ? 1 : 0.4)
                }
                .offset(x: 20)
            }.padding(.horizontal, 26).padding(.bottom, 0)
        }
    }

    private var quickSlots: some View {
        let energyPulse = 1 + 0.045 * sin(vm.effectClock * .pi * 3.2)
        let energyFlicker = 0.86 + 0.14 * (0.5 + 0.5 * sin(vm.effectClock * .pi * 4.6))
        let ordinaryItemCount = vm.collectedQuickItemOrder.count + vm.loadout.count
        return HStack {
            Spacer()
            VStack(spacing: 6) {
                if vm.energy >= 5 {
                    Button {
                        vm.activateEnergy()
                        state.audio.playSFX("sfx_confirm", settings: state.profile.settings)
                    } label: {
                        AssetImage(path: runItemPath(vm.energySkillItemID))
                            .frame(width: 64, height: 64)
                            .scaleEffect(energyPulse)
                            .opacity(energyFlicker)
                            .offset(y: CGFloat(sin(vm.effectClock * .pi * 2.4)) * 3)
                    }
                    .buttonStyle(GameHapticButtonStyle())
                }
                // 能量效果不计入三格限制；普通道具一次只显示三个，多出部分上下滑动查看。
                ScrollView(.vertical, showsIndicators: ordinaryItemCount > 3) {
                    VStack(spacing: 6) {
                        ForEach(vm.collectedQuickItemOrder, id: \.self) { id in
                            Button {
                                vm.useCollectedItem(id)
                                state.audio.playSFX("sfx_confirm", settings: state.profile.settings)
                            } label: {
                                quickItemIcon(id: id, count: vm.collectedQuickItems[id] ?? 0)
                            }
                            .buttonStyle(GameHapticButtonStyle())
                        }
                        ForEach(0..<vm.loadout.count, id: \.self) { index in
                            Button { vm.useSlot(index); state.audio.playSFX("sfx_confirm", settings: state.profile.settings) } label: {
                                AssetImage(path: GameData.item(vm.loadout[index])?.iconPath ?? "")
                                    .frame(width: 58, height: 58)
                                    .opacity(vm.usedLoadout.contains(vm.loadout[index]) ? 0.38 : 1)
                            }
                            .buttonStyle(GameHapticButtonStyle())
                            .disabled(vm.usedLoadout.contains(vm.loadout[index]))
                        }
                    }
                }
                .frame(width: 76, height: 198, alignment: .top)
                .clipped()
            }
            .padding(.trailing, 18)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .trailing)
        .offset(y: 4)
    }

    private func quickItemIcon(id: String, count: Int) -> some View {
        ZStack(alignment: .bottomTrailing) {
            AssetImage(path: GameData.item(id)?.iconPath ?? "")
                .frame(width: 58, height: 58)
            if count > 1 {
                Text("×\(count)")
                    .pixelText(13)
                    .padding(.horizontal, 5)
                    .padding(.vertical, 1)
                    .background(Color.black.opacity(0.72))
                    .clipShape(Capsule())
                    .offset(x: 2, y: 2)
            }
        }
        .frame(width: 62, height: 62)
    }

    private func navButton(_ path: String, action: @escaping () -> Void) -> some View { Button(action: action) { AssetImage(path: path).frame(width: 72, height: 72) }.buttonStyle(GameHapticButtonStyle()) }

    private var finishGatePath: String {
        "游戏内主界面/通关素材/终点/终点大门-\(vm.finishGateColor).png"
    }

    private var completionCelebration: some View {
        let root = "游戏内主界面/通关素材/通关特效"
        return AssetImage(path: "\(root)/\(vm.completionEffectName).png")
            .frame(width: 440, height: 390)
            .scaleEffect(vm.completionEffectScale)
            .opacity(vm.completionEffectOpacity)
            .position(x: 512, y: 318)
    }

    private func energyPath(index: Int, active: Bool) -> String {
        guard active else { return "游戏内主界面/血条+头像+能量条/能量条/灰色.png" }
        let files = ["003-黄色能量块.png", "004-黄绿能量块.png", "005-浅绿能量块.png", "006-绿色能量块.png", "007-深绿能量块.png"]
        return "游戏内主界面/血条+头像+能量条/能量条/\(files[index])"
    }
}

struct HoldArtButton: View {
    let path: String
    var size: CGFloat = 82
    let onPress: () -> Void
    let onRelease: () -> Void
    @State private var pressed = false
    var body: some View {
        AssetImage(path: path).frame(width: size, height: size).scaleEffect(pressed ? 0.92 : 1)
            .contentShape(Rectangle())
            .gesture(DragGesture(minimumDistance: 0).onChanged { _ in
                if !pressed {
                    pressed = true
                    onPress()
                }
            }.onEnded { _ in pressed = false; onRelease() })
    }
}

private struct DiamondShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.midX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
        path.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.midY))
        path.closeSubpath()
        return path
    }
}

struct PauseView: View {
    @EnvironmentObject private var state: GameAppState
    @ObservedObject var vm: RunGameViewModel
    var body: some View {
        ZStack {
            AssetImage(path: "暂停页/暂停面板.png").frame(width: 250, height: 340)
            VStack(spacing: 6) {
                art("暂停页/按钮/继续游戏按钮.png") { vm.togglePause() }
                art("暂停页/按钮/重新开始按钮.png") { state.restartLevel() }
                art("暂停页/按钮/设置按钮.png") { state.openSettings(from: .run) }
                art("暂停页/按钮/返回主页按钮.png") { state.navigate(.home) }
            }
            .position(x: 125, y: 180)
        }
        .frame(width: 250, height: 340)
    }
    private func art(_ path: String, action: @escaping () -> Void) -> some View { Button(action: action) { AssetImage(path: path).frame(width: 190, height: 50) }.buttonStyle(GameHapticButtonStyle()) }
}

struct ResultView: View {
    @EnvironmentObject private var state: GameAppState
    @State private var rewardPage = 0

    var body: some View {
        ZStack {
            AssetImage(path: AssetPath.runBackground, contentMode: .fill).ignoresSafeArea()
            if let result = state.latestResult ?? state.profile.lastRunSummary {
                resultPanel(result)
                    .offset(y: 6)
            }
        }
    }

    private func resultPanel(_ result: RunSummary) -> some View {
        ZStack {
            AssetImage(path: result.success ? "结算页/底框/成功面板-空白.png" : "结算页/底框/失败面板-空白.png")
            GeometryReader { _ in
                HStack(spacing: 5) {
                    ForEach(0..<3, id: \.self) { i in
                        AssetImage(path: i < result.stars ? "结算页/星级/亮星.png" : "结算页/星级/黑星.png").frame(width: 44, height: 44)
                    }
                }.position(x: 130, y: 102)
                Text("\(result.score)")
                    .font(.system(size: 24, weight: .black, design: .rounded))
                    .foregroundColor(.black)
                    .position(x: 130, y: 177)
                rewardCarousel(resultRewards(result))
                    .position(x: 130, y: 260)
                HStack(spacing: 8) {
                    resultButton("结算页/结算按钮/01_重试按钮.png") { state.restartLevel() }
                    resultButton("结算页/结算按钮/03_主页按钮.png") { state.navigate(.home) }
                    resultButton(result.success && result.level < 20 ? "结算页/结算按钮/04_下一关按钮.png" : "结算页/结算按钮/04_下一关按钮_灰-不可点击.png") {
                        if result.success && result.level < 20 { state.startLevel(result.level + 1) }
                    }
                }.position(x: 130, y: 308)
            }
        }.frame(width: 260, height: 370)
    }

    private func resultButton(_ path: String, action: @escaping () -> Void) -> some View {
        Button(action: action) { AssetImage(path: path).frame(width: 38, height: 38) }.buttonStyle(GameHapticButtonStyle())
    }

    private func rewardCarousel(_ rewards: [ResultReward]) -> some View {
        let pages = stride(from: 0, to: rewards.count, by: 3).map {
            Array(rewards[$0..<min($0 + 3, rewards.count)])
        }

        return TabView(selection: $rewardPage) {
            ForEach(Array(pages.enumerated()), id: \.offset) { pageIndex, page in
                HStack(spacing: 5) {
                    ForEach(Array(page.enumerated()), id: \.offset) { _, value in
                        ZStack(alignment: .bottomTrailing) {
                            AssetImage(path: value.path)
                            Text("×\(value.count)")
                                .font(.system(size: 8, weight: .black))
                                .foregroundColor(.white)
                                .padding(2)
                                .background(Color.black.opacity(0.65))
                                .clipShape(Capsule())
                        }
                        .frame(width: 45, height: 45)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .tag(pageIndex)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .never))
        .frame(width: 155, height: 50)
        .task(id: pages.count) {
            rewardPage = 0
            guard pages.count > 1 else { return }
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 2_800_000_000)
                guard !Task.isCancelled else { return }
                withAnimation(.easeInOut(duration: 0.3)) {
                    rewardPage = (rewardPage + 1) % pages.count
                }
            }
        }
    }

    private struct ResultReward { let path: String; let count: Int }
    private func resultRewards(_ result: RunSummary) -> [ResultReward] {
        var values: [ResultReward] = []
        for (id, count) in result.itemRewards.sorted(by: { $0.key < $1.key }) { if let item = GameData.item(id) { values.append(.init(path: item.resultCardPath, count: count)) } }
        for (name, count) in result.chestRewards.sorted(by: { $0.key < $1.key }) { if let chest = GameData.chests.first(where: { $0.kind.rawValue == name }) { values.append(.init(path: chest.resultCardPath, count: count)) } }
        for (name, count) in result.keyRewards.sorted(by: { $0.key < $1.key }) { if let key = GameData.keys.first(where: { $0.kind.rawValue == name }) { values.append(.init(path: key.resultCardPath, count: count)) } }
        return values
    }
}

struct RewardCard: View {
    let name: String; let path: String; let count: Int
    var body: some View { VStack(spacing: 4) { AssetImage(path: path).frame(width: 68, height: 68); Text(name).font(.caption.bold()); Text("×\(count)").font(.caption.bold()) }.frame(width: 100, height: 112).background(Color.blue.opacity(0.12)).clipShape(RoundedRectangle(cornerRadius: 10)) }
}
