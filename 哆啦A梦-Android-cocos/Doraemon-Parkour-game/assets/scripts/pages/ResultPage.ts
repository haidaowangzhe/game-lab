import { _decorator, Button, Component, Label, Node, UIOpacity, UITransform, view } from 'cc';
import { GameAppState, Screen } from '../core/GameAppState';
import { AudioService } from '../core/AudioService';
import { haptic } from '../core/Haptics';
import { fillBackground, makeImageButton, makeLabel, makeSprite } from '../ui/UIKit';
const { ccclass } = _decorator;

/** 设计基准面板（总结 §3.6） */
const PANEL_W = 260;
const PANEL_H = 370;
const VERTICAL_MARGIN_RATIO = 0.08;
const MAX_SCALE = 1.72;
/** 超过此数量才轮播；每页最多 4 张 */
const CAROUSEL_THRESHOLD = 4;
const PAGE_SIZE = 4;
const CAROUSEL_INTERVAL = 2.8;

/**
 * 结算页（总结 §3.6）：
 * 得分框内仅黑色数字；下方展示本局获得且未使用的道具卡。
 * 奖励卡超过 4 张时按页轮播（每页 4 张，约 2.8s 翻页）。
 */
@ccclass('ResultPage')
export class ResultPage extends Component {
    private pageRoots: Node[] = [];
    private dots: Label[] = [];
    private page = 0;
    private pageCount = 1;
    private timer = 0;

    onLoad(): void {
        const app = GameAppState.instance;
        const result = app.latestResult ?? { level: app.selectedLevel, success: false, stars: 0, score: 0 };
        AudioService.instance.playSfx(result.success ? 'win' : 'hurt');
        haptic(result.success ? 'success' : 'warning', app.profile.settings.vibrationEnabled);

        fillBackground(this.node, '游戏内主界面/背景图.png');

        const panelNode = new Node('Panel');
        this.node.addChild(panelNode);
        panelNode.addComponent(UITransform);
        panelNode.setPosition(0, -6, 0);

        const visible = view.getVisibleSize();
        const margin = Math.max(36, visible.height * VERTICAL_MARGIN_RATIO);
        const scaleByH = (visible.height - margin * 2) / PANEL_H;
        const scaleByW = (visible.width * 0.46) / PANEL_W;
        const scale = Math.min(MAX_SCALE, scaleByH, scaleByW);
        panelNode.setScale(scale, scale, 1);

        makeSprite(
            panelNode,
            'Bg',
            PANEL_W,
            PANEL_H,
            result.success ? '结算页/底框/成功面板-空白.png' : '结算页/底框/失败面板-空白.png',
        );

        for (let i = 0; i < 3; i++) {
            const star = makeSprite(
                panelNode,
                `Star${i}`,
                44,
                44,
                i < result.stars ? '结算页/星级/亮星.png' : '结算页/星级/黑星.png',
            );
            star.setPosition(-49 + i * 49, 83, 0);
        }

        const score = makeLabel(panelNode, 'Score', `${result.score}`, 24, '#000000', 200, 40);
        score.horizontalAlign = Label.HorizontalAlign.CENTER;
        score.node.setPosition(0, 8, 0);

        const cards = result.rewardCards ?? [];
        this.mountRewardCards(panelNode, cards);

        const canNext = result.success && result.level < 20;
        const retry = makeImageButton(panelNode, 'Retry', 38, 38, '结算页/结算按钮/01_重试按钮.png', () => {
            app.clearModals();
            app.restartLevel();
        });
        retry.setPosition(-65, -123, 0);

        const home = makeImageButton(panelNode, 'Home', 38, 38, '结算页/结算按钮/03_主页按钮.png', () => {
            app.clearModals();
            app.setScreen(Screen.Home);
        });
        home.setPosition(0, -123, 0);

        const next = makeImageButton(
            panelNode,
            'Next',
            38,
            38,
            canNext ? '结算页/结算按钮/04_下一关按钮.png' : '结算页/结算按钮/04_下一关按钮_灰-不可点击.png',
            () => {
                if (canNext) {
                    app.clearModals();
                    app.startLevel(result.level + 1);
                }
            },
        );
        next.setPosition(65, -123, 0);
        if (!canNext) {
            const btn = next.getComponent(Button);
            if (btn) {
                btn.interactable = false;
            }
        }
    }

    update(dt: number): void {
        if (this.pageCount <= 1) {
            return;
        }
        this.timer += dt;
        if (this.timer < CAROUSEL_INTERVAL) {
            return;
        }
        this.timer = 0;
        this.showPage((this.page + 1) % this.pageCount);
    }

    private mountRewardCards(panel: Node, cards: Array<{ path: string; count: number }>): void {
        if (cards.length === 0) {
            return;
        }
        const useCarousel = cards.length > CAROUSEL_THRESHOLD;
        const pageSize = useCarousel ? PAGE_SIZE : cards.length;
        const pages: Array<Array<{ path: string; count: number }>> = [];
        for (let i = 0; i < cards.length; i += pageSize) {
            pages.push(cards.slice(i, i + pageSize));
        }
        this.pageCount = pages.length;
        pages.forEach((page, pi) => {
            const root = new Node(`RewardPage${pi}`);
            panel.addChild(root);
            root.addComponent(UITransform);
            this.layoutCardRow(root, page);
            root.active = pi === 0;
            this.pageRoots.push(root);
        });
        if (useCarousel && pages.length > 1) {
            for (let i = 0; i < pages.length; i++) {
                const dot = makeLabel(panel, `Dot${i}`, i === 0 ? '●' : '○', 10, '#333333', 14, 14);
                dot.horizontalAlign = Label.HorizontalAlign.CENTER;
                const spread = (pages.length - 1) * 12;
                dot.node.setPosition(-spread / 2 + i * 12, -98, 0);
                this.dots.push(dot);
            }
        }
    }

    private layoutCardRow(parent: Node, cards: Array<{ path: string; count: number }>): void {
        const gap = 5;
        const cardW = 45;
        const totalW = cards.length * cardW + (cards.length - 1) * gap;
        cards.forEach((card, i) => {
            const x = -totalW / 2 + cardW / 2 + i * (cardW + gap);
            const node = makeSprite(parent, `Reward${i}`, cardW, cardW, card.path);
            node.setPosition(x, -75, 0);
            if (card.count > 1) {
                const badge = makeLabel(parent, `RewardN${i}`, `×${card.count}`, 10, '#FFFFFF', 28, 14, '#000000');
                badge.node.setPosition(x + 14, -75 - 14, 0);
            }
        });
    }

    private showPage(index: number): void {
        this.page = index;
        this.pageRoots.forEach((root, i) => {
            root.active = i === index;
            let op = root.getComponent(UIOpacity);
            if (!op) {
                op = root.addComponent(UIOpacity);
            }
            op.opacity = i === index ? 255 : 0;
        });
        this.dots.forEach((dot, i) => {
            dot.string = i === index ? '●' : '○';
        });
    }
}
