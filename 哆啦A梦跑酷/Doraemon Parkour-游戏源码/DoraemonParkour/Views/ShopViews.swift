import SwiftUI

struct ShopView: View {
    @EnvironmentObject private var state: GameAppState
    @State private var scrollProgress: CGFloat = 0
    @State private var contentDragStart: CGFloat?

    var body: some View {
        ZStack {
            Color.clear.ignoresSafeArea()
            ProportionalCanvas(size: CGSize(width: 730, height: 482)) {
                GeometryReader { geo in
                    ZStack {
                        AssetImage(path: "商城页/商城主页面/购买页完整面板.png")
                            .frame(width: geo.size.width, height: geo.size.height)
                        VStack(spacing: 4) {
                            topBar.frame(height: 96)
                            HStack(spacing: 8) {
                                categoryBar.frame(width: 140)
                                synchronizedCategoryContent
                                    .frame(maxWidth: .infinity)
                                    .padding(.bottom, 12)
                            }
                            .padding(.leading, 12)
                            .padding(.trailing, 22)
                            .padding(.bottom, 20)
                        }.padding(.top, 7)
                    }
                    .scaleEffect(1.04)
                    .offset(y: 10)
                }
            }
            if let detail = state.shopDetail { ModalMask { ProductDetailView(detail: detail) } }
        }
        .onChange(of: state.shopCategory) { _ in
            scrollProgress = 0
            contentDragStart = nil
        }
    }

    private var topBar: some View {
        ZStack {
            artButton("商城页/商城主页面/按钮/返回按钮.png", 43, 43) { state.backFromSection() }.position(x: 88, y: 51)
            Text("\(state.profile.coins)").font(.system(size: 18, weight: .black, design: .rounded)).foregroundColor(.black).position(x: 238, y: 52)
            artButton("商城页/商城主页面/按钮/加号按钮.png", 43, 43) { state.showRecharge = true }.position(x: 314.8, y: 51)
            Text("\(state.profile.diamonds)").font(.system(size: 18, weight: .black, design: .rounded)).foregroundColor(.black).position(x: 490, y: 52)
            artButton("商城页/商城主页面/按钮/加号按钮.png", 43, 43) { state.showRecharge = true }.position(x: 566, y: 51)
            artButton("商城页/商城主页面/按钮/设置按钮.png", 40, 40) { state.openSettings(from: .shop) }.position(x: 643, y: 51)
        }
    }

    private var categoryBar: some View {
        VStack(spacing: 14) {
            shopCategory(.characters, folder: "角色", file: "角色按钮")
            shopCategory(.items, folder: "道具", file: "道具按钮")
            shopCategory(.chests, folder: "宝箱钥匙", file: "宝箱按钮")
            Spacer(minLength: 0)
        }.padding(.top, 22).padding(.leading, 0)
    }

    private func shopCategory(_ category: ShopCategory, folder: String, file: String) -> some View {
        Button { state.shopCategory = category } label: {
            AssetImage(path: "商城页/商城主页面/按钮/商城分类按钮/\(folder)/\(file)\(state.shopCategory == category ? "" : "-灰黑").png")
                .frame(width: 112, height: 48)
        }.buttonStyle(GameHapticButtonStyle())
    }

