import { _decorator, Component, Label, UIOpacity } from 'cc';
import { AudioService } from '../core/AudioService';
import { GameAppState } from '../core/GameAppState';
import {
    charAttrGemKey,
    charAttrIconKey,
    charDetailPanelKey,
    charInfoRowKey,
    charPortraitKey,
    characterById,
    shopBuyExitButtonKey,
} from '../data/GameData';
import { makeImageButton, makeLabel, makeProportionalCanvas, makeSprite, applyModalFit } from '../ui/UIKit';
const { ccclass } = _decorator;

/** 角色主题色（对齐 iOS GameModels.themeHex） */
const THEME: Record<string, string> = {
    doraemon: '#1078E0',
    nobita: '#D89000',
    shizuka: '#E85078',
    gian: '#D02810',
    suneo: '#58A010',
    dorami: '#E87800',
};

/**
 * 角色商品详情（总结 §3.15.5 / iOS characterDetail）：画布 480×360；
 * 肖像/信息行/三维属性横排/定位+简介/技能/购买退出。
 */
@ccclass('ShopCharacterModal')
export class ShopCharacterModal extends Component {
    init(id: string): void {
        this.build(id);
    }

    private build(id: string): void {
        const app = GameAppState.instance;
        const c = characterById(id);
        const unlocked = app.profile.unlockedCharacters.includes(id);
        const canBuy = !unlocked && c.availableInRun;
        const canvas = makeProportionalCanvas(this.node, 'Canvas', 480, 360);
        applyModalFit(canvas, 0.88);

        const panel = makeSprite(canvas.node, 'Panel', 480, 360, charDetailPanelKey());
        canvas.place(panel, 240, 180);

        // 肖像按素材比例放入 102×128 框（434×536 → 约 103.6×128）
        const portrait = makeSprite(canvas.node, 'Portrait', 103.6, 128, charPortraitKey(id));
        canvas.place(portrait, 115, 134);

        const infoRow = makeSprite(canvas.node, 'InfoRow', 214, 15, charInfoRowKey(id));
        canvas.place(infoRow, 294, 98);

        // 三维属性：加大组间距，并与信息行拉开
        const attrs: Array<{ attr: 'life' | 'movement' | 'luck'; value: number }> = [
            { attr: 'life', value: 5 },
            { attr: 'movement', value: c.movement },
            { attr: 'luck', value: c.luck },
        ];
        const attrBlockW = 15 + 3 + 5 * 8 + 4;
        const attrGap = 14;
        const totalAttrW = attrs.length * attrBlockW + (attrs.length - 1) * attrGap;
        let cursorX = 294 - totalAttrW / 2;
        const attrY = 116;
        attrs.forEach((row) => {
            const iconX = cursorX + 7.5;
            const icon = makeSprite(canvas.node, `Icon${row.attr}`, 15, 15, charAttrIconKey(row.attr));
            canvas.place(icon, iconX, attrY);
            for (let g = 0; g < 5; g++) {
                const gem = makeSprite(
                    canvas.node,
                    `Gem${row.attr}${g}`,
                    8,
                    8,
                    charAttrGemKey(row.attr, g < row.value),
                );
                canvas.place(gem, cursorX + 15 + 3 + 4 + g * 9, attrY);
            }
            cursorX += attrBlockW + attrGap;
        });

        // 角色介绍：两行收紧上移，避开底部框角饰
        const theme = THEME[id] ?? '#1078E0';
        const role = makeLabel(canvas.node, 'Role', c.tagline, 12, theme, 196, 16);
        canvas.place(role.node, 294, 164);
        const intro = makeLabel(canvas.node, 'Intro', c.intro, 11, '#000000', 196, 20);
        intro.overflow = Label.Overflow.SHRINK;
        canvas.place(intro.node, 294, 178);

        const skill = makeLabel(canvas.node, 'Skill', `能量技：${c.skill}`, 12, '#000000', 300, 40);
        skill.overflow = Label.Overflow.SHRINK;
        canvas.place(skill.node, 240, 248);

        // HStack spacing 56 @ (240, 299) → 购买中心 170、退出 310
        const buy = makeImageButton(
            canvas.node,
            'Buy',
            84,
            25,
            shopBuyExitButtonKey('buy'),
            () => {
                AudioService.instance.playSfx('confirm');
                app.buyCharacter(id);
            },
        );
        canvas.place(buy, 170, 299);
        if (!canBuy) {
            let ui = buy.getComponent(UIOpacity);
            if (!ui) {
                ui = buy.addComponent(UIOpacity);
            }
            ui.opacity = 140; // ≈0.55
        }

        const exit = makeImageButton(
            canvas.node,
            'Exit',
            84,
            25,
            shopBuyExitButtonKey('exit'),
            () => {
                AudioService.instance.playSfx('confirm');
                app.popModal();
            },
        );
        canvas.place(exit, 310, 299);
    }
}
