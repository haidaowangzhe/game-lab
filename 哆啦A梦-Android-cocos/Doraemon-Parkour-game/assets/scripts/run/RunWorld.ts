/**
 * 局内模拟（总结 §3.4 / §2 相关小节；M5 最小可玩集，不含经济入账）。
 * 世界以设计像素为单位：高 637、地面 groundY=0.875×637、镜头锚点 0.30×1024、可见前方约 34m。
 */

import { itemById, type ChestKind } from '../data/GameData';

/**
 * 每关固定种子（对齐 iOS LevelRandomGenerator）：
 * 同一关重玩布局一致，滚石/陷阱回到开局位置。
 */
class LevelRng {
    private state: bigint;

    constructor(level: number) {
        this.state = (BigInt(level) * 0xd1b54a32d192ed03n) ^ 0xa24baed4963ee407n;
    }

    nextU64(): bigint {
        this.state = (this.state + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
        let value = this.state;
        value = (value ^ (value >> 30n)) * 0xbf58476d1ce4e5b9n;
        value = (value ^ (value >> 27n)) * 0x94d049bb133111ebn;
        return (value ^ (value >> 31n)) & 0xffffffffffffffffn;
    }

    /** [0, 1) */
    float(): number {
        return Number(this.nextU64() >> 11n) / Number(1n << 53n);
    }

    /** [0, max) 整数 */
    int(max: number): number {
        if (max <= 0) {
            return 0;
        }
        return Math.floor(this.float() * max);
    }

    pick<T>(arr: readonly T[]): T {
        return arr[this.int(arr.length)]!;
    }
}

/**
 * 掉落显示：在方框内按素材原始宽高比等比缩放（对齐 iOS AssetImage `.fit`）。
 * 禁止把竖长道具硬塞进正方形导致压扁。
 */
export function fitInBox(assetW: number, assetH: number, box: number): { w: number; h: number } {
    const s = Math.min(box / Math.max(1, assetW), box / Math.max(1, assetH));
    return { w: assetW * s, h: assetH * s };
}

/**
 * 按素材原图像素统一倍率缩小（同比例），保留相对大小差异。
 * 铜锣烧迷你/经典/豪华源图本身刻意分档，不可再塞进同一方框抹平。
 */
export function scaleUniform(
    assetW: number,
    assetH: number,
    refSide: number,
    targetSide: number,
): { w: number; h: number } {
    const s = targetSide / Math.max(1, refSide);
    return { w: assetW * s, h: assetH * s };
}

/** 局内掉落素材原始像素（resources 内 PNG） */
const DROP_NATIVE: Record<string, readonly [number, number]> = {
    coin: [90, 90],
    gem_blue: [76, 87],
    gem_green: [70, 89],
    gem_red: [74, 89],
    gem_purple: [70, 90],
    chest: [1216, 910],
    energy_milk: [162, 276],
    speed_shoes: [238, 209],
    shield: [195, 229],
    magnet: [222, 231],
    flight_boots: [269, 250],
    mini_dorayaki: [365, 360],
    classic_dorayaki: [522, 493],
    luxury_dorayaki: [632, 631],
    honey_muffin: [216, 175],
    natural_honey: [171, 182],
    golden_honeycomb: [191, 161],
    candy_lollipop: [161, 180],
    strawberry_milk: [138, 195],
    strawberry_cake: [179, 189],
    fresh_orange: [172, 171],
    vitality_juice: [158, 199],
    orange_pudding: [232, 197],
};

/**
 * 素材本身已区分大小的道具：统一倍率缩小（锚点=经典铜锣烧长边→局内中型约 58）。
 * 迷你 ≈40、经典 ≈58、豪华 ≈70，与源图像素比一致。
 */
const DROP_PROPORTIONAL_IDS: ReadonlySet<string> = new Set([
    'mini_dorayaki',
    'classic_dorayaki',
    'luxury_dorayaki',
]);
const DROP_PROPORTIONAL_REF_SIDE = 522; // classic_dorayaki 长边
const DROP_PROPORTIONAL_TARGET = 58;

/** iOS 视觉框：货币 40；通用道具/箱 58（框内 aspectFit）；铜锣烧按源图同比例 */
export function entityVisualSize(e: {
    type: string;
    itemId?: string;
    gemColor?: string;
    variant?: string;
}): { w: number; h: number } {
    switch (e.type) {
        case 'box':
            return { w: 72, h: 72 };
        case 'rockStone':
            return scaleUniform(217, 166, 166, 102);
        case 'concrete':
            return scaleUniform(220, 179, 179, 108);
        case 'stoneWall':
            // 角色站立高 120：墙至少略高于角色，按高度等比，避免只锁宽度压成矮墙
            return scaleUniform(247, 130, 130, 132);
        case 'barrelRed':
            return scaleUniform(203, 164, 164, 100);
        case 'barrelBlue':
            return scaleUniform(196, 159, 159, 98);
        case 'platform': {
            const natives: Record<string, readonly [number, number]> = {
                '1': [163, 96],
                '2': [156, 99],
                '3': [170, 100],
                '4': [193, 102],
            };
            const [nw, nh] = natives[e.variant ?? '1'] ?? natives['1'];
            return scaleUniform(nw, nh, 193, 230);
        }
        case 'spike':
            return { w: 69, h: 38 };
        case 'rock':
            return { w: 50, h: 49 };
        case 'rockCrack':
            return { w: 50, h: 48 };
        case 'rockBig':
            return { w: 96, h: 90 };
        case 'chainSpike':
            return { w: 87, h: 78 };
        case 'wallSpike':
            return { w: 44, h: 110 };
        case 'boardSpike':
            return { w: 58, h: 86 };
        case 'spear':
            return { w: 28, h: 98 };
        case 'arrowDown':
            return { w: 22, h: 72 };
        case 'arrowLeft':
        case 'arrowRight':
            return { w: 72, h: 22 };
        case 'coin':
            return fitInBox(DROP_NATIVE.coin[0], DROP_NATIVE.coin[1], 40);
        case 'gem': {
            const key = `gem_${e.gemColor ?? 'blue'}`;
            const native = DROP_NATIVE[key] ?? DROP_NATIVE.gem_blue;
            return fitInBox(native[0], native[1], 40);
        }
        case 'chest':
            return fitInBox(DROP_NATIVE.chest[0], DROP_NATIVE.chest[1], 58);
        case 'item':
        case 'food': {
            const id = e.itemId ?? (e.type === 'food' ? 'mini_dorayaki' : 'energy_milk');
            const native = DROP_NATIVE[id] ?? ([58, 58] as const);
            if (DROP_PROPORTIONAL_IDS.has(id)) {
                return scaleUniform(native[0], native[1], DROP_PROPORTIONAL_REF_SIDE, DROP_PROPORTIONAL_TARGET);
            }
            return fitInBox(native[0], native[1], 58);
        }
        default:
            return { w: 40, h: 40 };
    }
}

/**
 * 悬浮台不透明轮廓（20 列）：low/high 为相对实体底边的 0–1。
 * 碰撞跟素材锯齿底边走，不用整块方形。
 */
const PLATFORM_SHAPE: Record<string, { low: number[]; high: number[] }> = {
    '1': {
        low: [0.531, 0.302, 0.146, 0.156, 0.271, 0.281, 0.177, 0.177, 0.167, 0.062, 0.021, 0.135, 0.094, 0.094, 0.24, 0.219, 0.25, 0.229, 0.312, 0.51],
        high: [0.906, 0.948, 0.948, 0.948, 0.948, 0.948, 0.948, 0.948, 0.948, 0.948, 0.948, 0.948, 0.979, 0.948, 0.948, 0.948, 0.948, 0.948, 0.948, 0.906],
    },
    '2': {
        low: [0.535, 0.354, 0.273, 0.374, 0.293, 0.172, 0.051, 0.02, 0.081, 0.253, 0.293, 0.293, 0.283, 0.162, 0.202, 0.343, 0.354, 0.293, 0.394, 0.515],
        high: [0.889, 0.929, 0.929, 0.929, 0.929, 0.929, 0.929, 0.929, 0.929, 0.939, 0.96, 0.939, 0.98, 0.97, 0.929, 0.929, 0.929, 0.929, 0.929, 0.889],
    },
    '3': {
        low: [0.55, 0.39, 0.28, 0.3, 0.32, 0.2, 0.16, 0.16, 0.12, 0.02, 0.02, 0.1, 0.2, 0.13, 0.22, 0.34, 0.27, 0.27, 0.39, 0.53],
        high: [0.88, 0.93, 0.93, 0.93, 0.94, 0.93, 0.97, 0.98, 0.95, 0.94, 0.93, 0.96, 0.94, 0.93, 0.95, 0.97, 0.94, 0.93, 0.93, 0.9],
    },
    '4': {
        low: [0.529, 0.265, 0.157, 0.176, 0.333, 0.255, 0.265, 0.206, 0.186, 0.176, 0.157, 0.069, 0.02, 0.069, 0.216, 0.304, 0.284, 0.216, 0.265, 0.49],
        high: [0.892, 0.922, 0.922, 0.922, 0.951, 0.971, 0.971, 0.98, 0.98, 0.931, 0.961, 0.961, 0.961, 0.922, 0.961, 0.961, 0.951, 0.922, 0.922, 0.892],
    },
};

/**
 * 角色受伤半宽（相对 body.w/2），t=0 脚底 → t=1 头顶。
 * 按哆啦A梦站立像素轮廓：脑袋接近贴图宽，脚/肚窄很多；忽略左侧小尾巴外凸。
 * 用整张贴图矩形会在脚边提前碰上矮陷阱。
 */
const PLAYER_HURT_HALF = [0.42, 0.50, 0.56, 0.68, 0.90, 0.96, 0.88, 0.70, 0.40];

/** 陷阱左右外沿（相对 e.w/2），t=0 底 → t=1 顶。跟素材不透明轮廓走。 */
const HAZARD_HURT: Record<string, { left: number[]; right: number[] }> = {
    spike: {
        left: [0.94, 0.95, 0.95, 0.81, 0.77, 0.72, 0.65, 0.08],
        right: [0.93, 0.95, 0.95, 0.84, 0.77, 0.72, 0.67, 0.08],
    },
    chainSpike: {
        left: [0.66, 0.74, 0.80, 0.96, 0.72, 0.70, 0.75, 0.69],
        right: [0.65, 0.72, 0.79, 0.96, 0.72, 0.70, 0.75, 0.70],
    },
    wallSpike: {
        left: [0.03, 0.83, 0.40, 0.37, 0.21, 0.19, 0.69, 0.04],
        right: [0.83, 0.91, 0.91, 0.91, 0.91, 0.91, 0.91, 0.75],
    },
    boardSpike: {
        left: [0.26, 0.69, 0.32, 0.79, 0.75, 0.36, 0.59, 0.24],
        right: [0.18, 0.73, 0.34, 0.75, 0.81, 0.32, 0.63, 0.20],
    },
    spear: {
        left: [0.47, 0.51, 0.51, 0.51, 0.51, 0.79, 0.47, 0.05],
        right: [0.47, 0.51, 0.51, 0.51, 0.51, 0.84, 0.47, 0.05],
    },
    arrowDown: {
        left: [0.06, 0.48, 0.85, 0.27, 0.27, 0.27, 0.69, 0.35],
        right: [0.06, 0.56, 0.85, 0.35, 0.31, 0.31, 0.69, 0.06],
    },
    arrowLeft: {
        left: [0.54, 0.69, 0.80, 0.94, 0.90, 0.76, 0.62, 0.41],
        right: [0.08, 0.90, 0.93, 0.89, 0.89, 0.93, 0.92, 0.08],
    },
    arrowRight: {
        left: [0.08, 0.92, 0.93, 0.89, 0.89, 0.93, 0.90, 0.08],
        right: [0.41, 0.62, 0.76, 0.90, 0.94, 0.80, 0.69, 0.54],
    },
};

function sampleProfile(values: readonly number[], t: number): number {
    if (values.length === 0) {
        return 1;
    }
    if (t <= 0) {
        return values[0]!;
    }
    if (t >= 1) {
        return values[values.length - 1]!;
    }
    const x = t * (values.length - 1);
    const i = Math.min(values.length - 2, Math.floor(x));
    const f = x - i;
    return values[i]! * (1 - f) + values[i + 1]! * f;
}

/**
 * 实体类型：
 * - 障碍（贴地面）：木箱 / 大石球 / 岩石 / 水泥 / 石墙 / 油桶
 * - 陷阱：地刺、滚石、箭矢、吊链、侧刺、长矛
 * - 悬浮台：可踩踏平面
 */
export type EntityType =
    | 'box'
    | 'rockBig'
    | 'rockStone'
    | 'concrete'
    | 'stoneWall'
    | 'barrelRed'
    | 'barrelBlue'
    | 'platform'
    | 'spike'
    | 'rock'
    | 'rockCrack'
    | 'chainSpike'
    | 'wallSpike'
    | 'boardSpike'
    | 'spear'
    | 'arrowDown'
    | 'arrowLeft'
    | 'arrowRight'
    | 'coin'
    | 'gem'
    | 'item'
    | 'food'
    | 'chest';

export interface WorldEntity {
    id: number;
    type: EntityType;
    x: number;
    y: number;
    w: number;
    h: number;
    damage?: number;
    gemColor?: 'blue' | 'green' | 'red' | 'purple';
    itemId?: string;
    /** 滚石旋转角（度）；仅滚动陷阱使用 */
    rot?: number;
    /** 悬浮台 1–4；其它变体备用 */
    variant?: string;
    originX?: number;
    originY?: number;
    triggered?: boolean;
    /** 缺省视为 true；箭矢飞出视野后可暂时关闭 */
    active?: boolean;
    disabledUntil?: number;
    chestKind?: ChestKind;
}

export interface RunInput {
    left: boolean;
    right: boolean;
    /** 跳跃边沿触发（按下瞬间） */
    upPressed: boolean;
    /** 上键按住（飞行升） */
    up: boolean;
    down: boolean;
}

export interface RunOutcome {
    level: number;
    success: boolean;
    stars: number;
    score: number;
    hearts: number;
    coins: number;
    gems: Record<'blue' | 'green' | 'red' | 'purple', number>;
    items: string[];
    chests: number;
}

/** 局内瞬时/持续特效剩余时间（对齐 iOS RunGameViewModel） */
export interface RunFx {
    firstAid: number;
    milk: number;
    shieldBreak: number;
    luckySpark: number;
    leapBurst: number;
    vitalityPulse: number;
    /** 滚石撞碎残留 */
    rockShatter: number;
    rockShatterX: number;
    rockShatterY: number;
}

function approach(current: number, target: number, maxDelta: number): number {
    if (current < target) {
        return Math.min(target, current + maxDelta);
    }
    return Math.max(target, current - maxDelta);
}

export class RunWorld {
    readonly groundY = 637 * 0.875;
    readonly cameraAnchorX = 1024 * 0.30;
    readonly visibleWidth = 1024;
    readonly pxPerM = (1024 * 0.7) / 34;

