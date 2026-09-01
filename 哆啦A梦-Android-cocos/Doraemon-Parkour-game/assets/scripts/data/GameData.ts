/**
 * 全局数据常量（集中只读表；价格/文案数字一律以总结 §二为准，禁止散落魔法数）。
 * M0 阶段只含存档骨架所需常量；角色/道具/箱钥完整数据表按里程碑增补。
 */

/** 本地存档键名（对齐规范 §14 / 总结 §4.6） */
export const SAVE_KEY = 'doraemon_parkour_save_v1';

/** 存档结构版本（数据格式升级时 +1 并做迁移） */
export const SAVE_VERSION = 1;

/** 角色 id（胖虎/小夫不可出战，货架可展示） */
export const CHARACTER_IDS = {
    doraemon: 'doraemon', // 哆啦A梦
    nobita: 'nobita',     // 大雄
    shizuka: 'shizuka',   // 静香
    gian: 'gian',         // 胖虎（不可出战）
    suneo: 'suneo',       // 小夫（不可出战）
    dorami: 'dorami',     // 哆啦美
} as const;

/** 新档初始道具（总结 §2.1：迷你铜锣烧 ×2、能量牛奶 ×1） */
export const ITEM_IDS = {
    mini_dorayaki: 'mini_dorayaki', // 迷你铜锣烧
    energy_milk: 'energy_milk',     // 能量牛奶
} as const;

/** 单种钥匙库存上限（总结 §2.1） */
export const MAX_KEYS_PER_TYPE = 99;

/** 角色 id → 中文名（用于头像/详情等路径键；胖虎/小夫不可出战） */
export const CHARACTER_PORTRAIT_NAMES: Record<string, string> = {
    [CHARACTER_IDS.doraemon]: '哆啦A梦',
    [CHARACTER_IDS.nobita]: '大雄',
    [CHARACTER_IDS.shizuka]: '静香',
    [CHARACTER_IDS.gian]: '胖虎',
    [CHARACTER_IDS.suneo]: '小夫',
    [CHARACTER_IDS.dorami]: '哆啦美',
};

/** 首页方形头像路径键（对齐总结 §3.2.3 素材族） */
export function portraitPathKey(characterId: string): string {
    const name = CHARACTER_PORTRAIT_NAMES[characterId] ?? CHARACTER_PORTRAIT_NAMES[CHARACTER_IDS.doraemon];
    return `首页/人物头像（方形的）/角色卡_${name}.png`;
}

/** 设置默认值（总结 §2.4：音乐/音效 0–10 默认 8；开关默认开） */
export const DEFAULT_SETTINGS = {
    musicVolume: 8,
    soundVolume: 8,
    vibrationEnabled: true,
    tipsEnabled: true,
} as const;

/** 新档默认（总结 §4.6 存档建议字段） */
export function defaultProfile(): SaveProfile {
    return {
        version: SAVE_VERSION,
        coins: 200,
        diamonds: 10,
        unlockedCharacters: [CHARACTER_IDS.doraemon],
        selectedCharacter: CHARACTER_IDS.doraemon,
        itemInventory: {
            [ITEM_IDS.mini_dorayaki]: 2,
            [ITEM_IDS.energy_milk]: 1,
        },
        loadout: [],
        chestInventory: {},
        keyInventory: {},
        unlockedLevel: 1,
        levelStars: {},
        firstClear: {},
        nodeClaims: {},
        settings: { ...DEFAULT_SETTINGS },
        lastRunSummary: null,
    };
}

/** 存档数据形状（对齐总结 §4.6；字段可英文化，语义勿丢） */
export interface SettingsProfile {
    musicVolume: number;
    soundVolume: number;
    vibrationEnabled: boolean;
    tipsEnabled: boolean;
}

export interface SaveProfile {
    version: number;
    coins: number;
    diamonds: number;
    unlockedCharacters: string[];
    selectedCharacter: string;
    itemInventory: Record<string, number>;
    loadout: string[];
    chestInventory: Record<string, number>;
    keyInventory: Record<string, number>;
    unlockedLevel: number;
    levelStars: Record<string, number>;
    firstClear: Record<string, boolean>;
    nodeClaims: Record<string, boolean>;
    settings: SettingsProfile;
    lastRunSummary: unknown | null;
}

/** ===== 角色/道具/箱钥数据表（数字抄总结 §二/§7.3，禁止改价）===== */

export type ChestKind = 'wood' | 'silver' | 'gold' | 'purple';
export type KeyKind = 'copper' | 'silver' | 'gold' | 'purple';
export type Currency = 'coins' | 'diamonds';
export type ItemCategory = 'special' | 'common' | 'food';

export interface CharacterDef {
    id: string;
    name: string;
    price: number;
    availableInRun: boolean;
    /** 角色定位短句（商城详情首行强调色；人物角色介绍文案.md） */
    tagline: string;
    /** 背包详情底板短介绍（≤20 字；背包页角色详情设计.md / iOS intro） */
    bagIntro: string;
    /** 角色介绍正文（商城详情第二行） */
    intro: string;
    /** 局内能量技（总结 §2.5，商城详情展示） */
    skill: string;
    movement: number;
    luck: number;
}

