import { EventTarget } from 'cc';
import {
    ChestKind,
    RewardBundle,
    SaveProfile,
    chestByKind,
    characterById,
    itemById,
    keyByKind,
    ownedCharacterFallbackCoins,
    rollChest,
    settleEconomy,
} from '../data/GameData';
import { SaveStore } from './SaveStore';
import { haptic } from './Haptics';
import { RunOutcome } from '../run/RunWorld';

/** 主路由页面（对齐总结 §五 状态机；M0 只定义枚举，页面按里程碑接入） */
export enum Screen {
    Loading = 'loading',
    Home = 'home',
    Levels = 'levels',
    Run = 'run',
    Result = 'result',
    Inventory = 'inventory',
    Shop = 'shop',
    Settings = 'settings',
}

export interface ModalEntry {
    id: number;
    kind: ModalKind;
    payload?: unknown;
}

export interface ToastEntry {
    id: number;
    message: string;
}

/** 弹窗类型（M1：设置/关于/隐私/充值；后续里程碑再扩展） */
export enum ModalKind {
    Settings = 'settings',
    About = 'about',
    Privacy = 'privacy',
    Recharge = 'recharge',
    Pause = 'pause',
    /** 局内背包遮罩（对齐 iOS showInventoryOverlay） */
    Inventory = 'inventory',
    ChestReward = 'chest-reward',
    ChestFail = 'chest-fail',
    ShopCharacter = 'shop-character',
    ShopItem = 'shop-item',
    ShopChest = 'shop-chest',
    ShopKey = 'shop-key',
}

/** 结算结果（成败/星级/得分；奖励卡含数量） */
export interface RunResult {
    level: number;
    success: boolean;
    stars: number;
    score: number;
    /** 局内获得且未使用的道具/宝箱卡 */
    rewardCards?: Array<{ path: string; count: number }>;
}

/**
 * 全局状态单例（对齐规范 §9）：主路由、弹层栈、Toast、存档入口。
 * 事件：screen-changed / modal-changed / toast-changed / profile-changed。
 */
export class GameAppState {
    private static _instance: GameAppState | null = null;

    static get instance(): GameAppState {
        if (!this._instance) {
            this._instance = new GameAppState();
        }
        return this._instance;
    }

    readonly events = new EventTarget();
    readonly saveStore = new SaveStore();

    profile: SaveProfile;
    screen: Screen = Screen.Loading;
    /** 加载页用途：开机进首页 / 进局预加载 */
    loadingPurpose: 'boot' | 'run' = 'boot';
    selectedLevel = 1;
    runSessionID = '';
    latestResult: RunResult | null = null;

    private _modals: ModalEntry[] = [];
    private _toasts: ToastEntry[] = [];
    private _nextId = 1;

    constructor() {
        this.profile = this.saveStore.load();
    }

    setScreen(screen: Screen): void {
        if (this.screen === screen) {
            return;
        }
        this.screen = screen;
        this.events.emit('screen-changed', screen);
    }

    get modals(): readonly ModalEntry[] {
        return this._modals;
    }

    pushModal(kind: ModalKind, payload?: unknown): number {
        const id = this._nextId++;
        this._modals.push({ id, kind, payload });
        this.events.emit('modal-changed');
        return id;
    }

    popModal(): void {
        this._modals.pop();
        this.events.emit('modal-changed');
    }

    openSettings(): void {
        this.pushModal(ModalKind.Settings);
    }

    openAbout(): void {
        this.pushModal(ModalKind.About);
    }

    openPrivacy(): void {
        this.pushModal(ModalKind.Privacy);
    }

    openRecharge(): void {
        this.pushModal(ModalKind.Recharge);
    }

    openPause(): void {
        this.pushModal(ModalKind.Pause);
    }

    /**
     * 打开背包：局内 → 遮罩暂停；首页等 → 整页背包（对齐 iOS openInventory）
     */
    openInventory(from: 'home' | 'run' = 'home'): void {
        if (from === 'run') {
            this.pushModal(ModalKind.Inventory);
        } else {
            this.clearModals();
            this.setScreen(Screen.Inventory);
        }
    }

    /** 关闭局内背包遮罩 */
    closeInventoryOverlay(): void {
        if (this.topModalKind() === ModalKind.Inventory) {
            this.popModal();
            return;
        }
        // 若设置等叠在背包上，整栈清到去掉 Inventory
        const idx = this._modals.findIndex((m) => m.kind === ModalKind.Inventory);
        if (idx >= 0) {
            this._modals = this._modals.slice(0, idx);
            this.events.emit('modal-changed');
        }
    }