    level: number;
    targetM: number;
    gateX: number;
    gateColor: 'blue' | 'red' | 'purple';

    player = {
        x: 307.2,
        y: 0,
        vy: 0,
        onGround: true,
        jumps: 0,
        hearts: 5,
        energy: 0,
        invincible: 0,
        shield: 0,
        flying: 0,
        shoe: 0,
        leap: 0,
        magnet: 0,
        lucky: 0,
        heroBoost: 0,
        /** 活力饮料持续光效秒数（对齐 iOS vitalityRemaining） */
        vitality: 0,
    };

    cameraX = 0;
    /** 角色头顶越过 HUD 按钮行时上移镜头；未越过时为 0 */
    cameraY = 0;
    distanceM = 0;
    entities: WorldEntity[] = [];
    finished = false;
    success = false;
    stars = 0;
    score = 0;

    /**
     * 通关两段式（对齐 iOS）：
     * 1) `isFinishCameraLocked`：距终点 25m 内锁镜头，角色继续走进大门；
     * 2) `isCompleting`：完整抵达后播 ~2.8s 特效，再置 `finished` 进结算。
     */
    isFinishCameraLocked = false;
    isCompleting = false;
    completionEffectRemaining = 0;
    readonly completionEffectDuration = 2.8;
    completionEffectName = '通关撒花-中上';

    collectedCoins = 0;
    collectedGems: Record<'blue' | 'green' | 'red' | 'purple', number> = { blue: 0, green: 0, red: 0, purple: 0 };
    /** @deprecated 兼容：改为堆叠队列 collectedQuickOrder + counts */
    collectedItems: string[] = [];
    /** 局内拾取快捷栏：按首次拾取顺序；同 id 堆叠（对齐 iOS enqueueCollectedItem） */
    collectedQuickOrder: string[] = [];
    collectedQuickCounts: Record<string, number> = {};
    collectedChests = 0;

    /** 局内提示文案（对齐 iOS effectMessage；超时自动清除） */
    effectMessage: string | null = null;
    private effectMessageTimer = 0;
    /** 提示默认展示秒数 */
    private readonly effectMessageDuration = 2.2;
    effectClock = 0;
    /** 飞行过渡 0–1 / 倾斜 0–1（对齐 flightTransitionProgress / flightTiltProgress） */
    flightBlend = 0;
    flightTilt = 0;
    /** 受伤闪烁剩余秒（非滚石受击） */
    hurtBlink = 0;
    /** 击退 */
    knockbackRemaining = 0;
    knockbackDuration = 0;
    knockbackVelocity = 0;
    knockbackDir = 1;
    /**
     * 滚石倾倒符号（与朝向无关）：+1 = 顶往左倾（Cocos 正角），-1 = 顶往右倾。
     * 滚石从右侧撞来 → +1；从左侧撞来 → -1。
     */
    knockbackTiltSign = 1;
    rockKnockback = false;
    fx: RunFx = {
        firstAid: 0,
        milk: 0,
        shieldBreak: 0,
        luckySpark: 0,
        leapBurst: 0,
        vitalityPulse: 0,
        rockShatter: 0,
        rockShatterX: 0,
        rockShatterY: 0,
    };

    /** 当前出战角色的基础食物（掉落用） */
    basicFoodId: string;
    /** 本关已满星：只掉金币/宝石 */
    private readonly currencyOnly: boolean;
    private selectedCharId: string;
    private pickupCounts = { coin: 0, gem: 0, food: 0, item: 0, chest: 0 };
    private recentDropKinds: Array<'coin' | 'gem' | 'food' | 'item' | 'chest'> = [];
    private gemStreak = 0;
    private lastFlightBootX = -1e9;

    private nextSpawnX: number;
    private readonly rng: LevelRng;
    private nextId = 1;
    private elapsed = 0;
    private vitalityPending: { delay: number; amount: number } | null = null;
    private lastUp = false;
    /** 单帧碰撞体缓存，避免多次 playerBody() */
    private _bodyW = 0;
    private _bodyH = 0;

    /**
     * 能量积攒（相对旧「每拾取 +1 格」放慢）：
     * - 显示仍为 0–5 整格；内部用点数，满 ENERGY_PER_SEGMENT 才 +1 格
     * - 路程：每前进 1m 约 +POINTS_PER_METER（约 70m 路程≈1 格）
     * - 货币／掉落：按价值加点数，一枚金币远不够一格
     * 一局约 350m 且正常拾取时，大约能充满 1～2 次大招。
     */
    private energyPoints = 0;
    private lastEnergyDistM = 0;
    private readonly energyPerSegment = 100;
    private readonly pointsPerMeter = 1.4;
    private readonly energyPickupPoints: Record<string, number> = {
        coin: 10,
        gem_blue: 16,
        gem_green: 24,
        gem_red: 36,
        gem_purple: 28,
        item: 18,
        food: 18,
        chest: 28,
    };

    constructor(level: number, selectedCharacter: string, currencyOnly = false) {
        this.level = level;
        this.currencyOnly = currencyOnly;
        this.selectedCharId = selectedCharacter;
        this.rng = new LevelRng(level);
        this.targetM = 330 + level * 18;
        this.gateX = this.targetM * this.pxPerM;
        this.gateColor = this.rng.pick(['blue', 'red', 'purple'] as const);
        this.refreshBodyCache();
        const effects = [
            '通关撒花-左上',
            '通关撒花-中上',
            '通关烟花-右上',
            '通关撒花-左下',
            '通关烟花-中下',
            '通关烟花-右下',
        ] as const;
        this.completionEffectName = this.rng.pick(effects);
        this.nextSpawnX = 900;
        this.basicFoodId =
            selectedCharacter === 'nobita'
                ? 'honey_muffin'
                : selectedCharacter === 'shizuka'
                    ? 'candy_lollipop'
                    : selectedCharacter === 'dorami'
                        ? 'fresh_orange'
                        : 'mini_dorayaki';
        this.generateCourse();
    }

    /** 设置局内提示，约 2.2s 后自动消失 */
    setEffectMessage(msg: string | null): void {
        // 局内中间提示：控制在 5 字以内（含 5）
        if (msg) {
            const chars = Array.from(msg);
            this.effectMessage = chars.length > 5 ? chars.slice(0, 5).join('') : msg;
            this.effectMessageTimer = this.effectMessageDuration;
        } else {
            this.effectMessage = null;
            this.effectMessageTimer = 0;
        }
    }

    get baseSpeed(): number {
        return 320 + this.level * 5;
    }

    get speedMul(): number {
        let m = 1;
        if (this.player.shoe > 0) m *= 1.3;
        if (this.player.leap > 0) m *= 1.2;
        if (this.player.heroBoost > 0) m *= 1.35;
        return m;
    }

    get jumpMul(): number {
        return this.player.leap > 0 ? 1.2 : 1;
    }

    /** 受伤闪烁透明度（对齐 playerDamageOpacity） */
    get damageOpacity(): number {
        if (this.hurtBlink <= 0) {
            return 1;
        }
        return Math.floor(this.effectClock * 15) % 2 === 0 ? 0.22 : 1;
    }

