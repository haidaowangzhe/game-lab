import { _decorator, Button, Component, Label, Node, Sprite, UIOpacity, UITransform } from 'cc';
import { GameAppState, ModalKind, Screen } from '../core/GameAppState';
import {
    CHARACTER_IDS,
    CHARACTERS,
    ChestKind,
    ITEMS,
    characterById,
    characterCardKey,
    characterDetailKey,
    chestByKind,
    chestCardKey,
    chestDetailKey,
    itemById,
    itemCardKey,
    itemDetailKey,
    keyRemainLabelKey,
} from '../data/GameData';
import {
    fillDimOverlay,
    loadSpriteFrame,
    makeImageButton,
    makeLabel,
    makeProportionalCanvas,
    makeSprite,
    playButtonHaptic,
} from '../ui/UIKit';
import { ProportionalCanvas } from '../ui/ProportionalCanvas';
const { ccclass } = _decorator;

type Category = 'characters' | 'items' | 'chests';

/** 画布半宽／半高（671.5×500.5） */
const HALF_W = 335.75;
const HALF_H = 250.25;

/** 素材等比缩放：只锁高度，宽度按像素比例（对齐 iOS AssetImage aspectRatio .fit） */
function fitH(assetW: number, assetH: number, displayH: number): { w: number; h: number } {
    return { w: (displayH * assetW) / assetH, h: displayH };
}

/**
 * iOS InventoryViews 网格栏契约（相对画布 671.5）：
 * 栏左 = padH20 + 分类宽×0.20 + HStack间距10；栏宽 ×0.415
 */
const GRID_LEFT = 20 + 671.5 * 0.2 + 10; // 164.3
const GRID_W = 671.5 * 0.415; // ≈278.67
/** 顶栏下沿 8+96=104 + 栏 padTop15 + 网格 padTop10 → 首卡顶边 */
const GRID_CARD_TOP = 8 + 96 + 15 + 10; // 129

/** 角色卡 567×850；格高 119；3 列 spacing -5；offset x+3 */
const CHAR_CARD = fitH(567, 850, 119);
const CHAR_COLS = 3;
const CHAR_GAP_X = -5;
const CHAR_GAP_Y = 11;
const CHAR_CELL_W = (GRID_W - (CHAR_COLS - 1) * CHAR_GAP_X) / CHAR_COLS;
const CHAR_OX = 3;
const CHAR_FIRST_CX = GRID_LEFT + CHAR_OX + CHAR_CELL_W / 2;
const CHAR_STEP_X = CHAR_CELL_W + CHAR_GAP_X;
const CHAR_FIRST_CY = GRID_CARD_TOP + CHAR_CARD.h / 2;
const CHAR_STEP_Y = CHAR_CARD.h + CHAR_GAP_Y;

/** 道具卡 1254×1254；格高 60；4 列 spacing -15；offset x+3 */
const ITEM_CARD = fitH(1254, 1254, 60);
const ITEM_COLS = 4;
const ITEM_GAP_X = -15;
const ITEM_GAP_Y = 5;
const ITEM_CELL_W = (GRID_W - (ITEM_COLS - 1) * ITEM_GAP_X) / ITEM_COLS;
const ITEM_OX = 3;
const ITEM_FIRST_CX = GRID_LEFT + ITEM_OX + ITEM_CELL_W / 2;
const ITEM_STEP_X = ITEM_CELL_W + ITEM_GAP_X;
const ITEM_FIRST_CY = GRID_CARD_TOP + ITEM_CARD.h / 2;
const ITEM_STEP_Y = ITEM_CARD.h + ITEM_GAP_Y;

