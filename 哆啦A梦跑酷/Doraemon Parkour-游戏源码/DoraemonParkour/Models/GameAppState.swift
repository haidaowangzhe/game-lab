import Foundation
import UIKit

enum ChestOverlay: Equatable {
    case reward(ChestKind, RewardBundle)
    case missingKey(ChestKind)
    case missingChest(ChestKind)
}

enum ShopDetail: Equatable {
    case character(String)
    case item(String)
    case chest(ChestKind)
    case key(KeyKind)
}

@MainActor
final class GameAppState: ObservableObject {
    @Published var screen: AppScreen = .loading
    @Published var profile: PlayerProfile
    @Published var selectedLevel = 1
    @Published var inventoryCategory: InventoryCategory = .characters
    @Published var shopCategory: ShopCategory = .characters
    @Published var selectedCharacterID = "doraemon"
    @Published var selectedItemID = "energy_milk"
    @Published var selectedChest: ChestKind = .wood
    @Published var shopDetail: ShopDetail?
    @Published var chestOverlay: ChestOverlay?
    @Published var showRecharge = false
    @Published var showAbout = false
    @Published var showPrivacy = false
    @Published var showSettingsOverlay = false
    @Published var showInventoryOverlay = false
    @Published var toast: String?
    @Published var latestResult: RunSummary?
    @Published var runSessionID = UUID()

    let audio = AudioManager()
    @Published private(set) var returnScreen: AppScreen = .home