    /** 滚石击退视觉位移（点）：撞击瞬间满偏移，再收回 */
    get knockbackVisualOffset(): number {
        if (!this.rockKnockback || this.knockbackDuration <= 0 || this.knockbackRemaining <= 0) {
            return 0;
        }
        const progress = 1 - this.knockbackRemaining / this.knockbackDuration;
        return this.knockbackDir * Math.cos((progress * Math.PI) / 2) * 18;
    }

    /**
     * 滚石击退倾斜角（度）。Cocos 正角=逆时针=头顶往左。
     * 只认撞击来向，不认角色朝向：右撞→左倾，左撞→右倾。
     */
    get knockbackTiltDegrees(): number {
        if (!this.rockKnockback || this.knockbackDuration <= 0 || this.knockbackRemaining <= 0) {
            return 0;
        }
        const progress = 1 - this.knockbackRemaining / this.knockbackDuration;
        return this.knockbackTiltSign * Math.cos((progress * Math.PI) / 2) * 38;
    }

    update(dt: number, input: RunInput): void {
        if (this.finished) {
            return;
        }
        // 通关特效阶段：锁场景，只倒数，结束后再 finished（对齐 iOS isCompleting）
        if (this.isCompleting) {
            this.elapsed += dt;
            this.effectClock += dt;
            this.completionEffectRemaining = Math.max(0, this.completionEffectRemaining - dt);
            if (this.completionEffectRemaining <= 0) {
                this.finalizeSuccess();
            }
            return;
        }
        this.elapsed += dt;
        this.effectClock += dt;
        this.tickTimers(dt);

        const p = this.player;
        const flying = p.flying > 0;
        this.flightBlend = approach(this.flightBlend, flying ? 1 : 0, dt / (flying ? 0.55 : 0.38));
        this.flightTilt = approach(
            this.flightTilt,
            flying && (input.left || input.right) ? 1 : 0,
            dt / 0.28,
        );
        this.refreshBodyCache();

        const speed = this.baseSpeed * this.speedMul;
        const dir = (input.left ? -1 : 0) + (input.right ? 1 : 0);
        const control = this.knockbackRemaining > 0 ? 0.22 : 1;
        const distBefore = this.distanceM;

        if (flying) {
            // 飞行无视地面固体阻挡（对齐 iOS obstacleConstrainedDistance guard）
            p.x += dir * speed * 1.25 * dt * control;
            if (this.knockbackRemaining > 0) {
                p.x += this.knockbackVelocity * dt;
            }
            const rise = (input.up ? 1 : 0) - (input.down ? 1 : 0);
            p.y += rise * 320 * dt;
            p.y = Math.max(0, Math.min(560, p.y));
            p.vy = 0;
            p.onGround = p.y <= 0;
            p.jumps = 0;
        } else {
            const fromX = p.x;
            let toX = fromX + dir * speed * dt * control;
            if (this.knockbackRemaining > 0) {
                toX += this.knockbackVelocity * dt;
            }
            p.x = this.constrainSolidX(fromX, toX);

            const prevY = p.y;
            p.vy -= 2400 * dt;
            p.y += p.vy * dt;
            this.bounceOnCeilings(prevY);
            this.landOnSolids(prevY);
            if (p.y <= 0) {
                p.y = 0;
                p.vy = 0;
                p.onGround = true;
                p.jumps = 0;
            }
            // 二段跳需「松开再按」（对齐 iOS）
            if (input.upPressed && !this.lastUp) {
                if (p.onGround || p.jumps < 2) {
                    const airScale = p.onGround ? 1 : 0.7071;
                    p.vy = 950 * this.jumpMul * airScale;
                    p.onGround = false;
                    p.jumps++;
                    if (p.leap > 0) {
                        this.fx.leapBurst = 0.45;
                    }
                }
            }
            this.resolveSolidContacts();
        }
        this.lastUp = input.upPressed;

        if (this.knockbackRemaining > 0) {
            this.knockbackVelocity *= Math.exp(-4.2 * dt);
            this.knockbackRemaining = Math.max(0, this.knockbackRemaining - dt);
            if (this.knockbackRemaining <= 0) {
                this.knockbackVelocity = 0;
                this.rockKnockback = false;
            }
        }

        // 不可越过终点；贴齐终点时强制距离=目标，避免 float 导致永远差 0.00x 米通不了关
        // distanceM = 本关最远推进（只增不减）；得分/能量只认这段「新开拓」距离
        p.x = Math.max(0, Math.min(this.gateX, p.x));
        if (p.x >= this.gateX - 0.5) {
            p.x = this.gateX;
            this.distanceM = this.targetM;
        } else {
            this.distanceM = Math.min(this.targetM, Math.max(this.distanceM, p.x / this.pxPerM));
        }

        // 路程贡献能量（仅净前进）
        this.gainEnergyFromDistance();

        // 得分：按本关通过的新距离计，不按「当前是否在往右走」
        // 往回走再往右，未超过历史最远不加分；越过最远后才继续加
        const gainedM = this.distanceM - distBefore;
        if (gainedM > 0) {
            this.score += Math.floor(gainedM * 2 * 60);
        }

        // 终点前 25m 锁镜头：大门完整入镜后角色继续走进门（对齐 iOS）
        if (!this.isFinishCameraLocked) {
            this.cameraX = Math.max(0, p.x - this.cameraAnchorX);
            if (this.distanceM >= this.targetM - 25) {
                this.isFinishCameraLocked = true;
            }
        }
        this.updateCameraY(dt);

        this.updateHazards(dt);
        this.cullBehindCamera();
        this.applyMagnet(dt);
        this.resolvePickups();
        this.resolveObstacles();

        // 抵达终点（含浮点容差）→ 通关特效 → 结算
        if (this.distanceM >= this.targetM - 1e-4 || p.x >= this.gateX - 0.5) {
            this.beginCompletionSequence();
        }
        if (p.hearts <= 0) {
            this.finish(false);
        }
    }

    /** 抵达终点：锁镜头 + 播特效倒计时，尚未 finished（对齐 iOS beginCompletionSequence） */
    private beginCompletionSequence(): void {
        if (this.isCompleting || this.finished) {
            return;
        }
        this.isFinishCameraLocked = true;
        this.isCompleting = true;
        this.success = true;
        this.completionEffectRemaining = this.completionEffectDuration;
        this.setEffectMessage(null);
    }

    /** 特效播完：写星级／最终分并标记 finished，供页面 settle */
    private finalizeSuccess(): void {
        if (this.finished) {
            return;
        }
        this.finished = true;
        this.success = true;
        this.isCompleting = false;
        this.applySuccessScoreAndStars();
    }

    private applySuccessScoreAndStars(): void {
        const gemScore =
            this.collectedGems.blue * 5 +
            this.collectedGems.green * 12 +
            this.collectedGems.red * 25 +
            this.collectedGems.purple * 10;
        // 局内已累计移动分（对齐 iOS 前进加分）；再叠拾取加分
        this.score +=
            this.collectedCoins +
            gemScore +
            this.collectedItems.length * 5 +
            this.collectedChests * 20;
        // 星级：得分 / (目标距离×7) + 血心（对齐 iOS stars）
        const ratio = this.score / Math.max(1, this.targetM * 7);
        this.stars =
            ratio > 1.05 && this.player.hearts >= 4 ? 3 : ratio > 0.65 ? 2 : 1;
    }

    /** 使用携带/拾取道具；返回提示文案（≤5 字） */
    useItem(itemId: string): string | null {
        if (this.isCompleting || this.finished) {
            return null;
        }
        const p = this.player;
        switch (itemId) {
            case 'first_aid':
                this.heal(3);
                this.fx.firstAid = 0.8;
                this.fx.vitalityPulse = 0.28;
                return '急救回血';
            case 'vitality_drink':
                this.heal(1);
                p.vitality = 5;
                this.fx.vitalityPulse = 0.32;
                this.vitalityPending = { delay: 2.5, amount: 1 };
                return '活力回血';
            case 'lucky_drink':
                p.lucky = 20;
                return '幸运加成';
            case 'leap_drink':
                p.leap = 15;
                this.fx.leapBurst = 0.4;
                return '飞跃增强';
            case 'magnet':
                p.magnet = 20;
                return '磁铁吸附';
            case 'shield':
                p.shield += 1;
                return '获得护盾';
            case 'speed_shoes':
                p.shoe = 15;
                return '极速跑鞋';
            case 'flight_boots':
                p.flying = 10;
                if (p.y < 80) {
                    p.y = 120;
                }
                return '飞行启动';
            case 'energy_milk':
                this.heal(1);
                this.fx.milk = 0.6;
                return '牛奶回血';
            default: {
                const it = itemById(itemId);
                if (it?.category === 'food') {
                    const heal = it.buyPrice === 40 ? 1 : it.buyPrice === 80 ? 2 : 3;
                    this.heal(heal);
                    return '食物回血';
                }
                this.heal(1);
                return '使用道具';
            }
        }
    }

    /** 能量大招（总结 §2.5）；返回提示（≤5 字） */
    activateEnergy(characterId: string): string {
        const p = this.player;
        if (p.energy < 5 || this.finished || this.isCompleting) {
            this.setEffectMessage('能量未满');
            return this.effectMessage!;
        }
        p.energy = 0;
        this.energyPoints = 0;
        if (characterId === 'doraemon') {
            p.flying = 10;
            if (p.y < 80) {
                p.y = 120;
            }
            this.setEffectMessage('能量飞行');
        } else if (characterId === 'nobita') {
            p.heroBoost = 12;
            this.setEffectMessage('勇气加速');
        } else if (characterId === 'shizuka') {
            this.heal(2);
            p.shield += 1;
            this.setEffectMessage('甜心守护');
        } else if (characterId === 'dorami') {
            p.magnet = 12;
            p.lucky = 12;
            this.setEffectMessage('幸运磁力');
        } else {
            p.shield += 1;
            this.setEffectMessage('能量护盾');
        }
        return this.effectMessage!;
    }

    /** 失败立即结束；成功请走 beginCompletionSequence → finalizeSuccess */
    finish(success: boolean): void {
        if (this.finished || this.isCompleting) {
            return;
        }
        if (success) {
            this.beginCompletionSequence();
            return;
        }
        this.finished = true;
        this.success = false;
        this.stars = 0;
        const gemScore =
            this.collectedGems.blue * 5 +
            this.collectedGems.green * 12 +
            this.collectedGems.red * 25 +
            this.collectedGems.purple * 10;
        this.score +=
            this.collectedCoins +
            gemScore +
            this.collectedItems.length * 5 +
            this.collectedChests * 20;
    }

    outcome(): RunOutcome {
        return {
            level: this.level,
            success: this.success,
            stars: this.stars,
            score: this.score,
            hearts: this.player.hearts,
            coins: this.collectedCoins,
            gems: { ...this.collectedGems },
            items: [...this.collectedItems],
            chests: this.collectedChests,
        };
    }

