import SwiftUI

struct InventoryView: View {
    @EnvironmentObject private var state: GameAppState
    var embedded = false
    @State private var itemPage = 0
    private let detailBoardSize = CGSize(width: 146, height: 92)

    var body: some View {
        ZStack {
            Color.clear.ignoresSafeArea()
            ProportionalCanvas(size: CGSize(width: 671.5, height: 500.5)) {
                GeometryReader { geo in
                    ZStack {
                        AssetImage(path: "背包页/背包主页面/面板/背包页完整界面框-带滚动条.png")
                            .frame(width: geo.size.width, height: geo.size.height)

                        VStack(spacing: 3) {
                            inventoryTopBar.frame(height: 96)
                            HStack(spacing: 10) {
                                categoryBar.frame(width: geo.size.width * 0.20)
                                inventoryGrid
                                    .frame(width: geo.size.width * 0.415)
                                    .frame(maxHeight: .infinity, alignment: .top)
                                    .padding(.top, 15)
                                detailPanel
                                    .frame(maxWidth: .infinity)
                                    .frame(maxHeight: .infinity, alignment: .top)
                                    .padding(.top, 15)
                                    .offset(x: -9)
                            }
                            .padding(.horizontal, 20)
                            .padding(.bottom, 15)
                        }
                        .padding(.top, 8)
                    }
                    .scaleEffect(1.04)
                }
            }
            .offset(y: 6)
        }
    }

    private var inventoryTopBar: some View {
        ZStack {
            artButton("背包页/背包主页面/按钮/其他/返回按钮.png", width: 44, height: 44) {
                if embedded { state.showInventoryOverlay = false } else { state.backFromSection() }
            }
            .frame(width: 56, height: 56)
            .contentShape(Rectangle())
            .zIndex(10)
            .position(x: 65.5, y: 55.5)
            Text("\(state.profile.coins)").font(.system(size: 23, weight: .black, design: .rounded)).foregroundColor(.black).position(x: 201, y: 55.5)
            artButton("背包页/背包主页面/按钮/其他/圆形加号按钮.png", width: 38, height: 38) { state.showRecharge = true }.position(x: 289, y: 55.5)
            Text("\(state.profile.diamonds)").font(.system(size: 23, weight: .black, design: .rounded)).foregroundColor(.black).position(x: 474, y: 55.5)
            artButton("背包页/背包主页面/按钮/其他/圆形加号按钮.png", width: 38, height: 38) { state.showRecharge = true }.position(x: 558, y: 55.5)
            artButton("背包页/背包主页面/按钮/其他/设置按钮.png", width: 44, height: 44) { state.openSettings(from: embedded ? .run : .inventory) }.position(x: 605, y: 55.5)
        }
    }

    private var categoryBar: some View {
        VStack(spacing: 14) {
            categoryButton(.characters, folder: "角色", file: "角色按钮")
            categoryButton(.items, folder: "道具", file: "道具按钮")
            categoryButton(.chests, folder: "宝箱钥匙", file: "宝箱按钮")
            Spacer(minLength: 0)
        }
        .padding(.top, 40)
        .padding(.leading, 14)
    }

    private func categoryButton(_ category: InventoryCategory, folder: String, file: String) -> some View {
        Button {
            state.inventoryCategory = category
        } label: {
            AssetImage(path: "背包页/背包主页面/按钮/分类/\(folder)/\(file)\(state.inventoryCategory == category ? "" : "-灰黑").png")
                .frame(width: 115, height: 55)
        }.buttonStyle(GameHapticButtonStyle())
    }

    @ViewBuilder private var inventoryGrid: some View {
        switch state.inventoryCategory {
        case .characters: characterGrid
        case .items: itemGrid
        case .chests: chestGrid
        }
    }

