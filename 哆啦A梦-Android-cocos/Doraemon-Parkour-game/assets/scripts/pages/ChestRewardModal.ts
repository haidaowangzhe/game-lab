import { _decorator, Component, Label } from 'cc';
import { AudioService } from '../core/AudioService';
import { GameAppState } from '../core/GameAppState';
import { haptic } from '../core/Haptics';
import {
    ChestKind,
    RewardBundle,
    characterCardKey,
    chestByKind,
    itemById,
    rewardCoinKey,
    rewardDiamondKey,
    rewardItemKey,
} from '../data/GameData';
import { applyModalFit, makeImageButton, makeLabel, makeProportionalCanvas, makeSprite } from '../ui/UIKit';
const { ccclass } = _decorator;

interface Payload {
    kind: ChestKind;
    reward: RewardBundle;
}

/** 宝箱名强调色（素材上的黄/橙等，保留为特定色） */
const CHEST_NAME_HEX: Record<ChestKind, string> = {
    wood: '#E89820',
    silver: '#6A8AAA',
    gold: '#E8A010',
    purple: '#9A50C8',
};

/**
 * 宝箱奖励弹窗（总结 §3.12 / iOS rewardView）：画布 255×350；
 * 「获得奖励」已绘在面板上；标题用纯黑文案 + 宝箱名特定色。
 * 卡片 ×数值 保持白字描边，不改。
 */
@ccclass('ChestRewardModal')
export class ChestRewardModal extends Component {
    init(payload: Payload): void {
        this.build(payload);
    }

    private build(payload: Payload): void {
        const app = GameAppState.instance;
        AudioService.instance.playSfx('chest');
        haptic('success', app.profile.settings.vibrationEnabled);
        const canvas = makeProportionalCanvas(this.node, 'Canvas', 255, 350);
        applyModalFit(canvas, 0.82);

        const panel = makeSprite(canvas.node, 'Panel', 255, 350, '背包页/宝箱开启中间页/宝箱奖励页/宝箱奖励面板-空白.png');
        canvas.place(panel, 127.5, 175);

        // 「开启宝箱：」纯黑 + 宝箱名特定色；整行居中（原条 y=83）
        const chestName = payload.kind === 'gold' ? '金宝箱' : chestByKind(payload.kind).name;
        const fontSize = 16;
        const prefixStr = '开启宝箱：';
        const prefixW = fontSize * prefixStr.length;
        const nameW = fontSize * chestName.length;
        const rowW = prefixW + nameW;
        const prefix = makeLabel(canvas.node, 'TitlePrefix', prefixStr, fontSize, '#000000', prefixW + 4, 24);
        prefix.lineHeight = fontSize;
        const name = makeLabel(
            canvas.node,
            'TitleName',
            chestName,
            fontSize,
            CHEST_NAME_HEX[payload.kind],
            nameW + 4,
            24,
        );
        name.lineHeight = fontSize;
        canvas.place(prefix.node, 127.5 - rowW / 2 + prefixW / 2, 83);
        canvas.place(name.node, 127.5 - rowW / 2 + prefixW + nameW / 2, 83);

        const r = payload.reward;
        const cells: Array<{ key: string; count: number }> = [];
        if (r.coins > 0) {
            cells.push({ key: rewardCoinKey(), count: r.coins });
        }
        if (r.diamonds > 0) {
            cells.push({ key: rewardDiamondKey(), count: r.diamonds });
        }
        for (const id of r.items) {
            cells.push({ key: rewardItemKey(itemById(id)), count: 1 });
        }
        if (r.character) {
            cells.push({ key: characterCardKey(r.character, true), count: 1 });
        }

        const n = Math.min(4, Math.max(1, cells.length));
        const cell = 45;
        const gap = 3;
        const totalW = n * cell + (n - 1) * gap;
        cells.slice(0, n).forEach((entry, i) => {
            const node = makeSprite(canvas.node, `Cell${i}`, cell, cell, entry.key);
            canvas.place(node, 127.5 - totalW / 2 + cell / 2 + i * (cell + gap), 188);
            // 数量角标：右下角缩小放置（对齐 iOS bottomTrailing ×count）— 保留白字
            if (entry.count > 0) {
                const badge = makeLabel(node, 'Count', `×${entry.count}`, 11, '#FFFFFF', 28, 14, '#000000');
                badge.lineHeight = 11;
                badge.overflow = Label.Overflow.SHRINK;
                badge.horizontalAlign = Label.HorizontalAlign.RIGHT;
                badge.verticalAlign = Label.VerticalAlign.BOTTOM;
                badge.node.setPosition(10, -12, 0);
            }
        });

        const confirm = makeImageButton(
            canvas.node,
            'Confirm',
            90,
            36,
            '背包页/宝箱开启中间页/按钮/确定按钮.png',
            () => {
                AudioService.instance.playSfx('confirm');
                app.popModal();
            },
        );
        canvas.place(confirm, 127.5, 268);
    }
}