    private tickTimers(dt: number): void {
        const p = this.player;
        p.invincible = Math.max(0, p.invincible - dt);
        p.flying = Math.max(0, p.flying - dt);
        p.shoe = Math.max(0, p.shoe - dt);
        p.leap = Math.max(0, p.leap - dt);
        p.magnet = Math.max(0, p.magnet - dt);
        p.lucky = Math.max(0, p.lucky - dt);
        p.heroBoost = Math.max(0, p.heroBoost - dt);
        p.vitality = Math.max(0, p.vitality - dt);
        this.hurtBlink = Math.max(0, this.hurtBlink - dt);
        if (this.effectMessageTimer > 0) {
            this.effectMessageTimer = Math.max(0, this.effectMessageTimer - dt);
            if (this.effectMessageTimer <= 0) {
                this.effectMessage = null;
            }
        }
        const fx = this.fx;
        fx.firstAid = Math.max(0, fx.firstAid - dt);
        fx.milk = Math.max(0, fx.milk - dt);
        fx.shieldBreak = Math.max(0, fx.shieldBreak - dt);
        fx.luckySpark = Math.max(0, fx.luckySpark - dt);
        fx.leapBurst = Math.max(0, fx.leapBurst - dt);
        fx.vitalityPulse = Math.max(0, fx.vitalityPulse - dt);
        fx.rockShatter = Math.max(0, fx.rockShatter - dt);
        if (this.vitalityPending) {
            this.vitalityPending.delay -= dt;
            if (this.vitalityPending.delay <= 0) {
                this.heal(this.vitalityPending.amount);
                this.fx.vitalityPulse = 0.32;
                this.vitalityPending = null;
            }
        }
    }

    private heal(amount: number): void {
        this.player.hearts = Math.min(5, this.player.hearts + amount);
    }

    /**
     * 头顶越过 HUD 导航按钮行（设计 y≈114）时镜头上移；
     * 回到该线以下则平滑回落到地面机位。
     */
    private updateCameraY(dt: number): void {
        const hudKeepFromTop = 114;
        const maxHead = this.groundY - hudKeepFromTop;
        const head = this.player.y + this._bodyH;
        const desired = Math.max(0, head - maxHead);
        this.cameraY = approach(this.cameraY, desired, dt * 520);
    }

    /**
     * 滚动陷阱、下落/平移陷阱、周期长矛（对齐 iOS updateHazards）。
     * `rockBig` 仍为静态障碍，不在此滚动。
     */
    private updateHazards(dt: number): void {
        const p = this.player;
        for (const e of this.entities) {
            if (e.active === false && e.disabledUntil != null && this.elapsed < e.disabledUntil) {
                continue;
            }
            if (e.type === 'rock' || e.type === 'rockCrack') {
                const engage = e.x - p.x < 42 * this.pxPerM;
                if (engage) {
                    this.rollRock(e, e.type === 'rockCrack' ? 6.0 : 5.6, dt);
                }
                continue;
            }
            const phase = this.elapsed + (e.originX ?? e.x) * 0.07;
            switch (e.type) {
                case 'chainSpike':
                case 'arrowDown':
                    this.updateDropOnce(
                        e,
                        dt,
                        e.type === 'chainSpike' ? 2.4 : 1.4,
                        e.type === 'chainSpike' ? 1.15 * 637 : 1.9 * 637,
                    );
                    break;
                case 'wallSpike':
                    e.x = (e.originX ?? e.x) + Math.sin(phase * 2.4) * 1.4 * this.pxPerM;
                    e.active = true;
                    break;
                case 'boardSpike':
                    e.x = (e.originX ?? e.x) + Math.sin(phase * 2.4) * 1.4 * this.pxPerM;
                    e.active = true;
                    break;
                case 'spear': {
                    // 刺出后矛底高于站立身高 120，可从下方跑过；收回贴地后可跳过
                    const origin = e.originY ?? 0;
                    e.y = origin + Math.max(0, Math.sin(phase * 2.8)) * 180;
                    e.active = true;
                    break;
                }
                case 'arrowLeft':
                    this.updateHorizontalArrow(e, -1, dt);
                    break;
                case 'arrowRight':
                    this.updateHorizontalArrow(e, 1, dt);
                    break;
                default:
                    break;
            }
        }
    }

    /**
     * 下落类：先停在画面顶部；玩家经过正下方后按固定速度落一次。
     * 箭矢落地后消失；吊链落地后停住（对齐 iOS updateDropOnceHazard）。
     */
    private updateDropOnce(e: WorldEntity, dt: number, triggerM: number, fallSpeed: number): void {
        if (!e.triggered) {
            e.y = (e.originY ?? 470) + this.cameraY;
            e.active = true;
            if (Math.abs(e.x - this.player.x) <= triggerM * this.pxPerM) {
                e.triggered = true;
            }
            return;
        }
        e.active = true;
        if (e.y <= 0) {
            e.y = 0;
            if (e.type === 'arrowDown') {
                e.active = false;
                e.y = -999;
            }
            return;
        }
        e.y -= fallSpeed * dt;
        if (e.y <= 0) {
            e.y = 0;
            if (e.type === 'arrowDown') {
                e.active = false;
                e.y = -999;
            }
        }
    }

    /**
     * 横向箭矢从画面一侧边缘射出，飞完整段可视区后从对侧消失，1.2s 后再射
     * （对齐 iOS updateHorizontalArrow：camera 左右沿 + 1.6m 边距，速度 29m/s）。
     */
    private updateHorizontalArrow(e: WorldEntity, direction: number, dt: number): void {
        if (e.disabledUntil != null && this.elapsed < e.disabledUntil) {
            e.active = false;
            return;
        }
        const pad = 1.6 * this.pxPerM;
        const leftEdge = this.cameraX;
        const rightEdge = this.cameraX + this.visibleWidth;
        if (!e.triggered) {
            if (Math.abs((e.originX ?? e.x) - this.player.x) > 12 * this.pxPerM) {
                e.active = false;
                return;
            }
            e.triggered = true;
            e.active = true;
            e.x = direction > 0 ? leftEdge - pad : rightEdge + pad;
            e.y = e.originY ?? 64;
        }
        e.active = true;
        e.x += direction * 29 * this.pxPerM * dt;
        const passed = direction > 0 ? e.x > rightEdge + pad : e.x < leftEdge - pad;
        if (passed || this.arrowHitSolid(e)) {
            e.active = false;
            e.x = e.originX ?? e.x;
            e.y = e.originY ?? e.y;
            e.triggered = false;
            e.disabledUntil = this.elapsed + 1.2;
        }
    }

    private arrowHitSolid(arrow: WorldEntity): boolean {
        const aLeft = arrow.x - arrow.w / 2;
        const aRight = arrow.x + arrow.w / 2;
        const aBot = arrow.y;
        const aTop = arrow.y + arrow.h;
        for (const e of this.entities) {
            if (e.id === arrow.id) {
                continue;
            }
            const rock = e.type === 'rock' || e.type === 'rockCrack';
            if (!this.isSolid(e) && !rock) {
                continue;
            }
            const left = e.x - e.w / 2;
            const right = e.x + e.w / 2;
            const bot = e.y;
            const top = e.y + e.h;
            if (aRight < left || aLeft > right || aTop < bot || aBot > top) {
                continue;
            }
            return true;
        }
        return false;
    }

    private rollRock(e: WorldEntity, speedMps: number, dt: number): void {
        const speed = speedMps * this.pxPerM;
        e.x -= speed * dt;
        const radius = Math.min(e.w, e.h) * 0.5;
        // 向左滚 → 逆时针（Cocos Z 正角为逆时针）
        e.rot = (e.rot ?? 0) + ((speed * dt) / Math.max(1, radius)) * (180 / Math.PI);
    }

    /**
     * 受击反馈：
     * - 滚石：较长击退 + 立即倾斜 + 扣血闪烁
     * - 其它机关：短击退 + 受伤闪烁
     * @param hitFromRight 滚石是否从角色右侧撞来（仅滚石有效）
     */
    private beginDamageFeedback(
        kind: 'rock' | 'rockCrack' | 'other',
        knockDir: number,
        hitFromRight = false,
    ): void {
        this.knockbackDir = knockDir;
        this.rockKnockback = kind === 'rock' || kind === 'rockCrack';
        // 倾倒只看来向：右侧撞来 → 往左倾(+1)；左侧撞来 → 往右倾(-1)
        this.knockbackTiltSign = this.rockKnockback ? (hitFromRight ? 1 : -1) : 1;
        if (this.rockKnockback) {
            this.knockbackDuration = 0.72;
            this.knockbackVelocity = knockDir * 6.2 * this.pxPerM;
            this.hurtBlink = 1.0;
            this.setEffectMessage('滚石击退');
        } else {
            this.knockbackDuration = 0.26;
            this.knockbackVelocity = knockDir * 2.4 * this.pxPerM;
            this.hurtBlink = 1.0;
            this.setEffectMessage('触发机关');
        }
        this.knockbackRemaining = this.knockbackDuration;
    }

    /** 石球圆形碰撞：半径贴合素材圆，角色一侧用脚/身轮廓而不是整张矩形 */
    private playerTouchesRock(e: WorldEntity): boolean {
        const p = this.player;
        const body = this.playerBody();
        const radius = Math.min(e.w, e.h) * 0.5;
        const centerX = e.x;
        const centerY = e.y + e.h * 0.5;
        const y0 = Math.max(p.y, e.y);
        const y1 = Math.min(p.y + body.h, e.y + e.h);
        if (y1 <= y0) {
            return false;
        }
        const steps = Math.max(6, Math.min(16, Math.ceil((y1 - y0) / 4)));
        const r2 = radius * radius;
        for (let i = 0; i <= steps; i++) {
            const y = y0 + ((y1 - y0) * i) / steps;
            const t = (y - p.y) / Math.max(1, body.h);
            const half = sampleProfile(PLAYER_HURT_HALF, t) * body.w * 0.5;
            const closestX = Math.min(Math.max(centerX, p.x - half), p.x + half);
            const dx = closestX - centerX;
            const dy = y - centerY;
            if (dx * dx + dy * dy <= r2) {
                return true;
            }
        }
        return false;
    }

    /** 该高度角色受伤左右沿（世界坐标） */
    private playerHurtXAt(y: number): { left: number; right: number } | null {
        const p = this.player;
        const body = this.playerBody();
        if (y < p.y || y > p.y + body.h) {
            return null;
        }
        const t = (y - p.y) / Math.max(1, body.h);
        const half = sampleProfile(PLAYER_HURT_HALF, t) * body.w * 0.5;
        return { left: p.x - half, right: p.x + half };
    }

    /** 该高度陷阱受伤左右沿（世界坐标） */
    private hazardHurtXAt(e: WorldEntity, y: number): { left: number; right: number } | null {
        if (y < e.y || y > e.y + e.h) {
            return null;
        }
        const t = (y - e.y) / Math.max(1, e.h);
        const shape = HAZARD_HURT[e.type];
        const halfW = e.w * 0.5;
        if (!shape) {
            return { left: e.x - halfW * 0.88, right: e.x + halfW * 0.88 };
        }
        return {
            left: e.x - sampleProfile(shape.left, t) * halfW,
            right: e.x + sampleProfile(shape.right, t) * halfW,
        };
    }

