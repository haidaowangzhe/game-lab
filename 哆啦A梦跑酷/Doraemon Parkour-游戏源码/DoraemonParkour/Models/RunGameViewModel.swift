import Foundation
import Combine

enum WorldEntityKind: Equatable {
    case coin, blueGem, greenGem, redGem, purpleGem
    case item(String), chest(ChestKind), obstacle(String), hazard(String), platform(String)
}

enum RunHapticKind: Equatable {
    case shield, damage, success
}

/// 每个关卡使用自己的固定种子：同一关重玩保持可学习性，不同关卡则生成不同布局。
private struct LevelRandomGenerator: RandomNumberGenerator {
    private var state: UInt64

    init(seed: UInt64) { state = seed }

    mutating func next() -> UInt64 {
        state &+= 0x9E3779B97F4A7C15
        var value = state
        value = (value ^ (value >> 30)) &* 0xBF58476D1CE4E5B9
        value = (value ^ (value >> 27)) &* 0x94D049BB133111EB
        return value ^ (value >> 31)
    }
}

struct WorldEntity: Identifiable, Equatable {
    let id = UUID()
    let kind: WorldEntityKind
    let originX: Double
    let originY: Double
    var x: Double
    var y: Double
    var rotation: Double = 0
    var collected = false
    var triggered = false
    var isActive = true
    var disabledUntil: Double = 0

    init(kind: WorldEntityKind, x: Double, y: Double) {
        self.kind = kind
        originX = x
        originY = y
        self.x = x
        self.y = y
    }
}

@MainActor
final class RunGameViewModel: ObservableObject {
    static let groundLevel = 0.22
    /// 以 637pt 设计画布计算，直立飞行素材在该高度恰好贴近屏幕顶部而不会飞出画面。
    static let flightCeiling = 0.80

    let level: Int
    let character: CharacterDefinition
    let loadout: [String]
    let targetDistance: Double
    let finishGateColor: String
    let completionEffectName: String
    @Published var distance: Double = 0
    @Published private(set) var cameraDistance: Double = 0
    @Published var score = 0
    @Published var hearts = 5
    @Published var energy = 0
    @Published var playerY: Double = groundLevel
    @Published var laneOffset: Double = 0
    @Published private(set) var movementDirection: Double = 0
    @Published private(set) var facingDirection: Double = 1
    @Published var isPaused = false
    @Published var finished: Bool?
    @Published var usedLoadout: Set<String> = []
    @Published var entities: [WorldEntity] = []
    @Published var pickupCoins = 0
    @Published var pickupDiamonds = 0
    @Published var pickupItems: [String: Int] = [:]
    @Published var pickupChests: [ChestKind: Int] = [:]
    /// 本局拾到但尚未使用的道具，按首次拾取顺序显示在右侧快捷栏。
    @Published private(set) var collectedQuickItems: [String: Int] = [:]
    @Published private(set) var collectedQuickItemOrder: [String] = []
    @Published var flyingRemaining: Double = 0
    @Published private(set) var flightTransitionProgress: Double = 0
    @Published private(set) var flightTiltProgress: Double = 0
    @Published var shieldCharges = 0
    @Published var effectMessage: String?
    @Published private(set) var effectClock: Double = 0
    @Published private(set) var isFinishCameraLocked = false
    @Published private(set) var isCompleting = false
    @Published private(set) var hapticSignal = 0
    @Published private(set) var hapticKind: RunHapticKind = .damage

    private var timer: Timer?
    private var verticalVelocity: Double = 0
    private var verticalControl: Double = 0
    private var jumpsUsed = 0
    private var invincible: Double = 0
    private var hurtBlinkRemaining: Double = 0
    private var knockbackRemaining: Double = 0
    private var knockbackDuration: Double = 0
    private var knockbackVelocity: Double = 0
    private var knockbackDirection: Double = -1
    private var rockKnockback = false
    private var magnetRemaining: Double = 0
    private var luckyRemaining: Double = 0
    private var leapRemaining: Double = 0
    private var speedShoesRemaining: Double = 0
    private var nobitaSpeedRemaining: Double = 0
    private var firstAidEffectRemaining: Double = 0
    private var vitalityRemaining: Double = 0
    private var vitalitySecondHealPending = false
    private var vitalityHealPulseRemaining: Double = 0
    private var milkEffectRemaining: Double = 0
    private var shieldBreakEffectRemaining: Double = 0
    private var luckyCoinSparkRemaining: Double = 0
    private var leapJumpBurstRemaining: Double = 0
    private var debugEffectPreviewID: String?
    private var elapsed: Double = 0
    private var flightTargetY: Double = groundLevel
    private var worldPointsPerMeter: Double = 28
    private var completionEffectRemaining: Double = 0
    private let completionEffectDuration: Double = 2.8

    init(level: Int, character: CharacterDefinition, loadout: [String]) {
        self.level = level; self.character = character; self.loadout = loadout
        finishGateColor = ["蓝色", "红色", "紫色"].randomElement() ?? "蓝色"
        completionEffectName = [
            "通关撒花-左上", "通关撒花-中上", "通关烟花-右上",
            "通关撒花-左下", "通关烟花-中下", "通关烟花-右下"
        ].randomElement() ?? "通关撒花-中上"
        #if DEBUG
        let fastSuccess = ProcessInfo.processInfo.arguments.contains("-uiTestSuccess")
        #else
        let fastSuccess = false
        #endif
        targetDistance = fastSuccess ? 24 : 330 + Double(level * 18)
        entities = Self.makeEntities(level: level, target: targetDistance, character: character)
        #if DEBUG
        isPaused = ProcessInfo.processInfo.arguments.contains("-uiTestPause")
        if ProcessInfo.processInfo.arguments.contains("-uiTestFlight") {
            flyingRemaining = 10
            playerY = 0.45
            flightTargetY = playerY
            flightTransitionProgress = 1
        }
        if ProcessInfo.processInfo.arguments.contains("-uiTestFlightForward") {
            flyingRemaining = 10
            playerY = 0.45
            flightTargetY = playerY
            flightTransitionProgress = 1
            flightTiltProgress = 1
            movementDirection = 1
            facingDirection = 1
        }
        if let effectIndex = ProcessInfo.processInfo.arguments.firstIndex(of: "-uiTestItemEffect"),
           ProcessInfo.processInfo.arguments.indices.contains(effectIndex + 1) {
            debugEffectPreviewID = ProcessInfo.processInfo.arguments[effectIndex + 1]
            configureDebugEffectPreview(debugEffectPreviewID!)
        }
        #endif
        timer = Timer.scheduledTimer(withTimeInterval: 1.0 / 30.0, repeats: true) { [weak self] _ in Task { @MainActor in self?.tick(1.0 / 30.0) } }
    }

