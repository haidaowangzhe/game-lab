import { _decorator, Component, Node } from 'cc';
import { AudioService } from '../core/AudioService';
import { GameAppState } from '../core/GameAppState';
import {
    ChestKind,
    chestByKind,
    keyByKind,
    keyDetailPanelKey,
    keyHorizontalCardKey,
    keyRelationKey,
    keyUsageKey,
    shopBuyExitButtonKey,
} from '../data/GameData';
import { makeImageButton, makeProportionalCanvas, makeSprite, applyModalFit } from '../ui/UIKit';
const { ccclass } = _decorator;

/**
 * 钥匙商品详情（总结 §3.17.6 / iOS keyDetail）：画布 240×380；弹层留白 fit≈0.82。
 */
@ccclass('ShopKeyModal')
export class ShopKeyModal extends Component {
    /** payload 为对应宝箱 kind（钥匙由其派生） */
    init(chestKind: ChestKind): void {
        this.build(chestKind);
    }

    private build(chestKind: ChestKind): void {
        const app = GameAppState.instance;
        const chest = chestByKind(chestKind);
        const key = keyByKind(chest.key);
        const canvas = makeProportionalCanvas(this.node, 'Canvas', 240, 380);
        applyModalFit(canvas, 0.82);

        const content = new Node('Content');
        canvas.node.addChild(content);

        const place = (node: Node, x: number, y: number) => {
            node.setPosition(x - 120, 190 - y, 0);
        };

        const panel = makeSprite(content, 'Panel', 240, 380, keyDetailPanelKey());
        place(panel, 120, 190);

        const card = makeSprite(content, 'Card', 170, 127, keyHorizontalCardKey(key.kind));
        place(card, 120, 109);

        const relation = makeSprite(content, 'Relation', 160, 14, keyRelationKey(key.kind));
        place(relation, 120, 207);

        const usage = makeSprite(content, 'Usage', 144, 70, keyUsageKey(key.kind));
        place(usage, 120, 271);

        // 购买｜退出 spacing 16 @ (120, 334) → 72 / 168
        const buy = makeImageButton(
            content,
            'Buy',
            80,
            24,
            shopBuyExitButtonKey('buy'),
            () => {
                AudioService.instance.playSfx('confirm');
                app.buyKey(chestKind);
            },
        );
        place(buy, 72, 334);

        const exit = makeImageButton(
            content,
            'Exit',
            80,
            24,
            shopBuyExitButtonKey('exit'),
            () => {
                AudioService.instance.playSfx('confirm');
                app.popModal();
            },
        );
        place(exit, 168, 334);
    }
}