    /**
     * 陷阱伤害：按贴图像素轮廓分层相交，必须视觉上碰上才扣血。
     * 地刺底座几乎铺满框，角色脚却比脑袋窄一截——旧 AABB 会在空隙里提前判定。
     */
    private playerTouchesHazard(e: WorldEntity): boolean {
        if (e.active === false) {
            return false;
        }
        if (e.type === 'rock' || e.type === 'rockCrack') {
            return this.playerTouchesRock(e);
        }
        const p = this.player;
        const body = this.playerBody();
        const y0 = Math.max(p.y, e.y);
        const y1 = Math.min(p.y + body.h, e.y + e.h);
        if (y1 <= y0) {
            return false;
        }
        const steps = Math.max(6, Math.min(16, Math.ceil((y1 - y0) / 4)));
        for (let i = 0; i <= steps; i++) {
            const y = y0 + ((y1 - y0) * i) / steps;
            const player = this.playerHurtXAt(y);
            const hazard = this.hazardHurtXAt(e, y);
            if (!player || !hazard) {
                continue;
            }
            if (player.left < hazard.right && player.right > hazard.left) {
                return true;
            }
        }
        return false;
    }

    /**
     * 整关一次生成（固定种子）：前 5 关偏简单，之后逐步解锁箭矢/吊链/侧刺等，
     * 并穿插必须跳上悬浮台再二段跳才能拿到的奖励。
     */
    private generateCourse(): void {
        const clearBeforeGate = 16 * this.pxPerM;
        const spawnLimit = this.gateX - clearBeforeGate;
        let x = 22 * this.pxPerM;
        let segment = 0;
        const platEvery = this.platformEvery();
        const platOffset = 2 + this.rng.int(Math.max(1, platEvery - 1));
        let prevHazard: EntityType | null = null;

        while (x < spawnLimit) {
            const segLen = (13.2 + this.rng.float() * 5.2) * this.pxPerM;
            const isPlat = this.level >= 3 && segment >= platOffset && (segment - platOffset) % platEvery === 0;
            const nextIsPlat =
                this.level >= 3 &&
                segment + 1 >= platOffset &&
                (segment + 1 - platOffset) % platEvery === 0;

            if (isPlat) {
                this.spawnPlatformSegment(x);
            } else {
                this.spawnPickup(x);
            }

            if (
                !isPlat &&
                !nextIsPlat &&
                this.rng.float() * 100 < this.featureChance() &&
                x + segLen * 0.62 < spawnLimit
            ) {
                prevHazard = this.spawnLevelFeature(x + segLen * 0.5, prevHazard);
                if (this.level >= 11 && this.rng.float() < 0.42 && x + segLen * 0.78 < spawnLimit) {
                    prevHazard = this.spawnLevelFeature(x + segLen * 0.78, prevHazard);
                }
            }

            segment += 1;
            x += segLen;
        }
        this.placeGuaranteedFeatures(spawnLimit);
        this.resolveStaticOverlaps();
        this.nextSpawnX = this.gateX + 100;
    }

    /** 每关至少出现主障碍；6 关后强制出现箭矢/长矛/吊链等，避免随机漏掉 */
    private placeGuaranteedFeatures(limit: number): void {
        const start = 36 * this.pxPerM;
        const span = Math.max(280, limit - start - 40 * this.pxPerM);
        this.placeObstacle(this.primaryObstacle(), start + span * 0.16, 0);
        if (this.level >= 2) {
            const extra = this.unlockedObstacles().filter((t) => t !== this.primaryObstacle());
            if (extra.length > 0) {
                this.placeObstacle(extra[this.rng.int(extra.length)]!, start + span * 0.28, 0);
            }
        }
        if (this.level < 6) {
            return;
        }
        const must: EntityType[] = ['spear', 'arrowLeft'];
        if (this.level >= 8) {
            must.push('boardSpike', 'arrowRight');
        }
        if (this.level >= 10) {
            must.push('arrowDown', 'wallSpike', 'chainSpike');
        }
        must.forEach((t, i) => {
            const x = start + span * (0.4 + i * 0.07);
            if (x < limit) {
                this.placeHazard(t, x, this.hazardRestY(t));
            }
        });
    }

    private platformEvery(): number {
        if (this.level <= 5) {
            return 7;
        }
        if (this.level <= 10) {
            return 5;
        }
        if (this.level <= 15) {
            return 4;
        }
        return 3;
    }

    /** 前 5 关更疏；之后随关卡加密 */
    private featureChance(): number {
        if (this.level <= 5) {
            return 28 + this.level * 3;
        }
        return Math.min(78, 42 + this.level * 2);
    }

    private unlockedObstacles(): EntityType[] {
        const all: EntityType[] = ['box'];
        if (this.level >= 2) all.push('rockStone');
        if (this.level >= 3) all.push('barrelBlue');
        if (this.level >= 4) all.push('concrete');
        if (this.level >= 5) all.push('barrelRed');
        if (this.level >= 6) {
            all.push('stoneWall');
            all.push('rockBig');
        }
        return all;
    }

    /** 每关主障碍：提高该关辨识度 */
    private primaryObstacle(): EntityType {
        const cycle: EntityType[] = [
            'box',
            'rockStone',
            'barrelBlue',
            'concrete',
            'barrelRed',
            'stoneWall',
            'rockBig',
            'barrelBlue',
            'rockStone',
            'stoneWall',
            'concrete',
            'barrelRed',
            'rockBig',
            'stoneWall',
            'box',
            'rockStone',
            'concrete',
            'barrelRed',
            'stoneWall',
            'rockBig',
        ];
        return cycle[Math.max(0, Math.min(19, this.level - 1))]!;
    }

    private unlockedHazards(): EntityType[] {
        const list: EntityType[] = ['spike'];
        if (this.level >= 3) {
            list.push('rock');
        }
        if (this.level >= 5) {
            list.push('rockCrack');
        }
        if (this.level >= 6) {
            list.push('spear');
            list.push('arrowLeft');
        }
        if (this.level >= 8) {
            list.push('arrowRight');
            list.push('boardSpike');
        }
        if (this.level >= 10) {
            list.push('arrowDown');
            list.push('wallSpike');
            list.push('chainSpike');
        }
        return list;
    }

    private spawnLevelFeature(x: number, prev: EntityType | null): EntityType {
        const obstacles = this.unlockedObstacles();
        const hazards = this.unlockedHazards();
        const wantObstacle = this.rng.float() < (this.level <= 5 ? 0.55 : 0.38);
        if (wantObstacle && obstacles.length > 0) {
            let type = this.rng.float() < 0.7 ? this.primaryObstacle() : obstacles[this.rng.int(obstacles.length)]!;
            if (!obstacles.includes(type)) {
                type = obstacles[this.rng.int(obstacles.length)]!;
            }
            this.placeObstacle(type, x, 0);
            return type;
        }
        let type = hazards[this.rng.int(hazards.length)]!;
        if (type === prev && hazards.length > 1) {
            type = hazards[(hazards.indexOf(type) + 1) % hazards.length]!;
        }
        this.placeHazard(type, x, this.hazardRestY(type));
        return type;
    }

    private hazardRestY(type: EntityType): number {
        switch (type) {
            case 'chainSpike':
            case 'arrowDown':
                return 470;
            case 'wallSpike':
            case 'boardSpike':
                return 0;
            case 'arrowLeft':
            case 'arrowRight':
                return 64;
            default:
                return 0;
        }
    }

    private hazardDamage(type: EntityType): number {
        return type === 'chainSpike' ? 2 : 1;
    }

    private shiftClearOfPlatforms(x: number): number | null {
        let cur = x;
        for (let n = 0; n < 10; n++) {
            let bump = 0;
            for (const e of this.entities) {
                if (e.type !== 'platform') {
                    continue;
                }
                const minDist = e.w * 0.5 + 220;
                const d = Math.abs(e.x - cur);
                if (d < minDist) {
                    bump = Math.max(bump, minDist - d + 36);
                }
            }
            if (bump <= 0) {
                return cur;
            }
            cur += bump;
        }
        return null;
    }

    private placeObstacle(type: EntityType, x: number, y: number): void {
        const at = y <= 6 ? this.shiftClearOfPlatforms(x) : x;
        if (at == null) {
            return;
        }
        const sz = entityVisualSize({ type });
        const clear = this.findClearX(at, y, sz.w, sz.h, type);
        this.addEntity({ type, x: clear, y, w: sz.w, h: sz.h, originX: clear, originY: y });
    }

    private placeHazard(type: EntityType, x: number, y: number): void {
        const at = y <= 6 ? this.shiftClearOfPlatforms(x) : x;
        if (at == null) {
            return;
        }
        const sz = entityVisualSize({ type });
        const rolling = type === 'rock' || type === 'rockCrack';
        const clear = this.findClearX(at, y, sz.w, sz.h, type);
        this.addEntity({
            type,
            x: clear,
            y,
            w: sz.w,
            h: sz.h,
            damage: this.hazardDamage(type),
            rot: rolling ? 0 : undefined,
            originX: clear,
            originY: y,
            triggered: false,
            active: true,
        });
    }

    private isPickupEntity(e: WorldEntity): boolean {
        return e.type === 'coin' || e.type === 'gem' || e.type === 'item' || e.type === 'food' || e.type === 'chest';
    }

    private restsOnPlatform(item: WorldEntity, plat: WorldEntity): boolean {
        if (plat.type !== 'platform' || !this.isPickupEntity(item)) {
            return false;
        }
        const top = this.surfaceTop(plat);
        return item.y + 2 >= top && Math.abs(item.x - plat.x) <= plat.w * 0.55 + item.w * 0.5;
    }

    private aabbsOverlap(a: WorldEntity, b: WorldEntity, pad: number): boolean {
        const aL = a.x - a.w / 2 - pad;
        const aR = a.x + a.w / 2 + pad;
        const aB = a.y;
        const aT = a.y + a.h;
        const bL = b.x - b.w / 2;
        const bR = b.x + b.w / 2;
        const bB = b.y;
        const bT = b.y + b.h;
        return aL < bR && aR > bL && aB < bT && aT > bB;
    }

    /** 金币串之间只留小缝；货币/障碍/陷阱之间必须完全错开 */
    private overlapPad(a: WorldEntity, b: WorldEntity): number {
        if (this.isPickupEntity(a) && this.isPickupEntity(b)) {
            return 6;
        }
        return 24;
    }

    private skipOverlapPair(a: WorldEntity, b: WorldEntity): boolean {
        if (a.active === false || b.active === false) {
            return true;
        }
        return this.restsOnPlatform(a, b) || this.restsOnPlatform(b, a);
    }