export interface ItemDef {
    id: string;
    name: string;
    category: ItemCategory;
    /** 专属食物归属角色；null = 通用 */
    owner: string | null;
    buyPrice: number;
    sellPrice: number;
    intro: string;
    /** 购买卡短效果（≤13 字） */
    shortText: string;
    /** 详情说明（≤20 字） */
    detailText: string;
    /** 持续显示（秒/立即/分段/1次） */
    duration: string;
}

export interface ChestDef {
    kind: ChestKind;
    name: string;
    price: number;
    currency: Currency;
    key: KeyKind;
    /** 背包详情底板短介绍（≤20 字；背包页宝箱详情设计.md） */
    intro: string;
}

export interface KeyDef {
    kind: KeyKind;
    name: string;
    price: number;
    currency: Currency;
}

/** 开箱奖励包（总结 §3.12；character 为 null 表示未开角色） */
export interface RewardBundle {
    coins: number;
    diamonds: number;
    items: string[];
    character: string | null;
}

export const CHARACTERS: CharacterDef[] = [
    {
        id: CHARACTER_IDS.doraemon,
        name: '哆啦A梦',
        price: 0,
        availableInRun: true,
        tagline: '初始均衡型角色',
        bagIntro: '来自22世纪，铜锣烧类专属恢复。',
        intro: '来自未来的机器猫，擅长稳定续航与道具支援。',
        skill: '能量飞行 10 秒（无视地面障碍）',
        movement: 3,
        luck: 3,
    },
    {
        id: CHARACTER_IDS.nobita,
        name: '大雄',
        price: 50,
        availableInRun: true,
        tagline: '续航恢复型角色',
        bagIntro: '性格温和，擅长使用蜂蜜系食物。',
        intro: '温柔但容易受伤，适合依靠食物稳步续航。',
        skill: '勇气加速 12 秒（移速 ×1.35）',
        movement: 3,
        luck: 3,
    },
    {
        id: CHARACTER_IDS.shizuka,
        name: '静香',
        price: 70,
        availableInRun: true,
        tagline: '救急恢复型角色',
        bagIntro: '温柔善良，甜心食物恢复效果佳。',
        intro: '温柔可靠的伙伴，低血时拥有更强恢复力。',
        skill: '恢复 2 心 + 护盾 1 次',
        movement: 4,
        luck: 3,
    },
    {
        id: CHARACTER_IDS.gian,
        name: '胖虎',
        price: 90,
        availableInRun: false,
        tagline: '运动冲刺型角色',
        bagIntro: '力量十足，奔跑冲刺能力更出众。',
        intro: '力量十足的运动型角色，适合快速冲刺通关。',
        skill: '动作素材待补，暂不可出战',
        movement: 5,
        luck: 2,
    },
    {
        id: CHARACTER_IDS.suneo,
        name: '小夫',
        price: 90,
        availableInRun: false,
        tagline: '金币收集型角色',
        bagIntro: '家境优渥，跑酷收集效率更高。',
        intro: '擅长收集资源，适合金币和奖励关卡。',
        skill: '动作素材待补，暂不可出战',
        movement: 3,
        luck: 5,
    },
    {
        id: CHARACTER_IDS.dorami,
        name: '哆啦美',
        price: 120,
        availableInRun: true,
        tagline: '幸运辅助型角色',
        bagIntro: '聪明可爱，各项辅助能力均衡。',
        intro: '聪明可爱的辅助角色，更容易获得关卡道具。',
        skill: '幸运磁力 12 秒（磁铁 + 幸运）',
        movement: 4,
        luck: 4,
    },
];

