import Foundation
import SwiftUI

enum AppScreen: Equatable { case loading, home, levels, run, inventory, shop, settings, result }
enum InventoryCategory: String, CaseIterable, Identifiable { case characters = "角色", items = "道具", chests = "宝箱"; var id: String { rawValue } }
enum ShopCategory: String, CaseIterable, Identifiable { case characters = "角色", items = "道具", chests = "宝箱钥匙"; var id: String { rawValue } }
enum CurrencyKind: String, Codable { case coins = "金币", diamonds = "钻石" }
enum ItemCategory: String, Codable { case special = "特殊", utility = "通用", food = "食物" }
enum ChestKind: String, CaseIterable, Codable, Identifiable { case wood = "木宝箱", silver = "银宝箱", gold = "黄金宝箱", purple = "紫金宝箱"; var id: String { rawValue } }
enum KeyKind: String, CaseIterable, Codable, Identifiable { case copper = "铜钥匙", silver = "银钥匙", gold = "金钥匙", purple = "紫钥匙"; var id: String { rawValue } }

struct CharacterDefinition: Identifiable, Hashable {
    let id: String
    let name: String
    let price: Int
    let intro: String
    let role: String
    let movement: Int
    let luck: Int
    let availableInRun: Bool
    let themeHex: String
    let portraitPath: String
    let walkPath: String?
    let flightPath: String?
}

struct ItemDefinition: Identifiable, Hashable {
    let id: String
    let name: String
    let category: ItemCategory
    let owner: String?
    let buyPrice: Int
    let shortEffect: String
    let detail: String
    let duration: Int?
    let iconPath: String
    var sellPrice: Int { buyPrice / 2 }
}

struct ChestDefinition: Identifiable, Hashable {
    let kind: ChestKind
    let key: KeyKind
    let price: Int
    let currency: CurrencyKind
    let intro: String
    let iconPath: String
    var id: String { kind.rawValue }
}

struct KeyDefinition: Identifiable, Hashable {
    let kind: KeyKind
    let chest: ChestKind
    let price: Int
    let currency: CurrencyKind
    let iconPath: String
    var id: String { kind.rawValue }
}

struct SettingsProfile: Codable, Equatable {
    var musicVolume = 8
    var soundVolume = 8
    var vibrationEnabled = true
    var tipsEnabled = true
}

struct RunSummary: Codable, Equatable {
    var level: Int
    var success: Bool
    var stars: Int
    var score: Int
    var coins: Int
    var diamonds: Int
    var itemRewards: [String: Int]
    var chestRewards: [String: Int]
    var keyRewards: [String: Int]
}

struct PlayerProfile: Codable, Equatable {
    var coins = 200
    var diamonds = 10
    var unlockedCharacters: Set<String> = ["doraemon"]
    var selectedCharacter = "doraemon"
    var itemInventory: [String: Int] = ["mini_dorayaki": 2, "energy_milk": 1]
    var chestInventory: [String: Int] = [:]
    var keyInventory: [String: Int] = [:]
    var loadout: [String] = []
    var levelStars: [String: Int] = [:]
    var unlockedLevel = 1
    var firstClears: Set<Int> = []
    var claimedMilestones: Set<Int> = []
    var settings = SettingsProfile()
    var lastRunSummary: RunSummary?
}

struct RewardBundle: Equatable {
    var coins = 0
    var diamonds = 0
    var items: [String: Int] = [:]
    var chests: [ChestKind: Int] = [:]
    var keys: [KeyKind: Int] = [:]
    var character: String?
}

