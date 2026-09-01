import { _decorator, Component, Node, Sprite, UITransform } from 'cc';
import { GameAppState, ModalKind } from '../core/GameAppState';
import { AudioService } from '../core/AudioService';
import { hapticPreview } from '../core/Haptics';
import { DEFAULT_SETTINGS } from '../data/GameData';
import {
    applyModalFit,
    loadSpriteFrame,
    makeImageButton,
    makeProportionalCanvas,
    makeSprite,
} from '../ui/UIKit';
import { ProportionalCanvas } from '../ui/ProportionalCanvas';
const { ccclass } = _decorator;

/**
 * 设置遮罩页（总结 §3.7）：画布 708.5×450.5；
 * 弹层留白 + 内容 ×0.90，避免贴屏幕边；顶空 92；行中心约 114.5／177.5／240.5／301／366。
 */
@ccclass('SettingsPage')
export class SettingsPage extends Component {
    mainCanvas?: ProportionalCanvas;

    private readonly app = GameAppState.instance;
    private readonly audio = AudioService.instance;

    private musicBar?: Node;
    private soundBar?: Node;
    private vibrationToggle?: Node;
    private tipsToggle?: Node;
    /** 面板+控件统一挂这里，整体等比缩小 */
    private content?: Node;

    onLoad(): void {
        const canvas = makeProportionalCanvas(this.node, 'Canvas', 708.5, 450.5);
        applyModalFit(canvas, 0.92);
        this.mainCanvas = canvas;

        const content = new Node('Content');
        canvas.node.addChild(content);
        content.setScale(0.9, 0.9, 1);
        this.content = content;

        const panel = makeSprite(content, 'Panel', 708.5, 450.5, '设置页/面板/游戏设置面板.png');
        canvas.place(panel, 354.25, 225.25);

        // 顶空 92；框内控件整体再下移 10
        const contentY = 10;
        this.buildVolumeRow(canvas, 114.5 + contentY, '设置页/图标文字内容/03_背景音乐图标文字.png', 'music');
        this.buildVolumeRow(canvas, 177.5 + contentY, '设置页/图标文字内容/01_游戏音效图标文字.png', 'sound');
        this.buildToggleRow(canvas, 240.5 + contentY);
        this.buildAuxRow(canvas, 301 + contentY);
        this.buildBottomRow(canvas, 366 + contentY);
    }

    private root(): Node {
        return this.content ?? this.mainCanvas!.node;
    }

    /**
     * 音量条尺寸对齐 iOS SettingsViews：
     * 框 300×39；左内边距 24；小蓝块 23×16；端点宝石 26×39。
     * 满值 10 格 + 端点 = 24+230+26=280，右侧约 20，刚好停在金色端饰内侧，不压框内装饰。
     */
    private volumeMetrics(): {
        barW: number;
        barH: number;
        gemW: number;
        gemH: number;
        endW: number;
        endH: number;
        padL: number;
    } {
        return {
            barW: 300,
            barH: 29,
            gemW: 23,
            gemH: 16,
            endW: 26,
            endH: 39,
            padL: 24,
        };
    }

    private buildVolumeRow(
        canvas: ProportionalCanvas,
        centerY: number,
        iconKey: string,
        which: 'music' | 'sound',
    ): void {
        const parent = this.root();
        const icon = makeSprite(parent, `Icon${which}`, 142, 45, iconKey);
        canvas.place(icon, 147.3, centerY);

        const { barW, barH } = this.volumeMetrics();
        const bar = new Node(`Bar${which}`);
        parent.addChild(bar);
        bar.addComponent(UITransform).setContentSize(barW, barH);
        makeSprite(bar, 'Frame', barW, barH, '设置页/音量图形素材/音量框.png');
        if (which === 'music') {
            this.musicBar = bar;
        } else {
            this.soundBar = bar;
        }
        canvas.place(bar, 378.3, centerY);
        this.rebuildGems(bar, which === 'music' ? this.app.profile.settings.musicVolume : this.app.profile.settings.soundVolume);

        const plus = makeImageButton(parent, `Plus${which}`, 42, 42, '设置页/按钮/加减/加号控制按钮.png', () => {
            this.changeVolume(which, 1);
        });
        canvas.place(plus, 559.3, centerY);

        const minus = makeImageButton(parent, `Minus${which}`, 42, 42, '设置页/按钮/加减/减号控制按钮.png', () => {
            this.changeVolume(which, -1);
        });
        canvas.place(minus, 611.3, centerY);
    }

    private rebuildGems(bar: Node | undefined, value: number): void {
        if (!bar) {
            return;
        }
        const { barW, barH, gemW, gemH, endW, endH, padL } = this.volumeMetrics();
        const frame = bar.getChildByName('Frame');
        for (const child of [...bar.children]) {
            if (child !== frame) {
                child.destroy();
            }
        }
        bar.getComponent(UITransform)?.setContentSize(barW, barH);
        if (frame) {
            frame.setPosition(0, 0, 0);
            frame.getComponent(UITransform)?.setContentSize(barW, barH);
            const fsp = frame.getComponent(Sprite);
            if (fsp) fsp.sizeMode = Sprite.SizeMode.CUSTOM;
        }
        // 内槽从左侧金饰内侧开始；满值右缘落在右侧金饰内侧（padR≈20）
        const left = -barW / 2;
        const n = Math.max(0, Math.min(10, value));
        for (let k = 0; k < n; k++) {
            const gem = makeSprite(bar, `Gem${k}`, gemW, gemH, '设置页/音量图形素材/蓝色六边形宝石.png');
            gem.setPosition(left + padL + k * gemW + gemW / 2, 0.7, 0);
            gem.getComponent(UITransform)?.setContentSize(gemW, gemH);
            const gsp = gem.getComponent(Sprite);
            if (gsp) gsp.sizeMode = Sprite.SizeMode.CUSTOM;
        }
        const end = makeSprite(bar, 'End', endW, endH, '设置页/音量图形素材/六边形宝石.png');
        end.setPosition(left + padL + n * gemW + endW / 2, 0, 0);
        end.getComponent(UITransform)?.setContentSize(endW, endH);
        const esp = end.getComponent(Sprite);
        if (esp) esp.sizeMode = Sprite.SizeMode.CUSTOM;
    }