    deinit { timer?.invalidate() }

    func setHorizontal(_ value: Double) {
        guard !isCompleting else { return }
        movementDirection = min(1, max(-1, value))
        if movementDirection != 0 { facingDirection = movementDirection }
    }
    func stopHorizontal() { movementDirection = 0 }

    func updateWorldScale(pointsPerMeter: Double) {
        worldPointsPerMeter = max(1, pointsPerMeter)
    }

    var isMoving: Bool {
        (movementDirection > 0 && distance < targetDistance) || (movementDirection < 0 && distance > 0)
    }

    func jumpOrUp() {
        guard finished == nil, !isPaused, !isCompleting else { return }
        if flyingRemaining > 0 { flightTargetY = min(Self.flightCeiling, flightTargetY + 0.08) }
        else { launchJump(allowAirborneJump: true) }
    }

    func down() { if flyingRemaining > 0 { flightTargetY = max(Self.groundLevel + 0.04, flightTargetY - 0.08) } }

    /// 方向键按住期间持续保持输入：地面会在每次落地后再次起跳，飞行时则连续升降。
    func setVertical(_ value: Double) {
        guard finished == nil, !isPaused, !isCompleting else { return }
        let wasPressingUp = verticalControl > 0
        verticalControl = min(1, max(-1, value))
        if value > 0, !wasPressingUp, flyingRemaining <= 0 {
            launchJump(allowAirborneJump: true)
        }
    }

    func stopVertical() { verticalControl = 0 }

    private func launchJumpIfSupported() {
        launchJump(allowAirborneJump: false)
    }

    /// 地面起跳消耗第一段；松开后在空中再次按下可消耗第二段。
    /// 按住上键时只会在落地后重新开始第一段，不会自动触发第二段。
    private func launchJump(allowAirborneJump: Bool) {
        let supported = isPlayerSupported
        if supported { jumpsUsed = 0 }
        guard supported || (allowAirborneJump && jumpsUsed < 2) else { return }
        let baseVelocity: Double
        switch character.id {
        case "shizuka": baseVelocity = 1.48
        case "dorami": baseVelocity = 1.44
        case "suneo": baseVelocity = 1.40
        case "doraemon": baseVelocity = 1.38
        case "gian": baseVelocity = 1.36
        default: baseVelocity = 1.34 // 大雄仍能越过全部地面陷阱，但保留角色差异
        }
        let isSecondJump = !supported && jumpsUsed == 1
        // 在相同重力下，起跳速度乘以 sqrt(0.5) 会让实际上升高度约为第一段的一半。
        let jumpStageScale = isSecondJump ? 0.7071 : 1
        jumpsUsed += 1
        verticalVelocity = baseVelocity * jumpStageScale * (leapRemaining > 0 ? 1.20 : 1)
        if leapRemaining > 0 { leapJumpBurstRemaining = 0.45 }
    }
    func togglePause() { isPaused.toggle() }

    func activateEnergy() {
        guard !isCompleting else { return }
        guard energy >= 5 else { effectMessage = "能量尚未充满"; return }
        energy = 0
        switch character.id {
        case "doraemon": beginFlight(); effectMessage = "能量飞行：10秒内无视地面障碍"
        case "nobita": nobitaSpeedRemaining = 12; effectMessage = "勇气加速：12秒"
        case "shizuka": hearts = min(5, hearts + 2); shieldCharges += 1; effectMessage = "甜心守护：恢复2颗心并获得护盾"
        case "dorami": magnetRemaining = 12; luckyRemaining = 12; effectMessage = "幸运磁力：12秒"
        default: shieldCharges += 1; effectMessage = "能量护盾"
        }
    }

    var energySkillItemID: String {
        switch character.id {
        case "doraemon": return "flight_boots"
        case "nobita": return "speed_shoes"
        case "shizuka": return "shield"
        case "dorami": return "magnet"
        default: return "shield"
        }
    }

    func useSlot(_ index: Int) {
        guard !isCompleting, loadout.indices.contains(index), finished == nil, !usedLoadout.contains(loadout[index]), let item = GameData.item(loadout[index]) else { return }
        usedLoadout.insert(item.id)
        applyItemEffect(item)
        effectMessage = "已使用\(item.name)"
    }

    func useCollectedItem(_ id: String) {
        guard !isCompleting,
              finished == nil,
              let count = collectedQuickItems[id], count > 0,
              let item = GameData.item(id) else { return }
        applyItemEffect(item)
        if count == 1 {
            collectedQuickItems[id] = nil
            collectedQuickItemOrder.removeAll { $0 == id }
        } else {
            collectedQuickItems[id] = count - 1
        }
        let remainingForInventory = max(0, (pickupItems[id] ?? 0) - 1)
        if remainingForInventory == 0 { pickupItems[id] = nil }
        else { pickupItems[id] = remainingForInventory }
        effectMessage = "已使用拾取的\(item.name)"
    }

    private func enqueueCollectedItem(_ id: String) {
        if collectedQuickItems[id] == nil { collectedQuickItemOrder.append(id) }
        collectedQuickItems[id, default: 0] += 1
        pickupItems[id, default: 0] += 1
    }

    /// 背包携带道具和关卡内拾取道具共用同一套效果，避免出现拾到了却不能使用的情况。
    private func applyItemEffect(_ item: ItemDefinition) {
        switch item.id {
        case "first_aid":
            hearts = min(5, hearts + 3)
            firstAidEffectRemaining = 0.8
        case "vitality_drink":
            hearts = min(5, hearts + 1)
            vitalityRemaining = 5
            vitalitySecondHealPending = true
            vitalityHealPulseRemaining = 0.32
        case "lucky_drink": luckyRemaining = 20
        case "leap_drink": leapRemaining = 15
        case "magnet": magnetRemaining = 20
        case "shield": shieldCharges += 1
        case "speed_shoes": speedShoesRemaining = 15
        case "flight_boots": beginFlight()
        case "energy_milk":
            hearts = min(5, hearts + 1)
            milkEffectRemaining = 0.6
        default:
            if item.category == .food { hearts = min(5, hearts + (item.buyPrice == 40 ? 1 : item.buyPrice == 80 ? 2 : 3)) }
        }
    }

    private func beginFlight() {
        flyingRemaining = 10
        flightTargetY = max(0.42, playerY)
        verticalVelocity = 0
        if movementDirection == 0 { facingDirection = 1 }
    }