enum GameData {
    static let characters: [CharacterDefinition] = [
        .init(id: "doraemon", name: "哆啦A梦", price: 0, intro: "来自22世纪，铜锣烧类专属恢复。", role: "初始均衡型角色", movement: 3, luck: 3, availableInRun: true, themeHex: "1078E0", portraitPath: "首页/人物头像（方形的）/角色卡_哆啦A梦.png", walkPath: "游戏内主界面/人物运动/人物左右走动gif/哆啦A梦/哆啦A梦_副本3_preview_4x.gif", flightPath: "游戏内主界面/人物运动/使用道具后的角色状态/飞行靴/哆啦A梦/面向右/哆啦A梦-飞行靴-竖直-向右.png"),
        .init(id: "nobita", name: "大雄", price: 50, intro: "性格温和，擅长使用蜂蜜系食物。", role: "续航恢复型角色", movement: 3, luck: 3, availableInRun: true, themeHex: "D89000", portraitPath: "首页/人物头像（方形的）/角色卡_大雄.png", walkPath: "游戏内主界面/人物运动/人物左右走动gif/大熊/大熊_02_preview_4x.gif", flightPath: "游戏内主界面/人物运动/使用道具后的角色状态/飞行靴/大熊/面向右/大雄-飞行靴-竖直-向右.png"),
        .init(id: "shizuka", name: "静香", price: 70, intro: "温柔善良，甜心食物恢复效果佳。", role: "救急恢复型角色", movement: 4, luck: 3, availableInRun: true, themeHex: "E85078", portraitPath: "首页/人物头像（方形的）/角色卡_静香.png", walkPath: "游戏内主界面/人物运动/人物左右走动gif/静香/静香_02_preview_4x.gif", flightPath: "游戏内主界面/人物运动/使用道具后的角色状态/飞行靴/静香/面向右/静香-飞行靴-竖直-向右.png"),
        .init(id: "gian", name: "胖虎", price: 90, intro: "力量十足，奔跑冲刺能力更出众。", role: "运动冲刺型角色", movement: 5, luck: 2, availableInRun: false, themeHex: "D02810", portraitPath: "首页/人物头像（方形的）/角色卡_胖虎.png", walkPath: nil, flightPath: nil),
        .init(id: "suneo", name: "小夫", price: 90, intro: "家境优渥，跑酷收集效率更高。", role: "金币收集型角色", movement: 3, luck: 5, availableInRun: false, themeHex: "58A010", portraitPath: "首页/人物头像（方形的）/角色卡_小夫.png", walkPath: nil, flightPath: nil),
        .init(id: "dorami", name: "哆啦美", price: 120, intro: "聪明可爱，各项辅助能力均衡。", role: "幸运辅助型角色", movement: 4, luck: 4, availableInRun: true, themeHex: "E87800", portraitPath: "首页/人物头像（方形的）/角色卡_哆啦美.png", walkPath: "游戏内主界面/人物运动/人物左右走动gif/哆啦美/哆啦美_01_preview_4x.gif", flightPath: "游戏内主界面/人物运动/使用道具后的角色状态/飞行靴/哆啦美/面向右/哆啦美-飞行靴-竖直-向右.png")
    ]

    private static func quick(_ folder: String, _ name: String) -> String { "游戏内主界面/道具快捷栏/\(folder)/\(name).png" }
    static let items: [ItemDefinition] = [
        .init(id: "first_aid", name: "急救箱", category: .special, owner: nil, buyPrice: 280, shortEffect: "立即恢复3颗血心", detail: "立即恢复 3 颗血心", duration: nil, iconPath: quick("特殊道具", "急救箱")),
        .init(id: "vitality_drink", name: "活力饮料", category: .special, owner: nil, buyPrice: 180, shortEffect: "分段恢复2颗血心", detail: "分段共恢复 2 颗血心", duration: 5, iconPath: quick("特殊道具", "活力饮料")),
        .init(id: "lucky_drink", name: "幸运饮料", category: .special, owner: nil, buyPrice: 220, shortEffect: "金币+30%，掉落+10%", detail: "金币+30%、掉落+10%，20秒", duration: 20, iconPath: quick("特殊道具", "幸运饮料")),
        .init(id: "leap_drink", name: "飞跃饮料", category: .special, owner: nil, buyPrice: 200, shortEffect: "移速跳跃+20%15秒", detail: "移速与跳跃+20%，15秒", duration: 15, iconPath: quick("特殊道具", "飞跃饮料")),
        .init(id: "magnet", name: "超级磁铁", category: .utility, owner: nil, buyPrice: 160, shortEffect: "吸附周围物品20秒", detail: "吸附金币与道具，20秒", duration: 20, iconPath: quick("通用道具", "超级磁铁")),
        .init(id: "shield", name: "防护盾", category: .utility, owner: nil, buyPrice: 180, shortEffect: "抵挡1次碰撞伤害", detail: "抵挡 1 次碰撞伤害", duration: nil, iconPath: quick("通用道具", "防护盾")),
        .init(id: "speed_shoes", name: "极速跑鞋", category: .utility, owner: nil, buyPrice: 140, shortEffect: "移速+30%，15秒", detail: "移动速度+30%，15秒", duration: 15, iconPath: quick("通用道具", "极速跑鞋")),
        .init(id: "flight_boots", name: "飞行靴", category: .utility, owner: nil, buyPrice: 240, shortEffect: "无视地面障碍10秒", detail: "无视地面障碍，10秒", duration: 10, iconPath: quick("通用道具", "飞行靴")),
        .init(id: "energy_milk", name: "能量牛奶", category: .utility, owner: nil, buyPrice: 100, shortEffect: "通用恢复1颗血心", detail: "恢复 1 颗血心", duration: nil, iconPath: quick("通用道具", "能量牛奶")),
        food("fresh_orange", "新鲜橙子", "dorami", 40, 1, "哆啦美专用"), food("orange_juice", "活力橙汁", "dorami", 80, 2, "哆啦美专用"), food("orange_pudding", "橙子布丁", "dorami", 160, 3, "哆啦美专用"),
        food("honey_pancake", "蜂蜜松饼", "nobita", 40, 1, "大雄专用"), food("natural_honey", "天然蜂蜜", "nobita", 80, 2, "大雄专用"), food("golden_honeycomb", "黄金蜂巢", "nobita", 160, 3, "大雄专用"),
        food("heart_lollipop", "甜心棒棒糖", "shizuka", 40, 1, "静香专用"), food("strawberry_milk", "草莓牛奶", "shizuka", 80, 2, "静香专用"), food("strawberry_cake", "草莓蛋糕", "shizuka", 160, 3, "静香专用"),
        food("mini_dorayaki", "迷你铜锣烧", "doraemon", 40, 1, "哆啦A梦专用"), food("classic_dorayaki", "经典铜锣烧", "doraemon", 80, 2, "哆啦A梦专用"), food("luxury_dorayaki", "豪华铜锣烧", "doraemon", 160, 3, "哆啦A梦专用")
    ]