    /** 把 x 往右推到不与已有实体重叠（滚石开局也不能压住货币） */
    private findClearX(x: number, y: number, w: number, h: number, type: EntityType = 'box'): number {
        const dummy: WorldEntity = {
            id: -1,
            type,
            x,
            y,
            w,
            h,
        };
        let cur = x;
        for (let n = 0; n < 24; n++) {
            dummy.x = cur;
            let bump = 0;
            for (const e of this.entities) {
                if (this.skipOverlapPair(dummy, e)) {
                    continue;
                }
                const pad = this.overlapPad(dummy, e);
                if (!this.aabbsOverlap(dummy, e, pad)) {
                    continue;
                }
                bump = Math.max(bump, e.x + e.w / 2 + w / 2 + pad - cur + 2);
            }
            if (bump <= 0) {
                return cur;
            }
            cur += bump;
        }
        return cur;
    }

    /**
     * 从左到右只往前挤，避免障碍物在金币和食物之间来回推仍叠在一起。
     * 滚石之后滚动时仍可从物体上经过。
     */
    private resolveStaticOverlaps(): void {
        const arr = this.entities;
        for (let pass = 0; pass < 28; pass++) {
            const order = arr.map((_, i) => i).sort((ia, ib) => arr[ia]!.x - arr[ib]!.x);
            let moved = false;
            for (let a = 0; a < order.length; a++) {
                for (let b = a + 1; b < order.length; b++) {
                    const left = arr[order[a]!]!;
                    const right = arr[order[b]!]!;
                    if (this.skipOverlapPair(left, right)) {
                        continue;
                    }
                    const pad = this.overlapPad(left, right);
                    if (!this.aabbsOverlap(left, right, pad)) {
                        continue;
                    }
                    const gap = left.w / 2 + right.w / 2 + pad;
                    if (right.type === 'platform') {
                        if (left.type === 'platform') {
                            continue;
                        }
                        const nx = right.x - gap;
                        if (left.x > nx) {
                            left.x = nx;
                            if (left.originX != null) {
                                left.originX = left.x;
                            }
                            moved = true;
                        }
                        continue;
                    }
                    const nx = left.x + gap;
                    if (right.x < nx) {
                        right.x = nx;
                        if (right.originX != null) {
                            right.originX = right.x;
                        }
                        moved = true;
                    }
                }
            }
            if (!moved) {
                break;
            }
        }
    }

    private spawnPlatformSegment(x: number): void {
        const variant = `${1 + this.rng.int(4)}`;
        const sz = entityVisualSize({ type: 'platform', variant });
        const py = 118 + this.rng.int(46);
        this.addEntity({ type: 'platform', x, y: py, w: sz.w, h: sz.h, variant, originX: x, originY: py });
        const plat = this.entities[this.entities.length - 1]!;
        const top = this.surfaceTop(plat);
        const coins = 2 + this.rng.int(3);
        const spread = Math.max(40, (sz.w - 36) / Math.max(1, coins - 1));
        for (let i = 0; i < coins; i++) {
            const ox = x + (i - (coins - 1) / 2) * spread;
            const csz = entityVisualSize({ type: 'coin' });
            this.addEntity({ type: 'coin', x: ox, y: top + 4, w: csz.w, h: csz.h });
        }
        // 台上再跳一次才能拿到：高度超过地面一段跳触及范围（约 317）
        if (this.level >= 5 && this.rng.float() < 0.62) {
            const highY = Math.max(338, top + 128) + this.rng.int(28);
            const caps = this.pickupCaps();
            if (this.currencyOnly || this.pickupCounts.item >= caps.item) {
                if (this.pickupCounts.gem < caps.gem) {
                    const c = this.rollGemColor();
                    const gsz = entityVisualSize({ type: 'gem', gemColor: c });
                    this.addEntity({ type: 'gem', x, y: highY, w: gsz.w, h: gsz.h, gemColor: c });
                    this.noteDrop('gem');
                }
            } else if (this.rng.float() < 0.55) {
                const c = this.rollGemColor();
                const gsz = entityVisualSize({ type: 'gem', gemColor: c });
                this.addEntity({ type: 'gem', x, y: highY, w: gsz.w, h: gsz.h, gemColor: c });
                this.noteDrop('gem');
            } else {
                const itemId = this.rollUtilityId(x);
                if (itemId) {
                    const isz = entityVisualSize({ type: 'item', itemId });
                    this.addEntity({ type: 'item', x, y: highY, w: isz.w, h: isz.h, itemId });
                    this.noteDrop('item');
                    if (itemId === 'flight_boots') {
                        this.lastFlightBootX = x;
                    }
                }
            }
        }
    }

    private spawnPickup(x: number): void {
        // 判断点：先决定是否掉落（约 78%），再按设计大类概率抽类型
        if (this.rng.float() >= 0.78) {
            return;
        }
        const caps = this.pickupCaps();
        const distM = x / this.pxPerM;
        const nearStart = distM < 40;
        const nearGate = x > this.gateX - 10 * this.pxPerM;
        let kind = this.rollDropKind();
        if (this.currencyOnly && (kind === 'food' || kind === 'item' || kind === 'chest')) {
            kind = this.rng.float() < 0.7 ? 'coin' : 'gem';
        }
        if (kind === 'chest' && (this.pickupCounts.chest >= caps.chest || nearGate || this.recentHasChest(5))) {
            kind = this.rng.float() < 0.5 ? 'gem' : 'coin';
        }
        if (kind === 'food' && (this.pickupCounts.food >= caps.food || nearStart)) {
            kind = 'coin';
        }
        if (kind === 'item' && (this.pickupCounts.item >= caps.item || this.recentUtilityCount(3) >= 1)) {
            kind = 'coin';
        }
        if (kind === 'gem' && (this.pickupCounts.gem >= caps.gem || this.gemStreak >= 2)) {
            kind = 'coin';
        }
        const airY = 175 + this.rng.int(55);
        const groundY = 6;
        if (kind === 'coin') {
            const count = 3 + this.rng.int(3);
            const high = this.rng.float() < 0.55;
            const sz = entityVisualSize({ type: 'coin' });
            const y = high ? airY : groundY;
            const x0 = this.findClearX(x, y, sz.w, sz.h, 'coin');
            for (let i = 0; i < count; i++) {
                const t = count <= 1 ? 0.5 : i / (count - 1);
                const cy = high ? airY + Math.sin(t * Math.PI) * 35 : groundY;
                const cx = this.findClearX(x0 + i * 55, cy, sz.w, sz.h, 'coin');
                this.addEntity({ type: 'coin', x: cx, y: cy, w: sz.w, h: sz.h });
            }
            this.noteDrop('coin');
            return;
        }
        if (kind === 'gem') {
            const c = this.rollGemColor();
            const sz = entityVisualSize({ type: 'gem', gemColor: c });
            const gy = airY + 20;
            const gx = this.findClearX(x, gy, sz.w, sz.h, 'gem');
            this.addEntity({ type: 'gem', x: gx, y: gy, w: sz.w, h: sz.h, gemColor: c });
            this.noteDrop('gem');
            return;
        }
        if (kind === 'food') {
            const itemId = this.rollFoodId();
            const sz = entityVisualSize({ type: 'food', itemId });
            const fx = this.findClearX(x, groundY, sz.w, sz.h, 'food');
            this.addEntity({ type: 'food', x: fx, y: groundY, w: sz.w, h: sz.h, itemId });
            this.noteDrop('food');
            return;
        }
        if (kind === 'item') {
            const itemId = this.rollUtilityId(x);
            if (!itemId) {
                this.spawnPickupAsCoin(x, groundY);
                return;
            }
            const y = this.rng.float() < 0.5 ? groundY : airY;
            const sz = entityVisualSize({ type: 'item', itemId });
            const ix = this.findClearX(x, y, sz.w, sz.h, 'item');
            this.addEntity({ type: 'item', x: ix, y, w: sz.w, h: sz.h, itemId });
            this.noteDrop('item');
            if (itemId === 'flight_boots') {
                this.lastFlightBootX = x;
            }
            return;
        }
        const chestKind = this.rollChestKind();
        const sz = entityVisualSize({ type: 'chest' });
        const cx = this.findClearX(x, 0, sz.w, sz.h, 'chest');
        this.addEntity({ type: 'chest', x: cx, y: 0, w: sz.w, h: sz.h, chestKind });
        this.noteDrop('chest');
    }

    private spawnPickupAsCoin(x: number, groundY: number): void {
        const sz = entityVisualSize({ type: 'coin' });
        const cx = this.findClearX(x, groundY, sz.w, sz.h, 'coin');
        this.addEntity({ type: 'coin', x: cx, y: groundY, w: sz.w, h: sz.h });
        this.noteDrop('coin');
    }

    /** 《游戏过程中物品出现概率设计》§3：金币 45 / 宝石 20 / 食物 15 / 通用 12 / 宝箱 8 */
    private rollDropKind(): 'coin' | 'gem' | 'food' | 'item' | 'chest' {
        const r = this.rng.float() * 100;
        if (r < 45) {
            return 'coin';
        }
        if (r < 65) {
            return 'gem';
        }
        if (r < 80) {
            return 'food';
        }
        if (r < 92) {
            return 'item';
        }
        return 'chest';
    }

    /** §4.2 蓝 40 / 绿 25 / 红 20 / 紫 15 */
    private rollGemColor(): 'blue' | 'green' | 'red' | 'purple' {
        const r = this.rng.float() * 100;
        if (r < 40) {
            return 'blue';
        }
        if (r < 65) {
            return 'green';
        }
        if (r < 85) {
            return 'red';
        }
        return 'purple';
    }

    /** §5 牛奶 25 / 跑鞋 22 / 盾 20 / 磁铁 18 / 飞行靴 15；飞行靴 20m 内不重复 */
    private rollUtilityId(x: number): string | null {
        const pool: Array<{ id: string; w: number }> = [
            { id: 'energy_milk', w: 25 },
            { id: 'speed_shoes', w: 22 },
            { id: 'shield', w: 20 },
            { id: 'magnet', w: 18 },
            { id: 'flight_boots', w: 15 },
        ];
        if (x - this.lastFlightBootX < 20 * this.pxPerM) {
            pool.pop();
        }
        const total = pool.reduce((s, p) => s + p.w, 0);
        let r = this.rng.float() * total;
        for (const p of pool) {
            r -= p.w;
            if (r <= 0) {
                return p.id;
            }
        }
        return pool[pool.length - 1]?.id ?? null;
    }

    /** §6 当前角色专属 80%，品质 50/35/15；其他角色 20% */
    private rollFoodId(): string {
        const tiers: Record<string, [string, string, string]> = {
            doraemon: ['mini_dorayaki', 'classic_dorayaki', 'luxury_dorayaki'],
            nobita: ['honey_muffin', 'natural_honey', 'golden_honeycomb'],
            shizuka: ['candy_lollipop', 'strawberry_milk', 'strawberry_cake'],
            dorami: ['fresh_orange', 'vitality_juice', 'orange_pudding'],
        };
        const own = tiers[this.selectedCharId] ?? tiers.doraemon!;
        const others = Object.keys(tiers).filter((k) => k !== this.selectedCharId);
        const useOwn = this.rng.float() < 0.8 || others.length === 0;
        const set = useOwn ? own : tiers[this.rng.pick(others)]!;
        const q = this.rng.float() * 100;
        if (q < 50) {
            return set[0];
        }
        if (q < 85) {
            return set[1];
        }
        return set[2];
    }

