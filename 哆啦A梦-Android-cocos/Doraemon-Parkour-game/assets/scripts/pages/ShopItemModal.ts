import { _decorator, Component, Label, Node } from 'cc';
import { AudioService } from '../core/AudioService';
import { GameAppState } from '../core/GameAppState';
import {
    itemById,
    itemDetailPanelKey,
    itemHorizontalCardKey,
    itemMetaLabelKey,
    itemRarityKey,
    itemTypeKey,
    shopBuyExitButtonKey,
} from '../data/GameData';
import { makeImageButton, makeLabel, makeProportionalCanvas, makeSprite, applyModalFit } from '../ui/UIKit';
const { ccclass } = _decorator;

/** 按素材像素等比缩放到目标高度 */
function fitH(assetW: number, assetH: number, displayH: number): { w: number; h: number } {
    return { w: (displayH * assetW) / assetH, h: displayH };
}

/**
 * 道具商品详情（总结 §3.16.5 / iOS itemDetail）：画布 245×388；
 * 基础属性素材等比缩放；说明／效果正文居中留白；购买退出原位。
 */
@ccclass('ShopItemModal')
export class ShopItemModal extends Component {
    init(id: string): void {
        this.build(id);
    }

    private build(id: string): void {
        const app = GameAppState.instance;
        const item = itemById(id);
        const canvas = makeProportionalCanvas(this.node, 'Canvas', 245, 388);
        applyModalFit(canvas, 0.82);

        const content = new Node('Content');
        canvas.node.addChild(content);

        const place = (node: Node, x: number, y: number) => {
            node.setPosition(x - 122.5, 194 - y, 0);
        };

        const panel = makeSprite(content, 'Panel', 245, 388, itemDetailPanelKey());
        place(panel, 122.5, 194);

        const card = makeSprite(content, 'Card', 170, 127, itemHorizontalCardKey(item));
        place(card, 122.5, 115);

        // —— 基础属性第一行：类型≈850×90、稀有≈930×280，仅等比 ——
        const typeSz = fitH(850, 90, 10);
        const raritySz = fitH(930, 280, 14);
        const row1Gap = 12;
        const row1W = typeSz.w + row1Gap + raritySz.w;
        const row1Left = 122.5 - row1W / 2;
        const row1Y = 207;
        const type = makeSprite(content, 'Type', typeSz.w, typeSz.h, itemTypeKey(item));
        place(type, row1Left + typeSz.w / 2, row1Y);
        const rarity = makeSprite(content, 'Rarity', raritySz.w, raritySz.h, itemRarityKey(item.buyPrice));
        place(rarity, row1Left + typeSz.w + row1Gap + raritySz.w / 2, row1Y);

        // —— 第二行：与上行拉开；标签与文字贴紧；字号缩小、纯黑 ——
        const metaSz = fitH(1034, 407, 11);
        const metaY = 221;
        const pairGap = 16;
        const valueGap = 1;
        const durValueW = 34;
        const cdValueW = 22;
        const pair1W = metaSz.w + valueGap + durValueW;
        const pair2W = metaSz.w + valueGap + cdValueW;
        const row2W = pair1W + pairGap + pair2W;
        const row2Left = 122.5 - row2W / 2;

        const durLabel = makeSprite(content, 'DurLabel', metaSz.w, metaSz.h, itemMetaLabelKey('duration'));
        place(durLabel, row2Left + metaSz.w / 2, metaY);
        const durText =
            item.duration.includes('秒') || item.duration === '立即' || item.duration === '分段' || item.duration === '1次'
                ? item.duration.endsWith('秒')
                    ? item.duration.replace('秒', ' s')
                    : item.duration
                : item.duration;
        const durValue = makeLabel(content, 'DurValue', durText, 9, '#000000', durValueW, 12);
        durValue.lineHeight = 10;
        durValue.color.fromHEX('#000000');
        place(durValue.node, row2Left + metaSz.w + valueGap + durValueW / 2, metaY);

        const pair2Left = row2Left + pair1W + pairGap;
        const cdLabel = makeSprite(content, 'CdLabel', metaSz.w, metaSz.h, itemMetaLabelKey('cooldown'));
        place(cdLabel, pair2Left + metaSz.w / 2, metaY);
        const cdValue = makeLabel(content, 'CdValue', '无', 9, '#000000', cdValueW, 12);
        cdValue.lineHeight = 10;
        cdValue.color.fromHEX('#000000');
        place(cdValue.node, pair2Left + metaSz.w + valueGap + cdValueW / 2, metaY);

        // —— 说明／效果：相对框内上下留白更均衡，略下移 ——
        const short = makeLabel(content, 'Short', item.shortText, 11, '#000000', 176, 22);
        short.overflow = Label.Overflow.SHRINK;
        place(short.node, 122.5, 261);

        const detail = makeLabel(content, 'Detail', item.detailText, 11, '#000000', 176, 22);
        detail.overflow = Label.Overflow.SHRINK;
        place(detail.node, 122.5, 308);

        // 购买｜退出：恢复原位
        const buy = makeImageButton(
            content,
            'Buy',
            80,
            25,
            shopBuyExitButtonKey('buy'),
            () => {
                AudioService.instance.playSfx('confirm');
                app.buyItem(id);
            },
        );
        place(buy, 76.5, 340);

        const exit = makeImageButton(
            content,
            'Exit',
            80,
            25,
            shopBuyExitButtonKey('exit'),
            () => {
                AudioService.instance.playSfx('confirm');
                app.popModal();
            },
        );
        place(exit, 168.5, 340);
    }
}