/** 宝箱卡 1254×1254；格高 116；2 列 spacing 12；offset x+5 */
const CHEST_CARD = fitH(1254, 1254, 116);
const CHEST_COLS = 2;
const CHEST_GAP_X = 12;
const CHEST_GAP_Y = 20;
const CHEST_CELL_W = (GRID_W - (CHEST_COLS - 1) * CHEST_GAP_X) / CHEST_COLS;
const CHEST_OX = 5;
const CHEST_FIRST_CX = GRID_LEFT + CHEST_OX + CHEST_CELL_W / 2;
const CHEST_STEP_X = CHEST_CELL_W + CHEST_GAP_X;
const CHEST_FIRST_CY = GRID_CARD_TOP + CHEST_CARD.h / 2;
const CHEST_STEP_Y = CHEST_CARD.h + CHEST_GAP_Y;

/** 详情大卡：锁高 185，宽随素材比例（人物 367×433／道具 371×433／宝箱 375×433） */
const DETAIL_CHAR = fitH(367, 433, 185);
const DETAIL_ITEM = fitH(371, 433, 185);
const DETAIL_CHEST = fitH(375, 433, 185);
const DETAIL_CX = 543.25;
/** 详情栏 padTop15 + VStack padV8 → 大卡顶 127；中心 = 127+92.5 */
const DETAIL_CARD_CY = 8 + 96 + 15 + 8 + 185 / 2; // 219.5

/** 详情底板统一尺寸（以角色底板为准；去掉道具×1.048／宝箱非等比 scale） */
const DETAIL_BOARD_W = 146;
const DETAIL_BOARD_H = 92;
/**
 * 货币条数字：图标在左，空白区水平中心约 x=14；条带垂直中心 y≈-22。
 * 必须 lineHeight=fontSize，否则 UIKit 默认 size+6 会让字视觉偏下。
 */
const PRICE_NUM_X = 4;
const PRICE_NUM_Y = -22;
const PRICE_NUM_FONT = 15;
const PRICE_NUM_BOX_W = 72;
const PRICE_NUM_BOX_H = 18;
/** 宝箱「剩余钥匙」文案 601×115 → 高 18 等比 */
const REMAIN_LABEL = fitH(601, 115, 18);

/**
 * 背包页（总结 §3.9–3.11）：共用壳 671.5×500.5；
 * 壳层 ×0.92 与边框留白；独立页底图由 Boot 半透明叠层提供（对齐 iOS sectionPresentation）。
 */
@ccclass('InventoryPage')
export class InventoryPage extends Component {
    mainCanvas?: ProportionalCanvas;

    private readonly app = GameAppState.instance;
    private category: Category = 'characters';
    private selectedCharacter = CHARACTER_IDS.doraemon;
    private selectedItem: string | null = null;
    private selectedChest: ChestKind = 'wood';
    private itemPage = 0;
    /** 防止 destroyAllChildren 后异步贴图回写到已销毁节点导致闪烁／错位 */
    private buildGen = 0;

    private content?: Node;
    private gridNode?: Node;
    private detailNode?: Node;
    private pagerNode?: Node;
    private coinsLabel?: Label;
    private diamondsLabel?: Label;
    private catButtons: Array<{
        key: Category;
        node: Node;
        keyOn: string;
        keyOff: string;
        w: number;
        h: number;
    }> = [];

    onLoad(): void {
        // 局内弹层已有 ModalMask 0.55；独立页由 Boot 铺首页底+0.48。兜底：无底图时自补半透明黑
        if (!this.isEmbedded() && !this.node.parent?.getChildByName('SectionUnderlay')) {
            fillDimOverlay(this.node, 0.48);
        }
        const canvas = makeProportionalCanvas(this.node, 'Canvas', 671.5, 500.5);
        this.mainCanvas = canvas;

        const content = new Node('Content');
        canvas.node.addChild(content);
        content.setPosition(0, 2, 0);
        content.setScale(0.88, 0.88, 1);
        this.content = content;

        makeSprite(content, 'Panel', 671.5, 500.5, '背包页/背包主页面/面板/背包页完整界面框-带滚动条.png');

        this.buildTopBar(content);
        this.buildCategoryBar(content);

        this.gridNode = new Node('Grid');
        content.addChild(this.gridNode);
        this.detailNode = new Node('Detail');
        content.addChild(this.detailNode);
        this.pagerNode = new Node('Pager');
        content.addChild(this.pagerNode);

        this.refreshAll();
        this.app.events.on('profile-changed', this.refreshAll, this);
    }