    private static func food(_ id: String, _ name: String, _ owner: String, _ price: Int, _ hearts: Int, _ folder: String) -> ItemDefinition {
        ItemDefinition(id: id, name: name, category: .food, owner: owner, buyPrice: price, shortEffect: "恢复\(hearts)颗血心", detail: "恢复 \(hearts) 颗血心", duration: nil, iconPath: quick("食物道具/\(folder)", name))
    }

    static let chests: [ChestDefinition] = [
        .init(kind: .wood, key: .copper, price: 100, currency: .coins, intro: "基础宝箱，开启可获得基础奖励。", iconPath: "游戏内主界面/游戏内随机掉落素材/宝箱/木宝箱.png"),
        .init(kind: .silver, key: .silver, price: 260, currency: .coins, intro: "中级宝箱，开启可获得较好奖励。", iconPath: "游戏内主界面/游戏内随机掉落素材/宝箱/银宝箱.png"),
        .init(kind: .gold, key: .gold, price: 520, currency: .coins, intro: "高级宝箱，开启可获得稀有奖励。", iconPath: "游戏内主界面/游戏内随机掉落素材/宝箱/黄金宝箱.png"),
        .init(kind: .purple, key: .purple, price: 80, currency: .diamonds, intro: "顶级宝箱，开启可获得珍稀奖励。", iconPath: "游戏内主界面/游戏内随机掉落素材/宝箱/紫金宝箱.png")
    ]

    static let keys: [KeyDefinition] = [
        .init(kind: .copper, chest: .wood, price: 50, currency: .coins, iconPath: "背包页/宝箱开启中间页/提示页/钥匙/铜钥匙_背包卡.png"),
        .init(kind: .silver, chest: .silver, price: 130, currency: .coins, iconPath: "背包页/宝箱开启中间页/提示页/钥匙/银钥匙_背包卡.png"),
        .init(kind: .gold, chest: .gold, price: 260, currency: .coins, iconPath: "背包页/宝箱开启中间页/提示页/钥匙/金钥匙_背包卡.png"),
        .init(kind: .purple, chest: .purple, price: 40, currency: .diamonds, iconPath: "背包页/宝箱开启中间页/提示页/钥匙/紫钥匙_背包卡.png")
    ]

    static func character(_ id: String) -> CharacterDefinition { characters.first { $0.id == id } ?? characters[0] }
    static func item(_ id: String) -> ItemDefinition? { items.first { $0.id == id } }
    static func chest(_ kind: ChestKind) -> ChestDefinition { chests.first { $0.kind == kind }! }
}

extension Color {
    init(hex: String) {
        let value = UInt64(hex, radix: 16) ?? 0
        self.init(red: Double((value >> 16) & 255) / 255, green: Double((value >> 8) & 255) / 255, blue: Double(value & 255) / 255)
    }
}

// MARK: - Design asset routing

extension CharacterDefinition {
    var designName: String { name }
    var inventoryCardPath: String {
        return "背包页/背包主页面/背包卡/角色/已解锁状态/\(designName)_背包卡.png"
    }
    var lockedInventoryCardPath: String { "背包页/背包主页面/背包卡/角色/未解锁状态/\(designName)_背包卡_未解锁.png" }
    var inventoryDetailPath: String { "背包页/背包主页面/详情描述/详情卡/人物/\(designName)_详情卡.png" }
    var lockedInventoryDetailPath: String { "背包页/背包主页面/详情描述/详情卡/人物/灰色/\(designName)_详情卡.png" }
    var shopCardPath: String { "商城页/商城主页面/角色解锁/购买卡/角色卡-\(designName).png" }
    var shopPortraitPath: String { "商城页/商品详情页/详情页信息/角色详情页/纵向角色详情卡/\(designName).png" }
    var shopInfoRowPath: String {
        let suffix: String
        switch id { case "doraemon", "dorami": suffix = "机器"; case "shizuka": suffix = "女"; default: suffix = "男" }
        return "商城页/商品详情页/详情页信息/角色详情页/基础信息/文字信息/角色信息行-\(designName)-\(suffix).png"
    }
}