    clearModals(): void {
        this._modals = [];
        this.events.emit('modal-changed');
    }

    topModalKind(): ModalKind | null {
        const top = this._modals[this._modals.length - 1];
        return top ? top.kind : null;
    }

    /** 进关：直接进 Run（素材异步贴图；不再插加载页） */
    startLevel(level: number): void {
        this.selectedLevel = level;
        this.runSessionID = `run_${Date.now()}_${this._nextId++}`;
        this.screen = Screen.Run;
        this.events.emit('screen-changed', Screen.Run);
    }

    /**
     * 同关重开：强制重建 Run 页（即使当前已在 Run 也要 emit）。
     * 与 iOS `runSessionID = UUID(); navigate(.run)` 一致；关卡种子保证布局回到开局。
     */
    restartLevel(): void {
        this.clearModals();
        this.runSessionID = `run_${Date.now()}_${this._nextId++}`;
        this.screen = Screen.Run;
        this.events.emit('screen-changed', Screen.Run);
    }

    /** 结算入账（总结 §二/§2.8：拾取折算+通关/星级/首通/节点+道具退回；M6 收口） */
    settleRun(result: RunOutcome): void {
        const s = settleEconomy(result, this.profile);
        const p = this.profile;
        p.coins += s.coins;
        p.diamonds += s.diamonds;
        for (const id of s.itemsAdded) {
            p.itemInventory[id] = (p.itemInventory[id] ?? 0) + 1;
        }
        for (const kind of s.chestsAdded) {
            p.chestInventory[kind] = (p.chestInventory[kind] ?? 0) + 1;
        }
        for (const keyKind of s.keysAdded) {
            p.keyInventory[keyKind] = Math.min(99, (p.keyInventory[keyKind] ?? 0) + 1);
        }
        if (result.success) {
            p.unlockedLevel = Math.max(p.unlockedLevel, Math.min(20, result.level + 1));
            p.levelStars[`${result.level}`] = Math.max(p.levelStars[`${result.level}`] ?? 0, result.stars);
            p.firstClear[`${result.level}`] = true;
            for (const id of s.claimedNodes) {
                p.nodeClaims[id] = true;
            }
        }
        // 未使用的携带道具退回背包并清空携带（已消耗的不退）
        for (const id of p.loadout) {
            p.itemInventory[id] = (p.itemInventory[id] ?? 0) + 1;
        }
        p.loadout = [];
        p.lastRunSummary = {
            level: result.level,
            success: result.success,
            stars: result.stars,
            score: result.score,
            coins: s.coins,
            diamonds: s.diamonds,
        };
        this.commitProfile();
        this.latestResult = {
            level: result.level,
            success: result.success,
            stars: result.stars,
            score: result.score,
            rewardCards: s.rewardCards.slice(0, 9),
        };
        this.setScreen(Screen.Result);
    }

    /** 开箱（总结 §3.11.1 / §2.9）：先判箱量再判钥匙；成功扣 1+1 并掉落入账 */
    openChest(kind: ChestKind): void {
        const chest = chestByKind(kind);
        const boxCount = this.profile.chestInventory[kind] ?? 0;
        const vibe = this.profile.settings.vibrationEnabled;
        if (boxCount <= 0) {
            haptic('warning', vibe);
            this.pushModal(ModalKind.ChestFail, { reason: 'missingChest', kind });
            return;
        }
        const keyCount = this.profile.keyInventory[chest.key] ?? 0;
        if (keyCount <= 0) {
            haptic('warning', vibe);
            this.pushModal(ModalKind.ChestFail, { reason: 'missingKey', kind });
            return;
        }
        this.profile.chestInventory[kind] = boxCount - 1;
        this.profile.keyInventory[chest.key] = keyCount - 1;

        let reward = rollChest(kind, this.profile.unlockedCharacters);
        if (reward.character && this.profile.unlockedCharacters.includes(reward.character)) {
            reward = { ...reward, coins: reward.coins + ownedCharacterFallbackCoins(kind), character: null };
        }
        this.applyReward(reward);
        this.commitProfile();
        // 成功震动在 ChestRewardModal 播放（对齐 iOS notification.success）
        this.pushModal(ModalKind.ChestReward, { kind, reward });
    }