    /** §7 木 50 / 银 30 / 金 15 / 紫 5 */
    private rollChestKind(): ChestKind {
        const r = this.rng.float() * 100;
        if (r < 50) {
            return 'wood';
        }
        if (r < 80) {
            return 'silver';
        }
        if (r < 95) {
            return 'gold';
        }
        return 'purple';
    }

    private pickupCaps(): { coin: number; gem: number; food: number; item: number; chest: number } {
        if (this.level <= 5) {
            return { coin: 15, gem: 4, food: 2, item: 2, chest: 1 };
        }
        if (this.level <= 12) {
            return { coin: 25, gem: 6, food: 3, item: 3, chest: 1 };
        }
        return { coin: 35, gem: 9, food: 4, item: 4, chest: 1 };
    }

    private noteDrop(kind: 'coin' | 'gem' | 'food' | 'item' | 'chest'): void {
        this.pickupCounts[kind] += 1;
        this.recentDropKinds.push(kind);
        if (this.recentDropKinds.length > 8) {
            this.recentDropKinds.shift();
        }
        this.gemStreak = kind === 'gem' ? this.gemStreak + 1 : 0;
    }

    private recentHasChest(n: number): boolean {
        const slice = this.recentDropKinds.slice(-n);
        return slice.includes('chest');
    }

    private recentUtilityCount(n: number): number {
        return this.recentDropKinds.slice(-n).filter((k) => k === 'item').length;
    }

    /**
     * 关卡内已通过路段的障碍/陷阱须保留（回走仍可见可碰）。
     * 仅剔除滚出镜头很远的滚动石，避免无限堆积。
     */
    private cullBehindCamera(): void {
        const minX = this.cameraX - 1200;
        const arr = this.entities;
        let w = 0;
        for (let i = 0; i < arr.length; i++) {
            const e = arr[i];
            const rolling = e.type === 'rock' || e.type === 'rockCrack';
            if (!rolling || e.x > minX) {
                arr[w++] = e;
            }
        }
        if (w !== arr.length) {
            arr.length = w;
        }
    }

    private addEntity(partial: Omit<WorldEntity, 'id'>): void {
        this.entities.push({ id: this.nextId++, ...partial });
    }

    private applyMagnet(dt: number): void {
        if (this.player.magnet <= 0) {
            return;
        }
        // iOS：|dx|<6m 直接吸入；此处同口径瞬间收集 + 近距拉拽
        const vacuum = 6 * this.pxPerM;
        const p = this.player;
        const arr = this.entities;
        let w = 0;
        for (let i = 0; i < arr.length; i++) {
            const e = arr[i];
            if (
                e.type !== 'coin' &&
                e.type !== 'gem' &&
                e.type !== 'item' &&
                e.type !== 'food' &&
                e.type !== 'chest'
            ) {
                arr[w++] = e;
                continue;
            }
            const dx = e.x - p.x;
            if (Math.abs(dx) < vacuum) {
                this.collect(e);
                continue;
            }
            if (Math.abs(dx) < 220) {
                e.x -= dx * Math.min(1, dt * 8);
                const dy = e.y + e.h / 2 - (p.y + 45);
                e.y -= dy * Math.min(1, dt * 8);
            }
            arr[w++] = e;
        }
        if (w !== arr.length) {
            arr.length = w;
        }
    }

    /** 玩家侧向阻挡半宽：贴合站立贴图宽度 */
    private playerHalfWidth(): number {
        return this._bodyW * 0.5;
    }

    /**
     * 落地脚底半宽（约贴图宽的 18%）。
     * 比身体窄，避免「侧面刚好贴着障碍」被当成踩上顶面。
     */
    private playerLandingHalfWidth(): number {
        return this._bodyW * 0.18;
    }

    private refreshBodyCache(): void {
        const blend = this.flightBlend;
        const groundW = (120 * 96) / 132;
        const groundH = 120;
        const flyH = (120 * 2.35) / 1.5;
        const flyW = (flyH * 454) / 814;
        this._bodyW = groundW + (flyW - groundW) * blend;
        this._bodyH = groundH + (flyH - groundH) * blend;
    }

    private playerBody(): { w: number; h: number } {
        return { w: this._bodyW, h: this._bodyH };
    }

    private isSolid(e: WorldEntity): boolean {
        return this.isObstacle(e) || e.type === 'platform';
    }

    private isStandable(e: WorldEntity): boolean {
        return this.isSolid(e);
    }

    private isObstacle(e: WorldEntity): boolean {
        return (
            e.type === 'box' ||
            e.type === 'rockBig' ||
            e.type === 'rockStone' ||
            e.type === 'concrete' ||
            e.type === 'stoneWall' ||
            e.type === 'barrelRed' ||
            e.type === 'barrelBlue'
        );
    }

    private isHazard(e: WorldEntity): boolean {
        return (
            e.type === 'spike' ||
            e.type === 'rock' ||
            e.type === 'rockCrack' ||
            e.type === 'chainSpike' ||
            e.type === 'wallSpike' ||
            e.type === 'boardSpike' ||
            e.type === 'spear' ||
            e.type === 'arrowDown' ||
            e.type === 'arrowLeft' ||
            e.type === 'arrowRight'
        );
    }

    private obstacleBlockMessage(e: WorldEntity): string {
        switch (e.type) {
            case 'rockBig':
                return '石球阻挡';
            case 'rockStone':
                return '岩石阻挡';
            case 'concrete':
                return '水泥阻挡';
            case 'stoneWall':
                return '石墙阻挡';
            case 'barrelRed':
            case 'barrelBlue':
                return '油桶阻挡';
            default:
                return '木箱阻挡';
        }
    }

    private hazardMessage(type: EntityType): string {
        switch (type) {
            case 'spike':
                return '触发地刺';
            case 'chainSpike':
                return '吊链落刺';
            case 'wallSpike':
            case 'boardSpike':
                return '触发侧刺';
            case 'spear':
                return '触发长矛';
            case 'arrowDown':
            case 'arrowLeft':
            case 'arrowRight':
                return '触发箭矢';
            default:
                return '触发机关';
        }
    }

    private platformShape(e: WorldEntity): { low: number[]; high: number[] } | null {
        if (e.type !== 'platform') {
            return null;
        }
        return PLATFORM_SHAPE[e.variant ?? '1'] ?? PLATFORM_SHAPE['1'] ?? null;
    }

    private platformColIndex(e: WorldEntity, worldX: number, cols: number): number {
        const u = (worldX - (e.x - e.w / 2)) / Math.max(1, e.w);
        return Math.max(0, Math.min(cols - 1, Math.floor(u * cols)));
    }

    /** 该 x 处台面顶（草皮），采样点在台外或无素材则 null */
    private platformDeckAtX(e: WorldEntity, worldX: number): number | null {
        const sh = this.platformShape(e);
        if (!sh) {
            return null;
        }
        const left = e.x - e.w / 2;
        const right = e.x + e.w / 2;
        if (worldX < left || worldX > right) {
            return null;
        }
        const i = this.platformColIndex(e, worldX, sh.high.length);
        const t = sh.high[i] ?? -1;
        if (t < 0) {
            return null;
        }
        return e.y + t * e.h;
    }

    /** 该 x 处台底（锯齿），无素材则 null */
    private platformUndersideAtX(e: WorldEntity, worldX: number): number | null {
        const sh = this.platformShape(e);
        if (!sh) {
            return null;
        }
        const i = this.platformColIndex(e, worldX, sh.low.length);
        const t = sh.low[i] ?? -1;
        if (t < 0) {
            return null;
        }
        return e.y + t * e.h;
    }

    /** 在给定高度区间内，素材实际左右边界 */
    private platformSolidXRange(e: WorldEntity, minY: number, maxY: number): { left: number; right: number } | null {
        const sh = this.platformShape(e);
        if (!sh) {
            return null;
        }
        const cols = sh.low.length;
        const colW = e.w / cols;
        const base = e.x - e.w / 2;
        let left: number | null = null;
        let right: number | null = null;
        for (let i = 0; i < cols; i++) {
            const low = sh.low[i] ?? -1;
            const high = sh.high[i] ?? -1;
            if (low < 0 || high < 0) {
                continue;
            }
            const bot = e.y + low * e.h;
            const top = e.y + high * e.h;
            if (maxY <= bot || minY >= top) {
                continue;
            }
            const l = base + i * colW;
            const r = l + colW;
            left = left == null ? l : Math.min(left, l);
            right = right == null ? r : Math.max(right, r);
        }
        if (left == null || right == null) {
            return null;
        }
        return { left, right };
    }

    private surfaceTop(e: WorldEntity): number {
        const sh = this.platformShape(e);
        if (sh) {
            let t = 0;
            for (let i = 0; i < sh.high.length; i++) {
                t = Math.max(t, sh.high[i] ?? 0);
            }
            return e.y + t * e.h;
        }
        return e.y + e.h;
    }

    /** 侧向推挤：站在顶面、或脚还在台体下方（由顶板弹回处理）时不挡 */
    private blocksHorizontally(e: WorldEntity): boolean {
        const p = this.player;
        const top = this.surfaceTop(e);
        if (p.y >= top - 8) {
            return false;
        }
        if (e.type === 'platform') {
            const body = this.playerBody();
            const under = this.platformUndersideAtX(e, p.x);
            if (under != null && p.y + body.h <= under + 2) {
                return false;
            }
            if (this.platformSolidXRange(e, p.y, p.y + body.h) == null) {
                return false;
            }
            return true;
        }
        // 脚仍在台底以下：正下方起跳走顶板碰撞，不往两侧挤
        if (p.y < e.y - 4) {
            return false;
        }
        return true;
    }

    /**
     * 悬浮台硬顶：从正下方跳起撞到台底则弹回，不能穿过去。
     */
    private bounceOnCeilings(prevY: number): void {
        const p = this.player;
        if (p.vy <= 0) {
            return;
        }
        const body = this.playerBody();
        const half = this.playerHalfWidth();
        const prevHead = prevY + body.h;
        const head = p.y + body.h;
        for (const e of this.entities) {
            if (!this.isSolid(e) || e.y <= 6) {
                continue;
            }
            if (Math.abs(p.x - e.x) > half + e.w * 0.5) {
                continue;
            }
            let bot = e.y;
            if (e.type === 'platform') {
                const under = this.platformUndersideAtX(e, p.x);
                if (under == null) {
                    continue;
                }
                bot = under;
            }
            const crossed = prevHead <= bot + 10 && head > bot;
            const stuckBelow = p.y < bot && head > bot && p.y < this.surfaceTop(e);
            if (!crossed && !stuckBelow) {
                continue;
            }
            p.y = Math.max(0, bot - body.h);
            p.vy = -Math.max(320, Math.abs(p.vy) * 0.6);
            p.onGround = false;
            break;
        }
    }