extension ItemDefinition {
    var designGroup: String {
        switch category { case .special: return "特殊"; case .utility: return "通用"; case .food: return "食物" }
    }
    var designShopGroup: String {
        switch category { case .special: return "特殊道具"; case .utility: return "通用道具"; case .food: return "食物道具" }
    }
    var designOwnerFolder: String? {
        guard category == .food else { return nil }
        switch owner { case "doraemon": return "哆啦A梦专用"; case "dorami": return "哆啦美专用"; case "nobita": return "大熊专用"; case "shizuka": return "静香专用"; default: return nil }
    }
    var inventoryCardPath: String { "背包页/背包主页面/背包卡/道具/\(designGroup)/\(name)_背包卡.png" }
    var inventoryDetailPath: String { "背包页/背包主页面/详情描述/详情卡/道具/\(name)_详情卡.png" }
    var shopCardPath: String {
        let prefix = category == .food ? "\(designShopGroup)-\(designOwnerFolder ?? "")-" : "\(designShopGroup)-"
        return "商城页/商城主页面/道具购买/购买卡/加名称版购买卡/\(prefix)\(name)购买卡.png"
    }
    var shopDetailCardPath: String {
        let ownerPart = category == .food ? "/\(designOwnerFolder ?? "")" : ""
        return "商城页/商品详情页/详情页信息/道具详情页/横向道具详情卡/\(designShopGroup)\(ownerPart)/\(name).png"
    }
    var shopDetailHeroPath: String {
        let ownerFolder = owner == "dorami" ? "小橘专用" : designOwnerFolder
        let ownerPart = category == .food ? "/\(ownerFolder ?? "")" : ""
        return "商城页/商品详情页/素材卡/详情卡70%/道具/\(designShopGroup)\(ownerPart)/\(name).png"
    }
    var resultCardPath: String { "结算页/奖励道具/道具/\(designGroup)/\(name)_背包卡.png" }
    var chestRewardCardPath: String { "背包页/宝箱开启中间页/宝箱奖励页/道具/\(designGroup)/\(name)_背包卡.png" }
}

extension ChestDefinition {
    var inventoryCardPath: String { "背包页/背包主页面/背包卡/宝箱/\(kind.rawValue)_背包卡.png" }
    var inventoryDetailPath: String { "背包页/背包主页面/详情描述/详情卡/宝箱/\(kind.rawValue)_详情卡.png" }
    var shopCardPath: String { "商城页/商城主页面/宝箱购买/购买卡/\(kind.rawValue)购买卡.png" }
    var shopDetailPortraitPath: String { "商城页/商品详情页/详情页信息/宝箱钥匙详情页/宝箱详情页/纵向宝箱详情卡/\(kind.rawValue).png" }
    var failureCardPath: String { "背包页/宝箱开启中间页/提示页/宝箱/\(kind.rawValue)_背包卡.png" }
    var resultCardPath: String { "结算页/奖励道具/宝箱+钥匙/\(kind.rawValue)_背包卡.png" }
}

extension KeyDefinition {
    var shopCardPath: String { "商城页/商城主页面/宝箱购买/购买卡/\(kind.rawValue)购买卡.png" }
    var shopDetailCardPath: String { "商城页/商品详情页/详情页信息/宝箱钥匙详情页/钥匙详情页/横向钥匙详情卡/\(kind.rawValue).png" }
    var relationshipPath: String {
        let quality: String
        switch chest { case .wood: quality = "基础钥匙"; case .silver: quality = "中级钥匙"; case .gold: quality = "高级钥匙"; case .purple: quality = "稀有钥匙" }
        return "商城页/商品详情页/详情页信息/宝箱钥匙详情页/钥匙详情页/钥匙介绍/宝箱钥匙对应关系-\(chest.rawValue)-\(quality).png"
    }
    var instructionPath: String { "商城页/商品详情页/详情页信息/宝箱钥匙详情页/钥匙详情页/使用说明/\(chest.rawValue)完整说明文字.png" }
    var resultCardPath: String { "结算页/奖励道具/宝箱+钥匙/\(kind.rawValue)_背包卡.png" }
}
