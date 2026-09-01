import { _decorator, Button, Component, Label, Node, UIOpacity } from 'cc';
import { AudioService } from '../core/AudioService';
import { GameAppState, Screen } from '../core/GameAppState';
import {
    fillBackground,
    makeImageButton,
    makeLabel,
    makeProportionalCanvas,
    makeSprite,
    playButtonHaptic,
} from '../ui/UIKit';
import { ProportionalCanvas } from '../ui/ProportionalCanvas';
const { ccclass } = _decorator;

/**
 * 关卡选择页（总结 §3.3）：画布 1498×847（内容含 y+28）。
 * 顶栏：返回/设置 116×116；双货币按素材 314×83 等比缩小（勿用 270×100 拉伸）；
 * 关卡区 3 行 × 5 列（124×124），中排两侧翻页钮 126×126；共 2 页（1–15 / 16–20）。
 */
@ccclass('LevelSelectPage')
export class LevelSelectPage extends Component {
    mainCanvas?: ProportionalCanvas;

    private readonly app = GameAppState.instance;
    private page = 0;
    private grid?: Node;
    private coinsLabel?: Label;
    private diamondsLabel?: Label;

    onLoad(): void {
        fillBackground(this.node, '关卡选择页/背景图.png');
        const canvas = makeProportionalCanvas(this.node, 'Canvas', 1498, 847);
        this.mainCanvas = canvas;

        const back = makeImageButton(
            canvas.node,
            'Back',
            100,
            100,
            '关卡选择页/按钮/关卡返回按钮.png',
            () => this.app.setScreen(Screen.Home),
            true,
        );
        canvas.place(back, 118, 124);

        const settings = makeImageButton(
            canvas.node,
            'Settings',
            100,
            100,
            '关卡选择页/按钮/关卡设置按钮.png',
            () => this.app.openSettings(),
        );
        canvas.place(settings, 1380, 124);

        // 素材 314×83；宽 200 → 高按原比例，避免 270×100 纵向拉扁
        const badgeW = 200;
        const badgeH = (83 * badgeW) / 314;
        const diamond = makeSprite(
            canvas.node,
            'DiamondBadge',
            badgeW,
            badgeH,
            '首页/货币显示框/043-长款-圆角蓝框白底-钻石.png',
        );
        canvas.place(diamond, 600, 124);
        this.diamondsLabel = makeLabel(diamond, 'Value', '', 20, '#2A2A2A', 118, 34);
        this.diamondsLabel.node.setPosition(14, 0);

        const coin = makeSprite(
            canvas.node,
            'CoinBadge',
            badgeW,
            badgeH,
            '首页/货币显示框/041-长款-圆角金框白底-金币.png',
        );
        canvas.place(coin, 898, 124);
        this.coinsLabel = makeLabel(coin, 'Value', '', 20, '#2A2A2A', 118, 34);
        this.coinsLabel.node.setPosition(14, 0);

        const grid = new Node('Grid');
        canvas.node.addChild(grid);
        this.grid = grid;

        this.refresh();
        this.app.events.on('profile-changed', this.refresh, this);
    }

    onDestroy(): void {
        this.app.events.off('profile-changed', this.refresh, this);
    }

    private refresh(): void {
        if (!this.grid || !this.mainCanvas) {
            return;
        }
        const canvas = this.mainCanvas;
        this.grid.destroyAllChildren();
        canvas.node.getChildByName('Prev')?.destroy();
        canvas.node.getChildByName('Next')?.destroy();

        if (this.coinsLabel) {
            this.coinsLabel.string = `${this.app.profile.coins}`;
        }
        if (this.diamondsLabel) {
            this.diamondsLabel.string = `${this.app.profile.diamonds}`;
        }

        const start = this.page * 15 + 1;
        const end = Math.min(start + 14, 20);
        const rowY = [284, 430, 576];
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 5; c++) {
                const lv = start + r * 5 + c;
                if (lv > end || lv > 20) {
                    continue;
                }
                const tile = this.makeTile(lv);
                canvas.place(tile, 453 + c * 148, rowY[r]);
            }
        }

        const prev = makeImageButton(
            canvas.node,
            'Prev',
            126,
            126,
            '关卡选择页/页数/按钮框-上一页.png',
            () => this.changePage(-1),
        );
        canvas.place(prev, 268, 431);

        const next = makeImageButton(
            canvas.node,
            'Next',
            126,
            126,
            '关卡选择页/页数/按钮框-下一页.png',
            () => this.changePage(1),
        );
        canvas.place(next, 1230, 431);

        this.applyPageState(prev, next);
    }

    private makeTile(lv: number): Node {
        const p = this.app.profile;
        const unlocked = lv <= p.unlockedLevel;
        const stars = p.levelStars[`${lv}`] ?? 0;
        const key = !unlocked
            ? '关卡选择页/页数/按钮框-锁定.png'
            : stars > 0
                ? '关卡选择页/页数/按钮框-空白白底.png'
                : '关卡选择页/页数/按钮框-空白灰底.png';
        const tile = makeSprite(this.grid!, `Tile${lv}`, 124, 124, key);
        if (unlocked) {
            const num = makeLabel(tile, 'Num', `${lv}`, 34, '#FFFFFF', 124, 124);
            num.enableOutline = true;
            num.outlineColor.fromHEX('#000000');
            num.outlineWidth = 2;
            num.node.setPosition(0, stars > 0 ? 12 : 0, 0);
            if (stars > 0) {
                for (let i = 0; i < 3; i++) {
                    const star = makeSprite(
                        tile,
                        `Star${i}`,
                        20,
                        20,
                        i < stars ? '关卡选择页/页数/金星.png' : '关卡选择页/页数/灰星.png',
                    );
                    star.setPosition(-28 + i * 28, -25, 0);
                }
            }
            tile.addComponent(Button);
            tile.on(Button.EventType.CLICK, () => {
                AudioService.instance.playSfx('tap');
                playButtonHaptic();
                this.app.startLevel(lv);
            });
        }
        return tile;
    }

    private changePage(delta: number): void {
        this.page = Math.max(0, Math.min(1, this.page + delta));
        this.refresh();
    }

    private applyPageState(prev: Node, next: Node): void {
        const prevBtn = prev.getComponent(Button);
        const nextBtn = next.getComponent(Button);
        if (prevBtn) {
            prevBtn.interactable = this.page > 0;
        }
        this.setNodeOpacity(prev, this.page > 0 ? 255 : 115);
        if (nextBtn) {
            nextBtn.interactable = this.page < 1;
        }
        this.setNodeOpacity(next, this.page < 1 ? 255 : 115);
    }

    /** Cocos 3.x：Node 无 setOpacity，须用 UIOpacity */
    private setNodeOpacity(node: Node, opacity: number): void {
        let ui = node.getComponent(UIOpacity);
        if (!ui) {
            ui = node.addComponent(UIOpacity);
        }
        ui.opacity = opacity;
    }
}