    private func tick(_ dt: Double) {
        guard !isPaused, finished == nil else { return }
        elapsed += dt
        effectClock += dt
        if isCompleting {
            completionEffectRemaining = max(0, completionEffectRemaining - dt)
            if completionEffectRemaining == 0 { finished = true }
            return
        }
        invincible = max(0, invincible - dt)
        hurtBlinkRemaining = max(0, hurtBlinkRemaining - dt)
        if knockbackRemaining > 0 {
            knockbackRemaining = max(0, knockbackRemaining - dt)
            distance = min(targetDistance, max(0, distance + knockbackVelocity * dt))
            knockbackVelocity *= exp(-4.2 * dt)
            if knockbackRemaining == 0 {
                knockbackVelocity = 0
                rockKnockback = false
            }
        }
        flyingRemaining = max(0, flyingRemaining - dt)
        let flightIsActive = flyingRemaining > 0
        flightTransitionProgress = approach(
            flightTransitionProgress,
            target: flightIsActive ? 1 : 0,
            maximumDelta: dt / (flightIsActive ? 0.55 : 0.38)
        )
        flightTiltProgress = approach(
            flightTiltProgress,
            target: flightIsActive && abs(movementDirection) > 0.01 ? 1 : 0,
            maximumDelta: dt / 0.28
        )
        magnetRemaining = max(0, magnetRemaining - dt)
        luckyRemaining = max(0, luckyRemaining - dt)
        leapRemaining = max(0, leapRemaining - dt)
        speedShoesRemaining = max(0, speedShoesRemaining - dt)
        nobitaSpeedRemaining = max(0, nobitaSpeedRemaining - dt)
        firstAidEffectRemaining = max(0, firstAidEffectRemaining - dt)
        milkEffectRemaining = max(0, milkEffectRemaining - dt)
        vitalityHealPulseRemaining = max(0, vitalityHealPulseRemaining - dt)
        shieldBreakEffectRemaining = max(0, shieldBreakEffectRemaining - dt)
        luckyCoinSparkRemaining = max(0, luckyCoinSparkRemaining - dt)
        leapJumpBurstRemaining = max(0, leapJumpBurstRemaining - dt)
        if vitalityRemaining > 0 {
            let previous = vitalityRemaining
            vitalityRemaining = max(0, vitalityRemaining - dt)
            if vitalitySecondHealPending, previous > 2.5, vitalityRemaining <= 2.5 {
                vitalitySecondHealPending = false
                hearts = min(5, hearts + 1)
                vitalityHealPulseRemaining = 0.32
            }
        }
        keepDebugEffectAliveIfNeeded()
        let speedMultiplier = (leapRemaining > 0 ? 1.2 : 1)
            * (speedShoesRemaining > 0 ? 1.3 : 1)
            * (nobitaSpeedRemaining > 0 ? 1.35 : 1)
        let baseSpeed = (8.2 + Double(level) * 0.09 + Double(character.movement - 3) * 0.28) * speedMultiplier
        let distanceBeforeMovement = distance
        let controlDuringImpact = knockbackRemaining > 0 ? 0.22 : 1
        let travel = baseSpeed * movementDirection * controlDuringImpact * dt
        let proposedDistance = min(targetDistance, max(0, distance + travel))
        distance = obstacleConstrainedDistance(from: distance, proposed: proposedDistance)
        if !isFinishCameraLocked {
            cameraDistance = distance
            if distance >= targetDistance - 25 {
                isFinishCameraLocked = true
            }
        }
        if distance > distanceBeforeMovement { score += Int(baseSpeed * 2) }
        if flightIsActive {
            flightTargetY = min(
                Self.flightCeiling,
                max(Self.groundLevel + 0.04, flightTargetY + verticalControl * 0.62 * dt)
            )
            let verticalBlend = min(1, dt / 0.20)
            playerY += (flightTargetY - playerY) * verticalBlend
        } else {
            if verticalControl > 0 { launchJumpIfSupported() }
            let previousPlayerY = playerY
            verticalVelocity -= 2.8 * dt
            playerY += verticalVelocity * dt
            landOnStandableSurface(previousPlayerY: previousPlayerY)
            if playerY <= Self.groundLevel {
                playerY = Self.groundLevel
                flightTargetY = Self.groundLevel
                verticalVelocity = 0
                jumpsUsed = 0
            }
        }
        updateHazards(dt)
        checkCollisions()
        resolveSolidContacts()
        if distance >= targetDistance { beginCompletionSequence() }
    }

    /// 角色完整进入终点后先锁住场景并播放通关素材，特效结束后才进入结算页。
    private func beginCompletionSequence() {
        guard !isCompleting else { return }
        isFinishCameraLocked = true
        isCompleting = true
        completionEffectRemaining = completionEffectDuration
        movementDirection = 0
        verticalControl = 0
        effectMessage = nil
        emitHaptic(.success)
    }

    private func updateHazards(_ dt: Double) {
        for index in entities.indices {
            guard !entities[index].collected, case .hazard(let name) = entities[index].kind else { continue }
            let phase = elapsed + entities[index].originX * 0.07
            switch name {
            case "石球_大型":
                updateRollingRock(index: index, speed: 4.2, dt: dt)
            case "石球_小型", "石球_裂纹":
                updateRollingRock(index: index, speed: name == "石球_裂纹" ? 6.0 : 5.6, dt: dt)
            case "吊链落刺", "箭矢_向下":
                updateDropOnceHazard(index: index, dt: dt, name: name)
            case "墙面侧刺", "木板侧刺":
                entities[index].x = entities[index].originX + sin(phase * 2.4) * 1.4
            case "长矛":
                entities[index].y = entities[index].originY + max(0, sin(phase * 2.8)) * 0.18
            case "箭矢_向左":
                updateHorizontalArrow(index: index, direction: -1, dt: dt)
            case "箭矢_向右":
                updateHorizontalArrow(index: index, direction: 1, dt: dt)
            default: break
            }
        }
    }

    /// 按实际滚动距离和可见半径换算旋转角度，使滚石提速后仍保持“贴地滚动”而非滑动。
    private func updateRollingRock(index: Int, speed: Double, dt: Double) {
        let radiusPoints = min(
            entityCollisionSize(entities[index].kind).width,
            entityCollisionSize(entities[index].kind).height
        ) * 0.43
        let travelledPoints = speed * worldPointsPerMeter * dt
        entities[index].x -= speed * dt
        entities[index].rotation -= travelledPoints / max(1, radiusPoints) * 180 / .pi
        entities[index].y = entities[index].originY
    }

