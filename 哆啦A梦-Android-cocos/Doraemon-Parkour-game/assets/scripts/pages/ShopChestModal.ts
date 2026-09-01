import { _decorator, Component, Label } from 'cc';
import { AudioService } from '../core/AudioService';
import { GameAppState } from '../core/GameAppState';
import {
    ChestKind,
    chestByKind,
    chestDetailPanelKey,
    chestKeyConditionKey,
    chestPortraitKey,
    chestPreviewKeys,
    chestQualityKey,
    keyByKind,
    shopBuyExitButtonKey,
} from '../data/GameData';
import { makeImageButton, makeLabel, makeProportionalCanvas, makeSprite, applyModalFit } from '../ui/UIKit';
const { ccclass } = _decorator;

/**
 * 宝箱商品详情（总结 §3.17.5 / iOS chestDetail）：画布 510×380。
 */
@ccclass('ShopChestModal')
export class ShopChestModal extends Component {
    init(kind: ChestKind): void {
        this.build(kind);
    }

    private build(kind: ChestKind): void {
        const app = GameAppState.instance;
        const chest = chestByKind(kind);
        const key = keyByKind(chest.key);
        const canvas = makeProportionalCanvas(this.node, 'Canvas', 510, 380);
        applyModalFit(canvas, 0.86);

        const panel = makeSprite(canvas.node, 'Panel', 510, 380, chestDetailPanelKey());
        canvas.place(panel, 255, 190);

        const portrait = makeSprite(canvas.node, 'Portrait', 102, 128, chestPortraitKey(kind));
        canvas.place(portrait, 115, 134);

        const intro = makeLabel(canvas.node, 'Intro', `消耗 1个宝箱 + 1把${key.name} 开启`, 15, '#000000', 250, 46);
        intro.lineHeight = 18;
        intro.overflow = Label.Overflow.SHRINK;
        canvas.place(intro.node, 316, 114);

        // 品质｜开钥 HStack spacing 10 @ (316, 189)，各 110×18 → 中心 256 / 376
        const quality = makeSprite(canvas.node, 'Quality', 110, 18, chestQualityKey(kind));
        canvas.place(quality, 256, 189);
        const cond = makeSprite(canvas.node, 'KeyCond', 110, 18, chestKeyConditionKey(kind));
        canvas.place(cond, 376, 189);

        const previews = chestPreviewKeys(kind);
        const totalW = previews.length * 30 + (previews.length - 1) * 6;
        previews.forEach((keyPath, i) => {
            const p = makeSprite(canvas.node, `Preview${i}`, 30, 30, keyPath);
            canvas.place(p, 255 - totalW / 2 + 15 + i * 36, 263);
        });

        // 购买｜退出 spacing 52 @ (255, 310) → 180 / 330
        const buy = makeImageButton(
            canvas.node,
            'Buy',
            98,
            29,
            shopBuyExitButtonKey('buy'),
            () => {
                AudioService.instance.playSfx('confirm');
                app.buyChest(kind);
            },
        );
        canvas.place(buy, 180, 310);

        const exit = makeImageButton(
            canvas.node,
            'Exit',
            98,
            29,
            shopBuyExitButtonKey('exit'),
            () => {
                AudioService.instance.playSfx('confirm');
                app.popModal();
            },
        );
        canvas.place(exit, 330, 310);
    }
}