    private var characterGrid: some View {
        VStack(spacing: 0) {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: -5), count: 3), spacing: 11) {
                ForEach(GameData.characters) { character in
                    let unlocked = state.profile.unlockedCharacters.contains(character.id)
                    Button { state.selectedCharacterID = character.id } label: {
                        AssetImage(path: unlocked ? character.inventoryCardPath : character.lockedInventoryCardPath)
                            .scaleEffect(state.selectedCharacterID == character.id ? 1.025 : 1)
                            .brightness(state.selectedCharacterID == character.id ? 0.07 : 0)
                            .shadow(
                                color: state.selectedCharacterID == character.id ? .black.opacity(0.42) : .clear,
                                radius: 4,
                                y: 3
                            )
                    }
                    .buttonStyle(GameHapticButtonStyle())
                    .frame(height: 119)
                }
            }
            .offset(x: 3)
            Spacer(minLength: 0)
            pageStrip(page: 0, count: 1, previous: {}, next: {})
        }
        .padding(.top, 10)
        .padding(.bottom, 10)
    }

    private var ownedItems: [ItemDefinition] {
        GameData.items.filter { (state.profile.itemInventory[$0.id] ?? 0) > 0 || state.profile.loadout.contains($0.id) }
    }

    private var itemGrid: some View {
        let pageCount = max(1, Int(ceil(Double(ownedItems.count) / 12.0)))
        let pageItems = Array(ownedItems.dropFirst(itemPage * 12).prefix(12))
        return VStack(spacing: 0) {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: -15), count: 4), spacing: 5) {
                ForEach(pageItems) { item in
                    Button { state.selectedItemID = item.id } label: {
                        ZStack(alignment: .bottomTrailing) {
                            AssetImage(path: item.inventoryCardPath)
                                .scaleEffect(state.selectedItemID == item.id ? 1.035 : 1)
                                .brightness(state.selectedItemID == item.id ? 0.07 : 0)
                                .shadow(
                                    color: state.selectedItemID == item.id ? .black.opacity(0.42) : .clear,
                                    radius: 3,
                                    y: 2
                                )
                            Text("×\((state.profile.itemInventory[item.id] ?? 0) + (state.profile.loadout.contains(item.id) ? 1 : 0))")
                                .font(.system(size: 12, weight: .black, design: .rounded)).foregroundColor(.white)
                                .padding(.horizontal, 5).padding(.vertical, 2).background(Color.black.opacity(0.7)).clipShape(Capsule()).padding(3)
                        }
                    }.buttonStyle(GameHapticButtonStyle()).frame(height: 60)
                }
            }
            .offset(x: 3)
            if pageItems.isEmpty {
                Text("暂无道具").pixelText(20, color: .white).frame(maxWidth: .infinity).padding(.top, 45)
            }
            Spacer(minLength: 0)
            pageStrip(page: itemPage, count: pageCount, previous: { itemPage = max(0, itemPage - 1) }, next: { itemPage = min(pageCount - 1, itemPage + 1) })
        }
        .padding(.top, 10)
        .padding(.bottom, 10)
    }

    private var chestGrid: some View {
        VStack(spacing: 0) {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 2), spacing: 20) {
                ForEach(GameData.chests) { chest in
                    Button { state.selectedChest = chest.kind } label: {
                        ZStack(alignment: .bottomTrailing) {
                            AssetImage(path: chest.inventoryCardPath)
                                .scaleEffect(state.selectedChest == chest.kind ? 1.025 : 1)
                                .brightness(state.selectedChest == chest.kind ? 0.07 : 0)
                                .shadow(
                                    color: state.selectedChest == chest.kind ? .black.opacity(0.42) : .clear,
                                    radius: 4,
                                    y: 3
                                )
                            Text("×\(state.profile.chestInventory[chest.kind.rawValue] ?? 0)")
                                .font(.system(size: 13, weight: .black, design: .rounded)).foregroundColor(.white)
                                .padding(.horizontal, 6).padding(.vertical, 2).background(Color.black.opacity(0.7)).clipShape(Capsule()).padding(5)
                        }
                    }.buttonStyle(GameHapticButtonStyle()).frame(height: 116)
                }
            }
            .offset(x: 5)
            Spacer(minLength: 0)
            pageStrip(page: 0, count: 1, previous: {}, next: {})
        }
        .padding(.top, 10)
        .padding(.bottom, 10)
    }

    private func pageStrip(page: Int, count: Int, previous: @escaping () -> Void, next: @escaping () -> Void) -> some View {
        HStack(spacing: 7) {
            artButton("背包页/背包主页面/按钮/页数/分页上一页按钮.png", width: 38, height: 38, action: previous).opacity(page == 0 ? 0.45 : 1)
            if count == 1 {
                AssetImage(path: "背包页/背包主页面/按钮/页数/分页更多按钮.png").frame(width: 38, height: 38)
            } else {
                ForEach(0..<count, id: \.self) { value in
                    ZStack {
                        AssetImage(path: "背包页/背包主页面/按钮/页数/空白按钮框.png")
                        Text("\(value + 1)").font(.system(size: 18, weight: .black, design: .rounded)).foregroundColor(value == page ? GameLayout.royalBlue : .black)
                    }.frame(width: 38, height: 38)
                }
            }
            artButton("背包页/背包主页面/按钮/页数/分页下一页按钮.png", width: 38, height: 38, action: next).opacity(page >= count - 1 ? 0.45 : 1)
        }
        .offset(y: -20)
    }

    @ViewBuilder private var detailPanel: some View {
        switch state.inventoryCategory {
        case .characters: characterDetail
        case .items: itemDetail
        case .chests: chestDetail
        }
    }

    private var characterDetail: some View {
        let c = GameData.character(state.selectedCharacterID)
        let unlocked = state.profile.unlockedCharacters.contains(c.id)
        return VStack(spacing: 5) {
            AssetImage(path: unlocked ? c.inventoryDetailPath : c.lockedInventoryDetailPath).frame(height: 185)
            ZStack {
                AssetImage(path: "背包页/背包主页面/详情描述/详情底板/角色详情描述底板.png")
                GeometryReader { geo in
                    Text(c.intro)
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                        .minimumScaleFactor(0.72)
                        .frame(width: geo.size.width - 26, height: 30)
                        .clipped()
                        .position(x: geo.size.width / 2, y: 38)
                    Text("\(c.price)")
                        .font(.system(size: 15, weight: .black, design: .rounded))
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                        .frame(width: geo.size.width * 0.55, height: 18)
                        .clipped()
                        .position(x: geo.size.width * 0.62 - 10, y: 70)
                }
            }.frame(width: detailBoardSize.width, height: detailBoardSize.height)
            HStack(spacing: 6) {
                artButton(unlocked ? "背包页/背包主页面/按钮/其他/解锁按钮_灰-已解锁.png" : "背包页/背包主页面/按钮/其他/解锁按钮_亮.png", width: 75, height: 34) {
                    if !unlocked { state.openShop(from: embedded ? .run : .inventory, category: .characters); state.shopDetail = .character(c.id) }
                }
                artButton(unlocked && c.availableInRun && state.profile.selectedCharacter != c.id ? "背包页/背包主页面/按钮/其他/使用按钮.png" : "背包页/背包主页面/按钮/其他/使用按钮-灰.png", width: 75, height: 34) {
                    if unlocked && c.availableInRun { state.selectCharacter(c.id) }
                }
            }
        }.padding(.vertical, 8)
    }

    @ViewBuilder private var itemDetail: some View {
        if let item = GameData.item(state.selectedItemID), ownedItems.contains(where: { $0.id == item.id }) {
            let carried = state.profile.loadout.contains(item.id)
            VStack(spacing: 5) {
                AssetImage(path: item.inventoryDetailPath).frame(height: 185)
                ZStack {
                    AssetImage(path: "背包页/背包主页面/详情描述/详情底板/道具详情描述底板.png")
                        .scaleEffect(x: 1.048, y: 1.048)
                    GeometryReader { geo in
                        Text(item.detail)
                            .font(.system(size: 12, weight: .bold, design: .rounded))
                            .multilineTextAlignment(.center)
                            .lineLimit(2)
                            .minimumScaleFactor(0.72)
                            .frame(width: geo.size.width - 26, height: 30, alignment: .center)
                            .clipped()
                            .position(x: geo.size.width / 2, y: 38)
                        Text("\(item.sellPrice)")
                            .font(.system(size: 15, weight: .black, design: .rounded))
                            .lineLimit(1)
                            .minimumScaleFactor(0.75)
                            .frame(width: geo.size.width * 0.55, height: 18)
                            .clipped()
                            .position(x: geo.size.width * 0.55, y: 67)
                    }
                }.frame(width: detailBoardSize.width, height: detailBoardSize.height)
                HStack(spacing: 6) {
                    artButton((state.profile.itemInventory[item.id] ?? 0) > 0 ? "背包页/背包主页面/按钮/其他/出售按钮.png" : "背包页/背包主页面/按钮/其他/出售按钮-灰.png", width: 75, height: 34) { state.sell(item.id) }
                    artButton(carried ? "背包页/背包主页面/按钮/其他/使用按钮-灰.png" : "背包页/背包主页面/按钮/其他/使用按钮.png", width: 75, height: 34) {
                        if carried { state.cancelCarry(item.id) } else { state.carry(item.id) }
                    }
                }
            }.padding(.vertical, 8)
        } else {
            Text("选择道具查看详情").pixelText(18, color: .white)
        }
    }

    private var chestDetail: some View {
        let chest = GameData.chest(state.selectedChest)
        return VStack(spacing: 5) {
            AssetImage(path: chest.inventoryDetailPath).frame(height: 185)
            ZStack {
                AssetImage(path: "背包页/背包主页面/详情描述/详情底板/宝箱详情底板.png")
                    .scaleEffect(x: 1.029, y: 1.117)
                GeometryReader { geo in
                    Text(chest.intro)
                        .font(.system(size: 11, weight: .bold, design: .rounded))
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                        .minimumScaleFactor(0.72)
                        .frame(width: geo.size.width - 28, height: 30)
                        .clipped()
                        .position(x: geo.size.width / 2, y: 40)
                    HStack(spacing: 2) {
                        AssetImage(path: "背包页/背包主页面/详情描述/剩余钥匙/剩余\(chest.key.rawValue)数量文字.png")
                            .frame(width: 94, height: 18)
                            .offset(x: 4)
                        Text("\(state.profile.keyInventory[chest.key.rawValue] ?? 0)")
                            .font(.system(size: 14, weight: .black, design: .rounded))
                            .lineLimit(1)
                            .minimumScaleFactor(0.72)
                            .frame(width: 24, height: 18, alignment: .leading)
                            .clipped()
                            .offset(x: 5)
                    }
                        .frame(width: 120, height: 18)
                        .position(x: geo.size.width / 2, y: 70)
                }
            }.frame(width: detailBoardSize.width, height: detailBoardSize.height)
            artButton("背包页/背包主页面/按钮/其他/解锁按钮_亮.png", width: 88, height: 37) { state.openChest(chest.kind) }
        }.padding(.vertical, 8)
    }

    private func artButton(_ path: String, width: CGFloat, height: CGFloat, action: @escaping () -> Void) -> some View {
        Button(action: action) { AssetImage(path: path).frame(width: width, height: height) }.buttonStyle(GameHapticButtonStyle())
    }
}