    /// 横向箭矢由屏幕一侧边缘发射，完整飞过可视区域后才从另一侧消失。
    private func updateHorizontalArrow(index: Int, direction: Double, dt: Double) {
        guard elapsed >= entities[index].disabledUntil else {
            entities[index].isActive = false
            return
        }
        let metersBehindLeftEdge = 34.0 * 0.30 / 0.70
        let metersAheadRightEdge = 34.0
        let edgePadding = 1.6
        if !entities[index].triggered {
            guard abs(entities[index].originX - distance) <= 12 else {
                entities[index].isActive = false
                return
            }
            entities[index].triggered = true
            entities[index].isActive = true
            entities[index].x = direction > 0
                ? cameraDistance - metersBehindLeftEdge - edgePadding
                : cameraDistance + metersAheadRightEdge + edgePadding
        }
        entities[index].isActive = true
        entities[index].x += direction * 29 * dt
        let passedOppositeEdge = direction > 0
            ? entities[index].x > cameraDistance + metersAheadRightEdge + edgePadding
            : entities[index].x < cameraDistance - metersBehindLeftEdge - edgePadding
        if passedOppositeEdge {
            entities[index].isActive = false
            entities[index].x = entities[index].originX
            entities[index].triggered = false
            entities[index].disabledUntil = elapsed + 1.2
        }
    }

    private func nextHorizontalArrowCycle(for entity: WorldEntity) -> Double {
        let cycleDuration = 2.4
        let cycle = (elapsed + entity.originX * 0.07)
            .truncatingRemainder(dividingBy: cycleDuration)
        return elapsed + (cycleDuration - cycle) + 0.01
    }

    /// 下落类陷阱：停在屏幕顶部，玩家经过正下方后按固定速度下落一次。
    private func updateDropOnceHazard(index: Int, dt: Double, name: String) {
        entities[index].isActive = true
        if !entities[index].triggered {
            let triggerRange = name == "吊链落刺" ? 2.4 : 1.4
            if abs(entities[index].x - distance) <= triggerRange {
                entities[index].triggered = true
            }
            return
        }
        if entities[index].y <= Self.groundLevel + 0.001 { return }
        let fallSpeed = name == "吊链落刺" ? 1.15 : 1.9
        entities[index].y -= fallSpeed * dt
        if entities[index].y <= Self.groundLevel {
            entities[index].y = Self.groundLevel
            if name == "箭矢_向下" { entities[index].collected = true }
        }
    }

    private func checkCollisions() {
        for index in entities.indices where !entities[index].collected {
            let entity = entities[index]
            guard entity.isActive else { continue }
            let dx = abs(entity.x - distance)
            let magnetic = magnetRemaining > 0
                && debugEffectPreviewID != "magnet"
                && dx < 6
                && isPickup(entities[index].kind)
            var directCollision: Bool
            if case .hazard = entity.kind {
                directCollision = hazardTouchesPlayer(entity)
            } else {
                directCollision = dx <= pickupContactDistance(for: entity.kind)
                    && pickupBoundsOverlap(with: entity)
            }
            if isStandable(entity.kind), playerY >= entityTop(entity) - 0.008 {
                directCollision = false
            }
            guard directCollision || magnetic else { continue }
            switch entities[index].kind {
            case .hazard(let name):
                // 飞行只绕过地面实体阻挡，不提供无敌；空中陷阱和飞行路径上的机关照常伤害。
                guard invincible <= 0 else { continue }
                if shieldCharges > 0 {
                    shieldCharges -= 1
                    shieldBreakEffectRemaining = 0.3
                    invincible = 0.45
                    effectMessage = "护盾抵挡伤害"
                    emitHaptic(.shield)
                    consumeHazardAfterImpact(index: index, name: name)
                }
                else {
                    let damage = name == "石球_大型" || name == "吊链落刺" ? 2 : 1
                    hearts -= damage
                    invincible = 1.2
                    let knockDirection = distance <= entity.x ? -1.0 : 1.0
                    beginDamageFeedback(name: name, direction: knockDirection)
                    effectMessage = name.hasPrefix("石球") ? "被滚石击退" : "触发\(name)"
                    emitHaptic(.damage)
                    consumeHazardAfterImpact(index: index, name: name)
                    if hearts <= 0 { finished = false }
                }
            case .obstacle(let name):
                effectMessage = "\(name)阻挡了前进"
            case .platform: continue
            case .coin:
                pickupCoins += luckyRemaining > 0 ? 2 : 1
                score += 10
                if luckyRemaining > 0 { luckyCoinSparkRemaining = 0.35 }
                collect(index)
            case .blueGem: pickupCoins += 5; score += 40; collect(index)
            case .greenGem: pickupCoins += 12; score += 70; collect(index)
            case .redGem: pickupCoins += 25; score += 120; collect(index)
            case .purpleGem: pickupDiamonds += 1; score += 180; collect(index)
            case .item(let id):
                guard let item = GameData.item(id) else { collect(index); continue }
                score += 100
                collect(index)
                enqueueCollectedItem(id)
                effectMessage = "拾取\(item.name)，已加入右侧快捷栏"
            case .chest(let kind):
                pickupChests[kind, default: 0] += 1
                score += 250
                collect(index)
            }
        }
    }

    private func emitHaptic(_ kind: RunHapticKind) {
        hapticKind = kind
        hapticSignal &+= 1
    }

    private func beginDamageFeedback(name: String, direction: Double) {
        knockbackDirection = direction
        rockKnockback = name.hasPrefix("石球")
        if rockKnockback {
            knockbackDuration = name == "石球_大型" ? 0.95 : 0.72
            knockbackVelocity = direction * (name == "石球_大型" ? 8.2 : 6.2)
            hurtBlinkRemaining = 0
        } else {
            knockbackDuration = name == "吊链落刺" ? 0.48 : 0.26
            knockbackVelocity = direction * (name == "吊链落刺" ? 4.0 : 2.4)
            hurtBlinkRemaining = 1.0
        }
        knockbackRemaining = knockbackDuration
    }

    private func consumeHazardAfterImpact(index: Int, name: String) {
        switch name {
        case "石球_裂纹", "箭矢_向下":
            entities[index].collected = true
        case "箭矢_向左", "箭矢_向右":
            entities[index].isActive = false
            entities[index].triggered = false
            entities[index].x = entities[index].originX
            entities[index].disabledUntil = elapsed + 1.2
        default:
            break
        }
    }

    private func collect(_ index: Int) { entities[index].collected = true; energy = min(5, energy + 1) }
    private func isPickup(_ kind: WorldEntityKind) -> Bool { if case .hazard = kind { return false }; if case .obstacle = kind { return false }; if case .platform = kind { return false }; return true }