    onDestroy(): void {
        this.app.events.off('profile-changed', this.refreshAll, this);
    }

    private buildTopBar(content: Node): void {
        const back = makeImageButton(content, 'Back', 44, 44, '背包页/背包主页面/按钮/其他/返回按钮.png', () => {
            this.closeOrBack();
        });
        this.place(back, 65.5, 61);

        // 货币槽位画在面板上；数字用深色（对齐 iOS .black）
        this.coinsLabel = makeLabel(content, 'Coins', '', 23, '#000000', 80, 30);
        this.place(this.coinsLabel.node, 201, 61);

        const plusCoins = makeImageButton(
            content,
            'PlusCoins',
            38,
            38,
            '背包页/背包主页面/按钮/其他/圆形加号按钮.png',
            () => this.app.openRecharge(),
        );
        this.place(plusCoins, 289, 61);

        this.diamondsLabel = makeLabel(content, 'Diamonds', '', 23, '#000000', 80, 30);
        this.place(this.diamondsLabel.node, 474, 61);

        const plusDiamonds = makeImageButton(
            content,
            'PlusDiamonds',
            38,
            38,
            '背包页/背包主页面/按钮/其他/圆形加号按钮.png',
            () => this.app.openRecharge(),
        );
        this.place(plusDiamonds, 558, 61);

        const settings = makeImageButton(content, 'Settings', 44, 44, '背包页/背包主页面/按钮/其他/设置按钮.png', () => {
            this.app.openSettings();
        });
        this.place(settings, 605, 61);
    }

    private buildCategoryBar(content: Node): void {
        const cats: Array<{ key: Category; name: string }> = [
            { key: 'characters', name: '角色' },
            { key: 'items', name: '道具' },
            { key: 'chests', name: '宝箱' },
        ];
        cats.forEach((cat, i) => {
            const base = '背包页/背包主页面/按钮/分类';
            const sub = cat.key === 'characters' ? '角色' : cat.key === 'items' ? '道具' : '宝箱钥匙';
            const name = cat.name;
            const keyOn = `${base}/${sub}/${name}按钮.png`;
            const keyOff = `${base}/${sub}/${name}按钮-灰黑.png`;
            // 初始只亮当前分类，避免三钮先全亮再异步切灰时串台
            const initial = cat.key === this.category ? keyOn : keyOff;
            const node = makeImageButton(content, `Cat${cat.key}`, 115, 55, initial, () => this.setCategory(cat.key));
            // 分类栏：左 20 + leading 14 + 半钮；顶栏下 + padding.top 40 + 半钮；行距 55+14
            this.place(node, 92.5, 174.5 + i * 69);
            this.catButtons.push({ key: cat.key, node, keyOn, keyOff, w: 115, h: 55 });
        });
        this.applyCategoryVisuals();
    }

    private setCategory(cat: Category): void {
        if (this.category === cat) {
            return;
        }
        this.category = cat;
        this.itemPage = 0;
        this.applyCategoryVisuals();
        this.refreshAll();
    }

    /** 同一时刻仅一个分类亮（亮/灰互斥） */
    private applyCategoryVisuals(): void {
        this.catButtons.forEach((btn) => {
            this.swapImage(btn.node, btn.key === this.category ? btn.keyOn : btn.keyOff, btn.w, btn.h);
        });
    }

    private refreshAll(): void {
        if (this.coinsLabel) {
            this.coinsLabel.string = `${this.app.profile.coins}`;
        }
        if (this.diamondsLabel) {
            this.diamondsLabel.string = `${this.app.profile.diamonds}`;
        }
        this.applyCategoryVisuals();
        const gen = ++this.buildGen;
        this.rebuildGrid(gen);
        this.rebuildDetail(gen);
        this.rebuildPager(gen);
    }