struct ChestOverlayView: View {
    @EnvironmentObject private var state: GameAppState
    let overlay: ChestOverlay

    var body: some View {
        ProportionalCanvas(size: overlayCanvasSize) {
            Group {
                switch overlay {
                case .reward(let kind, let reward): rewardView(kind, reward)
                case .missingKey(let kind): failureView(kind, missingKey: true)
                case .missingChest(let kind): failureView(kind, missingKey: false)
                }
            }
        }
    }

    private var overlayCanvasSize: CGSize {
        switch overlay {
        case .reward: return CGSize(width: 255, height: 350)
        case .missingKey, .missingChest: return CGSize(width: 250, height: 350)
        }
    }

    private func rewardView(_ kind: ChestKind, _ reward: RewardBundle) -> some View {
        let rewards = rewardEntries(reward)
        let columnCount = max(1, min(4, rewards.count))
        let rewardGridWidth = CGFloat(columnCount * 45 + (columnCount - 1) * 3)
        return ZStack {
            AssetImage(path: "背包页/宝箱开启中间页/宝箱奖励页/宝箱奖励面板-空白.png")
            Text("开启宝箱：\(kind.rawValue)")
                .font(.system(size: 19, weight: .black, design: .rounded))
                .foregroundColor(.black)
                .frame(width: 225, height: 28)
                .position(x: 127.5, y: 80)
            LazyVGrid(columns: Array(repeating: GridItem(.fixed(45), spacing: 3), count: columnCount), spacing: 3) {
                ForEach(Array(rewards.enumerated()), id: \.offset) { _, reward in
                    ZStack(alignment: .bottomTrailing) {
                        AssetImage(path: reward.path)
                        Text("×\(reward.count)").font(.caption2.bold()).foregroundColor(.white).padding(3).background(Color.black.opacity(0.68)).clipShape(Capsule())
                    }.frame(width: 45, height: 45)
                }
            }
            .frame(width: rewardGridWidth, height: 45)
            .position(x: 127.5, y: 198)
            Button { state.chestOverlay = nil } label: {
                AssetImage(path: "背包页/宝箱开启中间页/按钮/确定按钮.png").frame(width: 90, height: 36)
            }
            .buttonStyle(GameHapticButtonStyle())
            .position(x: 127.5, y: 278)
        }.frame(width: 255, height: 350)
    }