    private applyReward(reward: RewardBundle): void {
        this.profile.coins += reward.coins;
        this.profile.diamonds += reward.diamonds;
        for (const id of reward.items) {
            this.profile.itemInventory[id] = (this.profile.itemInventory[id] ?? 0) + 1;
        }
        if (reward.character && !this.profile.unlockedCharacters.includes(reward.character)) {
            this.profile.unlockedCharacters.push(reward.character);
        }
    }

    /** 商城购买入口（总结 §5.4：先详情再扣费；一件商品一种货币） */
    buyCharacter(id: string): void {
        const c = characterById(id);
        const vibe = this.profile.settings.vibrationEnabled;
        if (this.profile.unlockedCharacters.includes(id)) {
            this.toast('已拥有该角色');
            return;
        }
        if (!c.availableInRun) {
            this.toast('动作素材待补…');
            return;
        }
        if (this.profile.diamonds < c.price) {
            haptic('warning', vibe);
            this.toast('钻石不足');
            return;
        }
        this.profile.diamonds -= c.price;
        this.profile.unlockedCharacters.push(id);
        this.commitProfile();
        haptic('success', vibe);
        this.toast(`购买成功，已解锁 ${c.name}`);
        this.popModal();
    }

    buyItem(id: string): void {
        const item = itemById(id);
        const vibe = this.profile.settings.vibrationEnabled;
        if (this.profile.coins < item.buyPrice) {
            haptic('warning', vibe);
            this.toast('金币不足');
            return;
        }
        this.profile.coins -= item.buyPrice;
        this.profile.itemInventory[id] = (this.profile.itemInventory[id] ?? 0) + 1;
        this.commitProfile();
        haptic('success', vibe);
        this.toast(`购买成功 +1 ${item.name}`);
        this.popModal();
    }

    buyChest(kind: ChestKind): void {
        const chest = chestByKind(kind);
        const vibe = this.profile.settings.vibrationEnabled;
        const wallet = chest.currency === 'coins' ? this.profile.coins : this.profile.diamonds;
        if (wallet < chest.price) {
            haptic('warning', vibe);
            this.toast(chest.currency === 'coins' ? '金币不足' : '钻石不足');
            return;
        }
        if (chest.currency === 'coins') {
            this.profile.coins -= chest.price;
        } else {
            this.profile.diamonds -= chest.price;
        }
        this.profile.chestInventory[kind] = (this.profile.chestInventory[kind] ?? 0) + 1;
        this.commitProfile();
        haptic('success', vibe);
        this.toast(`购买成功 +1 ${chest.name}`);
        this.popModal();
    }

    buyKey(kind: ChestKind): void {
        const chest = chestByKind(kind);
        const key = keyByKind(chest.key);
        const vibe = this.profile.settings.vibrationEnabled;
        const wallet = key.currency === 'coins' ? this.profile.coins : this.profile.diamonds;
        const owned = this.profile.keyInventory[chest.key] ?? 0;
        if (owned >= 99) {
            this.toast('钥匙已达上限 99');
            return;
        }
        if (wallet < key.price) {
            haptic('warning', vibe);
            this.toast(key.currency === 'coins' ? '金币不足' : '钻石不足');
            return;
        }
        if (key.currency === 'coins') {
            this.profile.coins -= key.price;
        } else {
            this.profile.diamonds -= key.price;
        }
        this.profile.keyInventory[chest.key] = owned + 1;
        this.commitProfile();
        haptic('success', vibe);
        this.toast(`购买成功 +1 ${key.name}`);
        this.popModal();
    }

    get toasts(): readonly ToastEntry[] {
        return this._toasts;
    }

    toast(message: string): void {
        const id = this._nextId++;
        this._toasts.push({ id, message });
        this.events.emit('toast-changed');
        setTimeout(() => {
            const idx = this._toasts.findIndex((t) => t.id === id);
            if (idx >= 0) {
                this._toasts.splice(idx, 1);
                this.events.emit('toast-changed');
            }
        }, 2000);
    }

    /** 存档成功后统一通知 UI 刷新 */
    commitProfile(): void {
        this.saveStore.save(this.profile);
        this.events.emit('profile-changed');
    }

    /** 清缓存（清结算摘要、保留进度） */
    clearCache(): void {
        this.saveStore.clearCache(this.profile);
        this.events.emit('profile-changed');
    }

    /** 重置为新档 */
    resetProfile(): void {
        this.profile = this.saveStore.reset();
        this.events.emit('profile-changed');
    }
}
