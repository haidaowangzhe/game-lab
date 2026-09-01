import { _decorator, Component, view } from 'cc';
import { GameAppState, Screen } from '../core/GameAppState';
import { makeImageButton, makeSprite } from '../ui/UIKit';
const { ccclass } = _decorator;

/** 设计基准面板（总结 §3.5） */
const PANEL_W = 250;
const PANEL_H = 340;
/** 上下留白占可视高度比例 */
const VERTICAL_MARGIN_RATIO = 0.1;
/** 左右至少留白占可视宽度比例 */
const HORIZONTAL_MARGIN_RATIO = 0.12;
/** 最大放大上限，避免过高过宽 */
const MAX_SCALE = 1.85;

/**
 * 暂停弹窗（总结 §3.5）：Mask 居中面板 250×340；
 * 按屏高／屏宽整体等比放大，并与屏幕边缘保持间距。
 */
@ccclass('PauseModal')
export class PauseModal extends Component {
    onLoad(): void {
        const app = GameAppState.instance;

        const visible = view.getVisibleSize();
        const marginV = Math.max(40, visible.height * VERTICAL_MARGIN_RATIO);
        const marginH = Math.max(36, visible.width * HORIZONTAL_MARGIN_RATIO);
        const scaleByH = (visible.height - marginV * 2) / PANEL_H;
        const scaleByW = (visible.width - marginH * 2) / PANEL_W;
        const scale = Math.min(MAX_SCALE, scaleByH, scaleByW);
        this.node.setScale(scale, scale, 1);

        const panel = makeSprite(this.node, 'Panel', PANEL_W, PANEL_H, '暂停页/暂停面板.png');
        panel.setPosition(0, 0, 0);

        const buttons: Array<[string, string, () => void]> = [
            [
                'Continue',
                '暂停页/按钮/继续游戏按钮.png',
                () => app.popModal(),
            ],
            [
                'Restart',
                '暂停页/按钮/重新开始按钮.png',
                () => {
                    app.clearModals();
                    app.restartLevel();
                },
            ],
            [
                'Settings',
                '暂停页/按钮/设置按钮.png',
                () => app.openSettings(),
            ],
            [
                'Home',
                '暂停页/按钮/返回主页按钮.png',
                () => {
                    app.clearModals();
                    app.setScreen(Screen.Home);
                },
            ],
        ];
        const ys = [74, 18, -38, -94];
        buttons.forEach(([name, key, onClick], i) => {
            const btn = makeImageButton(this.node, name, 190, 50, key, onClick, true);
            btn.setPosition(0, ys[i], 0);
        });
    }
}
