import { _decorator, Component, Label } from 'cc';
import { AudioService } from '../core/AudioService';
import { GameAppState, Screen } from '../core/GameAppState';
import {
    ChestKind,
    chestByKind,
    chestFailCardKey,
} from '../data/GameData';
import { applyModalFit, makeImageButton, makeLabel, makeProportionalCanvas, makeSprite } from '../ui/UIKit';
const { ccclass } = _decorator;

interface Payload {
    reason: 'missingKey' | 'missingChest';
    kind: ChestKind;
}

/** 宝箱名强调色（保留黄/银/金/紫等特定色） */
const CHEST_NAME_HEX: Record<ChestKind, string> = {
    wood: '#E89820',
    silver: '#6A8AAA',
    gold: '#E8A010',
    purple: '#9A50C8',
};

/**
 * 解锁失败弹窗（总结 §3.13 / 设计图／效果图）：画布 250×350。
 *
 * 面板已烘焙「提示」头标 +「解锁失败」大字，勿遮盖。
 * 动态层：对应宝箱条 → 失败原因条 → 示意卡 → 商店|确定；
 * 文案用纯黑（宝箱名保留特定色），替代原先白描边 PNG，避免浅底看不清。
 */
@ccclass('ChestFailModal')
export class ChestFailModal extends Component {
    init(payload: Payload): void {
        this.build(payload);
    }

    private build(payload: Payload): void {
        const app = GameAppState.instance;
        const canvas = makeProportionalCanvas(this.node, 'Canvas', 250, 350);
        applyModalFit(canvas, 0.82);

        const panel = makeSprite(canvas.node, 'Panel', 250, 350, '背包页/宝箱开启中间页/提示页/解锁失败面板-空白.png');
        canvas.place(panel, 125, 175);

        // 对应宝箱：纯黑前缀 + 宝箱名特定色
        const chestName = payload.kind === 'gold' ? '金宝箱' : chestByKind(payload.kind).name;
        const fontSize = 14;
        const prefixStr = '对应宝箱：';
        const prefixW = fontSize * prefixStr.length;
        const nameW = fontSize * chestName.length;
        const rowW = prefixW + nameW;
        const prefix = makeLabel(canvas.node, 'TitlePrefix', prefixStr, fontSize, '#000000', prefixW + 4, 22);
        prefix.lineHeight = fontSize;
        const name = makeLabel(
            canvas.node,
            'TitleName',
            chestName,
            fontSize,
            CHEST_NAME_HEX[payload.kind],
            nameW + 4,
            22,
        );
        name.lineHeight = fontSize;
        canvas.place(prefix.node, 125 - rowW / 2 + prefixW / 2, 132);
        canvas.place(name.node, 125 - rowW / 2 + prefixW + nameW / 2, 132);

        const reasonText =
            payload.reason === 'missingKey' ? '失败原因：钥匙数量不足' : '失败原因：宝箱数量不足';
        const reason = makeLabel(canvas.node, 'Reason', reasonText, 14, '#000000', 200, 22);
        reason.lineHeight = 14;
        reason.overflow = Label.Overflow.SHRINK;
        canvas.place(reason.node, 125, 162);

        const card = makeSprite(canvas.node, 'Card', 82, 82, chestFailCardKey(payload.kind, payload.reason));
        canvas.place(card, 125, 226);

        const shop = makeImageButton(
            canvas.node,
            'Shop',
            86,
            36,
            '背包页/宝箱开启中间页/按钮/商店按钮-常亮.png',
            () => {
                AudioService.instance.playSfx('confirm');
                app.clearModals();
                app.setScreen(Screen.Shop);
            },
        );
        canvas.place(shop, 78, 292);

        const confirm = makeImageButton(
            canvas.node,
            'Confirm',
            86,
            36,
            '背包页/宝箱开启中间页/按钮/确定按钮.png',
            () => {
                AudioService.instance.playSfx('confirm');
                app.popModal();
            },
        );
        canvas.place(confirm, 172, 292);
    }
}