export const ITEMS: ItemDef[] = [
    { id: 'first_aid', name: '急救箱', category: 'special', owner: null, buyPrice: 280, sellPrice: 140, intro: '立即恢复3颗血心。', shortText: '立即恢复3颗血心', detailText: '关键时刻立即回血', duration: '立即' },
    { id: 'vitality_drink', name: '活力饮料', category: 'special', owner: null, buyPrice: 180, sellPrice: 90, intro: '分段共恢复2颗血心。', shortText: '分段恢复2颗血心', detailText: '分段恢复血心', duration: '分段' },
    { id: 'lucky_drink', name: '幸运饮料', category: 'special', owner: null, buyPrice: 220, sellPrice: 110, intro: '金币+30%、掉落+10%，20秒。', shortText: '金币+30%，掉落+10%', detailText: '提高金币与掉落收益', duration: '20秒' },
    { id: 'leap_drink', name: '飞跃饮料', category: 'special', owner: null, buyPrice: 200, sellPrice: 100, intro: '移速与跳跃+20%，15秒。', shortText: '移速跳跃+20%15秒', detailText: '提升速度与跳跃能力', duration: '15秒' },
    { id: 'magnet', name: '超级磁铁', category: 'common', owner: null, buyPrice: 160, sellPrice: 80, intro: '吸附金币与掉落物，20秒。', shortText: '吸附周围物品20秒', detailText: '自动吸附附近奖励', duration: '20秒' },
    { id: 'shield', name: '防护盾', category: 'common', owner: null, buyPrice: 180, sellPrice: 90, intro: '抵挡1次碰撞伤害。', shortText: '抵挡1次碰撞伤害', detailText: '抵挡一次碰撞伤害', duration: '1次' },
    { id: 'speed_shoes', name: '极速跑鞋', category: 'common', owner: null, buyPrice: 140, sellPrice: 70, intro: '移动速度+30%，15秒。', shortText: '移速+30%，15秒', detailText: '短时间提升移动速度', duration: '15秒' },
    { id: 'flight_boots', name: '飞行靴', category: 'common', owner: null, buyPrice: 240, sellPrice: 120, intro: '无视地面障碍，10秒。', shortText: '无视地面障碍10秒', detailText: '短时间飞越地面障碍', duration: '10秒' },
    { id: 'energy_milk', name: '能量牛奶', category: 'common', owner: null, buyPrice: 100, sellPrice: 50, intro: '通用恢复，立即回1颗血心。', shortText: '通用恢复1颗血心', detailText: '所有角色都能使用', duration: '立即' },
    { id: 'fresh_orange', name: '新鲜橙子', category: 'food', owner: CHARACTER_IDS.dorami, buyPrice: 40, sellPrice: 20, intro: '恢复1颗血心，哆啦美专属。', shortText: '哆啦美恢复1颗血心', detailText: '哆啦美专属基础食物', duration: '立即' },
    { id: 'vitality_juice', name: '活力橙汁', category: 'food', owner: CHARACTER_IDS.dorami, buyPrice: 80, sellPrice: 40, intro: '恢复2颗血心，哆啦美专属。', shortText: '哆啦美恢复2颗血心', detailText: '哆啦美专属中级食物', duration: '立即' },
    { id: 'orange_pudding', name: '橙子布丁', category: 'food', owner: CHARACTER_IDS.dorami, buyPrice: 160, sellPrice: 80, intro: '恢复3颗血心，哆啦美专属。', shortText: '哆啦美恢复3颗血心', detailText: '哆啦美专属高级食物', duration: '立即' },
    { id: 'honey_muffin', name: '蜂蜜松饼', category: 'food', owner: CHARACTER_IDS.nobita, buyPrice: 40, sellPrice: 20, intro: '恢复1颗血心，大雄专属。', shortText: '大雄恢复1颗血心', detailText: '大雄专属基础食物', duration: '立即' },
    { id: 'natural_honey', name: '天然蜂蜜', category: 'food', owner: CHARACTER_IDS.nobita, buyPrice: 80, sellPrice: 40, intro: '恢复2颗血心，大雄专属。', shortText: '大雄恢复2颗血心', detailText: '大雄专属中级食物', duration: '立即' },
    { id: 'golden_honeycomb', name: '黄金蜂巢', category: 'food', owner: CHARACTER_IDS.nobita, buyPrice: 160, sellPrice: 80, intro: '恢复3颗血心，大雄专属。', shortText: '大雄恢复3颗血心', detailText: '大雄专属高级食物', duration: '立即' },
    { id: 'candy_lollipop', name: '甜心棒棒糖', category: 'food', owner: CHARACTER_IDS.shizuka, buyPrice: 40, sellPrice: 20, intro: '恢复1颗血心，静香专属。', shortText: '静香恢复1颗血心', detailText: '静香专属基础食物', duration: '立即' },
    { id: 'strawberry_milk', name: '草莓牛奶', category: 'food', owner: CHARACTER_IDS.shizuka, buyPrice: 80, sellPrice: 40, intro: '恢复2颗血心，静香专属。', shortText: '静香恢复2颗血心', detailText: '静香专属中级食物', duration: '立即' },
    { id: 'strawberry_cake', name: '草莓蛋糕', category: 'food', owner: CHARACTER_IDS.shizuka, buyPrice: 160, sellPrice: 80, intro: '恢复3颗血心，静香专属。', shortText: '静香恢复3颗血心', detailText: '静香专属高级食物', duration: '立即' },
    { id: 'mini_dorayaki', name: '迷你铜锣烧', category: 'food', owner: CHARACTER_IDS.doraemon, buyPrice: 40, sellPrice: 20, intro: '恢复1颗血心，A梦专属。', shortText: 'A梦恢复1颗血心', detailText: '哆啦A梦专属基础食物', duration: '立即' },
    { id: 'classic_dorayaki', name: '经典铜锣烧', category: 'food', owner: CHARACTER_IDS.doraemon, buyPrice: 80, sellPrice: 40, intro: '恢复2颗血心，A梦专属。', shortText: 'A梦恢复2颗血心', detailText: '哆啦A梦专属中级食物', duration: '立即' },
    { id: 'luxury_dorayaki', name: '豪华铜锣烧', category: 'food', owner: CHARACTER_IDS.doraemon, buyPrice: 160, sellPrice: 80, intro: '恢复3颗血心，A梦专属。', shortText: 'A梦恢复3颗血心', detailText: '哆啦A梦专属高级食物', duration: '立即' },
];

/** 商城道具货架：21 件全上架（购买卡齐全；可滚动） */
export const SHOP_ITEM_IDS: string[] = [
    'energy_milk',
    'speed_shoes',
    'shield',
    'magnet',
    'flight_boots',
    'leap_drink',
    'vitality_drink',
    'lucky_drink',
    'first_aid',
    'classic_dorayaki',
    'mini_dorayaki',
    'luxury_dorayaki',
    'fresh_orange',
    'vitality_juice',
    'orange_pudding',
    'honey_muffin',
    'natural_honey',
    'golden_honeycomb',
    'candy_lollipop',
    'strawberry_milk',
    'strawberry_cake',
];