    /** 移动前阻断：箱子/滚石真正挡住前进（飞行跳过） */
    private constrainSolidX(from: number, proposed: number): number {
        if (this.player.flying > 0 || proposed === from) {
            return proposed;
        }
        let constrained = proposed;
        const half = this.playerHalfWidth();
        const body = this.playerBody();
        const p = this.player;
        for (const e of this.entities) {
            if (!this.isSolid(e) || !this.blocksHorizontally(e)) {
                continue;
            }
            let left = e.x - e.w / 2;
            let right = e.x + e.w / 2;
            if (e.type === 'platform') {
                const span = this.platformSolidXRange(e, p.y, p.y + body.h);
                if (!span) {
                    continue;
                }
                left = span.left;
                right = span.right;
            }
            if (proposed > from) {
                if (from + half <= left + 2 && constrained + half > left) {
                    constrained = Math.min(constrained, left - half);
                }
            } else if (proposed < from) {
                if (from - half >= right - 2 && constrained - half < right) {
                    constrained = Math.max(constrained, right + half);
                }
            }
        }
        return constrained;
    }

    /** 已重叠时推出固体 */
    private resolveSolidContacts(): void {
        if (this.player.flying > 0) {
            return;
        }
        const half = this.playerHalfWidth();
        const p = this.player;
        const body = this.playerBody();
        for (const e of this.entities) {
            if (!this.isSolid(e) || !this.blocksHorizontally(e)) {
                continue;
            }
            let left = e.x - e.w / 2;
            let right = e.x + e.w / 2;
            if (e.type === 'platform') {
                const span = this.platformSolidXRange(e, p.y, p.y + body.h);
                if (!span) {
                    continue;
                }
                left = span.left;
                right = span.right;
            }
            if (p.x + half <= left || p.x - half >= right) {
                continue;
            }
            const top = this.surfaceTop(e);
            const bot = e.type === 'platform' ? (this.platformUndersideAtX(e, p.x) ?? e.y) : e.y;
            if (p.y >= top || p.y + body.h <= bot) {
                continue;
            }
            const center = (left + right) / 2;
            if (p.x <= center) {
                p.x = left - half;
            } else {
                p.x = right + half;
            }
        }
    }

    /**
     * 落到障碍 / 悬浮台顶面。
     * 只用脚底是否压在顶面上，不用全身 AABB：贴着侧面起跳时身体会擦到障碍，
     * 但不能因此被吸到顶上。
     */
    private landOnSolids(prevY: number): void {
        const p = this.player;
        if (p.vy > 0) {
            return;
        }
        const feetHalf = this.playerLandingHalfWidth();
        let bestTop: number | null = null;
        for (const e of this.entities) {
            if (!this.isStandable(e)) {
                continue;
            }
            let top = this.surfaceTop(e);
            const left = e.x - e.w * 0.5;
            const right = e.x + e.w * 0.5;
            if (e.type === 'platform') {
                const deck = this.platformDeckAtX(e, p.x);
                if (deck == null) {
                    continue;
                }
                top = deck;
            }
            // 顶面两侧各收一点，贴边起跳时中线仍在障碍外
            const inset = e.type === 'platform' ? 4 : 8;
            const standLeft = left + inset;
            const standRight = right - inset;
            const overlap = Math.min(p.x + feetHalf, standRight) - Math.max(p.x - feetHalf, standLeft);
            if (overlap < 6) {
                continue;
            }
            const fallingOnto = (prevY >= top - 8 && p.y <= top + 10) || (prevY > top && p.y <= top);
            if (fallingOnto) {
                bestTop = bestTop == null ? top : Math.max(bestTop, top);
            }
        }
        if (bestTop != null) {
            p.y = bestTop;
            p.vy = 0;
            p.onGround = true;
            p.jumps = 0;
        }
    }

    /** 对齐 iOS enqueueCollectedItem：同 id 堆叠 */
    enqueueCollectedItem(id: string): void {
        if (this.collectedQuickCounts[id] == null) {
            this.collectedQuickOrder.push(id);
            this.collectedQuickCounts[id] = 0;
        }
        this.collectedQuickCounts[id] += 1;
        this.collectedItems.push(id);
    }

    /** 使用局内拾取堆叠中的一件 */
    consumeCollectedItem(id: string): boolean {
        const n = this.collectedQuickCounts[id] ?? 0;
        if (n <= 0) {
            return false;
        }
        this.collectedQuickCounts[id] = n - 1;
        if (this.collectedQuickCounts[id] <= 0) {
            delete this.collectedQuickCounts[id];
            this.collectedQuickOrder = this.collectedQuickOrder.filter((x) => x !== id);
        }
        const idx = this.collectedItems.indexOf(id);
        if (idx >= 0) {
            this.collectedItems.splice(idx, 1);
        }
        return true;
    }

    private resolvePickups(): void {
        const p = this.player;
        const body = this.playerBody();
        const arr = this.entities;
        let w = 0;
        for (let i = 0; i < arr.length; i++) {
            const e = arr[i];
            const pickup =
                e.type === 'coin' || e.type === 'gem' || e.type === 'item' || e.type === 'food' || e.type === 'chest';
            if (!pickup) {
                arr[w++] = e;
                continue;
            }
            const contact = (body.w + e.w) * 0.5;
            if (Math.abs(p.x - e.x) >= contact) {
                arr[w++] = e;
                continue;
            }
            const feet = p.y;
            const head = p.y + body.h;
            const eBottom = e.y;
            const eTop = e.y + e.h;
            if (head <= eBottom || feet >= eTop) {
                arr[w++] = e;
                continue;
            }
            this.collect(e);
        }
        if (w !== arr.length) {
            arr.length = w;
        }
    }

    private collect(e: WorldEntity): void {
        this.addEnergyFromPickup(e);
        switch (e.type) {
            case 'coin':
                if (this.player.lucky > 0) {
                    this.collectedCoins += 2;
                    this.fx.luckySpark = 0.35;
                } else {
                    this.collectedCoins += 1;
                }
                break;
            case 'gem':
                this.collectedGems[e.gemColor ?? 'blue']++;
                break;
            case 'item':
            case 'food':
                if (e.itemId) {
                    this.enqueueCollectedItem(e.itemId);
                    const it = itemById(e.itemId);
                    this.setEffectMessage('拾取道具');
                }
                break;
            case 'chest':
                this.collectedChests++;
                break;
            default:
                break;
        }
    }

    /** 前进距离转化为能量点数 */
    private gainEnergyFromDistance(): void {
        const gained = this.distanceM - this.lastEnergyDistM;
        this.lastEnergyDistM = this.distanceM;
        if (gained > 0) {
            this.addEnergyPoints(gained * this.pointsPerMeter);
        }
    }

    /** 拾取货币／道具转化为能量点数（不再直接 +1 格） */
    private addEnergyFromPickup(e: WorldEntity): void {
        let key = e.type;
        if (e.type === 'gem') {
            key = `gem_${e.gemColor ?? 'blue'}`;
        }
        const pts = this.energyPickupPoints[key] ?? 12;
        // 幸运饮料下金币双倍时，能量也略增
        if (e.type === 'coin' && this.player.lucky > 0) {
            this.addEnergyPoints(pts * 1.5);
        } else {
            this.addEnergyPoints(pts);
        }
    }

    private addEnergyPoints(pts: number): void {
        if (pts <= 0 || this.player.energy >= 5 || this.isCompleting || this.finished) {
            return;
        }
        this.energyPoints += pts;
        while (this.energyPoints >= this.energyPerSegment && this.player.energy < 5) {
            this.energyPoints -= this.energyPerSegment;
            this.player.energy += 1;
        }
        if (this.player.energy >= 5) {
            this.player.energy = 5;
            this.energyPoints = 0;
        }
    }

    private resolveObstacles(): void {
        const p = this.player;
        const body = this.playerBody();
        let hitId: number | null = null;
        let shatterRock = false;

        for (const e of this.entities) {
            if (this.isObstacle(e)) {
                // 障碍：物理阻挡；贴住时给提示（对齐 iOS）
                if (p.flying <= 0 && p.invincible <= 0) {
                    const hw = (body.w + e.w) * 0.5;
                    const touching =
                        Math.abs(p.x - e.x) < hw && p.y < e.y + e.h && p.y + body.h > e.y;
                    if (touching && !(this.isStandable(e) && p.y >= this.surfaceTop(e) - 8)) {
                        this.setEffectMessage(this.obstacleBlockMessage(e));
                    }
                }
                continue;
            }
            if (!this.isHazard(e) || p.invincible > 0) {
                continue;
            }
            // 飞行只绕过地面地刺；箭矢/吊链等空中机关照常伤害（对齐 iOS）
            const isRock = e.type === 'rock' || e.type === 'rockCrack';
            const groundSpike = e.type === 'spike';
            if (p.flying > 0 && groundSpike && !isRock) {
                continue;
            }
            if (!this.playerTouchesHazard(e)) {
                continue;
            }
            // 石在角色右侧 = 滚石从右边撞来
            const hitFromRight = e.x >= p.x;
            // 击退推离滚石；倾倒方向由 hitFromRight 单独决定（与面向无关）
            const knockDir = hitFromRight ? -1 : 1;
            hitId = e.id;
            if (p.shield > 0) {
                p.shield--;
                this.fx.shieldBreak = 0.3;
                p.invincible = 0.45;
                this.setEffectMessage('护盾抵挡');
                if (isRock) {
                    shatterRock = true;
                    this.beginRockShatter(e);
                } else if (e.type === 'arrowLeft' || e.type === 'arrowRight' || e.type === 'arrowDown') {
                    this.deactivateArrow(e);
                }
                break;
            }
            p.hearts -= e.damage ?? 1;
            p.invincible = 1.2;
            if (isRock) {
                this.beginDamageFeedback(e.type as 'rock' | 'rockCrack', knockDir, hitFromRight);
                shatterRock = true;
                this.beginRockShatter(e);
            } else {
                this.beginDamageFeedback('other', knockDir);
                this.setEffectMessage(this.hazardMessage(e.type));
                if (e.type === 'arrowLeft' || e.type === 'arrowRight' || e.type === 'arrowDown') {
                    this.deactivateArrow(e);
                }
            }
            break;
        }

        if (shatterRock && hitId != null) {
            const arr = this.entities;
            let w = 0;
            for (let i = 0; i < arr.length; i++) {
                if (arr[i].id !== hitId) {
                    arr[w++] = arr[i];
                }
            }
            arr.length = w;
        }
    }

    /** 滚石撞到立刻蹦散：记特效坐标并移除实体 */
    private beginRockShatter(e: WorldEntity): void {
        this.fx.rockShatter = 0.32;
        this.fx.rockShatterX = e.x;
        this.fx.rockShatterY = e.y + e.h * 0.5;
    }

    private deactivateArrow(e: WorldEntity): void {
        e.active = false;
        if (e.type === 'arrowDown') {
            // 向下箭矢只落一次，命中后销毁、不再射出（对齐 iOS collected）
            e.triggered = true;
            e.y = -999;
            return;
        }
        e.triggered = false;
        e.x = e.originX ?? e.x;
        e.y = e.originY ?? e.y;
        e.disabledUntil = this.elapsed + 1.2;
    }

}