    private var synchronizedCategoryContent: some View {
        GeometryReader { geo in
            let scrollbarWidth: CGFloat = 44
            let spacing: CGFloat = 5
            let trailingInset: CGFloat = 28
            let usesCardSafeArea = state.shopCategory == .items || state.shopCategory == .chests
            let topContentInset: CGFloat = usesCardSafeArea ? 11 : 0
            let bottomContentInset: CGFloat = usesCardSafeArea ? 17 : 0
            let viewportHeight = max(0, geo.size.height - topContentInset - bottomContentInset)
            let maxScroll = max(0, shopContentHeight - viewportHeight)
            let scrollingEnabled = state.shopCategory != .characters && maxScroll > 0
            let contentWidth = max(0, geo.size.width - scrollbarWidth - spacing * 2 - trailingInset)

            HStack(spacing: spacing) {
                categoryContent
                    .frame(width: contentWidth, height: shopContentHeight, alignment: .top)
                    .offset(y: scrollingEnabled ? -scrollProgress * maxScroll : 0)
                    .frame(width: contentWidth, height: viewportHeight, alignment: .top)
                    .clipped()
                    .padding(.top, topContentInset)
                    .padding(.bottom, bottomContentInset)
                    .contentShape(Rectangle())
                    .simultaneousGesture(
                        DragGesture(minimumDistance: 8)
                            .onChanged { value in
                                guard scrollingEnabled else { return }
                                if contentDragStart == nil { contentDragStart = scrollProgress }
                                let start = contentDragStart ?? scrollProgress
                                scrollProgress = min(1, max(0, start - value.translation.height / maxScroll))
                            }
                            .onEnded { _ in contentDragStart = nil }
                    )

                ShopScrollBar(progress: $scrollProgress, enabled: scrollingEnabled)
                    .frame(width: scrollbarWidth)
                    .padding(.vertical, 10)

                Color.clear.frame(width: trailingInset)
            }
        }
    }

    private var shopContentHeight: CGFloat {
        switch state.shopCategory {
        case .characters: return 346
        case .items:
            let rows = max(1, Int(ceil(Double(shopItems.count) / 5.0)))
            return CGFloat(rows) * 149 + CGFloat(max(0, rows - 1)) * 10
        case .chests: return 308
        }
    }

    private var shopCharacters: [CharacterDefinition] {
        ordered(GameData.characters, ids: ["doraemon", "dorami", "shizuka", "gian", "suneo", "nobita"])
    }

    private var shopItems: [ItemDefinition] {
        ordered(GameData.items, ids: [
            "energy_milk", "speed_shoes", "shield", "magnet", "flight_boots",
            "leap_drink", "vitality_drink", "lucky_drink", "first_aid", "classic_dorayaki"
        ])
    }

    private var shopKeys: [KeyDefinition] {
        ordered(GameData.keys, ids: [KeyKind.copper.rawValue, KeyKind.silver.rawValue, KeyKind.gold.rawValue, KeyKind.purple.rawValue])
    }

    private func ordered<Value: Identifiable>(_ values: [Value], ids: [Value.ID]) -> [Value] where Value.ID: Hashable {
        let ranks = Dictionary(uniqueKeysWithValues: ids.enumerated().map { ($0.element, $0.offset) })
        return values.enumerated().sorted {
            let lhs = ranks[$0.element.id] ?? (ids.count + $0.offset)
            let rhs = ranks[$1.element.id] ?? (ids.count + $1.offset)
            return lhs < rhs
        }.map(\.element)
    }

    @ViewBuilder private var categoryContent: some View {
        switch state.shopCategory {
        case .characters:
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
                ForEach(shopCharacters) { character in
                    ShopArtCard(path: character.shopCardPath, price: character.price, currency: .diamonds,
                                disabled: state.profile.unlockedCharacters.contains(character.id) || !character.availableInRun) {
                        state.shopDetail = .character(character.id)
                    }.frame(height: 155)
                }
            }
            .padding(.top, 8)
            .offset(y: 1)
        case .items:
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 3), count: 5), spacing: 10) {
                ForEach(shopItems) { item in
                    ShopArtCard(path: item.shopCardPath, price: item.buyPrice, currency: .coins, priceColor: .white, contentBottomPadding: 13) { state.shopDetail = .item(item.id) }
                        .frame(height: 149)
                }
            }
        case .chests:
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 18), count: 4), spacing: 10) {
                ForEach(shopKeys) { key in
                    ShopArtCard(path: key.shopCardPath, price: key.price, currency: key.currency, priceColor: .white, contentBottomPadding: 15) { state.shopDetail = .key(key.kind) }.frame(height: 149)
                }
                ForEach(GameData.chests) { chest in
                    ShopArtCard(path: chest.shopCardPath, price: chest.price, currency: chest.currency, priceColor: .white, contentBottomPadding: 15) { state.shopDetail = .chest(chest.kind) }.frame(height: 149)
                }
            }
        }
    }

    private func artButton(_ path: String, _ width: CGFloat, _ height: CGFloat, action: @escaping () -> Void) -> some View {
        Button(action: action) { AssetImage(path: path).frame(width: width, height: height) }.buttonStyle(GameHapticButtonStyle())
    }
}