    private func failureView(_ kind: ChestKind, missingKey: Bool) -> some View {
        let chest = GameData.chest(kind)
        let key = GameData.keys.first(where: { $0.kind == chest.key })!
        return ZStack {
            AssetImage(path: "背包页/宝箱开启中间页/提示页/解锁失败面板-空白.png")
            VStack(spacing: 8) {
                Spacer().frame(height: 46)
                AssetImage(path: "背包页/宝箱开启中间页/提示页/详细内容/对应宝箱-\(kind == .gold ? "金宝箱" : kind.rawValue).png").frame(width: 180, height: 25)
                AssetImage(path: missingKey ? "背包页/宝箱开启中间页/提示页/详细内容/失败原因-钥匙数量不足.png" : "背包页/宝箱开启中间页/提示页/详细内容/失败原因-宝箱数量不足.png").frame(width: 185, height: 25)
                AssetImage(path: missingKey ? key.iconPath : chest.failureCardPath).frame(width: 82, height: 82)
                HStack(spacing: 8) {
                    Button { state.chestOverlay = nil; state.showInventoryOverlay = false; state.openShop(from: .inventory, category: .chests) } label: { AssetImage(path: "背包页/宝箱开启中间页/按钮/商店按钮-常亮.png").frame(width: 86, height: 36) }.buttonStyle(GameHapticButtonStyle())
                    Button { state.chestOverlay = nil } label: { AssetImage(path: "背包页/宝箱开启中间页/按钮/确定按钮.png").frame(width: 86, height: 36) }.buttonStyle(GameHapticButtonStyle())
                }
                Spacer().frame(height: 10)
            }
            .offset(y: 10)
        }.frame(width: 250, height: 350)
    }

    private struct RewardEntry { let path: String; let count: Int }
    private func rewardEntries(_ reward: RewardBundle) -> [RewardEntry] {
        var values: [RewardEntry] = []
        if reward.coins > 0 { values.append(.init(path: "背包页/宝箱开启中间页/宝箱奖励页/道具/金币奖励框.png", count: reward.coins)) }
        if reward.diamonds > 0 { values.append(.init(path: "背包页/宝箱开启中间页/宝箱奖励页/道具/蓝色宝石奖励框.png", count: reward.diamonds)) }
        for (id, count) in reward.items.sorted(by: { $0.key < $1.key }) { if let item = GameData.item(id) { values.append(.init(path: item.chestRewardCardPath, count: count)) } }
        if let id = reward.character { values.append(.init(path: GameData.character(id).inventoryCardPath, count: 1)) }
        return values
    }
}