    private rebuildGrid(gen: number): void {
        if (!this.gridNode) {
            return;
        }
        this.gridNode.destroyAllChildren();
        if (this.category === 'characters') {
            CHARACTERS.forEach((c, i) => {
                if (gen !== this.buildGen) {
                    return;
                }
                const unlocked = this.app.profile.unlockedCharacters.includes(c.id);
                const selected = this.selectedCharacter === c.id;
                const node = makeSprite(
                    this.gridNode!,
                    `Ch${c.id}`,
                    CHAR_CARD.w,
                    CHAR_CARD.h,
                    characterCardKey(c.id, unlocked),
                );
                this.place(
                    node,
                    CHAR_FIRST_CX + (i % CHAR_COLS) * CHAR_STEP_X,
                    CHAR_FIRST_CY + Math.floor(i / CHAR_COLS) * CHAR_STEP_Y,
                );
                node.setScale(selected ? 1.025 : 1, selected ? 1.025 : 1, 1);
                node.addComponent(Button);
                node.on(Button.EventType.CLICK, () => {
                    playButtonHaptic();
                    if (this.selectedCharacter === c.id) {
                        return;
                    }
                    this.selectedCharacter = c.id;
                    this.applyGridSelectionScale('Ch');
                    this.rebuildDetail(this.buildGen);
                });
            });
            return;
        }
        if (this.category === 'items') {
            const owned = ITEMS.filter(
                (it) => (this.app.profile.itemInventory[it.id] ?? 0) > 0 || this.app.profile.loadout.includes(it.id),
            );
            if (owned.length === 0) {
                const empty = makeLabel(this.gridNode, 'Empty', '暂无道具', 20, '#FFFFFF', 278, 40);
                this.place(empty.node, GRID_LEFT + GRID_W / 2, 250);
                return;
            }
            const pageCount = Math.max(1, Math.ceil(owned.length / 12));
            this.itemPage = Math.min(this.itemPage, pageCount - 1);
            const start = this.itemPage * 12;
            owned.slice(start, start + 12).forEach((it, i) => {
                if (gen !== this.buildGen) {
                    return;
                }
                const inv = this.app.profile.itemInventory[it.id] ?? 0;
                const inLoadout = this.app.profile.loadout.includes(it.id);
                const selected = this.selectedItem === it.id;
                const node = makeSprite(
                    this.gridNode!,
                    `Item${it.id}`,
                    ITEM_CARD.w,
                    ITEM_CARD.h,
                    itemCardKey(it),
                );
                this.place(
                    node,
                    ITEM_FIRST_CX + (i % ITEM_COLS) * ITEM_STEP_X,
                    ITEM_FIRST_CY + Math.floor(i / ITEM_COLS) * ITEM_STEP_Y,
                );
                node.setScale(selected ? 1.035 : 1, selected ? 1.035 : 1, 1);
                const badge = makeLabel(node, 'Count', `×${inv + (inLoadout ? 1 : 0)}`, 12, '#FFFFFF', 36, 18);
                badge.node.setPosition(ITEM_CARD.w / 2 - 14, -ITEM_CARD.h / 2 + 12, 0);
                node.addComponent(Button);
                node.on(Button.EventType.CLICK, () => {
                    playButtonHaptic();
                    if (this.selectedItem === it.id) {
                        return;
                    }
                    this.selectedItem = it.id;
                    this.applyGridSelectionScale('Item');
                    this.rebuildDetail(this.buildGen);
                });
            });
            return;
        }
        // chests：2 列；卡面正方形等比（格高 116 → 116×116）
        const order: ChestKind[] = ['wood', 'silver', 'gold', 'purple'];
        order.forEach((kind, i) => {
            if (gen !== this.buildGen) {
                return;
            }
            const count = this.app.profile.chestInventory[kind] ?? 0;
            const selected = this.selectedChest === kind;
            const node = makeSprite(
                this.gridNode!,
                `Chest${kind}`,
                CHEST_CARD.w,
                CHEST_CARD.h,
                chestCardKey(kind),
            );
            this.place(
                node,
                CHEST_FIRST_CX + (i % CHEST_COLS) * CHEST_STEP_X,
                CHEST_FIRST_CY + Math.floor(i / CHEST_COLS) * CHEST_STEP_Y,
            );
            node.setScale(selected ? 1.025 : 1, selected ? 1.025 : 1, 1);
            const badge = makeLabel(node, 'Count', `×${count}`, 13, '#FFFFFF', 40, 20);
            badge.node.setPosition(CHEST_CARD.w / 2 - 16, -CHEST_CARD.h / 2 + 14, 0);
            node.addComponent(Button);
            node.on(Button.EventType.CLICK, () => {
                playButtonHaptic();
                if (this.selectedChest === kind) {
                    return;
                }
                this.selectedChest = kind;
                this.applyGridSelectionScale('Chest');
                this.rebuildDetail(this.buildGen);
            });
        });
    }