private struct ShopScrollBar: View {
    @Binding var progress: CGFloat
    let enabled: Bool

    var body: some View {
        GeometryReader { geo in
            let thumbHeight = min(47, geo.size.height)
            let endpointInset = min(28, max(0, (geo.size.height - thumbHeight) / 2))
            let travel = max(0, geo.size.height - thumbHeight - endpointInset * 2)
            let thumbProgress = enabled ? progress : 0.5

            ZStack(alignment: .top) {
                AssetImage(path: "商城页/商城主页面/按钮/滑动条/商城竖向滚动条-细.png")
                    .frame(width: 43, height: geo.size.height)

                AssetImage(path: "商城页/商城主页面/按钮/滑动条/滚动条菱形滑块.png")
                    .frame(width: 43, height: thumbHeight)
                    .offset(y: endpointInset + thumbProgress * travel)
            }
            .frame(width: geo.size.width, height: geo.size.height, alignment: .top)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        guard enabled, travel > 0 else { return }
                        progress = min(1, max(0, (value.location.y - endpointInset - thumbHeight / 2) / travel))
                    }
            )
        }
    }
}

private struct ShopArtCard: View {
    let path: String
    let price: Int
    let currency: CurrencyKind
    var disabled = false
    var priceColor: Color = .black
    var contentBottomPadding: CGFloat = 18
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack(alignment: .bottom) {
                AssetImage(path: path)
                VStack(spacing: 0) {
                    HStack(spacing: 2) {
                        if currency == .diamonds { AssetImage(path: "商城页/商城主页面/角色解锁/蓝色宝石.png").frame(width: 10, height: 10) }
                        else { AssetImage(path: "商城页/商城主页面/道具购买/金币.png").frame(width: 10, height: 10) }
                        Text("\(price)").font(.system(size: 10, weight: .black, design: .rounded)).foregroundColor(priceColor)
                    }
                    AssetImage(path: disabled ? "商城页/商城主页面/按钮/购买按钮/购买按钮-灰-不可购买.png" : "商城页/商城主页面/按钮/购买按钮/购买按钮-亮.png")
                        .frame(width: 50, height: 15)
                }.padding(.bottom, contentBottomPadding)
            }
            .contentShape(Rectangle())
        }.buttonStyle(GameHapticButtonStyle())
    }
}

struct ProductDetailView: View {
    @EnvironmentObject private var state: GameAppState
    let detail: ShopDetail

    var body: some View {
        ProportionalCanvas(size: detailCanvasSize) {
            Group {
                switch detail {
                case .character(let id): characterDetail(GameData.character(id))
                case .item(let id): if let item = GameData.item(id) { itemDetail(item) }
                case .chest(let kind): chestDetail(GameData.chest(kind))
                case .key(let kind): keyDetail(GameData.keys.first(where: { $0.kind == kind })!)
                }
            }
            .scaleEffect(detailContentScale)
        }
    }

    private var detailContentScale: CGFloat {
        switch detail {
        case .item, .key: return 1.06
        case .character, .chest: return 1
        }
    }