/** 商城购买卡食物夹名（文件用 大熊/小橘，与展示名大雄/哆啦美不同） */
function shopFoodOwnerFolder(owner: string | null): string {
    switch (owner) {
        case CHARACTER_IDS.doraemon:
            return '哆啦A梦专用';
        case CHARACTER_IDS.dorami:
            return '小橘专用';
        case CHARACTER_IDS.nobita:
            return '大熊专用';
        case CHARACTER_IDS.shizuka:
            return '静香专用';
        default:
            return '哆啦A梦专用';
    }
}

/** 详情横向卡食物夹名（哆啦美用「哆啦美专用」，大雄用「大熊专用」） */
function detailFoodOwnerFolder(owner: string | null): string {
    switch (owner) {
        case CHARACTER_IDS.doraemon:
            return '哆啦A梦专用';
        case CHARACTER_IDS.dorami:
            return '哆啦美专用';
        case CHARACTER_IDS.nobita:
            return '大熊专用';
        case CHARACTER_IDS.shizuka:
            return '静香专用';
        default:
            return '哆啦A梦专用';
    }
}

export const CHESTS: ChestDef[] = [
    { kind: 'wood', name: '木宝箱', price: 100, currency: 'coins', key: 'copper', intro: '基础宝箱，开启可获得基础奖励。' },
    { kind: 'silver', name: '银宝箱', price: 260, currency: 'coins', key: 'silver', intro: '中级宝箱，开启可获得较好奖励。' },
    { kind: 'gold', name: '黄金宝箱', price: 520, currency: 'coins', key: 'gold', intro: '高级宝箱，开启可获得稀有奖励。' },
    { kind: 'purple', name: '紫金宝箱', price: 80, currency: 'diamonds', key: 'purple', intro: '顶级宝箱，开启可获得珍稀奖励。' },
];

export const KEYS: KeyDef[] = [
    { kind: 'copper', name: '铜钥匙', price: 50, currency: 'coins' },
    { kind: 'silver', name: '银钥匙', price: 130, currency: 'coins' },
    { kind: 'gold', name: '金钥匙', price: 260, currency: 'coins' },
    { kind: 'purple', name: '紫钥匙', price: 40, currency: 'diamonds' },
];