    /** 仅更新网格选中缩放，避免整表销毁重建导致闪烁 */
    private applyGridSelectionScale(prefix: 'Ch' | 'Item' | 'Chest'): void {
        if (!this.gridNode) {
            return;
        }
        const selectedScale = prefix === 'Item' ? 1.035 : 1.025;
        this.gridNode.children.forEach((child) => {
            if (!child.name.startsWith(prefix)) {
                return;
            }
            let on = false;
            if (prefix === 'Ch') {
                on = child.name === `Ch${this.selectedCharacter}`;
            } else if (prefix === 'Item') {
                on = child.name === `Item${this.selectedItem}`;
            } else {
                on = child.name === `Chest${this.selectedChest}`;
            }
            const s = on ? selectedScale : 1;
            child.setScale(s, s, 1);
        });
    }

    private rebuildDetail(gen: number): void {
        if (!this.detailNode || gen !== this.buildGen) {
            return;
        }
        this.detailNode.destroyAllChildren();
        if (this.category === 'characters') {
            this.buildCharacterDetail();
        } else if (this.category === 'items') {
            this.buildItemDetail();
        } else {
            this.buildChestDetail();
        }
    }

    private buildCharacterDetail(): void {
        const c = characterById(this.selectedCharacter);
        const unlocked = this.app.profile.unlockedCharacters.includes(c.id);
        const isCurrent = this.app.profile.selectedCharacter === c.id;
        const canUse = unlocked && c.availableInRun && !isCurrent;

        // 详情大卡：锁高 185，宽按人物卡 367×433 等比
        const card = makeSprite(this.detailNode!, 'Card', DETAIL_CHAR.w, DETAIL_CHAR.h, characterDetailKey(c.id, unlocked));
        this.place(card, DETAIL_CX, DETAIL_CARD_CY);

        const board = makeSprite(
            this.detailNode!,
            'Board',
            DETAIL_BOARD_W,
            DETAIL_BOARD_H,
            '背包页/背包主页面/详情描述/详情底板/角色详情描述底板.png',
        );
        this.place(board, DETAIL_CX, DETAIL_CARD_CY + DETAIL_CHAR.h / 2 + 5 + DETAIL_BOARD_H / 2);
        // 顶部紫色装饰条为底板素材自带空带；介绍在中部；数字在货币条图标右侧空白正中
        const intro = makeLabel(board, 'Intro', c.bagIntro, 12, '#000000', 120, 30);
        intro.overflow = Label.Overflow.SHRINK;
        intro.node.setPosition(0, 8, 0);
        this.placeBoardCurrencyNumber(board, `${c.price}`);

        const btnY = DETAIL_CARD_CY + DETAIL_CHAR.h / 2 + 5 + DETAIL_BOARD_H + 5 + 17;
        const unlock = makeImageButton(
            this.detailNode!,
            'Unlock',
            75,
            34,
            unlocked ? '背包页/背包主页面/按钮/其他/解锁按钮_灰-已解锁.png' : '背包页/背包主页面/按钮/其他/解锁按钮_亮.png',
            () => {
                if (!unlocked) {
                    this.goShop();
                }
            },
        );
        this.place(unlock, DETAIL_CX - 40.5, btnY);

        const use = makeImageButton(
            this.detailNode!,
            'Use',
            75,
            34,
            canUse ? '背包页/背包主页面/按钮/其他/使用按钮.png' : '背包页/背包主页面/按钮/其他/使用按钮-灰.png',
            () => {
                if (!unlocked) {
                    this.app.toast('尚未解锁该角色');
                } else if (!c.availableInRun) {
                    this.app.toast('动作素材待补…');
                } else if (isCurrent) {
                    this.app.toast('已是当前出战角色');
                } else {
                    this.app.profile.selectedCharacter = c.id;
                    this.app.commitProfile();
                    this.app.toast(`已使用 ${c.name}`);
                }
            },
        );
        this.place(use, DETAIL_CX + 40.5, btnY);
    }