    private var isPlayerSupported: Bool {
        if playerY <= Self.groundLevel + 0.008 { return true }
        return entities.contains { entity in
            guard !entity.collected, isStandable(entity.kind) else { return false }
            let top = entityTop(entity)
            return abs(playerY - top) <= 0.012
                && abs(entity.x - distance) < horizontalContactDistance(for: entity.kind) * 0.92
        }
    }

    /// 角色的可见矩形范围。playerY 表示脚底高度，顶部由当前普通/飞行素材高度推导。
    private var playerVerticalBounds: ClosedRange<Double> {
        let size = playerCollisionSize
        let visualSink = 8 * (1 - flightTransitionProgress) / 637
        let bottom = playerY - visualSink
        return bottom...(bottom + size.height / 637)
    }

    /// 受伤判定略收进角色可见轮廓，避免透明边缘未碰到陷阱却扣血。
    private var playerDamageVerticalBounds: ClosedRange<Double> {
        let visible = playerVerticalBounds
        let inset = (visible.upperBound - visible.lowerBound) * 0.07
        return (visible.lowerBound + inset)...(visible.upperBound - inset * 0.70)
    }

    /// 拾取判定覆盖完整可见角色并增加少量容差，头、手、脚碰到货币都会拾取。
    private var playerPickupVerticalBounds: ClosedRange<Double> {
        let visible = playerVerticalBounds
        return (visible.lowerBound - 5 / 637)...(visible.upperBound + 9 / 637)
    }

    private var playerCollisionSize: (width: Double, height: Double) {
        let ground = (120 * 96 / 132.0, 120.0)
        let uprightHeight = 120 * 2.35 / 1.5
        let upright = (uprightHeight * 454 / 814, uprightHeight)
        let tiltedHeight = 120 * 2.2 / 1.5
        let tilted = (tiltedHeight * 567 / 690, tiltedHeight)
        let flightWidth = upright.0 + (tilted.0 - upright.0) * flightTiltProgress
        let flightHeight = upright.1 + (tilted.1 - upright.1) * flightTiltProgress
        return (
            ground.0 + (flightWidth - ground.0) * flightTransitionProgress,
            ground.1 + (flightHeight - ground.1) * flightTransitionProgress
        )
    }

    private func entityCollisionSize(_ kind: WorldEntityKind) -> (width: Double, height: Double) {
        switch kind {
        case .coin, .blueGem, .greenGem, .redGem, .purpleGem: return (40, 40)
        case .obstacle: return (54, 54)
        case .hazard(let name):
            if name == "石球_大型" { return (64, 60) }
            if name == "石球_小型" { return (50, 49) }
            if name == "石球_裂纹" { return (50, 48) }
            if name == "地刺_三连" { return (69, 38) }
            if name == "圆形地刺盘" { return (54, 31) }
            if name == "吊链落刺" { return (87, 78) }
            if name == "墙面侧刺" { return (44, 110) }
            if name == "木板侧刺" { return (58, 86) }
            if name == "箭矢_向下" { return (22, 72) }
            if name == "箭矢_向左" || name == "箭矢_向右" { return (72, 22) }
            if name == "长矛" { return (28, 98) }
            return (54, 54)
        case .platform: return (110, 50)
        default: return (58, 58)
        }
    }

    private struct NormalizedHitbox {
        let x: Double
        let y: Double
        let width: Double
        let height: Double
    }

    private struct WorldHitbox {
        let minX: Double
        let maxX: Double
        let minY: Double
        let maxY: Double
    }

    /// 按素材的有效尖刺区域设置伤害盒，避免木梁、底座、矛杆等透明或安全区域误伤。
    private func hazardHitboxes(_ name: String) -> [NormalizedHitbox] {
        switch name {
        case "地刺_三连":
            return [.init(x: 0.08, y: 0.22, width: 0.84, height: 0.72)]
        case "圆形地刺盘":
            return [.init(x: 0.06, y: 0.08, width: 0.88, height: 0.82)]
        case "吊链落刺":
            return [.init(x: 0.13, y: 0.00, width: 0.74, height: 0.38)]
        case "墙面侧刺":
            return [.init(x: 0.00, y: 0.05, width: 0.48, height: 0.90)]
        case "木板侧刺":
            return [
                .init(x: 0.00, y: 0.05, width: 0.27, height: 0.90),
                .init(x: 0.73, y: 0.05, width: 0.27, height: 0.90)
            ]
        case "长矛":
            return [.init(x: 0.16, y: 0.58, width: 0.68, height: 0.42)]
        case "箭矢_向下":
            return [.init(x: 0.18, y: 0.04, width: 0.64, height: 0.90)]
        case "箭矢_向左", "箭矢_向右":
            return [.init(x: 0.04, y: 0.18, width: 0.92, height: 0.64)]
        default:
            return [.init(x: 0.04, y: 0.04, width: 0.92, height: 0.92)]
        }
    }

    /// 侧刺的中间板材属于实体阻挡，但不是伤害区；滚石另按圆形碰撞处理。
    private func solidBodyHitboxes(for entity: WorldEntity) -> [WorldHitbox] {
        switch entity.kind {
        case .obstacle, .platform:
            return [worldHitbox(.init(x: 0.06, y: 0.02, width: 0.88, height: 0.96), for: entity)]
        case .hazard("墙面侧刺"):
            return [worldHitbox(.init(x: 0.48, y: 0.02, width: 0.50, height: 0.96), for: entity)]
        case .hazard("木板侧刺"):
            return [worldHitbox(.init(x: 0.27, y: 0.02, width: 0.46, height: 0.96), for: entity)]
        default:
            return []
        }
    }

    private func worldHitbox(_ box: NormalizedHitbox, for entity: WorldEntity) -> WorldHitbox {
        let size = entityCollisionSize(entity.kind)
        let left = entity.x - size.width / (2 * worldPointsPerMeter)
        let bottom = entityBottom(entity)
        return .init(
            minX: left + box.x * size.width / worldPointsPerMeter,
            maxX: left + (box.x + box.width) * size.width / worldPointsPerMeter,
            minY: bottom + box.y * size.height / 637,
            maxY: bottom + (box.y + box.height) * size.height / 637
        )
    }

    private var playerHorizontalBounds: ClosedRange<Double> {
        let halfWidth = playerCollisionSize.width * 0.38 / worldPointsPerMeter
        return (distance - halfWidth)...(distance + halfWidth)
    }

