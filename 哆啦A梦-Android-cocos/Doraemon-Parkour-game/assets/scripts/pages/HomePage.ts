import { _decorator, Component, Label, Node, Sprite } from 'cc';
import { GameAppState, Screen } from '../core/GameAppState';
import { portraitPathKey } from '../data/GameData';
import {
    fillBackground,
    loadSpriteFrame,
    makeImageButton,
    makeLabel,
    makeProportionalCanvas,
    makeSprite,
} from '../ui/UIKit';
import { ProportionalCanvas } from '../ui/ProportionalCanvas';
const { ccclass } = _decorator;

/**
 * 首页（总结 §3.2）：设计画布 967×547（内容已含 y+24 偏移）；
 * 顶栏左：角色卡 86×96 + 钻石/金币框 136×42（字号 18，较设计稿略缩）；右：商城/背包 76×96；
 * 底栏三钮 250×64：开始→关卡→设置。商城/背包/开始/选关为 M2–M4 占位 toast。
 */
@ccclass('HomePage')
export class HomePage extends Component {
    mainCanvas?: ProportionalCanvas;

    private readonly app = GameAppState.instance;
    private coinsLabel?: Label;
    private diamondsLabel?: Label;
    private portrait?: Node;

    onLoad(): void {
        fillBackground(this.node, '首页/背景图.png');
        const canvas = makeProportionalCanvas(this.node, 'Canvas', 967, 547);
        this.mainCanvas = canvas;

        this.portrait = makeSprite(canvas.node, 'Portrait', 86, 96, portraitPathKey(this.app.profile.selectedCharacter));
        // 不用 iOS offset(x:-40) 的负坐标，避免预览/真机左边裁切；仍靠左上，避开中央标题字
        canvas.place(this.portrait, 61, 86);

        const diamond = makeSprite(canvas.node, 'DiamondBadge', 136, 42, '首页/货币显示框/043-长款-圆角蓝框白底-钻石.png');
        canvas.place(diamond, 180, 66);
        this.diamondsLabel = makeLabel(diamond, 'Value', '', 18, '#2A2A2A', 88, 32);
        this.diamondsLabel.node.setPosition(4, 0);

        const coin = makeSprite(canvas.node, 'CoinBadge', 136, 42, '首页/货币显示框/041-长款-圆角金框白底-金币.png');
        canvas.place(coin, 180, 112);
        this.coinsLabel = makeLabel(coin, 'Value', '', 18, '#2A2A2A', 88, 32);
        this.coinsLabel.node.setPosition(4, 0);

        const shop = makeImageButton(canvas.node, 'Shop', 76, 96, '首页/按钮/首页商城卡片.png', () => {
            this.app.setScreen(Screen.Shop);
        });
        canvas.place(shop, 827, 86);

        const bag = makeImageButton(canvas.node, 'Inventory', 76, 96, '首页/按钮/首页背包卡片.png', () => {
            this.app.openInventory('home');
        });
        canvas.place(bag, 911, 86);

        const start = makeImageButton(canvas.node, 'Start', 250, 64, '首页/按钮/首页开始游戏按钮.png', () => {
            this.app.startLevel(Math.min(this.app.profile.unlockedLevel, 20));
        });
        canvas.place(start, 483.5, 305);

        const levels = makeImageButton(canvas.node, 'Levels', 250, 64, '首页/按钮/首页关卡选择按钮.png', () => {
            this.app.setScreen(Screen.Levels);
        });
        canvas.place(levels, 483.5, 379);

        const settings = makeImageButton(canvas.node, 'Settings', 250, 64, '首页/按钮/首页设置按钮.png', () => {
            this.app.openSettings();
        });
        canvas.place(settings, 483.5, 453);

        this.refresh();
        this.app.events.on('profile-changed', this.refresh, this);
    }

    onDestroy(): void {
        this.app.events.off('profile-changed', this.refresh, this);
    }

    private refresh(): void {
        const p = this.app.profile;
        if (this.coinsLabel) {
            this.coinsLabel.string = `${p.coins}`;
        }
        if (this.diamondsLabel) {
            this.diamondsLabel.string = `${p.diamonds}`;
        }
        if (this.portrait) {
            const sprite = this.portrait.getComponent(Sprite);
            if (sprite) {
                loadSpriteFrame(portraitPathKey(p.selectedCharacter), (frame) => {
                    if (frame && sprite.isValid) {
                        sprite.spriteFrame = frame;
                    }
                });
            }
        }
    }
}
