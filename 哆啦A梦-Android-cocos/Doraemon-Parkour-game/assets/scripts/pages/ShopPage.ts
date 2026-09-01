import {
    _decorator,
    Button,
    Component,
    EventTouch,
    Label,
    Mask,
    Node,
    NodeEventType,
    ScrollView,
    Sprite,
    UITransform,
    Vec2,
} from 'cc';
import { GameAppState, ModalKind, Screen } from '../core/GameAppState';
import {
    ChestKind,
    SHOP_ITEM_IDS,
    characterById,
    chestByKind,
    itemById,
    keyByKind,
    priceGemKey,
    shopBuyButtonKey,
    shopCategoryKey,
    shopCharacterCardKey,
    shopChestKeyCardKey,
    shopItemCardKey,
    shopPanelKey,
    shopScrollbarThumbKey,
    shopScrollbarTrackKey,
    shopTopButtonKey,
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

/** 中间白区约 y=94~446、x=144~690；裁剪窗落在白区内并留边 */
const AREA_TOP = 113;
const AREA_BOTTOM_PAD = 40;
const AREA_H = 482 - AREA_TOP - AREA_BOTTOM_PAD; // 329
const GRID_LEFT = 164;
const GRID_W = 450;
/** 裁剪视口 */
const VIEW_H = AREA_H;
const VIEW_CY = AREA_TOP + VIEW_H / 2;
/** 滑条：贴白区右侧，端饰内缩避免叠箭头 */
const SCROLL_TRACK_X = GRID_LEFT + GRID_W + 30; // 644
const SCROLL_TRACK_H = AREA_H - 24;
const SCROLL_TRACK_CY = AREA_TOP + 12 + SCROLL_TRACK_H / 2;
const THUMB_H = 47;
const THUMB_END_INSET = 46;
/** 道具／箱钥相对视口顶的额外下移，避免贴顶部分隔饰 */
const SHELF_TOP_PAD = 5;

/**
 * 商城页：ScrollView + Mask 滚动裁剪窗口；滑条轨+菱形滑块各分类同位同尺寸。
 * 壳层相对设计稿略缩小，与边框留白；底图由 Boot section 半透明叠层提供。
 */
@ccclass('ShopPage')
export class ShopPage extends Component {
    mainCanvas?: ProportionalCanvas;

    private readonly app = GameAppState.instance;
    private category: Category = 'characters';
    private contentH = 346;
    private scrollEnabled = false;

    private viewNode?: Node;
    private scrollView?: ScrollView;
    private scrollContent?: Node;
    private trackNode?: Node;
    private thumbNode?: Node;
    private coinsLabel?: Label;
    private diamondsLabel?: Label;
    private catButtons: Array<{ key: Category; node: Node; keyOn: string; keyOff: string; w: number; h: number }> =
        [];

    /** 拖滑块：起点进度与 UI y */
    private thumbDragStartProg = 0;
    private thumbDragStartUiY = 0;

    onLoad(): void {
        // 独立打开时若无 Boot 底图，补一层半透明黑（嵌入不需要）
        if (!this.node.parent?.getChildByName('SectionUnderlay')) {
            fillDimOverlay(this.node, 0.48);
        }
        const canvas = makeProportionalCanvas(this.node, 'Canvas', 730, 482);
        this.mainCanvas = canvas;

        const shell = new Node('Content');
        canvas.node.addChild(shell);
        // 原 iOS ×1.04 在预览易裁切金边；收到 0.88，四周与屏幕／边框留白
        shell.setPosition(0, 4, 0);
        shell.setScale(0.88, 0.88, 1);

        makeSprite(shell, 'Panel', 730, 482, shopPanelKey());
        this.buildTopBar(shell);
        this.buildCategoryBar(shell);
        this.buildScrollWindow(shell);

        this.refreshAll();
        this.app.events.on('profile-changed', this.onProfileChanged, this);
    }

    onDestroy(): void {
        this.app.events.off('profile-changed', this.onProfileChanged, this);
    }

    private onProfileChanged = (): void => {
        this.refreshAll();
    };

    private buildTopBar(shell: Node): void {
        const back = makeImageButton(shell, 'Back', 40, 40, shopTopButtonKey('back'), () => {
            this.app.setScreen(Screen.Home);
        });
        this.place(back, 88, 57);

        this.coinsLabel = makeLabel(shell, 'Coins', '', 22, '#2A2A2A', 72, 28);
        this.place(this.coinsLabel.node, 238, 58);
        this.place(
            makeImageButton(shell, 'PlusCoins', 43, 43, shopTopButtonKey('plus'), () => this.app.openRecharge()),
            314.8,
            58,
        );

        this.diamondsLabel = makeLabel(shell, 'Diamonds', '', 22, '#2A2A2A', 72, 28);
        this.place(this.diamondsLabel.node, 490, 58);
        this.place(
            makeImageButton(shell, 'PlusDiamonds', 43, 43, shopTopButtonKey('plus'), () => this.app.openRecharge()),
            566,
            58,
        );

        this.place(
            makeImageButton(shell, 'Settings', 40, 40, shopTopButtonKey('settings'), () => this.app.openSettings()),
            643,
            57,
        );
    }

    private buildCategoryBar(shell: Node): void {
        // 左侧蓝区约 x=38~132；略放大回接近原稿，仍留边不压框
        const catW = 105;
        const catH = 44;
        const catX = 82;
        (['characters', 'items', 'chests'] as Category[]).forEach((key, i) => {
            const active = key === this.category;
            const node = makeImageButton(shell, `Cat${key}`, catW, catH, shopCategoryKey(key, active), () => {
                if (this.category === key) {
                    return;
                }
                this.category = key;
                this.refreshAll();
            });
            this.place(node, catX, 160 + i * 58);
            this.catButtons.push({
                key,
                node,
                keyOn: shopCategoryKey(key, true),
                keyOff: shopCategoryKey(key, false),
                w: catW,
                h: catH,
            });
        });
    }

    /**
     * 滚动裁剪窗口：固定视口 Mask + ScrollView；旁侧固定滑条。
     * view(Mask) → content(ScrollView.content)
     */
    private buildScrollWindow(shell: Node): void {
        const view = new Node('ScrollWindow');
        shell.addChild(view);
        view.addComponent(UITransform).setContentSize(GRID_W, VIEW_H);
        view.addComponent(Mask);
        this.place(view, GRID_LEFT + GRID_W / 2, VIEW_CY);
        this.viewNode = view;

        const content = new Node('ScrollContent');
        view.addChild(content);
        const contentUt = content.addComponent(UITransform);
        contentUt.setContentSize(GRID_W, VIEW_H);
        contentUt.setAnchorPoint(0.5, 1); // 顶对齐，ScrollView 竖滑标准锚点
        content.setPosition(0, VIEW_H / 2, 0); // 顶边贴视口顶
        this.scrollContent = content;

        const sv = view.addComponent(ScrollView);
        sv.vertical = true;
        sv.horizontal = false;
        sv.inertia = true;
        sv.brake = 0.75;
        sv.elastic = false;
        sv.cancelInnerEvents = false;
        sv.content = content;
        this.scrollView = sv;

        view.on(ScrollView.EventType.SCROLLING, this.syncThumbFromScroll, this);
        view.on(ScrollView.EventType.SCROLL_ENDED, this.syncThumbFromScroll, this);

        const track = makeSprite(shell, 'ScrollTrack', 43, SCROLL_TRACK_H, shopScrollbarTrackKey());
        this.trackNode = track;
        this.place(track, SCROLL_TRACK_X, SCROLL_TRACK_CY);

        const thumb = makeSprite(shell, 'ScrollThumb', 43, THUMB_H, shopScrollbarThumbKey());
        this.thumbNode = thumb;
        this.place(thumb, SCROLL_TRACK_X, SCROLL_TRACK_CY);

        // 只用 delta / 起终点 UI-y，避免 convertToNodeSpace 在 scale 下算飞
        thumb.on(NodeEventType.TOUCH_START, this.onThumbStart, this);
        thumb.on(NodeEventType.TOUCH_MOVE, this.onThumbMove, this);
        // 轨道点击易因坐标空间不一致把内容滚出视口；滚动交给 ScrollView 手势 + 滑块拖动
    }

    private onThumbStart(e: EventTouch): void {
        if (!this.scrollEnabled) {
            return;
        }
        this.thumbDragStartProg = this.currentProgress();
        this.thumbDragStartUiY = e.getUILocation().y;
        e.propagationStopped = true;
    }

    private onThumbMove(e: EventTouch): void {
        if (!this.scrollEnabled || !this.scrollView) {
            return;
        }
        const travel = Math.max(1, SCROLL_TRACK_H - THUMB_H - THUMB_END_INSET * 2);
        // UI y 向上为正；滑块下移 → 进度增加 → 看下方
        const dy = e.getUILocation().y - this.thumbDragStartUiY;
        const prog = Math.min(1, Math.max(0, this.thumbDragStartProg - dy / travel));
        this.scrollToProgress(prog);
        e.propagationStopped = true;
    }

    private currentProgress(): number {
        if (!this.scrollView || !this.scrollEnabled) {
            return 0;
        }
        const max = this.scrollView.getMaxScrollOffset();
        if (max.y <= 0.01) {
            return 0;
        }
        return Math.min(1, Math.max(0, this.scrollView.getScrollOffset().y / max.y));
    }

    private scrollToProgress(prog: number): void {
        if (!this.scrollView) {
            return;
        }
        const max = this.scrollView.getMaxScrollOffset();
        this.scrollView.scrollToOffset(new Vec2(0, prog * Math.max(0, max.y)), 0.05);
        this.syncThumbFromScroll();
    }

    private syncThumbFromScroll = (): void => {
        if (!this.thumbNode) {
            return;
        }
        const endpointInset = Math.min(THUMB_END_INSET, Math.max(0, (SCROLL_TRACK_H - THUMB_H) / 2));
        const travel = Math.max(0, SCROLL_TRACK_H - THUMB_H - endpointInset * 2);
        const prog = this.scrollEnabled ? this.currentProgress() : 0.5;
        const trackTop = SCROLL_TRACK_CY - SCROLL_TRACK_H / 2;
        const thumbCy = trackTop + endpointInset + THUMB_H / 2 + prog * travel;
        this.place(this.thumbNode, SCROLL_TRACK_X, thumbCy);
    };

    private refreshAll(): void {
        if (this.coinsLabel) {
            this.coinsLabel.string = `${this.app.profile.coins}`;
        }
        if (this.diamondsLabel) {
            this.diamondsLabel.string = `${this.app.profile.diamonds}`;
        }
        this.catButtons.forEach((btn) => {
            this.swapImage(btn.node, btn.key === this.category ? btn.keyOn : btn.keyOff, btn.w, btn.h);
        });
        this.rebuildGrid();
        this.layoutScroll();
    }

    private layoutScroll(): void {
        if (!this.scrollContent || !this.scrollView || !this.viewNode) {
            return;
        }
        // 内容高度至少等于视口，避免 ScrollView 异常
        const h = Math.max(this.contentH, VIEW_H);
        this.scrollContent.getComponent(UITransform)?.setContentSize(GRID_W, h);
        this.scrollEnabled = this.category !== 'characters' && this.contentH > VIEW_H + 1;

        this.scrollView.enabled = this.scrollEnabled;
        this.scrollView.scrollToTop(0);
        // 顶锚点：content 顶边始终对齐视口顶，由 ScrollView 改 y 实现滚动
        this.scrollContent.setPosition(0, VIEW_H / 2, 0);
        this.syncThumbFromScroll();
    }

    private rebuildGrid(): void {
        if (!this.scrollContent) {
            return;
        }
        this.scrollContent.destroyAllChildren();

        if (this.category === 'characters') {
            // 两行角色卡落在缩小后的视口内，无需滚动
            this.contentH = VIEW_H;
            const order = ['doraemon', 'dorami', 'shizuka', 'gian', 'suneo', 'nobita'];
            order.forEach((id, i) => {
                const c = characterById(id);
                const unlocked = this.app.profile.unlockedCharacters.includes(id);
                const bright = !unlocked && c.availableInRun;
                const col = i % 3;
                const row = Math.floor(i / 3);
                const card = makeSprite(this.scrollContent!, `Ch${id}`, 140, 150, shopCharacterCardKey(id));
                this.placeInContent(card, 72 + col * 152, 7 + 75 + row * 158);
                // 角色卡白底约本地 Y -30~-58.6（150 高卡）：bottomPad=16 使钮底贴齐白区底，不压金边框，价标距脚底线约 2px
                this.decorateArtCard(card, c.price, 'diamonds', bright, 16, '#2A2A2A', () => this.openCharacter(id));
                card.addComponent(Button);
                card.on(Button.EventType.CLICK, () => {
                    playButtonHaptic();
                    this.openCharacter(id);
                });
            });
            return;
        }

        if (this.category === 'items') {
            const rows = Math.max(1, Math.ceil(SHOP_ITEM_IDS.length / 5));
            const itemH = 149;
            const rowGap = 17; // 原 10，再加大 7，避免下一行顶边露出
            const rowStep = itemH + rowGap;
            // 顶垫 SHELF_TOP_PAD，避免贴顶部分隔饰
            this.contentH = SHELF_TOP_PAD + rows * itemH + Math.max(0, rows - 1) * rowGap + 8;
            SHOP_ITEM_IDS.forEach((id, i) => {
                const item = itemById(id);
                const col = i % 5;
                const row = Math.floor(i / 5);
                const card = makeSprite(this.scrollContent!, `Item${id}`, 86, itemH, shopItemCardKey(item));
                this.placeInContent(card, 45 + col * 90, SHELF_TOP_PAD + itemH / 2 + row * rowStep);
                this.decorateArtCard(card, item.buyPrice, 'coins', true, 13, '#FFFFFF', () => this.openItem(id));
                card.addComponent(Button);
                card.on(Button.EventType.CLICK, () => {
                    playButtonHaptic();
                    this.openItem(id);
                });
            });
            return;
        }

        this.contentH = SHELF_TOP_PAD + 308 + 8;
        const keys: ChestKind[] = ['wood', 'silver', 'gold', 'purple'];
        keys.forEach((kind, i) => {
            const chest = chestByKind(kind);
            const key = keyByKind(chest.key);
            const card = makeSprite(this.scrollContent!, `Key${key.kind}`, 100, 149, shopChestKeyCardKey(key.name));
            this.placeInContent(card, 52 + i * 114, SHELF_TOP_PAD + 74.5);
            this.decorateArtCard(card, key.price, key.currency, true, 15, '#FFFFFF', () => this.openKey(kind));
            card.addComponent(Button);
            card.on(Button.EventType.CLICK, () => {
                playButtonHaptic();
                this.openKey(kind);
            });
        });
        keys.forEach((kind, i) => {
            const chest = chestByKind(kind);
            const card = makeSprite(this.scrollContent!, `Chest${kind}`, 100, 149, shopChestKeyCardKey(chest.name));
            this.placeInContent(card, 52 + i * 114, SHELF_TOP_PAD + 74.5 + 159);
            this.decorateArtCard(card, chest.price, chest.currency, true, 15, '#FFFFFF', () => this.openChest(kind));
            card.addComponent(Button);
            card.on(Button.EventType.CLICK, () => {
                playButtonHaptic();
                this.openChest(kind);
            });
        });
    }

    /** content 锚点 (0.5,1)：原点在顶边中心；y 向下为负 */
    private placeInContent(node: Node, xFromLeft: number, yFromTop: number): void {
        node.setPosition(xFromLeft - GRID_W / 2, -yFromTop, 0);
    }

    private decorateArtCard(
        card: Node,
        price: number,
        currency: 'coins' | 'diamonds',
        bright: boolean,
        bottomPad: number,
        priceColor: string,
        onClick: () => void,
    ): void {
        const halfH = (card.getComponent(UITransform)?.contentSize.height ?? 149) / 2;
        // 设计稿 50×15；勿放大以免盖住卡面边框装饰
        const btnH = 15;
        const priceRowH = 12;
        const btnY = -halfH + bottomPad + btnH / 2;
        const priceY = -halfH + bottomPad + btnH + priceRowH / 2;

        const buy = makeImageButton(card, 'BuyBtn', 50, btnH, shopBuyButtonKey(bright), onClick);
        buy.setPosition(0, btnY, 0);
        const gem = makeSprite(card, 'Gem', 10, 10, priceGemKey(currency));
        gem.setPosition(-11, priceY, 0);
        // 标签高度与价行一致，避免文字框偏高顶到角色脚底
        makeLabel(card, 'Price', `${price}`, 12, priceColor, 40, 12).node.setPosition(8, priceY, 0);
    }

    private openCharacter(id: string): void {
        this.app.pushModal(ModalKind.ShopCharacter, { id });
    }

    private openItem(id: string): void {
        this.app.pushModal(ModalKind.ShopItem, { id });
    }

    private openChest(kind: ChestKind): void {
        this.app.pushModal(ModalKind.ShopChest, { kind });
    }

    private openKey(chestKind: ChestKind): void {
        this.app.pushModal(ModalKind.ShopKey, { kind: chestKind });
    }

    private place(node: Node, x: number, y: number): void {
        node.setPosition(x - 365, 241 - y, 0);
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
            if ((node as Node & { _wantKey?: string })._wantKey !== key) {
                return;
            }
            sprite.spriteFrame = frame;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            node.getComponent(UITransform)?.setContentSize(w, h);
        });
    }
}