    init() {
        profile = SaveStore.load()
        selectedCharacterID = profile.selectedCharacter
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-uiTestLoading") {
            screen = .loading
        } else if ProcessInfo.processInfo.arguments.contains("-uiTestSuccess") {
            screen = .run
            selectedLevel = 1
        } else if ProcessInfo.processInfo.arguments.contains("-uiTestHome") {
            screen = .home
        } else if ProcessInfo.processInfo.arguments.contains("-uiTestLevels") {
            screen = .levels
        } else if ProcessInfo.processInfo.arguments.contains("-uiTestRunQuickbar") ||
                    ProcessInfo.processInfo.arguments.contains("-uiTestPause") ||
                    ProcessInfo.processInfo.arguments.contains("-uiTestFlight") ||
                    ProcessInfo.processInfo.arguments.contains("-uiTestFlightForward") ||
                    ProcessInfo.processInfo.arguments.contains("-uiTestItemEffect") {
            profile.loadout = ["energy_milk", "shield", "flight_boots"]
            screen = .run
            selectedLevel = 1
        } else if ProcessInfo.processInfo.arguments.contains("-uiTestFailureResult") {
            screen = .result
            latestResult = RunSummary(level: 1, success: false, stars: 0, score: 620, coins: 18, diamonds: 1, itemRewards: ["energy_milk": 1, "mini_dorayaki": 1], chestRewards: [:], keyRewards: [:])
        } else if ProcessInfo.processInfo.arguments.contains("-uiTestSuccessResult") {
            screen = .result
            latestResult = RunSummary(level: 1, success: true, stars: 3, score: 1375, coins: 125, diamonds: 3, itemRewards: ["energy_milk": 1, "shield": 1], chestRewards: [ChestKind.wood.rawValue: 1], keyRewards: [:])
        } else if ProcessInfo.processInfo.arguments.contains("-uiTestInventoryCharacters") {
            screen = .inventory
            inventoryCategory = .characters
        } else if ProcessInfo.processInfo.arguments.contains("-uiTestInventoryItems") {
            screen = .inventory
            inventoryCategory = .items
        } else if ProcessInfo.processInfo.arguments.contains("-uiTestInventoryChests") {
            screen = .inventory
            inventoryCategory = .chests
        } else if ProcessInfo.processInfo.arguments.contains("-uiTestShopCharacters") {
            screen = .shop
            shopCategory = .characters
        } else if ProcessInfo.processInfo.arguments.contains("-uiTestShopItems") {
            screen = .shop
            shopCategory = .items
        } else if ProcessInfo.processInfo.arguments.contains("-uiTestShopChests") {
            screen = .shop
            shopCategory = .chests
        } else if ProcessInfo.processInfo.arguments.contains("-uiTestShopDetail") {
            screen = .shop
            shopDetail = .character("nobita")
        } else if ProcessInfo.processInfo.arguments.contains("-uiTestItemDetail") {
            screen = .shop
            shopCategory = .items
            shopDetail = .item("speed_shoes")
        } else if ProcessInfo.processInfo.arguments.contains("-uiTestChestDetail") {
            screen = .shop
            shopCategory = .chests
            shopDetail = .chest(.wood)
        } else if ProcessInfo.processInfo.arguments.contains("-uiTestKeyDetail") {
            screen = .shop
            shopCategory = .chests
            shopDetail = .key(.copper)
        } else if ProcessInfo.processInfo.arguments.contains("-uiTestSettings") {
            screen = .home
            showSettingsOverlay = true
        } else if ProcessInfo.processInfo.arguments.contains("-uiTestAbout") {
            screen = .home
            showSettingsOverlay = true
            showAbout = true
        } else if ProcessInfo.processInfo.arguments.contains("-uiTestPrivacy") {
            screen = .home
            showSettingsOverlay = true
            showPrivacy = true
        } else if ProcessInfo.processInfo.arguments.contains("-uiTestChestReward") {
            screen = .inventory
            inventoryCategory = .chests
            chestOverlay = .reward(.wood, RewardBundle(coins: 55, items: ["energy_milk": 1]))
        } else if ProcessInfo.processInfo.arguments.contains("-uiTestMissingKey") {
            screen = .inventory
            inventoryCategory = .chests
            chestOverlay = .missingKey(.wood)
        } else if ProcessInfo.processInfo.arguments.contains("-uiTestMissingChest") {
            screen = .inventory
            inventoryCategory = .chests
            chestOverlay = .missingChest(.wood)
        } else if ProcessInfo.processInfo.arguments.contains("-uiTestRecharge") {
            screen = .shop
            showRecharge = true
        }
        #endif
    }

    var selectedCharacter: CharacterDefinition { GameData.character(profile.selectedCharacter) }

    func completeLoading() { navigate(.home) }

    func navigate(_ target: AppScreen) {
        screen = target
        shopDetail = nil
        chestOverlay = nil
        switch target {
        case .run: audio.playBGM("bgm_run", settings: profile.settings)
        case .result: audio.playBGM("bgm_result", settings: profile.settings)
        case .loading: break
        default: audio.playBGM("bgm_home", settings: profile.settings)
        }
    }

    func openSettings(from source: AppScreen) { returnScreen = source; showSettingsOverlay = true }
    func closeSettings() { showSettingsOverlay = false }
    func openInventory(from source: AppScreen) {
        returnScreen = source
        if source == .run { showInventoryOverlay = true } else { navigate(.inventory) }
    }
    func openShop(from source: AppScreen, category: ShopCategory? = nil) { returnScreen = source; if let category { shopCategory = category }; navigate(.shop) }
    func backFromSection() {
        // Returning from a nested section can leave the current section stored
        // as its own destination. Fall back to home instead of navigating to
        // the same screen and making the back button appear unresponsive.
        if returnScreen == screen, screen == .inventory || screen == .shop {
            navigate(.home)
        } else {
            navigate(returnScreen)
        }
    }

    func startLevel(_ level: Int) {
        guard level <= profile.unlockedLevel else { showToast("该关卡尚未解锁") ; return }
        selectedLevel = level
        runSessionID = UUID()
        navigate(.run)
    }

    func restartLevel() { runSessionID = UUID(); navigate(.run) }

    func toggleMusic() {
        profile.settings.musicVolume = profile.settings.musicVolume == 0 ? 8 : 0
        persistSettings()
    }

    func changeVolume(music: Bool, delta: Int) {
        if music { profile.settings.musicVolume = min(10, max(0, profile.settings.musicVolume + delta)) }
        else { profile.settings.soundVolume = min(10, max(0, profile.settings.soundVolume + delta)) }
        persistSettings()
    }

    func resetSettings() { profile.settings = SettingsProfile(); persistSettings(); showToast("已恢复默认设置") }
    func clearCache() { profile.lastRunSummary = nil; SaveStore.save(profile); showToast("缓存已清理，进度已保留") }

    func persistSettings() {
        SaveStore.save(profile)
        audio.update(settings: profile.settings)
    }

    func selectCharacter(_ id: String) {
        let character = GameData.character(id)
        guard profile.unlockedCharacters.contains(id) else { openShop(from: .inventory, category: .characters); shopDetail = .character(id); return }
        guard character.availableInRun else { showToast("动作素材待补，当前角色暂不可出战"); return }
        profile.selectedCharacter = id
        selectedCharacterID = id
        save()
        showToast("已使用\(character.name)")
    }

    func carry(_ itemID: String) {
        guard let item = GameData.item(itemID), (profile.itemInventory[itemID] ?? 0) > 0 else { showToast("背包中没有该道具"); return }
        if profile.loadout.contains(itemID) { return }
        if let owner = item.owner, owner != profile.selectedCharacter { showToast("非当前角色专属"); return }
        guard profile.loadout.count < 3 else { showToast("携带已满，请先取消一格"); return }
        profile.itemInventory[itemID, default: 0] -= 1
        profile.loadout.append(itemID)
        save()
    }

    func cancelCarry(_ itemID: String) {
        guard let index = profile.loadout.firstIndex(of: itemID) else { return }
        profile.loadout.remove(at: index)
        profile.itemInventory[itemID, default: 0] += 1
        save()
    }

    func sell(_ itemID: String) {
        guard let item = GameData.item(itemID), (profile.itemInventory[itemID] ?? 0) > 0 else { showToast("没有可出售的道具"); return }
        profile.itemInventory[itemID, default: 0] -= 1
        profile.coins += item.sellPrice
        save()
        audio.playSFX("sfx_confirm", settings: profile.settings)
        showToast("出售成功，获得 \(item.sellPrice) 金币")
    }

    func purchase(_ detail: ShopDetail) {
        var currency: CurrencyKind = .coins
        var price = 0
        switch detail {
        case .character(let id):
            let value = GameData.character(id)
            guard value.availableInRun else { showToast("动作素材待补，暂未开放购买"); return }
            guard !profile.unlockedCharacters.contains(id) else { showToast("角色已拥有"); return }
            currency = .diamonds; price = value.price
        case .item(let id):
            guard let item = GameData.item(id) else { return }
            price = item.buyPrice
        case .chest(let kind):
            let chest = GameData.chest(kind); currency = chest.currency; price = chest.price
        case .key(let kind):
            guard let key = GameData.keys.first(where: { $0.kind == kind }) else { return }
            guard (profile.keyInventory[kind.rawValue] ?? 0) < 99 else { showToast("该钥匙已达 99 把上限"); return }
            currency = key.currency; price = key.price
        }
        guard spend(price, currency: currency) else {
            GameHaptics.notification(.warning, enabled: profile.settings.vibrationEnabled)
            showToast("\(currency.rawValue)不足")
            return
        }
        switch detail {
        case .character(let id): profile.unlockedCharacters.insert(id)
        case .item(let id): profile.itemInventory[id, default: 0] += 1
        case .chest(let kind): profile.chestInventory[kind.rawValue, default: 0] += 1
        case .key(let kind): profile.keyInventory[kind.rawValue, default: 0] += 1
        }
        save()
        audio.playSFX("sfx_confirm", settings: profile.settings)
        GameHaptics.notification(.success, enabled: profile.settings.vibrationEnabled)
        showToast("购买成功")
    }

    private func spend(_ value: Int, currency: CurrencyKind) -> Bool {
        if currency == .coins { guard profile.coins >= value else { return false }; profile.coins -= value }
        else { guard profile.diamonds >= value else { return false }; profile.diamonds -= value }
        return true
    }

    func openChest(_ kind: ChestKind) {
        let chest = GameData.chest(kind)
        guard (profile.chestInventory[kind.rawValue] ?? 0) > 0 else {
            GameHaptics.notification(.warning, enabled: profile.settings.vibrationEnabled)
            chestOverlay = .missingChest(kind)
            return
        }
        guard (profile.keyInventory[chest.key.rawValue] ?? 0) > 0 else {
            GameHaptics.notification(.warning, enabled: profile.settings.vibrationEnabled)
            chestOverlay = .missingKey(kind)
            return
        }
        profile.chestInventory[kind.rawValue, default: 0] -= 1
        profile.keyInventory[chest.key.rawValue, default: 0] -= 1
        let reward = rollChest(kind)
        apply(reward)
        save()
        audio.playSFX("sfx_chest", settings: profile.settings)
        GameHaptics.notification(.success, enabled: profile.settings.vibrationEnabled)
        chestOverlay = .reward(kind, reward)
    }

    private func rollChest(_ kind: ChestKind) -> RewardBundle {
        var reward = RewardBundle()
        switch kind {
        case .wood:
            reward.coins = Int.random(in: 40...70)
            reward.items[Bool.random() ? "mini_dorayaki" : "energy_milk"] = 1
        case .silver:
            reward.coins = Int.random(in: 80...130)
            reward.items[["classic_dorayaki", "magnet", "shield", "energy_milk"].randomElement()!] = 1
            if Int.random(in: 0..<100) < 15 { reward.diamonds = 1 }
            if Int.random(in: 0..<100) < 3 { reward.character = "nobita" }
        case .gold:
            reward.coins = Int.random(in: 140...220)
            reward.items[["luxury_dorayaki", "flight_boots", "leap_drink", "lucky_drink", "first_aid"].randomElement()!] = 1
            reward.diamonds = [1, 2, 2, 3].randomElement()!
            if Int.random(in: 0..<100) < 6 { reward.character = ["nobita", "shizuka"].randomElement()! }
        case .purple:
            reward.coins = Int.random(in: 180...280)
            reward.items[["flight_boots", "lucky_drink", "first_aid", "shield"].randomElement()!] = Int.random(in: 1...2)
            reward.diamonds = [8, 8, 12, 12, 16].randomElement()!
            if Int.random(in: 0..<100) < 12 { reward.character = ["nobita", "shizuka", "dorami"].randomElement()! }
        }
        if let character = reward.character, profile.unlockedCharacters.contains(character) {
            reward.character = nil
            reward.coins += kind == .silver ? 40 : (kind == .gold ? 80 : 120)
        }
        return reward
    }

    private func apply(_ reward: RewardBundle) {
        profile.coins += reward.coins
        profile.diamonds += reward.diamonds
        reward.items.forEach { profile.itemInventory[$0.key, default: 0] += $0.value }
        reward.chests.forEach { profile.chestInventory[$0.key.rawValue, default: 0] += $0.value }
        reward.keys.forEach { profile.keyInventory[$0.key.rawValue, default: 0] = min(99, profile.keyInventory[$0.key.rawValue, default: 0] + $0.value) }
        if let character = reward.character { profile.unlockedCharacters.insert(character) }
    }

    func settleRun(level: Int, success: Bool, stars: Int, score: Int, pickupCoins: Int, pickupDiamonds: Int, items: [String: Int], chests: [ChestKind: Int], usedLoadout: Set<String>) {
        var reward = RewardBundle(coins: pickupCoins, diamonds: pickupDiamonds, items: items, chests: chests)
        if !success && reward.coins == 0 && reward.diamonds == 0 && items.isEmpty && chests.isEmpty { reward.coins = 10 }
        if success {
            let base = level <= 5 ? 40 : (level <= 12 ? 70 : (level <= 20 ? 100 : 130))
            reward.coins += base + (stars == 2 ? 25 : (stars == 3 ? 55 : 0))
            let first = !profile.firstClears.contains(level)
            if first {
                reward.coins += level <= 5 ? 30 : (level <= 12 ? 50 : (level <= 20 ? 70 : 90))
                reward.diamonds += level <= 5 ? 3 : (level <= 12 ? 5 : (level <= 20 ? 7 : 9))
                profile.firstClears.insert(level)
            }
            if stars == 3 {
                let chance = level <= 5 ? 8 : (level <= 12 ? 12 : (level <= 20 ? 15 : 18))
                if Int.random(in: 0..<100) < chance { reward.diamonds += 1 }
            }
            profile.unlockedLevel = max(profile.unlockedLevel, min(20, level + 1))
            profile.levelStars[String(level)] = max(profile.levelStars[String(level)] ?? 0, stars)
            applyMilestones(into: &reward)
        }
        apply(reward)
        for id in profile.loadout where !usedLoadout.contains(id) { profile.itemInventory[id, default: 0] += 1 }
        profile.loadout.removeAll()
        let summary = RunSummary(level: level, success: success, stars: stars, score: score, coins: reward.coins, diamonds: reward.diamonds, itemRewards: reward.items, chestRewards: Dictionary(uniqueKeysWithValues: reward.chests.map { ($0.key.rawValue, $0.value) }), keyRewards: Dictionary(uniqueKeysWithValues: reward.keys.map { ($0.key.rawValue, $0.value) }))
        profile.lastRunSummary = summary
        latestResult = summary
        save()
        audio.playSFX(success ? "sfx_win" : "sfx_hurt", settings: profile.settings)
        navigate(.result)
    }

    private func applyMilestones(into reward: inout RewardBundle) {
        let clears = profile.firstClears.count
        let milestones: [(Int, ChestKind, KeyKind, Int)] = [(3,.wood,.copper,0),(5,.wood,.copper,10),(8,.silver,.silver,15),(12,.silver,.silver,20),(16,.gold,.gold,25),(20,.gold,.gold,30),(25,.purple,.purple,40)]
        for (count, chest, key, diamonds) in milestones where clears >= count && !profile.claimedMilestones.contains(count) {
            profile.claimedMilestones.insert(count)
            reward.chests[chest, default: 0] += 1
            reward.keys[key, default: 0] += 1
            reward.diamonds += diamonds
        }
    }

    func showToast(_ message: String) {
        toast = message
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in if self?.toast == message { self?.toast = nil } }
    }

    func save() { SaveStore.save(profile) }
}
