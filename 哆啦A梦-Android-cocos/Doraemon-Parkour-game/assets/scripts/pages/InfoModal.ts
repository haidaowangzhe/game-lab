import { _decorator, Component } from 'cc';
import { AudioService } from '../core/AudioService';
import { GameAppState } from '../core/GameAppState';
import { makeImageButton, makeProportionalCanvas, makeSprite, applyModalFit } from '../ui/UIKit';
const { ccclass } = _decorator;

/**
 * 关于游戏 / 隐私政策弹窗（总结 §3.8）：画布 650×413；弹层留白。
 * 面板二选一铺满；确定钮 145×45 中心 (325, 341.5)。正文已烘焙进面板。
 */
@ccclass('InfoModal')
export class InfoModal extends Component {
    private kind: 'about' | 'privacy' = 'about';

    init(kind: 'about' | 'privacy'): void {
        this.kind = kind;
        this.build();
    }

    private build(): void {
        const canvas = makeProportionalCanvas(this.node, 'Canvas', 650, 413);
        applyModalFit(canvas, 0.88);
        const panelKey =
            this.kind === 'about'
                ? '游戏信息+隐私政策/面板/关于游戏弹窗.png'
                : '游戏信息+隐私政策/面板/隐私政策弹窗.png';
        const panel = makeSprite(canvas.node, 'Panel', 650, 413, panelKey);
        canvas.place(panel, 325, 206.5);

        const confirm = makeImageButton(
            canvas.node,
            'Confirm',
            145,
            45,
            '游戏信息+隐私政策/确定按钮.png',
            () => {
                AudioService.instance.playSfx('confirm');
                GameAppState.instance.popModal();
            },
        );
        canvas.place(confirm, 325, 341.5);
    }
}