    private func playerIntersects(_ box: WorldHitbox) -> Bool {
        let playerX = playerHorizontalBounds
        let playerY = playerDamageVerticalBounds
        return playerX.lowerBound < box.maxX && playerX.upperBound > box.minX
            && playerY.lowerBound < box.maxY && playerY.upperBound > box.minY
    }

    private func hazardTouchesPlayer(_ entity: WorldEntity) -> Bool {
        guard entity.isActive, case .hazard(let name) = entity.kind else { return false }
        if name.hasPrefix("石球") { return playerTouchesRock(entity) }
        return hazardHitboxes(name).contains { playerIntersects(worldHitbox($0, for: entity)) }
    }

    /// 石球使用椭圆化后的圆形检测，以屏幕横纵比例分别换算半径。
    private func playerTouchesRock(_ entity: WorldEntity) -> Bool {
        let size = entityCollisionSize(entity.kind)
        let radiusPoints = min(size.width, size.height) * 0.43
        let radiusX = radiusPoints / worldPointsPerMeter
        let radiusY = radiusPoints / 637
        let centerX = entity.x
        let centerY = entityBottom(entity) + size.height * 0.50 / 637
        let playerX = playerHorizontalBounds
        let playerY = playerVerticalBounds
        let closestX = min(max(centerX, playerX.lowerBound), playerX.upperBound)
        let closestY = min(max(centerY, playerY.lowerBound), playerY.upperBound)
        let dx = (closestX - centerX) / max(0.0001, radiusX)
        let dy = (closestY - centerY) / max(0.0001, radiusY)
        return dx * dx + dy * dy <= 1
    }

    private func horizontalArrowHitObstacle(_ arrow: WorldEntity) -> Bool {
        guard arrow.isActive else { return false }
        let arrowBox = worldHitbox(hazardHitboxes("箭矢_向左")[0], for: arrow)
        return entities.contains { target in
            guard target.id != arrow.id, !target.collected else { return false }
            var bodies = solidBodyHitboxes(for: target)
            if case .hazard(let name) = target.kind, name.hasPrefix("石球") {
                let size = entityCollisionSize(target.kind)
                let radius = min(size.width, size.height) * 0.43
                bodies.append(.init(
                    minX: target.x - radius / worldPointsPerMeter,
                    maxX: target.x + radius / worldPointsPerMeter,
                    minY: entityBottom(target) + (size.height * 0.50 - radius) / 637,
                    maxY: entityBottom(target) + (size.height * 0.50 + radius) / 637
                ))
            }
            return bodies.contains { body in
                arrowBox.minX < body.maxX && arrowBox.maxX > body.minX
                    && arrowBox.minY < body.maxY && arrowBox.maxY > body.minY
            }
        }
    }

    private func horizontalContactDistance(for kind: WorldEntityKind) -> Double {
        let entityWidth = entityCollisionSize(kind).width
        // 去掉素材四周的少量透明留白，使可见边缘能够自然贴住，但不发生重叠。
        return ((playerCollisionSize.width + entityWidth) * 0.44) / worldPointsPerMeter
    }

    private func pickupContactDistance(for kind: WorldEntityKind) -> Double {
        ((playerCollisionSize.width + entityCollisionSize(kind).width) * 0.50) / worldPointsPerMeter
    }

    private func entityBottom(_ entity: WorldEntity) -> Double {
        let groundInset: Double
        switch entity.kind {
        case .item, .chest, .obstacle:
            groundInset = 4 / 637
        case .hazard(let name) where name.hasPrefix("石球") || name == "地刺_三连" || name == "圆形地刺盘" || name == "长矛":
            groundInset = 4 / 637
        default:
            groundInset = 0
        }
        return entity.y - groundInset
    }

    private func entityTop(_ entity: WorldEntity) -> Double {
        entityBottom(entity) + entityCollisionSize(entity.kind).height / 637
    }

    private func verticalBoundsOverlap(with entity: WorldEntity) -> Bool {
        let player = playerVerticalBounds
        return player.lowerBound < entityTop(entity) && player.upperBound > entityBottom(entity)
    }

    private func pickupBoundsOverlap(with entity: WorldEntity) -> Bool {
        let player = playerPickupVerticalBounds
        return player.lowerBound < entityTop(entity) && player.upperBound > entityBottom(entity)
    }

    private func isStandable(_ kind: WorldEntityKind) -> Bool {
        if case .obstacle = kind { return true }
        if case .platform = kind { return true }
        return false
    }

    private func isSolid(_ kind: WorldEntityKind) -> Bool {
        if isStandable(kind) { return true }
        if case .hazard(let name) = kind {
            return name.hasPrefix("石球") || name == "墙面侧刺" || name == "木板侧刺"
        }
        return false
    }

    private func solidHorizontalIntervals(for entity: WorldEntity) -> [ClosedRange<Double>] {
        let playerY = playerVerticalBounds
        if case .hazard(let name) = entity.kind, name.hasPrefix("石球") {
            let size = entityCollisionSize(entity.kind)
            let radiusPoints = min(size.width, size.height) * 0.43
            let radiusX = radiusPoints / worldPointsPerMeter
            let radiusY = radiusPoints / 637
            let centerY = entityBottom(entity) + size.height * 0.50 / 637
            guard playerY.lowerBound < centerY + radiusY, playerY.upperBound > centerY - radiusY else {
                return []
            }
            let closestY = min(max(centerY, playerY.lowerBound), playerY.upperBound)
            let normalizedY = abs(closestY - centerY) / max(0.0001, radiusY)
            let horizontalRadius = radiusX * sqrt(max(0, 1 - normalizedY * normalizedY))
            return [(entity.x - horizontalRadius)...(entity.x + horizontalRadius)]
        }
        return solidBodyHitboxes(for: entity).compactMap { body in
            guard playerY.lowerBound < body.maxY, playerY.upperBound > body.minY else { return nil }
            return body.minX...body.maxX
        }
    }

    private func landOnStandableSurface(previousPlayerY: Double) {
        guard verticalVelocity <= 0 else { return }
        let surfaces = entities.compactMap { entity -> Double? in
            guard !entity.collected, isStandable(entity.kind) else { return nil }
            let contact = horizontalContactDistance(for: entity.kind) * 0.88
            guard abs(entity.x - distance) < contact else { return nil }
            let top = entityTop(entity)
            guard previousPlayerY >= top - 0.012, playerY <= top + 0.012 else { return nil }
            return top
        }
        if let top = surfaces.max() {
            playerY = top
            verticalVelocity = 0
            jumpsUsed = 0
        }
    }