    private var detailCanvasSize: CGSize {
        switch detail {
        case .character: return CGSize(width: 480, height: 360)
        case .item: return CGSize(width: 245, height: 388)
        case .chest: return CGSize(width: 510, height: 380)
        case .key: return CGSize(width: 240, height: 380)
        }
    }

    private func characterDetail(_ character: CharacterDefinition) -> some View {
        ZStack {
            AssetImage(path: "商城页/商品详情页/详情页信息/角色详情页/角色详情面板-空白.png")
            AssetImage(path: character.shopPortraitPath).frame(width: 102, height: 128).position(x: 115, y: 134)
            AssetImage(path: character.shopInfoRowPath).frame(width: 214, height: 20).position(x: 294, y: 96)
            HStack(spacing: 7) {
                attribute(icon: "001-生命图标.png", count: 5, gem: "001-红色宝石.png")
                attribute(icon: "002-运动能力图标.png", count: character.movement, gem: "002-蓝色宝石.png")
                attribute(icon: "003-幸运图标.png", count: character.luck, gem: "003-绿色宝石.png")
            }.position(x: 294, y: 113)
            VStack(spacing: 3) {
                Text(character.role)
                    .font(.system(size: 12, weight: .black, design: .rounded))
                    .foregroundColor(Color(hex: character.themeHex))
                Text(characterIntroduction(character.id))
                    .font(.system(size: 10.5, weight: .bold, design: .rounded))
                    .foregroundColor(.black)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .minimumScaleFactor(0.86)
            }
            .frame(width: 220, height: 40)
            .position(x: 294, y: 171)
            characterSkills(character)
                .position(x: 240, y: 248)
            HStack(spacing: 56) { detailButtons(enabled: character.availableInRun && !state.profile.unlockedCharacters.contains(character.id), width: 84, height: 25) }
                .position(x: 240, y: 299)
        }.frame(width: 480, height: 360)
    }

    private func attribute(icon: String, count: Int, gem: String) -> some View {
        HStack(spacing: 2) {
            AssetImage(path: "商城页/商品详情页/详情页信息/角色详情页/基础信息/属性图标/\(icon)").frame(width: 15, height: 15)
            HStack(spacing: 1) { ForEach(0..<5, id: \.self) { i in AssetImage(path: "商城页/商品详情页/详情页信息/角色详情页/基础信息/宝石格子/\(i < count ? gem : "灰色.png")").frame(width: 8, height: 8) } }
        }
    }

    private func itemDetail(_ item: ItemDefinition) -> some View {
        ZStack {
            AssetImage(path: "商城页/商品详情页/详情页信息/道具详情页/道具详情面板-空白.png")
            AssetImage(path: item.shopDetailCardPath).frame(width: 170, height: 127).position(x: 122.5, y: 115)
            HStack(spacing: 6) {
                AssetImage(path: itemTypePath(item)).frame(width: 82, height: 14)
                AssetImage(path: rarityPath(item)).frame(width: 80, height: 18)
            }
            .position(x: 130, y: 206)
            HStack(spacing: 8) {
                itemTime(path: "商城页/商品详情页/详情页信息/道具详情页/基础属性/持续时间标签.png", value: item.duration.map { "\($0) s" } ?? "即时")
                itemTime(path: "商城页/商品详情页/详情页信息/道具详情页/基础属性/冷却时间标签.png", value: "无")
            }
            .position(x: 122.5, y: 219)
            Text(itemDescription(item)).font(.system(size: 11, weight: .bold, design: .rounded)).multilineTextAlignment(.center).lineLimit(2).minimumScaleFactor(0.82)
                .frame(width: 190, height: 30).position(x: 122.5, y: 261)
            Text(item.detail).font(.system(size: 11, weight: .bold, design: .rounded)).multilineTextAlignment(.center).lineLimit(2).minimumScaleFactor(0.82)
                .frame(width: 190, height: 30).position(x: 122.5, y: 309)
            HStack(spacing: 12) { detailButtons(enabled: true, width: 80, height: 25) }.position(x: 122.5, y: 340)
        }.frame(width: 245, height: 388)
    }