    private buildItemDetail(): void {
        if (!this.selectedItem) {
            const hint = makeLabel(this.detailNode!, 'Hint', '选择道具查看详情', 18, '#FFFFFF', 180, 40);
            this.place(hint.node, DETAIL_CX, 260);
            return;
        }
        const item = itemById(this.selectedItem);
        const inv = this.app.profile.itemInventory[item.id] ?? 0;
        const inLoadout = this.app.profile.loadout.includes(item.id);

        const card = makeSprite(this.detailNode!, 'Card', DETAIL_ITEM.w, DETAIL_ITEM.h, itemDetailKey(item));
        this.place(card, DETAIL_CX, DETAIL_CARD_CY);

        const board = makeSprite(
            this.detailNode!,
            'Board',
            DETAIL_BOARD_W,
            DETAIL_BOARD_H,
            '背包页/背包主页面/详情描述/详情底板/道具详情描述底板.png',
        );
        this.place(board, DETAIL_CX, DETAIL_CARD_CY + DETAIL_ITEM.h / 2 + 5 + DETAIL_BOARD_H / 2);
        const intro = makeLabel(board, 'Intro', item.intro, 12, '#000000', 120, 30);
        intro.overflow = Label.Overflow.SHRINK;
        intro.node.setPosition(0, 8, 0);
        this.placeBoardCurrencyNumber(board, `${item.sellPrice}`);

        const btnY = DETAIL_CARD_CY + DETAIL_ITEM.h / 2 + 5 + DETAIL_BOARD_H + 5 + 17;
        const sell = makeImageButton(
            this.detailNode!,
            'Sell',
            75,
            34,
            inv > 0 ? '背包页/背包主页面/按钮/其他/出售按钮.png' : '背包页/背包主页面/按钮/其他/出售按钮-灰.png',
            () => {
                if (inv <= 0) {
                    this.app.toast('没有可出售的道具');
                    return;
                }
                this.app.profile.itemInventory[item.id] = inv - 1;
                this.app.profile.coins += item.sellPrice;
                this.app.commitProfile();
                this.app.toast(`出售成功 +${item.sellPrice}金`);
            },
        );
        this.place(sell, DETAIL_CX - 40.5, btnY);

        const use = makeImageButton(
            this.detailNode!,
            'Use',
            75,
            34,
            inLoadout ? '背包页/背包主页面/按钮/其他/使用按钮-灰.png' : '背包页/背包主页面/按钮/其他/使用按钮.png',
            () => {
                if (inLoadout) {
                    this.cancelCarry(item.id);
                    return;
                }
                if (inv <= 0) {
                    this.app.toast('背包中没有该道具');
                    return;
                }
                if (this.app.profile.loadout.length >= 3) {
                    this.app.toast('携带已满，最多 3 个');
                    return;
                }
                if (item.owner && item.owner !== this.app.profile.selectedCharacter) {
                    this.app.toast('非当前角色专属');
                    return;
                }
                this.app.profile.itemInventory[item.id] = inv - 1;
                this.app.profile.loadout.push(item.id);
                this.app.commitProfile();
                this.app.toast(`已携带 ${item.name}`);
            },
        );
        this.place(use, DETAIL_CX + 40.5, btnY);
    }

