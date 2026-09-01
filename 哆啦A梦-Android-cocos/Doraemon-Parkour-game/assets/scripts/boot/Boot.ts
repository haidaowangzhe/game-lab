import {
    _decorator,
    Component,
    Node,
    UITransform,
    view,
} from 'cc';
import { AudioService } from '../core/AudioService';
import { GameAppState, ModalKind, Screen } from '../core/GameAppState';
import { ChestFailModal } from '../pages/ChestFailModal';
import { ChestRewardModal } from '../pages/ChestRewardModal';
import { HomePage } from '../pages/HomePage';
import { InfoModal } from '../pages/InfoModal';
import { InventoryPage } from '../pages/InventoryPage';
import { LevelSelectPage } from '../pages/LevelSelectPage';
import { LoadingPage } from '../pages/LoadingPage';
import { PauseModal } from '../pages/PauseModal';
import { RechargeModal } from '../pages/RechargeModal';
import { ResultPage } from '../pages/ResultPage';
import { RunGamePage } from '../pages/RunGamePage';
import { SettingsPage } from '../pages/SettingsPage';
import { ShopChestModal } from '../pages/ShopChestModal';
import { ShopCharacterModal } from '../pages/ShopCharacterModal';
import { ShopItemModal } from '../pages/ShopItemModal';
import { ShopKeyModal } from '../pages/ShopKeyModal';
import { ShopPage } from '../pages/ShopPage';
import { ModalMask } from '../ui/ModalMask';
import { ProportionalCanvas } from '../ui/ProportionalCanvas';
import { ToastLayer } from '../ui/ToastLayer';
import { fillBackground, fillDimOverlay } from '../ui/UIKit';
const { ccclass } = _decorator;

/**
 * 入口组件（挂在 Boot 场景 Canvas 上）。
 * M1：主路由渲染 Loading/Home；弹层渲染 设置/关于/隐私/充值；
 * 切页确保轻快 BGM 在播（全游戏统一曲）；窗口变化时重应用画布并重建弹层。
 */
@ccclass('Boot')
export class Boot extends Component {
    private readonly app = GameAppState.instance;
    private readonly audio = AudioService.instance;

    private pageLayer!: Node;
    private modalLayer!: Node;
    private toastLayer!: Node;
    private currentPage: { mainCanvas?: ProportionalCanvas } | null = null;

    onLoad(): void {
        const bgmNode = new Node('BgmAudio');
        this.node.addChild(bgmNode);
        const sfxNode = new Node('SfxAudio');
        this.node.addChild(sfxNode);
        this.audio.init(bgmNode, sfxNode);
        this.audio.applyVolumes(this.app.profile.settings.musicVolume, this.app.profile.settings.soundVolume);

        this.pageLayer = this.makeLayer('PageLayer');
        this.modalLayer = this.makeLayer('ModalLayer');
        this.toastLayer = this.makeLayer('ToastLayer');
        this.toastLayer.addComponent(ToastLayer);

        this.app.events.on('screen-changed', this.onScreenChanged, this);
        this.app.events.on('modal-changed', this.refreshModals, this);
        this.app.events.on('toast-changed', this.refreshToasts, this);

        view.setResizeCallback(() => {
            this.currentPage?.mainCanvas?.apply();
            (this.currentPage as { resize?: () => void } | null)?.resize?.();
            this.refreshModals();
            this.refreshToasts();
        });

        this.renderPage();
        this.refreshModals();
        this.refreshToasts();
    }

    onDestroy(): void {
        view.setResizeCallback(null);
        this.app.events.off('screen-changed', this.onScreenChanged, this);
        this.app.events.off('modal-changed', this.refreshModals, this);
        this.app.events.off('toast-changed', this.refreshToasts, this);
    }

    private makeLayer(name: string): Node {
        const layer = new Node(name);
        this.node.addChild(layer);
        layer.addComponent(UITransform);
        return layer;
    }

    private onScreenChanged(_screen: Screen): void {
        this.renderPage();
    }