    /// 每帧将角色与箱子、滚石的水平位置分离到边界，防止高速移动时穿透或重叠。
    private func resolveSolidContacts() {
        for entity in entities where !entity.collected && isSolid(entity.kind) {
            guard entity.isActive else { continue }
            if isStandable(entity.kind), playerY >= entityTop(entity) - 0.008 { continue }
            let playerHalfWidth = playerCollisionSize.width * 0.44 / worldPointsPerMeter
            for interval in solidHorizontalIntervals(for: entity) {
                guard distance + playerHalfWidth > interval.lowerBound,
                      distance - playerHalfWidth < interval.upperBound else { continue }
                let center = (interval.lowerBound + interval.upperBound) / 2
                if distance <= center {
                    distance = max(0, interval.lowerBound - playerHalfWidth)
                } else {
                    distance = min(targetDistance, interval.upperBound + playerHalfWidth)
                }
            }
        }
    }

    private func approach(_ value: Double, target: Double, maximumDelta: Double) -> Double {
        if value < target { return min(target, value + maximumDelta) }
        return max(target, value - maximumDelta)
    }

    /// 实体障碍物会真正阻断移动；箱子可跳上去，带伤害的滚石只能躲避。
    private func obstacleConstrainedDistance(from current: Double, proposed: Double) -> Double {
        guard flyingRemaining <= 0, proposed != current else { return proposed }
        var constrained = proposed
        for entity in entities where !entity.collected && isSolid(entity.kind) {
            guard entity.isActive else { continue }
            if isStandable(entity.kind), playerY >= entityTop(entity) - 0.008 { continue }
            let playerHalfWidth = playerCollisionSize.width * 0.44 / worldPointsPerMeter
            for interval in solidHorizontalIntervals(for: entity) {
                if proposed > current,
                   current + playerHalfWidth <= interval.lowerBound + 0.002,
                   constrained + playerHalfWidth >= interval.lowerBound {
                    constrained = min(constrained, interval.lowerBound - playerHalfWidth)
                } else if proposed < current,
                          current - playerHalfWidth >= interval.upperBound - 0.002,
                          constrained - playerHalfWidth <= interval.upperBound {
                    constrained = max(constrained, interval.upperBound + playerHalfWidth)
                }
            }
        }
        return min(targetDistance, max(0, constrained))
    }

    // MARK: - 道具叠加视觉状态

    var isFirstAidEffectActive: Bool { firstAidEffectRemaining > 0 }
    var isVitalityEffectActive: Bool { vitalityRemaining > 0 }
    var isLuckyEffectActive: Bool { luckyRemaining > 0 }
    var isLeapEffectActive: Bool { leapRemaining > 0 }
    var isMagnetEffectActive: Bool { magnetRemaining > 0 }
    var isShieldEffectActive: Bool { shieldCharges > 0 }
    var isSpeedShoesEffectActive: Bool { speedShoesRemaining > 0 || nobitaSpeedRemaining > 0 }
    var isMilkEffectActive: Bool { milkEffectRemaining > 0 }
    var isShieldBreaking: Bool { shieldBreakEffectRemaining > 0 }
    var isVitalityHealPulsing: Bool { vitalityHealPulseRemaining > 0 }
    var isLuckyCoinSparkActive: Bool { luckyCoinSparkRemaining > 0 }
    var isLeapJumpBurstActive: Bool { leapJumpBurstRemaining > 0 }

    var completionEffectOpacity: Double {
        guard isCompleting else { return 0 }
        let progress = 1 - completionEffectRemaining / completionEffectDuration
        return min(1, progress / 0.12, max(0, completionEffectRemaining / 0.30))
    }

    /// 通关素材从画面中心快速爆开，再轻微回弹到正常大小；过程只播放一次，不循环闪烁。
    var completionEffectScale: Double {
        guard isCompleting else { return 0.08 }
        let progress = 1 - completionEffectRemaining / completionEffectDuration
        if progress < 0.16 {
            let t = max(0, progress / 0.16)
            return 0.08 + 1.10 * (1 - pow(1 - t, 3))
        }
        if progress < 0.28 {
            let t = (progress - 0.16) / 0.12
            return 1.18 - 0.18 * t
        }
        return 1
    }

    var playerDamageOpacity: Double {
        guard hurtBlinkRemaining > 0 else { return 1 }
        return Int(effectClock * 15).isMultiple(of: 2) ? 0.22 : 1
    }

    var rockKnockbackVisualOffset: Double {
        guard rockKnockback, knockbackDuration > 0 else { return 0 }
        let progress = 1 - knockbackRemaining / knockbackDuration
        return knockbackDirection * sin(progress * .pi) * 18
    }

    var rockKnockbackTiltDegrees: Double {
        guard rockKnockback, knockbackDuration > 0 else { return 0 }
        let progress = 1 - knockbackRemaining / knockbackDuration
        return knockbackDirection * sin(progress * .pi) * 13
    }

    var firstAidEffectProgress: Double { 1 - min(1, firstAidEffectRemaining / 0.8) }
    var milkEffectProgress: Double { 1 - min(1, milkEffectRemaining / 0.6) }
    var shieldBreakEffectProgress: Double { 1 - min(1, shieldBreakEffectRemaining / 0.3) }

    private func configureDebugEffectPreview(_ id: String) {
        effectMessage = nil
        // 预览时移除伤害机关，避免截图被受击提示遮挡；磁铁预览额外放置可牵引目标。
        for index in entities.indices {
            if case .hazard = entities[index].kind { entities[index].collected = true }
        }
        switch id {
        case "first_aid": firstAidEffectRemaining = 0.52
        case "vitality_drink": vitalityRemaining = 5; vitalityHealPulseRemaining = 0.28
        case "lucky_drink": luckyRemaining = 20; luckyCoinSparkRemaining = 0.3
        case "leap_drink": leapRemaining = 15; leapJumpBurstRemaining = 0.4
        case "magnet":
            magnetRemaining = 20
            entities.append(WorldEntity(kind: .coin, x: 3.5, y: Self.groundLevel + 0.12))
            entities.append(WorldEntity(kind: .blueGem, x: 5.2, y: Self.groundLevel + 0.28))
        case "shield": shieldCharges = 1
        case "speed_shoes": speedShoesRemaining = 15
        case "flight_boots":
            flyingRemaining = 10
            playerY = 0.45
            flightTargetY = playerY
            flightTransitionProgress = 1
            flightTiltProgress = 0.65
            movementDirection = 1
            facingDirection = 1
        case "energy_milk": milkEffectRemaining = 0.42
        default: break
        }
    }