    private buildChestDetail(): void {
        const chest = chestByKind(this.selectedChest);

        const card = makeSprite(this.detailNode!, 'Card', DETAIL_CHEST.w, DETAIL_CHEST.h, chestDetailKey(this.selectedChest));
        this.place(card, DETAIL_CX, DETAIL_CARD_CY);

        const board = makeSprite(
            this.detailNode!,
            'Board',
            DETAIL_BOARD_W,
            DETAIL_BOARD_H,
            '背包页/背包主页面/详情描述/详情底板/宝箱详情底板.png',
        );
        this.place(board, DETAIL_CX, DETAIL_CARD_CY + DETAIL_CHEST.h / 2 + 5 + DETAIL_BOARD_H / 2);
        const intro = makeLabel(board, 'Intro', chest.intro, 11, '#000000', 118, 30);
        intro.overflow = Label.Overflow.SHRINK;
        intro.node.setPosition(0, 8, 0);

        // 剩余钥匙文案 + 数字：与角色/道具货币条同高；整行往右 5
        const remain = this.app.profile.keyInventory[chest.key] ?? 0;
        const rowGap = 4;
        const numBoxW = 32;
        const rowW = REMAIN_LABEL.w + rowGap + numBoxW;
        const rowOx = 5;
        const remainLabel = makeSprite(
            board,
            'RemainLabel',
            REMAIN_LABEL.w,
            REMAIN_LABEL.h,
            keyRemainLabelKey(this.selectedChest),
        );
        remainLabel.setPosition(-rowW / 2 + REMAIN_LABEL.w / 2 + rowOx, PRICE_NUM_Y, 0);
        const remainNum = makeLabel(board, 'RemainNum', `${remain}`, 14, '#000000', numBoxW, PRICE_NUM_BOX_H);
        remainNum.lineHeight = 14;
        remainNum.overflow = Label.Overflow.SHRINK;
        remainNum.horizontalAlign = Label.HorizontalAlign.CENTER;
        remainNum.verticalAlign = Label.VerticalAlign.CENTER;
        remainNum.node.setPosition(rowW / 2 - numBoxW / 2 + rowOx - 6, PRICE_NUM_Y, 0);

        const unlock = makeImageButton(
            this.detailNode!,
            'Unlock',
            88,
            37,
            '背包页/背包主页面/按钮/其他/解锁按钮_亮.png',
            () => this.app.openChest(this.selectedChest),
        );
        this.place(unlock, DETAIL_CX, DETAIL_CARD_CY + DETAIL_CHEST.h / 2 + 5 + DETAIL_BOARD_H + 5 + 18.5);
    }

    /** 货币条内数字：落在图标右侧空白区正中（角色／道具底板通用） */
    private placeBoardCurrencyNumber(board: Node, text: string): void {
        const price = makeLabel(
            board,
            'Price',
            text,
            PRICE_NUM_FONT,
            '#000000',
            PRICE_NUM_BOX_W,
            PRICE_NUM_BOX_H,
        );
        price.lineHeight = PRICE_NUM_FONT;
        price.overflow = Label.Overflow.SHRINK;
        price.horizontalAlign = Label.HorizontalAlign.CENTER;
        price.verticalAlign = Label.VerticalAlign.CENTER;
        price.node.setPosition(PRICE_NUM_X, PRICE_NUM_Y, 0);
    }

    private cancelCarry(id: string): void {
        const idx = this.app.profile.loadout.indexOf(id);
        if (idx < 0) {
            return;
        }
        this.app.profile.loadout.splice(idx, 1);
        this.app.profile.itemInventory[id] = (this.app.profile.itemInventory[id] ?? 0) + 1;
        this.app.commitProfile();
        this.app.toast('已卸下并退回背包');
    }