export function characterById(id: string): CharacterDef {
    return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

export function itemById(id: string): ItemDef {
    return ITEMS.find((it) => it.id === id) ?? ITEMS[0];
}

export function chestByKind(kind: ChestKind): ChestDef {
    return CHESTS.find((c) => c.kind === kind) ?? CHESTS[0];
}

export function keyByKind(kind: KeyKind): KeyDef {
    return KEYS.find((k) => k.kind === kind) ?? KEYS[0];
}

/** 背包道具列表卡（总结 §3.10.3）；目录用中文夹名，勿写 food/common/special */
export function itemCardKey(item: ItemDef): string {
    const folder = item.category === 'special' ? '特殊' : item.category === 'common' ? '通用' : '食物';
    return `背包页/背包主页面/背包卡/道具/${folder}/${item.name}_背包卡.png`;
}

export function itemDetailKey(item: ItemDef): string {
    return `背包页/背包主页面/详情描述/详情卡/道具/${item.name}_详情卡.png`;
}

export function characterCardKey(id: string, unlocked: boolean): string {
    const c = characterById(id);
    return unlocked
        ? `背包页/背包主页面/背包卡/角色/已解锁状态/${c.name}_背包卡.png`
        : `背包页/背包主页面/背包卡/角色/未解锁状态/${c.name}_背包卡_未解锁.png`;
}

export function characterDetailKey(id: string, unlocked: boolean): string {
    const c = characterById(id);
    return unlocked
        ? `背包页/背包主页面/详情描述/详情卡/人物/${c.name}_详情卡.png`
        : `背包页/背包主页面/详情描述/详情卡/人物/灰色/${c.name}_详情卡.png`;
}

export function chestCardKey(kind: ChestKind): string {
    return `背包页/背包主页面/背包卡/宝箱/${chestByKind(kind).name}_背包卡.png`;
}

export function chestDetailKey(kind: ChestKind): string {
    return `背包页/背包主页面/详情描述/详情卡/宝箱/${chestByKind(kind).name}_详情卡.png`;
}

export function keyRemainLabelKey(kind: ChestKind): string {
    return `背包页/背包主页面/详情描述/剩余钥匙/剩余${keyByKind(chestByKind(kind).key).name}数量文字.png`;
}

/** 开箱奖励图标（总结 §3.12.3；仅本次开出时加载） */
export function rewardCoinKey(): string {
    return '背包页/宝箱开启中间页/宝箱奖励页/道具/金币奖励框.png';
}

export function rewardDiamondKey(): string {
    return '背包页/宝箱开启中间页/宝箱奖励页/道具/蓝色宝石奖励框.png';
}

export function rewardItemKey(item: ItemDef): string {
    // 目录为中文夹名（特殊／通用／食物），与背包卡一致；勿写 special/common/food
    const folder = item.category === 'special' ? '特殊' : item.category === 'common' ? '通用' : '食物';
    return `背包页/宝箱开启中间页/宝箱奖励页/道具/${folder}/${item.name}_背包卡.png`;
}

/** 奖励弹窗标题条（详细内容/开启宝箱-*.png；黄金箱文件名特例「金宝箱」） */
export function chestRewardTitleKey(kind: ChestKind): string {
    const name = kind === 'gold' ? '金宝箱' : chestByKind(kind).name;
    return `背包页/宝箱开启中间页/宝箱奖励页/详细内容/开启宝箱-${name}.png`;
}

/** 开箱失败素材（总结 §3.13.3；黄金箱文件名特例「金宝箱」） */
export function chestFailTitleKey(kind: ChestKind): string {
    const c = chestByKind(kind);
    const name = kind === 'gold' ? '金宝箱' : c.name;
    return `背包页/宝箱开启中间页/提示页/详细内容/对应宝箱-${name}.png`;
}

export function chestFailReasonKey(reason: 'missingKey' | 'missingChest'): string {
    return reason === 'missingKey'
        ? '背包页/宝箱开启中间页/提示页/详细内容/失败原因-钥匙数量不足.png'
        : '背包页/宝箱开启中间页/提示页/详细内容/失败原因-宝箱数量不足.png';
}

export function chestFailCardKey(kind: ChestKind, reason: 'missingKey' | 'missingChest'): string {
    if (reason === 'missingKey') {
        return `背包页/宝箱开启中间页/提示页/钥匙/${keyByKind(chestByKind(kind).key).name}_背包卡.png`;
    }
    return `背包页/宝箱开启中间页/提示页/宝箱/${chestByKind(kind).name}_背包卡.png`;
}

/** 开箱掉落（总结 §2.9；已拥有角色折金币，防刷） */
export function rollChest(kind: ChestKind, unlockedCharacters: string[]): RewardBundle {
    const rand = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;
    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

    switch (kind) {
        case 'wood': {
            const pool = ['fresh_orange', 'honey_muffin', 'candy_lollipop', 'mini_dorayaki', 'energy_milk', 'speed_shoes'];
            return { coins: rand(40, 70), diamonds: 0, items: [pick(pool)], character: null };
        }
        case 'silver': {
            const pool = ['vitality_juice', 'natural_honey', 'strawberry_milk', 'classic_dorayaki', 'shield', 'magnet', 'speed_shoes'];
            const items = [pick(pool)];
            const diamonds = Math.random() < 0.15 ? 1 : 0;
            let character: string | null = null;
            if (Math.random() < 0.03) {
                character = CHARACTER_IDS.nobita;
            }
            return { coins: rand(80, 130), diamonds, items, character };
        }
        case 'gold': {
            const pool = ['flight_boots', 'first_aid', 'lucky_drink', 'leap_drink', 'orange_pudding', 'golden_honeycomb', 'strawberry_cake', 'luxury_dorayaki'];
            const items = [pick(pool)];
            const r = Math.random();
            const diamonds = r < 0.2 ? 1 : r < 0.7 ? 2 : 3;
            let character: string | null = null;
            if (Math.random() < 0.06) {
                character = Math.random() < 0.5 ? CHARACTER_IDS.nobita : CHARACTER_IDS.shizuka;
            }
            return { coins: rand(140, 220), diamonds, items, character };
        }
        case 'purple': {
            const pool = ['first_aid', 'lucky_drink', 'leap_drink', 'flight_boots', 'magnet', 'shield', 'orange_pudding', 'golden_honeycomb', 'strawberry_cake', 'luxury_dorayaki'];
            const itemCount = rand(1, 2);
            const items: string[] = [];
            for (let i = 0; i < itemCount; i++) {
                items.push(pick(pool));
            }
            const r = Math.random();
            const diamonds = r < 0.4 ? 8 : r < 0.8 ? 12 : 16;
            let character: string | null = null;
            if (Math.random() < 0.12) {
                character = pick([CHARACTER_IDS.nobita, CHARACTER_IDS.shizuka, CHARACTER_IDS.gian, CHARACTER_IDS.suneo, CHARACTER_IDS.dorami]);
            }
            return { coins: rand(180, 280), diamonds, items, character };
        }
    }
}

/** 开箱已拥有角色折金币（总结 §2.1 防刷：银40/金80/紫120） */
export function ownedCharacterFallbackCoins(kind: ChestKind): number {
    switch (kind) {
        case 'silver':
            return 40;
        case 'gold':
            return 80;
        case 'purple':
            return 120;
        default:
            return 0;
    }
}

/** ===== 商城路径助手（总结 §3.15–3.17）===== */

const SHOP_ROOT = '商城页/商城主页面';
const SHOP_DETAIL_ROOT = '商城页/商品详情页/详情页信息';

export function shopPanelKey(): string {
    return `${SHOP_ROOT}/购买页完整面板.png`;
}

export function shopTopButtonKey(kind: 'back' | 'plus' | 'settings'): string {
    const name = kind === 'back' ? '返回按钮' : kind === 'plus' ? '加号按钮' : '设置按钮';
    return `${SHOP_ROOT}/按钮/${name}.png`;
}

export function shopCategoryKey(cat: 'characters' | 'items' | 'chests', active: boolean): string {
    const sub = cat === 'characters' ? '角色' : cat === 'items' ? '道具' : '宝箱钥匙';
    const name = cat === 'characters' ? '角色' : cat === 'items' ? '道具' : '宝箱';
    return `${SHOP_ROOT}/按钮/商城分类按钮/${sub}/${name}按钮${active ? '' : '-灰黑'}.png`;
}

export function shopCharacterCardKey(id: string): string {
    return `${SHOP_ROOT}/角色解锁/购买卡/角色卡-${characterById(id).name}.png`;
}

export function shopItemCardKey(item: ItemDef): string {
    const prefix =
        item.category === 'common'
            ? '通用道具'
            : item.category === 'special'
                ? '特殊道具'
                : `食物道具-${shopFoodOwnerFolder(item.owner)}`;
    return `${SHOP_ROOT}/道具购买/购买卡/加名称版购买卡/${prefix}-${item.name}购买卡.png`;
}

export function shopChestKeyCardKey(name: string): string {
    return `${SHOP_ROOT}/宝箱购买/购买卡/${name}购买卡.png`;
}

export function priceGemKey(currency: Currency): string {
    return currency === 'coins' ? `${SHOP_ROOT}/道具购买/金币.png` : `${SHOP_ROOT}/角色解锁/蓝色宝石.png`;
}

export function shopBuyButtonKey(bright: boolean): string {
    return bright
        ? `${SHOP_ROOT}/按钮/购买按钮/购买按钮-亮.png`
        : `${SHOP_ROOT}/按钮/购买按钮/购买按钮-灰-不可购买.png`;
}

export function shopScrollbarTrackKey(): string {
    return `${SHOP_ROOT}/按钮/滑动条/商城竖向滚动条-细.png`;
}

export function shopScrollbarThumbKey(): string {
    return `${SHOP_ROOT}/按钮/滑动条/滚动条菱形滑块.png`;
}

export function shopBuyExitButtonKey(kind: 'buy' | 'exit'): string {
    return `商城页/商品详情页/按钮/${kind === 'buy' ? '001-购买按钮' : '002-退出按钮'}.png`;
}

/** 角色详情（总结 §3.15.5） */
export function charDetailPanelKey(): string {
    return `${SHOP_DETAIL_ROOT}/角色详情页/角色详情面板-空白.png`;
}

export function charPortraitKey(id: string): string {
    return `${SHOP_DETAIL_ROOT}/角色详情页/纵向角色详情卡/${characterById(id).name}.png`;
}

export function charInfoRowKey(id: string): string {
    const suffix = id === CHARACTER_IDS.doraemon || id === CHARACTER_IDS.dorami ? '机器' : id === CHARACTER_IDS.shizuka ? '女' : '男';
    return `${SHOP_DETAIL_ROOT}/角色详情页/基础信息/文字信息/角色信息行-${characterById(id).name}-${suffix}.png`;
}

export function charAttrIconKey(attr: 'life' | 'movement' | 'luck'): string {
    const name = attr === 'life' ? '001-生命图标' : attr === 'movement' ? '002-运动能力图标' : '003-幸运图标';
    return `${SHOP_DETAIL_ROOT}/角色详情页/基础信息/属性图标/${name}.png`;
}

export function charAttrGemKey(attr: 'life' | 'movement' | 'luck', lit: boolean): string {
    if (!lit) {
        return `${SHOP_DETAIL_ROOT}/角色详情页/基础信息/宝石格子/灰色.png`;
    }
    const name = attr === 'life' ? '001-红色宝石' : attr === 'movement' ? '002-蓝色宝石' : '003-绿色宝石';
    return `${SHOP_DETAIL_ROOT}/角色详情页/基础信息/宝石格子/${name}.png`;
}

/** 道具详情（总结 §3.16.5） */
export function itemDetailPanelKey(): string {
    return `${SHOP_DETAIL_ROOT}/道具详情页/道具详情面板-空白.png`;
}

export function itemHorizontalCardKey(item: ItemDef): string {
    const sub =
        item.category === 'food'
            ? `食物道具/${detailFoodOwnerFolder(item.owner)}`
            : item.category === 'special'
                ? '特殊道具'
                : '通用道具';
    return `${SHOP_DETAIL_ROOT}/道具详情页/横向道具详情卡/${sub}/${item.name}.png`;
}

export function itemMetaLabelKey(kind: 'duration' | 'cooldown'): string {
    return `${SHOP_DETAIL_ROOT}/道具详情页/基础属性/${kind === 'duration' ? '持续时间' : '冷却时间'}标签.png`;
}

export function itemTypeKey(item: ItemDef): string {
    let name: string;
    switch (item.id) {
        case 'first_aid':
            name = '001-商品类型高级恢复道具';
            break;
        case 'magnet':
        case 'flight_boots':
            name = '002-商品类型高级功能道具';
            break;
        case 'lucky_drink':
            name = '003-商品类型收益增益道具';
            break;
        case 'energy_milk':
            name = '004-商品类型通用恢复道具';
            break;
        case 'leap_drink':
            name = '005-商品类型增益饮料';
            break;
        case 'vitality_drink':
            name = '007-商品类型恢复饮料';
            break;
        case 'speed_shoes':
            name = '008-商品类型功能道具';
            break;
        default:
            name = item.category === 'food' ? '006-商品类型专属食物' : '009-商品类型防御道具';
            break;
    }
    return `${SHOP_DETAIL_ROOT}/道具详情页/基础属性/商品类型/${name}.png`;
}

export function itemRarityKey(price: number): string {
    const name = price < 140 ? '001-稀有度普通' : price < 200 ? '002-稀有度稀有' : '003-稀有度史诗';
    return `${SHOP_DETAIL_ROOT}/道具详情页/基础属性/稀有度/${name}.png`;
}

/** 宝箱详情（总结 §3.17.5） */
export function chestDetailPanelKey(): string {
    return `${SHOP_DETAIL_ROOT}/宝箱钥匙详情页/宝箱详情页/宝箱详情面板-空白.png`;
}

export function chestPortraitKey(kind: ChestKind): string {
    return `${SHOP_DETAIL_ROOT}/宝箱钥匙详情页/宝箱详情页/纵向宝箱详情卡/${chestByKind(kind).name}.png`;
}

export function chestQualityKey(kind: ChestKind): string {
    const name = kind === 'wood' ? '001-宝箱品质基础宝箱' : kind === 'silver' ? '002-宝箱品质中级宝箱' : kind === 'gold' ? '003-宝箱品质高级宝箱' : '004-宝箱品质稀有宝箱';
    return `${SHOP_DETAIL_ROOT}/宝箱钥匙详情页/宝箱详情页/宝箱信息素材/${name}.png`;
}

export function chestKeyConditionKey(kind: ChestKind): string {
    // 与 iOS chestKeyConditionPath 一致：005铜 / 006银 / 007金 / 008紫（不可一律写 005-）
    const keyKind = chestByKind(kind).key;
    const file =
        keyKind === 'copper'
            ? '005-开启条件铜钥匙'
            : keyKind === 'silver'
              ? '006-开启条件银钥匙'
              : keyKind === 'gold'
                ? '007-开启条件金钥匙'
                : '008-开启条件紫钥匙';
    return `${SHOP_DETAIL_ROOT}/宝箱钥匙详情页/宝箱详情页/宝箱信息素材/${file}.png`;
}

const CHEST_PREVIEWS: Record<ChestKind, string[]> = {
    wood: ['货币/金币.png', '道具/食物道具/哆啦A梦专用/迷你铜锣烧.png', '道具/通用道具/能量牛奶.png'],
    silver: ['货币/金币.png', '货币/蓝色宝石.png', '道具/通用道具/超级磁铁.png', '角色/002-大雄头像.png'],
    gold: ['货币/金币.png', '货币/蓝色宝石.png', '道具/通用道具/飞行靴.png', '角色/003-静香头像.png'],
    purple: ['货币/蓝色宝石.png', '道具/特殊道具/幸运饮料.png', '道具/特殊道具/急救箱.png', '角色/006-哆啦美头像.png'],
};

export function chestPreviewKeys(kind: ChestKind): string[] {
    return CHEST_PREVIEWS[kind].map(
        (rel) => `${SHOP_DETAIL_ROOT}/宝箱钥匙详情页/宝箱详情页/开箱奖励/奖励卡/${rel}`,
    );
}

/** 钥匙详情（总结 §3.17.6） */
export function keyDetailPanelKey(): string {
    return `${SHOP_DETAIL_ROOT}/宝箱钥匙详情页/钥匙详情页/钥匙详情面板-空白.png`;
}

export function keyHorizontalCardKey(kind: KeyKind): string {
    return `${SHOP_DETAIL_ROOT}/宝箱钥匙详情页/钥匙详情页/横向钥匙详情卡/${keyByKind(kind).name}.png`;
}

export function keyRelationKey(kind: KeyKind): string {
    const map: Record<KeyKind, string> = {
        copper: '宝箱钥匙对应关系-木宝箱-基础钥匙',
        silver: '宝箱钥匙对应关系-银宝箱-中级钥匙',
        gold: '宝箱钥匙对应关系-黄金宝箱-高级钥匙',
        purple: '宝箱钥匙对应关系-紫金宝箱-稀有钥匙',
    };
    return `${SHOP_DETAIL_ROOT}/宝箱钥匙详情页/钥匙详情页/钥匙介绍/${map[kind]}.png`;
}

export function keyUsageKey(kind: KeyKind): string {
    const map: Record<KeyKind, string> = {
        copper: '木宝箱完整说明文字',
        silver: '银宝箱完整说明文字',
        gold: '黄金宝箱完整说明文字',
        purple: '紫金宝箱完整说明文字',
    };
    return `${SHOP_DETAIL_ROOT}/宝箱钥匙详情页/钥匙详情页/使用说明/${map[kind]}.png`;
}

/** ===== M6 结算经济（总结 §二 / §六）===== */

export interface NodeClaimDef {
    id: string;
    level: number;
    chest: ChestKind;
    key: KeyKind;
    diamonds: number;
}

/** 累计通关节点（只领一次；关卡上限 20，21+/25 关节点不可达） */
export const NODE_CLAIMS: NodeClaimDef[] = [
    { id: 'node3', level: 3, chest: 'wood', key: 'copper', diamonds: 0 },
    { id: 'node5', level: 5, chest: 'wood', key: 'copper', diamonds: 10 },
    { id: 'node8', level: 8, chest: 'silver', key: 'silver', diamonds: 15 },
    { id: 'node12', level: 12, chest: 'silver', key: 'silver', diamonds: 20 },
    { id: 'node16', level: 16, chest: 'gold', key: 'gold', diamonds: 25 },
    { id: 'node20', level: 20, chest: 'gold', key: 'gold', diamonds: 30 },
];

export interface SettlementResult {
    coins: number;
    diamonds: number;
    itemsAdded: string[];
    chestsAdded: ChestKind[];
    keysAdded: KeyKind[];
    rewardCards: Array<{ path: string; count: number }>;
    claimedNodes: string[];
}

export function baseClearCoins(level: number): number {
    return level <= 5 ? 40 : level <= 12 ? 70 : 100;
}

export function firstClearReward(level: number): { coins: number; diamonds: number } {
    if (level <= 5) {
        return { coins: 30, diamonds: 3 };
    }
    if (level <= 12) {
        return { coins: 50, diamonds: 5 };
    }
    return { coins: 70, diamonds: 7 };
}

export function threeStarExtraChance(level: number): number {
    return level <= 5 ? 0.08 : level <= 12 ? 0.12 : 0.15;
}

export function starBonusCoins(stars: number): number {
    return stars >= 3 ? 55 : stars === 2 ? 25 : 0;
}

/** 结算奖励卡路径（总结 §3.6.3）；目录用中文夹名 */
export function settleItemCardKey(item: ItemDef): string {
    const folder = item.category === 'special' ? '特殊' : item.category === 'common' ? '通用' : '食物';
    return `结算页/奖励道具/道具/${folder}/${item.name}_背包卡.png`;
}

export function settleChestCardKey(kind: ChestKind): string {
    return `结算页/奖励道具/宝箱+钥匙/${chestByKind(kind).name}_背包卡.png`;
}

export function settleKeyCardKey(kind: KeyKind): string {
    return `结算页/奖励道具/宝箱+钥匙/${keyByKind(kind).name}_背包卡.png`;
}

/** 结算经济（总结 §2.1/§2.8；防刷：失败不发通关项；零拾取安慰 +10） */
export function settleEconomy(
    result: { level: number; success: boolean; stars: number; coins: number; gems: Record<'blue' | 'green' | 'red' | 'purple', number>; items: string[]; chests: number },
    profile: SaveProfile,
): SettlementResult {
    const out: SettlementResult = {
        coins: 0,
        diamonds: 0,
        itemsAdded: [],
        chestsAdded: [],
        keysAdded: [],
        rewardCards: [],
        claimedNodes: [],
    };

    // 局内拾取折算（宝石不进钱包，直接折算）
    out.coins += result.coins;
    out.coins += result.gems.blue * 5 + result.gems.green * 12 + result.gems.red * 25;
    out.diamonds += result.gems.purple * 1;
    out.itemsAdded = [...result.items];
    for (let i = 0; i < result.chests; i++) {
        out.chestsAdded.push('wood');
    }

    if (!result.success) {
        const gotNothing =
            result.coins === 0 &&
            result.gems.blue + result.gems.green + result.gems.red + result.gems.purple === 0 &&
            result.items.length === 0 &&
            result.chests === 0;
        if (gotNothing) {
            out.coins += 10;
        }
        appendPickupRewardCards(out, result.items, result.chests);
        return out;
    }

    // 成功：基础金 + 星级
    out.coins += baseClearCoins(result.level);
    out.coins += starBonusCoins(result.stars);

    // 首通（每关一次）
    if (!profile.firstClear[`${result.level}`]) {
        const fr = firstClearReward(result.level);
        out.coins += fr.coins;
        out.diamonds += fr.diamonds;
    }

    // 三星额外钻（可重复）
    if (result.stars >= 3 && Math.random() < threeStarExtraChance(result.level)) {
        out.diamonds += 1;
    }

    // 累计通关节点（只领一次）
    for (const node of NODE_CLAIMS) {
        if (result.level >= node.level && !profile.nodeClaims[node.id]) {
            out.claimedNodes.push(node.id);
            out.chestsAdded.push(node.chest);
            out.keysAdded.push(node.key);
            out.diamonds += node.diamonds;
            pushRewardCard(out, settleChestCardKey(node.chest), 1);
            pushRewardCard(out, settleKeyCardKey(node.key), 1);
        }
    }

    // 奖励卡：本局拾取且未使用的道具/宝箱
    appendPickupRewardCards(out, result.items, result.chests);
    return out;
}

function pushRewardCard(out: SettlementResult, path: string, count: number): void {
    const exist = out.rewardCards.find((c) => c.path === path);
    if (exist) {
        exist.count += count;
    } else {
        out.rewardCards.push({ path, count });
    }
}

/** 局内获得且未消耗的道具/木宝箱 → 结算展示卡 */
function appendPickupRewardCards(out: SettlementResult, items: string[], chests: number): void {
    const itemCounts = new Map<string, number>();
    for (const id of items) {
        itemCounts.set(id, (itemCounts.get(id) ?? 0) + 1);
    }
    for (const [id, count] of itemCounts) {
        pushRewardCard(out, settleItemCardKey(itemById(id)), count);
    }
    if (chests > 0) {
        pushRewardCard(out, settleChestCardKey('wood'), chests);
    }
}
