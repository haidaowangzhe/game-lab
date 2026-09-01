import { _decorator, Component, Label, Mask, Node, UITransform } from 'cc';
import { GameAppState, Screen } from '../core/GameAppState';
import { preloadRunAssets } from '../run/RunAssetPreload';
import { fillBackground, makeLabel, makeProportionalCanvas, makeSprite } from '../ui/UIKit';
import { ProportionalCanvas } from '../ui/ProportionalCanvas';
const { ccclass } = _decorator;

/**
 * 进度框 / 蓝条素材均为 850×57。
 * 外框显示按宽 909.48 等比：高 = 57×(909.48/850)；
 * 蓝条与框同高同比例，用 Mask 裁切宽度，避免「框厚条瘦」。
 */
const BAR_W = 909.48;
const BAR_H = (57 * BAR_W) / 850; // ≈ 61.0，与素材同比
/** 相对框左缘内缩（素材槽约从 x=26 起 → 26/850×框宽） */
const FILL_LEADING = (26 * BAR_W) / 850;
/** 蓝条相对默认位置再左移（设计坐标） */
const FILL_X_OFFSET = -4;
/**
 * 满进度可视宽：素材槽宽 + 抵消左移，保证 100% 时贴到黑框右端。
 * 若再改 FILL_X_OFFSET，这里会自动补齐右侧。
 */
const FILL_MAX_W = ((825 - 26) * BAR_W) / 850 - FILL_X_OFFSET + 14;
const FILL_BODY_W = FILL_MAX_W;
const FILL_H = BAR_H * 0.65; // 贴合框内黑槽可视高度（约 33/57）
const HEAD_H = FILL_H;
const HEAD_W = (23 * HEAD_H) / 57;

/** 信息图中心 y：底边需在进度条顶之上留间距 */
const INFO_H = 500;
const INFO_W = 923.26;
const BAR_CY = 755.22;
const BAR_TOP = BAR_CY - BAR_H / 2;
const INFO_GAP = 28;
const INFO_CY = BAR_TOP - INFO_GAP - INFO_H / 2; // ≈ 421

/**
 * 加载页（总结 §3.1）：
 * - boot：假进度后进首页
 * - run：真实预加载局内关键素材后再进 Run（解决进关蓝块／半截素材）
 */
@ccclass('LoadingPage')
export class LoadingPage extends Component {
    mainCanvas?: ProportionalCanvas;

    private done = false;
    private step = 0;
    private stepTimer = 0;
    private readonly stepCount = 30;
    private readonly stepInterval = 0.045;
    private fillMask?: Node;
    private fillBody?: Node;
    private fillHead?: Node;
    private tipLabel?: Label;
    private readonly app = GameAppState.instance;
    private readonly isRunPreload = GameAppState.instance.loadingPurpose === 'run';

    onLoad(): void {
        fillBackground(this.node, '加载页/启动页背景-模糊.png');
        const canvas = makeProportionalCanvas(this.node, 'Canvas', 1378, 921);
        this.mainCanvas = canvas;

        const info = makeSprite(canvas.node, 'Info', INFO_W, INFO_H, '加载页/2d像素文字信息.png');
        canvas.place(info, 689, INFO_CY);
        // 设置「温馨提示」关闭时，不显示加载页中间提示图
        info.active = this.app.profile.settings.tipsEnabled;

        const bar = makeSprite(canvas.node, 'ProgressBar', BAR_W, BAR_H, '加载页/进度条/进度框不透明版.png');
        canvas.place(bar, 689, BAR_CY);

        const mask = new Node('FillMask');
        bar.addChild(mask);
        const maskUt = mask.addComponent(UITransform);
        maskUt.setAnchorPoint(0, 0.5);
        maskUt.setContentSize(0, FILL_H);
        mask.addComponent(Mask);
        mask.setPosition(-BAR_W / 2 + FILL_LEADING + FILL_X_OFFSET, 2.5, 0);
        this.fillMask = mask;

        const fill = makeSprite(mask, 'ProgressFill', FILL_BODY_W, FILL_H, '加载页/进度条/中间蓝色进度条01.png');
        fill.setPosition(FILL_BODY_W / 2, 0, 0);
        this.fillBody = fill;

        const head = makeSprite(bar, 'ProgressHead', HEAD_W, HEAD_H, '加载页/进度条/蓝色进度条右端圆头.png');
        head.active = false;
        this.fillHead = head;

        const tip = this.isRunPreload ? '正在准备关卡素材……' : '22世纪传来了一封神秘来信……';
        const text = makeLabel(canvas.node, 'BottomText', tip, 44, '#FFFFFF', 1378, 60);
        text.enableShadow = true;
        text.shadowColor.fromHEX('#000000');
        text.shadowOffset.set(2, -2);
        canvas.place(text.node, 689, 838.11);
        this.tipLabel = text;

        this.setProgress(0);

        if (this.isRunPreload) {
            const charId = this.app.profile.selectedCharacter;
            preloadRunAssets(charId, (p) => {
                // 进度条至少跟真实加载；略抬前半段避免长时间停在 0
                this.setProgress(Math.max(0.05, p * 0.95));
            })
                .then(() => {
                    this.finishRunPreload();
                })
                .catch(() => {
                    // 失败也进局，避免卡死在加载页
                    this.finishRunPreload();
                });
        }
    }

    update(dt: number): void {
        if (this.done || this.isRunPreload) {
            return;
        }
        this.stepTimer += dt;
        while (this.stepTimer >= this.stepInterval && this.step < this.stepCount) {
            this.stepTimer -= this.stepInterval;
            this.step += 1;
            this.setProgress(this.step / this.stepCount);
        }
        if (this.step >= this.stepCount) {
            this.done = true;
            this.setProgress(1);
            this.app.loadingPurpose = 'boot';
            this.app.setScreen(Screen.Home);
        }
    }

    private finishRunPreload(): void {
        if (this.done) {
            return;
        }
        this.done = true;
        this.setProgress(1);
        this.app.loadingPurpose = 'boot';
        this.app.setScreen(Screen.Run);
    }

    private setProgress(p: number): void {
        const progress = Math.min(1, Math.max(0, p));
        if (!this.fillMask) {
            return;
        }
        const w = progress <= 0 ? 0 : Math.max(24, FILL_MAX_W * progress);
        this.fillMask.getComponent(UITransform)?.setContentSize(w, FILL_H);
        if (this.fillBody) {
            this.fillBody.active = progress > 0;
        }
        if (this.fillHead) {
            this.fillHead.active = progress > 0;
            const rightX = -BAR_W / 2 + FILL_LEADING + FILL_X_OFFSET + w;
            this.fillHead.setPosition(rightX - HEAD_W * 0.2, 0, 0);
        }
    }
}