    private changeVolume(which: 'music' | 'sound', delta: number): void {
        const s = this.app.profile.settings;
        const key = which === 'music' ? 'musicVolume' : 'soundVolume';
        const next = Math.max(0, Math.min(10, s[key] + delta));
        if (next === s[key]) return;
        s[key] = next;
        this.app.commitProfile();
        this.audio.applyVolumes(s.musicVolume, s.soundVolume);
        if (which === 'music' && next > 0) this.audio.playBgm('home');
        this.rebuildGems(which === 'music' ? this.musicBar : this.soundBar, next);
    }

    private buildToggleRow(canvas: ProportionalCanvas, centerY: number): void {
        const parent = this.root();
        const iconVibration = makeSprite(parent, 'IconVibration', 142, 45, '设置页/图标文字内容/02_震动反馈图标文字.png');
        canvas.place(iconVibration, 166.25, centerY);

        this.vibrationToggle = makeImageButton(
            parent,
            'VibrationToggle',
            92,
            39,
            this.app.profile.settings.vibrationEnabled ? '设置页/按钮/开启按钮.png' : '设置页/按钮/关闭按钮.png',
            () => {
                const next = !this.app.profile.settings.vibrationEnabled;
                this.app.profile.settings.vibrationEnabled = next;
                this.app.commitProfile();
                this.refreshToggles();
                // 打开时立刻试震，方便在真机确认权限与效果
                if (next) {
                    hapticPreview(true);
                }
            },
        );
        canvas.place(this.vibrationToggle, 291.25, centerY);

        const iconTips = makeSprite(parent, 'IconTips', 142, 45, '设置页/图标文字内容/04_温馨提示图标文字.png');
        canvas.place(iconTips, 442.25, centerY);

        this.tipsToggle = makeImageButton(
            parent,
            'TipsToggle',
            92,
            39,
            this.app.profile.settings.tipsEnabled ? '设置页/按钮/开启按钮.png' : '设置页/按钮/关闭按钮.png',
            () => {
                this.app.profile.settings.tipsEnabled = !this.app.profile.settings.tipsEnabled;
                this.app.commitProfile();
                this.refreshToggles();
            },
        );
        canvas.place(this.tipsToggle, 567.25, centerY);
    }

    private refreshToggles(): void {
        const s = this.app.profile.settings;
        if (this.vibrationToggle) {
            this.swapImage(this.vibrationToggle, s.vibrationEnabled ? '设置页/按钮/开启按钮.png' : '设置页/按钮/关闭按钮.png');
        }
        if (this.tipsToggle) {
            this.swapImage(this.tipsToggle, s.tipsEnabled ? '设置页/按钮/开启按钮.png' : '设置页/按钮/关闭按钮.png');
        }
    }

    private swapImage(node: Node, key: string): void {
        const sprite = node.getComponent(Sprite);
        if (!sprite) {
            return;
        }
        loadSpriteFrame(key, (frame) => {
            if (frame && sprite.isValid) {
                sprite.spriteFrame = frame;
            }
        });
    }

    private buildAuxRow(canvas: ProportionalCanvas, centerY: number): void {
        const parent = this.root();
        const items: Array<[string, string, () => void]> = [
            ['Reset', '设置页/按钮/游戏信息/恢复默认按钮.png', () => this.onReset()],
            ['About', '设置页/按钮/游戏信息/关于游戏按钮.png', () => this.app.openAbout()],
            ['Clear', '设置页/按钮/游戏信息/清理缓存按钮.png', () => this.onClearCache()],
            ['Privacy', '设置页/按钮/游戏信息/隐私政策按钮.png', () => this.app.openPrivacy()],
        ];
        items.forEach(([name, key, onClick], i) => {
            const btn = makeImageButton(parent, name, 116, 40, key, onClick);
            canvas.place(btn, 159.25 + i * 130, centerY);
        });
    }

    private buildBottomRow(canvas: ProportionalCanvas, centerY: number): void {
        const parent = this.root();
        const close = makeImageButton(parent, 'Close', 170, 50, '设置页/按钮/关闭设置按钮.png', () => {
            this.app.popModal();
            // 从暂停进设置再关闭设置 = 继续游戏（总结 §3.5.1）
            if (this.app.topModalKind() === ModalKind.Pause) {
                this.app.popModal();
            }
        });
        canvas.place(close, 233.25, centerY);

        const exit = makeImageButton(parent, 'Exit', 170, 50, '设置页/按钮/退出游戏按钮.png', () => {
            this.app.toast('退出游戏（原生构建环境生效）');
        });
        canvas.place(exit, 475.25, centerY);
    }

    private onReset(): void {
        this.app.profile.settings = { ...DEFAULT_SETTINGS };
        this.app.commitProfile();
        this.audio.applyVolumes(DEFAULT_SETTINGS.musicVolume, DEFAULT_SETTINGS.soundVolume);
        this.rebuildGems(this.musicBar, DEFAULT_SETTINGS.musicVolume);
        this.rebuildGems(this.soundBar, DEFAULT_SETTINGS.soundVolume);
        this.refreshToggles();
        this.app.toast('已恢复默认设置');
    }

    private onClearCache(): void {
        this.app.clearCache();
        this.app.toast('缓存已清理，进度已保留');
    }
}