    private func chestDetail(_ chest: ChestDefinition) -> some View {
        ZStack {
            AssetImage(path: "商城页/商品详情页/详情页信息/宝箱钥匙详情页/宝箱详情页/宝箱详情面板-空白.png")
            AssetImage(path: chest.shopDetailPortraitPath)
                .frame(width: 102, height: 128)
                .position(x: 115, y: 134)
            Text(chestIntroduction(chest.kind))
                .font(.system(size: 12.5, weight: .bold, design: .rounded))
                .foregroundColor(.black)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.82)
                .frame(width: 250, height: 46)
                .position(x: 316, y: 114)
            HStack(spacing: 10) {
                AssetImage(path: chestQualityPath(chest.kind)).frame(width: 110, height: 18)
                AssetImage(path: chestKeyConditionPath(chest.key)).frame(width: 110, height: 18)
            }
            .frame(width: 250, height: 30)
            .position(x: 316, y: 189)
            HStack(spacing: 6) {
                ForEach(chestRewardPreview(chest.kind), id: \.self) { path in
                    AssetImage(path: path).frame(width: 30, height: 30)
                }
            }
            .frame(width: 300, height: 40)
            .position(x: 255, y: 263)
            HStack(spacing: 52) { detailButtons(enabled: true, width: 98, height: 29) }
                .position(x: 255, y: 310)
        }.frame(width: 510, height: 380)
    }

    private func keyDetail(_ key: KeyDefinition) -> some View {
        ZStack {
            AssetImage(path: "商城页/商品详情页/详情页信息/宝箱钥匙详情页/钥匙详情页/钥匙详情面板-空白.png")
            AssetImage(path: key.shopDetailCardPath)
                .frame(width: 170, height: 127)
                .position(x: 120, y: 109)
            AssetImage(path: key.relationshipPath)
                .frame(width: 160, height: 14)
                .position(x: 120, y: 207)
            AssetImage(path: key.instructionPath)
                .frame(width: 144, height: 70)
                .position(x: 120, y: 271)
            HStack(spacing: 16) { detailButtons(enabled: true, width: 80, height: 24) }
                .position(x: 120, y: 334)
        }.frame(width: 240, height: 380)
    }

    private func itemTime(path: String, value: String) -> some View {
        HStack(spacing: 3) {
            AssetImage(path: path).frame(width: 42, height: 12)
            Text(value)
                .font(.system(size: 8.5, weight: .black, design: .rounded))
                .foregroundColor(.black)
                .lineLimit(1)
        }
    }

    private func detailButtons(enabled: Bool, width: CGFloat, height: CGFloat) -> some View {
        Group {
            Button { state.purchase(detail) } label: { AssetImage(path: "商城页/商品详情页/按钮/001-购买按钮.png").frame(width: width, height: height).opacity(enabled ? 1 : 0.55) }.buttonStyle(GameHapticButtonStyle())
            Button { state.shopDetail = nil } label: { AssetImage(path: "商城页/商品详情页/按钮/002-退出按钮.png").frame(width: width, height: height) }.buttonStyle(GameHapticButtonStyle())
        }
    }

    private func itemTypePath(_ item: ItemDefinition) -> String {
        let index: String
        switch item.id {
        case "first_aid": index = "001-商品类型高级恢复道具.png"
        case "magnet", "flight_boots": index = "002-商品类型高级功能道具.png"
        case "lucky_drink": index = "003-商品类型收益增益道具.png"
        case "energy_milk": index = "004-商品类型通用恢复道具.png"
        case "leap_drink": index = "005-商品类型增益饮料.png"
        case _ where item.category == .food: index = "006-商品类型专属食物.png"
        case "vitality_drink": index = "007-商品类型恢复饮料.png"
        case "speed_shoes": index = "008-商品类型功能道具.png"
        default: index = "009-商品类型防御道具.png"
        }
        return "商城页/商品详情页/详情页信息/道具详情页/基础属性/商品类型/\(index)"
    }

    private func rarityPath(_ item: ItemDefinition) -> String {
        let file = item.buyPrice >= 200 ? "003-稀有度史诗.png" : (item.buyPrice >= 140 ? "002-稀有度稀有.png" : "001-稀有度普通.png")
        return "商城页/商品详情页/详情页信息/道具详情页/基础属性/稀有度/\(file)"
    }

    private func characterSkills(_ character: CharacterDefinition) -> some View {
        let skills = skillDetails(character.id)
        let theme = Color(hex: character.themeHex)

        return VStack(spacing: 3) {
            ForEach(Array(skills.enumerated()), id: \.offset) { index, skill in
                VStack(spacing: 0) {
                    (Text("\(index + 1)、\(skill.type)：")
                        .foregroundColor(.black)
                     + Text("“\(skill.name)”")
                        .foregroundColor(theme))
                        .font(.system(size: 9.5, weight: .black, design: .rounded))
                        .lineLimit(1)
                    Text(skill.description)
                        .font(.system(size: 7.8, weight: .bold, design: .rounded))
                        .foregroundColor(.black)
                        .multilineTextAlignment(.center)
                        .lineLimit(1)
                        .minimumScaleFactor(0.72)
                }
            }
        }
        .frame(width: 310, height: 48)
    }

    private struct SkillDetail {
        let type: String
        let name: String
        let description: String
    }

    private func skillDetails(_ id: String) -> [SkillDetail] {
        switch id {
        case "doraemon":
            return [
                .init(type: "被动", name: "铜锣烧补给", description: "使用铜锣烧系列食物时，恢复效果稳定，适合新手使用。"),
                .init(type: "能量", name: "次元口袋", description: "释放后持续10秒吸附附近金币和道具，并获得1次护盾。")
            ]
        case "nobita":
            return [
                .init(type: "被动", name: "蜂蜜守护", description: "低血心时使用蜂蜜系食物，可额外恢复1颗血心，每局最多1次。"),
                .init(type: "能量", name: "勇气奔跑", description: "释放后立即恢复1颗血心，并在8秒内提升运动能力。")
            ]
        case "shizuka":
            return [
                .init(type: "被动", name: "甜心急救", description: "只剩1颗血心时使用甜心食物，可额外恢复1颗血心，每局最多1次。"),
                .init(type: "能量", name: "甜心治愈", description: "释放后立即恢复2颗血心，并在5秒内降低受到伤害的风险。")
            ]
        case "gian":
            return [
                .init(type: "被动", name: "强力步伐", description: "移动速度提升8%，跑酷冲刺更流畅，但不改变血心上限。"),
                .init(type: "能量", name: "怒吼冲刺", description: "释放后持续8秒高速冲刺，可无视1次轻型障碍伤害。")
            ]
        case "dorami":
            return [
                .init(type: "被动", name: "幸运雷达", description: "道具掉落概率提升8%，更容易获得包含血心回复类道具。"),
                .init(type: "能量", name: "幸运补给", description: "释放后立即生成1个随机增益道具，并10秒内提升掉落概率。")
            ]
        default:
            return [
                .init(type: "被动", name: "金币嗅觉", description: "金币获取提升12%，适合金币关卡，不改变血心恢复量。"),
                .init(type: "能量", name: "闪光收集", description: "释放后持续12秒扩大金币吸附范围，并提升金币收益。")
            ]
        }
    }

    private func characterIntroduction(_ id: String) -> String {
        switch id {
        case "doraemon": return "来自未来的机器猫，擅长稳定续航与道具支援。"
        case "nobita": return "温柔但容易受伤，适合依靠食物稳步续航。"
        case "shizuka": return "温柔可靠的伙伴，低血时拥有更强恢复力。"
        case "gian": return "力量十足的运动型角色，适合快速冲刺通关。"
        case "dorami": return "聪明可爱的辅助角色，更容易获得关卡道具。"
        default: return "擅长收集资源，适合金币和奖励关卡。"
        }
    }

    private func itemDescription(_ item: ItemDefinition) -> String {
        switch item.id {
        case "first_aid": return "关键时刻立即回血"
        case "vitality_drink": return "分段恢复血心"
        case "lucky_drink": return "提高金币与掉落收益"
        case "leap_drink": return "提升速度与跳跃能力"
        case "magnet": return "自动吸附附近奖励"
        case "shield": return "抵挡一次碰撞伤害"
        case "speed_shoes": return "短时间提升移动速度"
        case "flight_boots": return "短时间飞越地面障碍"
        case "energy_milk": return "所有角色都能使用"
        default:
            switch item.owner {
            case "doraemon": return "哆啦A梦专属食物"
            case "dorami": return "哆啦美专属食物"
            case "nobita": return "大雄专属食物"
            case "shizuka": return "静香专属食物"
            default: return item.shortEffect
            }
        }
    }

    private func chestIntroduction(_ kind: ChestKind) -> String {
        switch kind {
        case .wood:
            return "封存初心试炼的木宝箱\n开启后赐予勇者旅途微光补给"
        case .silver:
            return "蕴藏月银祝福的宝箱\n开启后带来进阶资源并有机会开出完整角色"
        case .gold:
            return "承载黄金远征荣光的宝箱\n开启后可能唤来稀有角色"
        case .purple:
            return "沉睡紫金秘境力量的宝箱\n开启后释放最珍贵的角色奖励"
        }
    }

    private func chestQualityPath(_ kind: ChestKind) -> String {
        let file: String
        switch kind { case .wood: file = "001-宝箱品质基础宝箱.png"; case .silver: file = "002-宝箱品质中级宝箱.png"; case .gold: file = "003-宝箱品质高级宝箱.png"; case .purple: file = "004-宝箱品质稀有宝箱.png" }
        return "商城页/商品详情页/详情页信息/宝箱钥匙详情页/宝箱详情页/宝箱信息素材/\(file)"
    }

    private func chestKeyConditionPath(_ kind: KeyKind) -> String {
        let file: String
        switch kind { case .copper: file = "005-开启条件铜钥匙.png"; case .silver: file = "006-开启条件银钥匙.png"; case .gold: file = "007-开启条件金钥匙.png"; case .purple: file = "008-开启条件紫钥匙.png" }
        return "商城页/商品详情页/详情页信息/宝箱钥匙详情页/宝箱详情页/宝箱信息素材/\(file)"
    }

    private func chestRewardPreview(_ kind: ChestKind) -> [String] {
        let root = "商城页/商品详情页/详情页信息/宝箱钥匙详情页/宝箱详情页/开箱奖励/奖励卡"
        switch kind {
        case .wood: return ["\(root)/货币/金币.png", "\(root)/道具/食物道具/哆啦A梦专用/迷你铜锣烧.png", "\(root)/道具/通用道具/能量牛奶.png"]
        case .silver: return ["\(root)/货币/金币.png", "\(root)/货币/蓝色宝石.png", "\(root)/道具/通用道具/超级磁铁.png", "\(root)/角色/002-大雄头像.png"]
        case .gold: return ["\(root)/货币/金币.png", "\(root)/货币/蓝色宝石.png", "\(root)/道具/通用道具/飞行靴.png", "\(root)/角色/003-静香头像.png"]
        case .purple: return ["\(root)/货币/蓝色宝石.png", "\(root)/道具/特殊道具/幸运饮料.png", "\(root)/道具/特殊道具/急救箱.png", "\(root)/角色/006-哆啦美头像.png"]
        }
    }
}