    /// 截图专用入口只在 Debug 启动参数存在时生效，让瞬时特效不会在模拟器截图前消失。
    private func keepDebugEffectAliveIfNeeded() {
        guard let id = debugEffectPreviewID else { return }
        switch id {
        case "first_aid": firstAidEffectRemaining = 0.52
        case "vitality_drink": vitalityRemaining = 5; vitalityHealPulseRemaining = 0.28
        case "lucky_drink": luckyRemaining = 20; luckyCoinSparkRemaining = 0.3
        case "leap_drink": leapRemaining = 15; leapJumpBurstRemaining = 0.4
        case "magnet": magnetRemaining = 20
        case "shield": shieldCharges = 1
        case "speed_shoes": speedShoesRemaining = 15
        case "flight_boots": flyingRemaining = 10
        case "energy_milk": milkEffectRemaining = 0.42
        default: break
        }
    }

    var stars: Int {
        guard finished == true else { return 0 }
        let ratio = Double(score) / max(1, targetDistance * 7)
        return ratio > 1.05 && hearts >= 4 ? 3 : (ratio > 0.65 ? 2 : 1)
    }

    private static func makeEntities(level: Int, target: Double, character: CharacterDefinition) -> [WorldEntity] {
        var result: [WorldEntity] = []
        var random = LevelRandomGenerator(seed: UInt64(level) &* 0xD1B54A32D192ED03 ^ 0xA24BAED4963EE407)
        let gems: [WorldEntityKind] = [.blueGem, .blueGem, .greenGem, .redGem, .purpleGem]
        let utilities = ["energy_milk", "speed_shoes", "shield", "magnet", "flight_boots"]
        let foods: [String]
        switch character.id {
        case "nobita": foods = ["honey_pancake", "natural_honey", "golden_honeycomb"]
        case "shizuka": foods = ["heart_lollipop", "strawberry_milk", "strawberry_cake"]
        case "dorami": foods = ["fresh_orange", "orange_juice", "orange_pudding"]
        default: foods = ["mini_dorayaki", "classic_dorayaki", "luxury_dorayaki"]
        }

        let allHazards: [(WorldEntityKind, Double)] = [
            (.hazard("石球_小型"), 0.22), (.hazard("地刺_三连"), 0.22),
            (.obstacle("木箱"), 0.22), (.hazard("圆形地刺盘"), 0.22),
            (.hazard("箭矢_向左"), 0.32), (.hazard("箭矢_向右"), 0.32),
            (.hazard("木板侧刺"), 0.31), (.hazard("长矛"), 0.22),
            (.hazard("石球_裂纹"), 0.22), (.hazard("墙面侧刺"), 0.42),
            (.hazard("箭矢_向下"), 0.96), (.hazard("吊链落刺"), 0.96),
            (.hazard("石球_大型"), 0.22)
        ]
        // 前期逐步引入机关；关卡越高组合越丰富，但每一关的顺序均由独立种子打乱。
        let unlockedHazardCount = min(allHazards.count, 6 + max(0, level - 1) / 2)
        var levelHazards = Array(allHazards.prefix(unlockedHazardCount))
        levelHazards.shuffle(using: &random)

        let platformEvery = max(5, 9 - min(level, 10) / 2)
        let platformOffset = Int.random(in: 2..<platformEvery, using: &random)
        let hazardChance = min(76, 43 + level * 2)
        var x = 23.0 + Double.random(in: 0...5, using: &random)
        var segment = 0
        var chestPlaced = false
        var previousHazard: WorldEntityKind?

        while x < target - 16 {
            let segmentLength = Double.random(in: 11.2...15.4, using: &random)
            let isPlatformSegment = segment >= platformOffset && (segment - platformOffset).isMultiple(of: platformEvery)

            if isPlatformSegment {
                let variant = Int.random(in: 1...4, using: &random)
                let platformY = Self.groundLevel + Double.random(in: 0.15...0.23, using: &random)
                result.append(WorldEntity(kind: .platform("悬浮地\(variant).png"), x: x, y: platformY))
                let platformTop = platformY + 50 / 637.0
                let count = Int.random(in: 2...4, using: &random)
                for index in 0..<count {
                    let centered = Double(index) - Double(count - 1) / 2
                    result.append(WorldEntity(kind: .coin, x: x + centered * 1.55, y: platformTop + 0.015))
                }
            } else if !chestPlaced, x > target * 0.44, x < target * 0.68 {
                let kind: ChestKind = level > 15 ? .gold : (level > 7 ? .silver : .wood)
                result.append(WorldEntity(kind: .chest(kind), x: x, y: Self.groundLevel))
                chestPlaced = true
            } else {
                let rewardRoll = Int.random(in: 0..<100, using: &random)
                if rewardRoll < 54 {
                    let count = Int.random(in: 2...5, using: &random)
                    let arcHeight = rewardRoll < 24 ? Double.random(in: 0.16...0.28, using: &random) : 0
                    for index in 0..<count {
                        let progress = Double(index) / Double(max(1, count - 1))
                        let y = Self.groundLevel + sin(progress * .pi) * arcHeight
                        result.append(WorldEntity(kind: .coin, x: x + Double(index) * 1.65, y: y))
                    }
                } else if rewardRoll < 75 {
                    let gem = gems[Int.random(in: 0..<gems.count, using: &random)]
                    result.append(WorldEntity(kind: gem, x: x, y: Self.groundLevel + Double.random(in: 0.06...0.25, using: &random)))
                } else if rewardRoll < 83 {
                    let food = foods[Int.random(in: 0..<foods.count, using: &random)]
                    result.append(WorldEntity(kind: .item(food), x: x, y: Self.groundLevel))
                } else if rewardRoll < 88 {
                    let item = utilities[Int.random(in: 0..<utilities.count, using: &random)]
                    result.append(WorldEntity(kind: .item(item), x: x, y: Self.groundLevel + Double.random(in: 0...0.10, using: &random)))
                }
                // 88...99 保持为空区段；食物和通用道具总计只有 13% 的独立生成概率。
            }

            if !isPlatformSegment,
               Int.random(in: 0..<100, using: &random) < hazardChance,
               x + segmentLength * 0.64 < target - 12 {
                var hazard = levelHazards[Int.random(in: 0..<levelHazards.count, using: &random)]
                if hazard.0 == previousHazard, levelHazards.count > 1 {
                    hazard = levelHazards[(levelHazards.firstIndex(where: { $0.0 == hazard.0 })! + 1) % levelHazards.count]
                }
                result.append(WorldEntity(kind: hazard.0, x: x + segmentLength * 0.64, y: hazard.1))
                previousHazard = hazard.0
            }

            segment += 1
            x += segmentLength
        }
        return result
    }
}