    private rebuildPager(gen: number): void {
        if (!this.pagerNode || gen !== this.buildGen) {
            return;
        }
        this.pagerNode.destroyAllChildren();
        const base = '背包页/背包主页面/按钮/页数';
        // 分页条落在网格栏底部，offset(y:-20) → 中心约 y=437
        const py = 437;
        const cx = GRID_LEFT + GRID_W / 2;
        if (this.category === 'items') {
            const owned = ITEMS.filter(
                (it) => (this.app.profile.itemInventory[it.id] ?? 0) > 0 || this.app.profile.loadout.includes(it.id),
            );
            const pageCount = Math.max(1, Math.ceil(owned.length / 12));
            const prev = makeImageButton(this.pagerNode, 'Prev', 38, 38, `${base}/分页上一页按钮.png`, () => {
                if (this.itemPage > 0) {
                    this.itemPage--;
                    this.refreshAll();
                }
            });
            this.place(prev, cx - 45, py);
            this.setNodeOpacity(prev, this.itemPage > 0 ? 255 : 115);
            const next = makeImageButton(this.pagerNode, 'Next', 38, 38, `${base}/分页下一页按钮.png`, () => {
                if (this.itemPage < pageCount - 1) {
                    this.itemPage++;
                    this.refreshAll();
                }
            });
            this.place(next, cx + 45, py);
            this.setNodeOpacity(next, this.itemPage < pageCount - 1 ? 255 : 115);
            if (pageCount <= 1) {
                const more = makeSprite(this.pagerNode, 'More', 38, 38, `${base}/分页更多按钮.png`);
                this.place(more, cx, py);
            } else {
                for (let i = 0; i < pageCount; i++) {
                    const dot = makeSprite(this.pagerNode, `Dot${i}`, 38, 38, `${base}/空白按钮框.png`);
                    this.place(dot, cx + (i - (pageCount - 1) / 2) * 45, py);
                }
                const num = makeLabel(this.pagerNode, 'PageNum', `${this.itemPage + 1}`, 18, '#4A7BFF', 38, 38);
                this.place(num.node, cx + (this.itemPage - (pageCount - 1) / 2) * 45, py);
            }
            return;
        }
        const prev = makeSprite(this.pagerNode, 'Prev', 38, 38, `${base}/分页上一页按钮.png`);
        this.place(prev, cx - 45, py);
        this.setNodeOpacity(prev, 115);
        const more = makeSprite(this.pagerNode, 'More', 38, 38, `${base}/分页更多按钮.png`);
        this.place(more, cx, py);
        const next = makeSprite(this.pagerNode, 'Next', 38, 38, `${base}/分页下一页按钮.png`);
        this.place(next, cx + 45, py);
        this.setNodeOpacity(next, 115);
    }

    /** 设计坐标（左上原点）→ Content 本地（中心原点） */
    private place(node: Node, x: number, y: number): void {
        node.setPosition(x - HALF_W, HALF_H - y, 0);
    }

    /** 局内以 Modal 打开时为 embedded */
    private isEmbedded(): boolean {
        return this.app.modals.some((m) => m.kind === ModalKind.Inventory);
    }

    private closeOrBack(): void {
        if (this.isEmbedded()) {
            this.app.closeInventoryOverlay();
        } else {
            this.app.setScreen(Screen.Home);
        }
    }

    /** 去商城；局内则先关遮罩并离开本局（对齐 iOS openShop from run） */
    private goShop(): void {
        if (this.isEmbedded()) {
            this.app.clearModals();
        }
        this.app.setScreen(Screen.Shop);
    }

    private setNodeOpacity(node: Node, opacity: number): void {
        let ui = node.getComponent(UIOpacity);
        if (!ui) {
            ui = node.addComponent(UIOpacity);
        }
        ui.opacity = opacity;
    }

    private swapImage(node: Node, key: string, w: number, h: number): void {
        const sprite = node.getComponent(Sprite);
        if (!sprite) {
            return;
        }
        (node as Node & { _wantKey?: string })._wantKey = key;
        loadSpriteFrame(key, (frame) => {
            if (!frame || !sprite.isValid) {
                return;
            }
            // 丢弃过期回调，防止切换分类时亮/灰图互相覆盖
            if ((node as Node & { _wantKey?: string })._wantKey !== key) {
                return;
            }
            sprite.spriteFrame = frame;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            node.getComponent(UITransform)?.setContentSize(w, h);
        });
    }
}
