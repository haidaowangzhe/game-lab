import { _decorator, Component } from 'cc';
import { AudioService } from '../core/AudioService';
import { GameAppState } from '../core/GameAppState';
import { makeImageButton, makeProportionalCanvas, makeSprite, applyModalFit } from '../ui/UIKit';
const { ccclass } = _decorator;

/**
 * 充值提示弹窗（总结 §3.14）：画布 300×385；弹层留白；
 * 面板铺满；确定钮 125×45 中心 (150, 318.5)。仅说明无充值，无 IAP。
 */
@ccclass('RechargeModal')
export class RechargeModal extends Component {
    onLoad(): void {
        const canvas = makeProportionalCanvas(this.node, 'Canvas', 300, 385);
        applyModalFit(canvas, 0.82);
        const panel = makeSprite(canvas.node, 'Panel', 300, 385, '充值提示弹窗/提示弹窗.png');
        canvas.place(panel, 150, 192.5);

        const confirm = makeImageButton(
            canvas.node,
            'Confirm',
            125,
            45,
            '充值提示弹窗/确定按钮.png',
            () => {
                AudioService.instance.playSfx('confirm');
                GameAppState.instance.popModal();
            },
        );
        canvas.place(confirm, 150, 318.5);
    }
}