    private renderPage(): void {
        this.pageLayer.destroyAllChildren();
        this.currentPage = null;
        if (this.app.modals.length === 0) {
            this.pageLayer.resumeSystemEvents(true);
        }

        // 全游戏统一轻快 BGM；切页只确保在播，不换轨
        this.audio.playBgm('home');

        switch (this.app.screen) {
            case Screen.Loading: {
                const pageNode = this.makePageNode();
                this.currentPage = pageNode.addComponent(LoadingPage);
                break;
            }
            case Screen.Home: {
                const pageNode = this.makePageNode();
                this.currentPage = pageNode.addComponent(HomePage);
                break;
            }
            case Screen.Levels: {
                const pageNode = this.makePageNode();
                this.currentPage = pageNode.addComponent(LevelSelectPage);
                break;
            }
            // 对齐 iOS RootView.sectionPresentation：首页底图 + 黑 0.48 + 面板
            case Screen.Inventory: {
                this.mountSectionUnderlay();
                const pageNode = this.makePageNode();
                this.currentPage = pageNode.addComponent(InventoryPage);
                break;
            }
            case Screen.Shop: {
                this.mountSectionUnderlay();
                const pageNode = this.makePageNode();
                this.currentPage = pageNode.addComponent(ShopPage);
                break;
            }
            case Screen.Run: {
                const pageNode = this.makePageNode();
                this.currentPage = pageNode.addComponent(RunGamePage);
                break;
            }
            case Screen.Result: {
                const pageNode = this.makePageNode();
                this.currentPage = pageNode.addComponent(ResultPage);
                break;
            }
            default: {
                const pageNode = this.makePageNode();
                this.currentPage = pageNode.addComponent(HomePage);
                break;
            }
        }
    }

    private makePageNode(): Node {
        const pageNode = new Node('Page');
        this.pageLayer.addChild(pageNode);
        return pageNode;
    }

    /** iOS：sectionBackground(home) + Color.black.opacity(0.48) */
    private mountSectionUnderlay(): void {
        const underlay = new Node('SectionUnderlay');
        this.pageLayer.addChild(underlay);
        fillBackground(underlay, '首页/背景图.png');
        fillDimOverlay(underlay, 0.48);
    }

    private refreshModals(): void {
        this.modalLayer.destroyAllChildren();
        const modals = this.app.modals;
        if (modals.length === 0) {
            // 无弹层时恢复下层点击
            this.pageLayer.resumeSystemEvents(true);
            return;
        }
        // 有弹层时暂停 pageLayer 事件，避免半透明遮罩下按钮仍可点
        this.pageLayer.pauseSystemEvents(true);

        const top = modals[modals.length - 1];
        const maskNode = new Node('Mask');
        this.modalLayer.addChild(maskNode);
        const mask = maskNode.addComponent(ModalMask);
        const content = mask.content ?? maskNode;

        switch (top.kind) {
            case ModalKind.Settings:
                content.addComponent(SettingsPage);
                break;
            case ModalKind.About:
                content.addComponent(InfoModal).init('about');
                break;
            case ModalKind.Privacy:
                content.addComponent(InfoModal).init('privacy');
                break;
            case ModalKind.Recharge:
                content.addComponent(RechargeModal);
                break;
            case ModalKind.Pause:
                content.addComponent(PauseModal);
                break;
            case ModalKind.Inventory:
                content.addComponent(InventoryPage);
                break;
            case ModalKind.ChestReward:
                content.addComponent(ChestRewardModal).init(top.payload as never);
                break;
            case ModalKind.ChestFail:
                content.addComponent(ChestFailModal).init(top.payload as never);
                break;
            case ModalKind.ShopCharacter:
                content.addComponent(ShopCharacterModal).init((top.payload as { id: string }).id);
                break;
            case ModalKind.ShopItem:
                content.addComponent(ShopItemModal).init((top.payload as { id: string }).id);
                break;
            case ModalKind.ShopChest:
                content.addComponent(ShopChestModal).init((top.payload as { kind: 'wood' | 'silver' | 'gold' | 'purple' }).kind);
                break;
            case ModalKind.ShopKey:
                content.addComponent(ShopKeyModal).init((top.payload as { kind: 'wood' | 'silver' | 'gold' | 'purple' }).kind);
                break;
        }
    }

    private refreshToasts(): void {
        const layer = this.toastLayer.getComponent(ToastLayer);
        layer?.showMessages(this.app.toasts.map((t) => t.message));
    }
}
