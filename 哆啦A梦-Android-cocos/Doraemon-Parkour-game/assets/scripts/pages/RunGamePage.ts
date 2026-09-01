import {
    _decorator,
    Color,
    Component,
    Graphics,
    Input,
    input,
    KeyCode,
    Label,
    Mask,
    Node,
    ScrollView,
    Sprite,
    SpriteFrame,
    UIOpacity,
    UITransform,
    view,
} from 'cc';
import { GameAppState, Screen } from '../core/GameAppState';
import { AudioService } from '../core/AudioService';
import { haptic } from '../core/Haptics';
import {
    CHARACTER_PORTRAIT_NAMES,
    characterById,
    itemById,
} from '../data/GameData';
import { RunInput, RunWorld, entityVisualSize } from '../run/RunWorld';
import { WalkAnim } from '../run/WalkAnim';
import {
    getCachedSpriteFrame,
    loadSpriteFrame,
    makeImageButton,
    makeLabel,
    makeProportionalCanvas,
    makeRect,
    makeSprite,
    playButtonHaptic,
} from '../ui/UIKit';
import { ProportionalCanvas } from '../ui/ProportionalCanvas';
const { ccclass } = _decorator;

const WORLD_H = 637;
const WORLD_W = 1024;
const GROUND_Y = WORLD_H * 0.875; // 设计顶向下的碰撞地面线
/** 跳高镜头上移时，用背景图顶部天空色补上沿，不拉伸、不翻转原图 */
const SKY_FILL_H = 480;
const SKY_FILL_HEX = '#017DF6';
/** 背景按总结：高铺满 637，宽 = 高 × (1850/850) */
const BG_H = WORLD_H;
const BG_W = (WORLD_H * 1850) / 850;
/** 走动基准高 120，宽按 walk 96×132 保比例（对齐 iOS playerVisualSize） */
const CHAR_H = 120;
const CHAR_W = (CHAR_H * 96) / 132;
/** 直立飞行：高 = 120×2.35/1.5，宽按 454×814（对齐 iOS playerVisualSize） */
const FLIGHT_UPRIGHT_H = (CHAR_H * 2.35) / 1.5;
const FLIGHT_UPRIGHT_W = (FLIGHT_UPRIGHT_H * 454) / 814;
/** 倾斜飞行：高 = 120×2.2/1.5，宽按 567×690 */
const FLIGHT_TILT_H = (CHAR_H * 2.2) / 1.5;
const FLIGHT_TILT_W = (FLIGHT_TILT_H * 567) / 690;

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * Math.min(1, Math.max(0, t));
}

/** 地面↔飞行、竖直↔倾斜插值尺寸，避免用错比例把素材压扁 */
function playerVisualSize(flightBlend: number, tiltBlend: number): { w: number; h: number } {
    const flightW = lerp(FLIGHT_UPRIGHT_W, FLIGHT_TILT_W, tiltBlend);
    const flightH = lerp(FLIGHT_UPRIGHT_H, FLIGHT_TILT_H, tiltBlend);
    return {
        w: lerp(CHAR_W, flightW, flightBlend),
        h: lerp(CHAR_H, flightH, flightBlend),
    };
}

/** 走动用 PNG 静帧回退（帧序列未导入时） */
function walkFallbackKey(charId: string): string {
    const map: Record<string, string> = {
        doraemon: '哆啦A梦/哆啦A梦_walk.png',
        nobita: '大熊/大熊_walk.png',
        shizuka: '静香/静香_walk.png',
        dorami: '哆啦美/哆啦美_walk.png',
    };
    return `游戏内主界面/人物运动/人物左右走动gif/${map[charId] ?? map.doraemon}`;
}

function flightKey(charId: string, facing: 'left' | 'right', posture: '竖直' | '倾斜' = '竖直'): string {
    const folder: Record<string, string> = {
        doraemon: '哆啦A梦',
        nobita: '大熊',
        shizuka: '静香',
        dorami: '哆啦美',
    };
    const name = CHARACTER_PORTRAIT_NAMES[charId] ?? '哆啦A梦';
    // iOS：素材目录左右命名与画面朝向相反，按视觉朝向映射
    const facesLeft = facing === 'left';
    const dir = facesLeft ? '面向右' : '面向左';
    const suffix = facesLeft ? '向右' : '向左';
    return `游戏内主界面/人物运动/使用道具后的角色状态/飞行靴/${folder[charId] ?? folder.doraemon}/${dir}/${name}-飞行靴-${posture}-${suffix}.png`;
}

function gateColorName(color: 'blue' | 'red' | 'purple'): string {
    return color === 'blue' ? '蓝色' : color === 'red' ? '红色' : '紫色';
}

function entityKey(e: {
    type: string;
    gemColor?: string;
    itemId?: string;
    variant?: string;
    chestKind?: string;
}): string {
    const root = '游戏内主界面';
    switch (e.type) {
        case 'box':
            return `${root}/关卡机关与障碍素材/障碍物/木箱.png`;
        case 'rockBig':
            return `${root}/关卡机关与障碍素材/障碍物/石球_大型.png`;
        case 'rockStone':
            return `${root}/关卡机关与障碍素材/障碍物/岩石.png`;
        case 'concrete':
            return `${root}/关卡机关与障碍素材/障碍物/水泥方块.png`;
        case 'stoneWall':
            return `${root}/关卡机关与障碍素材/障碍物/石墙.png`;
        case 'barrelRed':
            return `${root}/关卡机关与障碍素材/障碍物/红色油桶组.png`;
        case 'barrelBlue':
            return `${root}/关卡机关与障碍素材/障碍物/蓝色油桶组.png`;
        case 'platform':
            return `${root}/关卡机关与障碍素材/悬浮台/悬浮地${e.variant ?? '1'}.png`;
        case 'spike':
            return `${root}/关卡机关与障碍素材/陷阱/地刺_三连.png`;
        case 'rock':
            return `${root}/关卡机关与障碍素材/陷阱/石球_小型.png`;
        case 'rockCrack':
            return `${root}/关卡机关与障碍素材/陷阱/石球_裂纹.png`;
        case 'chainSpike':
            return `${root}/关卡机关与障碍素材/陷阱/吊链落刺.png`;
        case 'wallSpike':
            return `${root}/关卡机关与障碍素材/陷阱/墙面侧刺.png`;
        case 'boardSpike':
            return `${root}/关卡机关与障碍素材/陷阱/木板侧刺.png`;
        case 'spear':
            return `${root}/关卡机关与障碍素材/陷阱/长矛.png`;
        case 'arrowDown':
            return `${root}/关卡机关与障碍素材/陷阱/箭矢_向下.png`;
        case 'arrowLeft':
            return `${root}/关卡机关与障碍素材/陷阱/箭矢_向左.png`;
        case 'arrowRight':
            return `${root}/关卡机关与障碍素材/陷阱/箭矢_向右.png`;
        case 'coin':
            return `${root}/游戏内随机掉落素材/货币/金币.png`;
        case 'gem': {
            const map: Record<string, string> = { blue: '蓝宝石', green: '绿宝石', red: '红宝石', purple: '紫宝石' };
            return `${root}/游戏内随机掉落素材/货币/${map[e.gemColor ?? 'blue']}.png`;
        }
        case 'item':
            return `${root}/游戏内随机掉落素材/通用道具/${itemById(e.itemId ?? 'energy_milk').name}.png`;
        case 'food': {
            const it = itemById(e.itemId ?? 'mini_dorayaki');
            return `${root}/游戏内随机掉落素材/食物道具/${CHARACTER_PORTRAIT_NAMES[it.owner ?? 'doraemon']}专用/${it.name}.png`;
        }
        case 'chest': {
            const names: Record<string, string> = {
                wood: '木宝箱',
                silver: '银宝箱',
                gold: '黄金宝箱',
                purple: '紫金宝箱',
            };
            return `${root}/游戏内随机掉落素材/宝箱/${names[e.chestKind ?? 'wood'] ?? '木宝箱'}.png`;
        }
        default:
            return `${root}/游戏内随机掉落素材/货币/金币.png`;
    }
}

function entitySize(e: { type: string; itemId?: string; gemColor?: string; variant?: string }): [number, number] {
    const sz = entityVisualSize(e);
    return [sz.w, sz.h];
}

function quickIconKey(itemId: string): string {
    const it = itemById(itemId);
    const root = '游戏内主界面/道具快捷栏';
    if (it.category === 'special') {
        return `${root}/特殊道具/${it.name}.png`;
    }
    if (it.category === 'common') {
        return `${root}/通用道具/${it.name}.png`;
    }
    return `${root}/食物道具/${CHARACTER_PORTRAIT_NAMES[it.owner ?? 'doraemon']}专用/${it.name}.png`;
}

/**
 * 局内页（总结 §3.4，M5 最小可玩集）：
 * 世界滚动 + 角色（跳/二段跳/飞行）+ 木箱/地刺/石球 + 金币/宝石/道具/宝箱拾取；
 * HUD（头像/五心/能量/得分距离/右五导航）+ 方向键 + 快捷栏 + 能量大招 + 暂停。
 * 结算经济入账留 M6。
 */
@ccclass('RunGamePage')
export class RunGamePage extends Component {
    mainCanvas?: ProportionalCanvas;

    private readonly app = GameAppState.instance;
    private readonly world: RunWorld;
    private readonly inputState: RunInput = { left: false, right: false, upPressed: false, up: false, down: false };
    private readonly entityNodes = new Map<number, Node>();
    private readonly usedCarried = new Set<string>();
    private readonly heartNodes: Node[] = [];
    private readonly energyNodes: Node[] = [];

    private bgTiles: Node[] = [];
    private bgSkyFills: Node[] = [];
    private characterNode!: Node;
    /** 仅负责左右镜像；击退倾斜加在 characterNode 上，避免 scaleX=-1 把倾角翻反/抵消 */
    private characterFaceNode!: Node;
    private gateNode!: Node;
    private effectNode: Node | null = null;
    private effectTimer = 0;
    private settled = false;
    private lastFlying = false;
    private lastFacing: 'left' | 'right' = 'right';
    private lastFlightFacing: 'left' | 'right' | null = null;
    private lastSig = '';
    private lastShield = 0;
    private lastHearts = 5;
    private lastJumps = 0;
    private lastHeartsShown = -1;
    private lastEnergyShown = -1;
    private prevTotalValue = 0;
    private scoreLabel?: Label;
    private distanceLabel?: Label;
    private energyIconNode: Node | null = null;
    /** 设计坐标 y（向下）；需低于右上导航按钮底边，避免重叠 */
    private energyIconBaseY = 178;
    private quickbarNode?: Node;
    private quickScrollView: ScrollView | null = null;
    private quickScrollContent: Node | null = null;
    private downKeyNode: Node | null = null;
    private worldLayer: Node | null = null;
    private lastDownFlying: boolean | null = null;
    private charHalfH = CHAR_H / 2;
    private lastBgOffset = Number.NaN;
    private lastBgCamY = Number.NaN;
    private lastScoreShown = -1;
    private lastDistShown = -1;
    private lastAuraActive = false;
    private auraDrawAcc = 0;
    private lastGateVisible = false;
    private lastCharSizeW = -1;
    private lastCharSizeH = -1;
    private lastGhostW = -1;
    private lastGhostH = -1;
    private readonly entityHalfH = new Map<number, number>();
    private readonly entityPool: Node[] = [];
    private readonly _deadEntityIds: number[] = [];
    private readonly walkAnim = new WalkAnim();
    private musicIcon: Node | null = null;
    private tipLabel?: Label;
    private tipNode?: Node;
    private tipBgNode?: Node;
    private auraNode?: Node;
    private rockShatterNode?: Node;
    private flightTiltNode?: Node;
    /** 极速跑鞋：角色本体半透明残影（非红块） */
    private readonly shoeGhosts: Node[] = [];
    private lastTip = '';

    constructor() {
        super();
        this.world = new RunWorld(
            GameAppState.instance.selectedLevel,
            GameAppState.instance.profile.selectedCharacter,
            (GameAppState.instance.profile.levelStars[`${GameAppState.instance.selectedLevel}`] ?? 0) >= 3,
        );
    }

    onLoad(): void {
        this.buildWorldLayer();
        const canvas = makeProportionalCanvas(this.node, 'HudCanvas', 1024, WORLD_H);
        this.mainCanvas = canvas;
        this.applyWorldScale();
        this.buildHud(canvas);
        this.buildInput(canvas);
        this.bindKeyboard();
        this.refreshHearts();
        this.refreshEnergy();
        this.refreshQuickbar();
        this.refreshHudText();
    }

    onDestroy(): void {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
    }

    /** 窗口变化时由 Boot 调用：世界层与 HUD 画布同步缩放 */
    resize(): void {
        this.applyWorldScale();
    }

    update(dt: number): void {
        if (this.app.modals.length > 0) {
            this.inputState.upPressed = false;
            return;
        }
        // 卡顿掉帧时限制单帧步进，避免穿透与逻辑爆炸
        const step = Math.min(dt, 1 / 30);
        this.world.update(step, this.inputState);
        this.inputState.upPressed = false;
        if (this.world.player.jumps > this.lastJumps && this.world.player.flying <= 0) {
            this.playSfx('jump');
            haptic('light', this.app.profile.settings.vibrationEnabled);
        }
        this.lastJumps = this.world.player.jumps;
        this.renderWorld(step);
        this.refreshHearts();
        this.refreshEnergy();
        this.refreshHudText();
        this.refreshQuickbar();
        this.pulseEnergyIcon();
        this.refreshDownKey();
        this.handleSfx();

        if (this.world.isCompleting) {
            this.handleCompletionVfx(step);
        }
        if (this.world.finished) {
            this.handleFinish();
        }
    }

    private buildWorldLayer(): void {
        const layer = new Node('WorldLayer');
        this.node.addChild(layer);
        layer.addComponent(UITransform).setContentSize(WORLD_W, WORLD_H);
        this.worldLayer = layer;

        // 背景铺满世界高 637；色带垫在图下方，跳高时露出上沿而不盖住云
        for (let i = 0; i < 3; i++) {
            const fill = new Node(`BgSkyFill${i}`);
            layer.addChild(fill);
            fill.addComponent(UITransform).setContentSize(BG_W, SKY_FILL_H);
            const g = fill.addComponent(Graphics);
            g.fillColor.fromHEX(SKY_FILL_HEX);
            g.rect(-BG_W / 2, -SKY_FILL_H / 2, BG_W, SKY_FILL_H);
            g.fill();
            fill.setPosition((i - 0.5) * BG_W, (BG_H + SKY_FILL_H) / 2, 0);
            this.bgSkyFills.push(fill);
            const tile = makeSprite(layer, `Bg${i}`, BG_W, BG_H, '游戏内主界面/背景图.png');
            tile.setPosition((i - 0.5) * BG_W, 0, 0);
            this.bgTiles.push(tile);
        }

        // 终点门在角色之下，走近时角色能盖住大门
        this.gateNode = new Node('Gate');
        layer.addChild(this.gateNode);
        this.gateNode.addComponent(UITransform).setContentSize(375, 380);
        const gateSp = this.gateNode.addComponent(Sprite);
        gateSp.sizeMode = Sprite.SizeMode.CUSTOM;
        this.gateNode.active = false;
        this.gateLoaded = false;

        this.characterNode = new Node('Player');
        layer.addChild(this.characterNode);
        this.characterNode.addComponent(UITransform).setContentSize(CHAR_W, CHAR_H);
        // 底锚点：滚石击退倾斜绕脚底旋转（对齐 iOS rotationEffect anchor: .bottom）
        this.characterNode.getComponent(UITransform)!.setAnchorPoint(0.5, 0);

        this.characterFaceNode = makeSprite(
            this.characterNode,
            'Face',
            CHAR_W,
            CHAR_H,
            walkFallbackKey(this.app.profile.selectedCharacter),
        );
        this.characterFaceNode.getComponent(UITransform)?.setAnchorPoint(0.5, 0);
        this.characterFaceNode.setPosition(0, 0, 0);
        // 贴图未到前隐藏，不用蓝色占位块
        let faceOp = this.characterFaceNode.getComponent(UIOpacity);
        if (!faceOp) {
            faceOp = this.characterFaceNode.addComponent(UIOpacity);
        }
        const cached = getCachedSpriteFrame(walkFallbackKey(this.app.profile.selectedCharacter));
        faceOp.opacity = cached ? 255 : 0;
        if (cached) {
            this.applyCharacterFrame(cached);
        }

        // 飞行倾斜层：进关不预拉大图，首次飞行再 load（减轻进关 IO）
        this.flightTiltNode = new Node('PlayerTilt');
        layer.addChild(this.flightTiltNode);
        this.flightTiltNode.addComponent(UITransform).setContentSize(FLIGHT_TILT_W, FLIGHT_TILT_H);
        this.flightTiltNode.getComponent(UITransform)!.setAnchorPoint(0.5, 0);
        const tiltSp = this.flightTiltNode.addComponent(Sprite);
        tiltSp.sizeMode = Sprite.SizeMode.CUSTOM;
        this.flightTiltNode.active = false;
        let tiltOp = this.flightTiltNode.addComponent(UIOpacity);
        tiltOp.opacity = 0;

        // 跑鞋残影：复制角色精灵，仅移动时显示（对齐 iOS playerView 半透明副本）
        for (let i = 0; i < 2; i++) {
            const ghost = new Node(`ShoeGhost${i}`);
            layer.addChild(ghost);
            ghost.addComponent(UITransform).setContentSize(CHAR_W, CHAR_H);
            ghost.getComponent(UITransform)!.setAnchorPoint(0.5, 0);
            const sp = ghost.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            const op = ghost.addComponent(UIOpacity);
            op.opacity = 0;
            ghost.active = false;
            this.shoeGhosts.push(ghost);
        }

        this.auraNode = new Node('Aura');
        layer.addChild(this.auraNode);
        this.auraNode.addComponent(UITransform).setContentSize(420, 360);
        this.auraNode.addComponent(Graphics);

        this.rockShatterNode = new Node('RockShatter');
        layer.addChild(this.rockShatterNode);
        this.rockShatterNode.addComponent(UITransform).setContentSize(160, 160);
        this.rockShatterNode.addComponent(Graphics);
        this.rockShatterNode.active = false;

        this.walkAnim.load(this.app.profile.selectedCharacter, () => {
            const sprite = this.characterFaceNode.getComponent(Sprite);
            if (sprite && this.walkAnim.firstFrame) {
                this.applyCharacterFrame(this.walkAnim.firstFrame);
            } else {
                this.loadCharacterPose(walkFallbackKey(this.app.profile.selectedCharacter));
            }
        });

        this.syncWorldTransforms();
    }

    private gateLoaded = false;
    private ensureGateSprite(): void {
        if (this.gateLoaded || !this.gateNode) {
            return;
        }
        this.gateLoaded = true;
        const key = `游戏内主界面/通关素材/终点/终点大门-${gateColorName(this.world.gateColor)}.png`;
        loadSpriteFrame(key, (frame) => {
            const sp = this.gateNode.getComponent(Sprite);
            if (frame && sp && sp.isValid) {
                sp.spriteFrame = frame;
                sp.sizeMode = Sprite.SizeMode.CUSTOM;
                this.gateNode.getComponent(UITransform)?.setContentSize(375, 380);
            }
        });
    }

    /** 世界 y（相对地面向上）→ 层内本地 y（中心原点、向上为正） */
    private worldToLocalY(feetAboveGround: number, halfH: number): number {
        // 地面线在设计顶向下 GROUND_Y → 本地 y = H/2 - GROUND_Y
        const groundLocal = WORLD_H / 2 - GROUND_Y;
        return groundLocal + feetAboveGround + halfH - this.world.cameraY;
    }

    private worldToLocalX(worldX: number): number {
        return worldX - this.world.cameraX - WORLD_W / 2;
    }

    private syncWorldTransforms(): void {
        const p = this.world.player;
        // 底锚点：脚底 y
        this.characterNode.setPosition(this.worldToLocalX(p.x), this.worldToLocalY(p.y, 0), 0);
        this.gateNode.setPosition(this.worldToLocalX(this.world.gateX), this.worldToLocalY(0, 190) + 4, 0);
    }

    private applyWorldScale(): void {
        if (!this.worldLayer) {
            return;
        }
        const visible = view.getVisibleSize();
        const s = Math.min(visible.width / 1024, visible.height / WORLD_H);
        this.worldLayer.setScale(s, s, 1);
    }

    private buildHud(canvas: ProportionalCanvas): void {
        const char = characterById(this.app.profile.selectedCharacter);
        const portrait = makeSprite(
            canvas.node,
            'Portrait',
            100,
            100,
            `游戏内主界面/血条+头像+能量条/人物头像（方形的）/角色卡_${char.name}.png`,
        );
        canvas.place(portrait, 12, 92);

        for (let i = 0; i < 5; i++) {
            const heart = makeSprite(canvas.node, `Heart${i}`, 34, 34, '游戏内主界面/血条+头像+能量条/血量/红心.png');
            canvas.place(heart, 96 + i * 36, 59);
            this.heartNodes.push(heart);
        }

        makeSprite(canvas.node, 'EnergyFrame', 200, 40, '游戏内主界面/血条+头像+能量条/能量条/001-蓝色血条.png');
        canvas.place(canvas.node.getChildByName('EnergyFrame')!, 170, 101);
        const energyColors = ['003-黄色能量块', '004-黄绿能量块', '005-浅绿能量块', '006-绿色能量块', '007-深绿能量块'];
        for (let i = 0; i < 5; i++) {
            const gem = makeSprite(
                canvas.node,
                `Energy${i}`,
                36,
                24,
                `游戏内主界面/血条+头像+能量条/能量条/${energyColors[i]}.png`,
            );
            canvas.place(gem, 96 + i * 36, 101);
            this.energyNodes.push(gem);
        }

        const scoreTitle = makeSprite(canvas.node, 'ScoreTitle', 64, 37, '游戏内主界面/得分距离文字/001-得分标签.png');
        canvas.place(scoreTitle, 512, 56);
        this.scoreLabel = makeLabel(canvas.node, 'Score', '0', 22, '#FFFFFF', 140, 28, '#1A1A1A');
        canvas.place(this.scoreLabel.node, 512, 88);
        const distTitle = makeSprite(canvas.node, 'DistTitle', 64, 37, '游戏内主界面/得分距离文字/002-距离标签.png');
        canvas.place(distTitle, 512, 118);
        this.distanceLabel = makeLabel(canvas.node, 'Dist', '0m', 18, '#FFFFFF', 180, 26, '#1A1A1A');
        canvas.place(this.distanceLabel.node, 512, 150);

        const nav: Array<[string, string, () => void]> = [
            ['Inv', '游戏内主界面/按钮/导航按钮-背包.png', () => this.app.openInventory('run')],
            ['Music', '游戏内主界面/按钮/音量开启关闭/控制按钮-音量开启新版.png', () => this.toggleMusic()],
            ['Pause', '游戏内主界面/按钮/暂停开始/控制按钮-暂停大图.png', () => this.app.openPause()],
            ['Settings', '游戏内主界面/按钮/关卡设置按钮.png', () => this.app.openSettings()],
            ['Home', '游戏内主界面/按钮/导航按钮-首页.png', () => {
                this.app.clearModals();
                this.app.setScreen(Screen.Home);
            }],
        ];
        nav.forEach(([name, key, onClick], i) => {
            const btn = makeImageButton(canvas.node, name, 72, 72, key, onClick);
            canvas.place(btn, 706 + i * 80, 78);
            if (name === 'Music') {
                this.musicIcon = btn;
            }
        });

        this.quickbarNode = new Node('Quickbar');
        canvas.node.addChild(this.quickbarNode);

        // 效果提示：屏幕正中半透明黑底；文案≤5字；约 2.2s 后自动消失
        this.tipBgNode = makeRect(canvas.node, 'EffectTipBg', 160, 40, '#000000');
        let tipBgOp = this.tipBgNode.getComponent(UIOpacity);
        if (!tipBgOp) {
            tipBgOp = this.tipBgNode.addComponent(UIOpacity);
        }
        tipBgOp.opacity = 110;
        canvas.place(this.tipBgNode, 512, WORLD_H / 2);
        this.tipBgNode.active = false;
        this.tipLabel = makeLabel(canvas.node, 'EffectTip', '', 22, '#FFFFFF', 148, 36);
        this.tipNode = this.tipLabel.node;
        canvas.place(this.tipNode, 512, WORLD_H / 2);
        this.tipNode.active = false;
    }

    private buildInput(canvas: ProportionalCanvas): void {
        // 方向键：总结左上 (6,555) → 中心；略上移避免预览裁切底边
        const left = this.makeHoldButton(canvas.node, 'Left', 82, 82, '游戏内主界面/按钮/方向键/方向按钮-左.png');
        canvas.place(left, 47, 586);
        const right = this.makeHoldButton(canvas.node, 'Right', 82, 82, '游戏内主界面/按钮/方向键/方向按钮-右.png');
        canvas.place(right, 145, 586);
        const up = this.makeHoldButton(canvas.node, 'Up', 82, 82, '游戏内主界面/按钮/方向键/方向按钮-上.png');
        canvas.place(up, 977, 496);
        const down = this.makeHoldButton(canvas.node, 'Down', 82, 82, '游戏内主界面/按钮/方向键/方向按钮-下.png');
        canvas.place(down, 977, 586);
        this.downKeyNode = down;
        this.refreshDownKey();
    }

    private makeHoldButton(parent: Node, name: string, w: number, h: number, key: string): Node {
        const n = makeSprite(parent, name, w, h, key);
        const setHeld = (on: boolean) => {
            if (name === 'Left') {
                this.inputState.left = on;
            } else if (name === 'Right') {
                this.inputState.right = on;
            } else if (name === 'Down') {
                this.inputState.down = on;
            }
        };
        n.on(Node.EventType.TOUCH_START, () => {
            if (name === 'Up') {
                this.inputState.upPressed = true;
                this.inputState.up = true;
            } else {
                setHeld(true);
            }
        });
        n.on(Node.EventType.TOUCH_END, () => {
            if (name === 'Up') {
                this.inputState.up = false;
            } else {
                setHeld(false);
            }
        });
        n.on(Node.EventType.TOUCH_CANCEL, () => {
            if (name === 'Up') {
                this.inputState.up = false;
            } else {
                setHeld(false);
            }
        });
        return n;
    }

    private bindKeyboard(): void {
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
    }

    private onKeyDown(e: { keyCode: number }): void {
        switch (e.keyCode) {
            case KeyCode.ARROW_LEFT:
            case KeyCode.KEY_A:
                this.inputState.left = true;
                break;
            case KeyCode.ARROW_RIGHT:
            case KeyCode.KEY_D:
                this.inputState.right = true;
                break;
            case KeyCode.ARROW_UP:
            case KeyCode.KEY_W:
            case KeyCode.SPACE:
                this.inputState.upPressed = true;
                this.inputState.up = true;
                break;
            case KeyCode.ARROW_DOWN:
            case KeyCode.KEY_S:
                this.inputState.down = true;
                break;
            default:
                break;
        }
    }

    private onKeyUp(e: { keyCode: number }): void {
        switch (e.keyCode) {
            case KeyCode.ARROW_LEFT:
            case KeyCode.KEY_A:
                this.inputState.left = false;
                break;
            case KeyCode.ARROW_RIGHT:
            case KeyCode.KEY_D:
                this.inputState.right = false;
                break;
            case KeyCode.ARROW_UP:
            case KeyCode.KEY_W:
            case KeyCode.SPACE:
                this.inputState.up = false;
                break;
            case KeyCode.ARROW_DOWN:
            case KeyCode.KEY_S:
                this.inputState.down = false;
                break;
            default:
                break;
        }
    }

    private toggleMusic(): void {
        const s = this.app.profile.settings;
        s.musicVolume = s.musicVolume > 0 ? 0 : 8;
        this.app.commitProfile();
        AudioService.instance.applyVolumes(s.musicVolume, s.soundVolume);
        if (s.musicVolume > 0) {
            AudioService.instance.playBgm('home');
            this.swapMusicIcon(true);
        } else {
            this.swapMusicIcon(false);
        }
    }

    private swapMusicIcon(on: boolean): void {
        if (!this.musicIcon) {
            return;
        }
        const key = on
            ? '游戏内主界面/按钮/音量开启关闭/控制按钮-音量开启新版.png'
            : '游戏内主界面/按钮/音量开启关闭/控制按钮-音量关闭新版.png';
        const sprite = this.musicIcon.getComponent(Sprite);
        if (sprite) {
            loadSpriteFrame(key, (frame) => {
                if (frame && sprite.isValid) {
                    sprite.spriteFrame = frame;
                }
            });
        }
    }

    private renderWorld(dt: number): void {
        const p = this.world.player;
        const cam = this.world.cameraX;
        const camY = this.world.cameraY;
        const offset = -((cam % BG_W) + BG_W) % BG_W;
        if (offset !== this.lastBgOffset || camY !== this.lastBgCamY) {
            this.lastBgOffset = offset;
            this.lastBgCamY = camY;
            for (let i = 0; i < this.bgTiles.length; i++) {
                const x = offset + (i - 0.5) * BG_W;
                this.bgTiles[i].setPosition(x, -camY, 0);
                const fill = this.bgSkyFills[i];
                if (fill) {
                    fill.setPosition(x, -camY + (BG_H + SKY_FILL_H) / 2, 0);
                }
            }
        }

        // 实体同步：复用节点池；视野外隐藏，减少无效变换
        const viewLeft = cam - 80;
        const viewRight = cam + WORLD_W + 80;
        const alive = this._aliveScratch;
        alive.clear();
        for (let i = 0; i < this.world.entities.length; i++) {
            const e = this.world.entities[i];
            alive.add(e.id);
            let node = this.entityNodes.get(e.id);
            if (!node) {
                node = this.acquireEntityNode(e);
                this.entityNodes.set(e.id, node);
            }
            const inView = e.active !== false && e.x > viewLeft && e.x < viewRight;
            if (node.active !== inView) {
                node.active = inView;
            }
            if (inView) {
                const h = this.entityHalfH.get(e.id) ?? entitySize(e)[1];
                node.setPosition(this.worldToLocalX(e.x), this.worldToLocalY(e.y, h / 2), 0);
                if (e.rot != null) {
                    node.angle = e.rot;
                }
            }
        }
        this.stackRollingRocksAboveObstacles();
        this.entityNodes.forEach((_node, id) => {
            if (!alive.has(id)) {
                this._deadEntityIds.push(id);
            }
        });
        for (let i = 0; i < this._deadEntityIds.length; i++) {
            const id = this._deadEntityIds[i];
            const node = this.entityNodes.get(id);
            if (node) {
                this.releaseEntityNode(id, node);
            }
        }
        this._deadEntityIds.length = 0;

        const moving =
            !this.world.finished &&
            !this.world.isCompleting &&
            (this.inputState.left || this.inputState.right);
        if (this.inputState.left) {
            this.lastFacing = 'left';
        } else if (this.inputState.right) {
            this.lastFacing = 'right';
        }

        const flying = p.flying > 0;
        const faceSign = !flying && this.lastFacing === 'left' ? -1 : 1;
        if (this.characterFaceNode) {
            this.characterFaceNode.setScale(faceSign, 1, 1);
        }
        if (flying !== this.lastFlying) {
            this.lastFlying = flying;
            if (flying) {
                this.lastFlightFacing = this.lastFacing;
                this.loadFlightPose(this.lastFacing);
            } else {
                this.lastFlightFacing = null;
                if (this.flightTiltNode) {
                    this.flightTiltNode.active = false;
                }
                if (this.walkAnim.firstFrame) {
                    this.applyCharacterFrame(this.walkAnim.firstFrame);
                } else {
                    this.loadCharacterPose(walkFallbackKey(this.app.profile.selectedCharacter));
                }
            }
        } else if (flying && this.lastFlightFacing !== this.lastFacing) {
            this.lastFlightFacing = this.lastFacing;
            this.loadFlightPose(this.lastFacing);
        } else if (!flying) {
            const sprite = this.characterFaceNode.getComponent(Sprite);
            this.walkAnim.tick(dt, moving, sprite);
        }

        const blend = this.world.flightBlend;
        const tilt = this.world.flightTilt;
        const vis = playerVisualSize(blend, tilt);
        const halfH = vis.h / 2;
        this.charHalfH = halfH;
        const kb = this.world.knockbackVisualOffset;
        const tiltDeg = this.world.knockbackTiltDegrees;
        const px = this.worldToLocalX(p.x) + kb;
        const py = this.worldToLocalY(p.y, 0);
        // 倾倒加在父节点角度上：只跟撞击来向走，不被 Face 的左右 scale 翻转
        this.characterNode.setPosition(px, py, 0);
        this.characterNode.angle = tiltDeg;
        if (this.characterFaceNode) {
            this.characterFaceNode.angle = 0;
        }

        if (flying) {
            const upright = playerVisualSize(blend, 0);
            if (upright.w !== this.lastCharSizeW || upright.h !== this.lastCharSizeH) {
                this.lastCharSizeW = upright.w;
                this.lastCharSizeH = upright.h;
                this.characterNode.getComponent(UITransform)?.setContentSize(upright.w, upright.h);
                this.characterNode.getComponent(UITransform)?.setAnchorPoint(0.5, 0);
                this.characterFaceNode.getComponent(UITransform)?.setContentSize(upright.w, upright.h);
                this.characterFaceNode.getComponent(UITransform)?.setAnchorPoint(0.5, 0);
                const sp = this.characterFaceNode.getComponent(Sprite);
                if (sp) {
                    sp.sizeMode = Sprite.SizeMode.CUSTOM;
                }
            }
        } else if (this.lastCharSizeW !== CHAR_W || this.lastCharSizeH !== CHAR_H) {
            this.lastCharSizeW = CHAR_W;
            this.lastCharSizeH = CHAR_H;
            this.characterNode.getComponent(UITransform)?.setContentSize(CHAR_W, CHAR_H);
            this.characterFaceNode.getComponent(UITransform)?.setContentSize(CHAR_W, CHAR_H);
        }

        let charOp = this.characterFaceNode.getComponent(UIOpacity);
        if (!charOp) {
            charOp = this.characterFaceNode.addComponent(UIOpacity);
        }
        const hasFrame = !!this.characterFaceNode.getComponent(Sprite)?.spriteFrame;
        charOp.opacity = hasFrame ? Math.floor(this.world.damageOpacity * 255) : 0;

        if (this.flightTiltNode) {
            this.flightTiltNode.active = blend > 0.02;
            this.flightTiltNode.setPosition(px, py, 0);
            this.flightTiltNode.angle = tiltDeg;
            const tiltSize = playerVisualSize(blend, 1);
            const tut = this.flightTiltNode.getComponent(UITransform);
            tut?.setContentSize(tiltSize.w, tiltSize.h);
            tut?.setAnchorPoint(0.5, 0);
            let top = this.flightTiltNode.getComponent(UIOpacity);
            if (!top) {
                top = this.flightTiltNode.addComponent(UIOpacity);
            }
            top.opacity = Math.floor(blend * tilt * 255);
            if (blend > 0.05 && hasFrame) {
                charOp.opacity = Math.floor(this.world.damageOpacity * Math.max(0.05, blend * (1 - tilt)) * 255);
            }
        }

        this.refreshShoeGhosts(px, py, tiltDeg, vis, moving);
        this.drawAuras(px, py + halfH, halfH * 2, this.lastFacing, moving, dt);
        this.refreshEffectTip();
        this.drawRockShatter();

        const gateVisible = this.world.gateX - cam < 1250;
        if (gateVisible !== this.lastGateVisible) {
            this.lastGateVisible = gateVisible;
            this.gateNode.active = gateVisible;
            if (gateVisible) {
                this.ensureGateSprite();
            }
        }
        if (gateVisible) {
            this.gateNode.setPosition(this.worldToLocalX(this.world.gateX), this.worldToLocalY(0, 190) + 4, 0);
        }
    }

    private readonly _aliveScratch = new Set<number>();

    private acquireEntityNode(e: {
        id: number;
        type: string;
        gemColor?: string;
        itemId?: string;
        variant?: string;
        chestKind?: string;
    }): Node {
        const [w, h] = entitySize(e);
        this.entityHalfH.set(e.id, h);
        let node = this.entityPool.pop();
        const parent = this.characterNode.parent!;
        if (!node) {
            node = makeSprite(parent, `E${e.id}`, w, h, entityKey(e));
        } else {
            node.name = `E${e.id}`;
            node.parent = parent;
            node.active = true;
            node.angle = 0;
            const ut = node.getComponent(UITransform);
            ut?.setContentSize(w, h);
            const sp = node.getComponent(Sprite);
            if (sp) {
                sp.sizeMode = Sprite.SizeMode.CUSTOM;
                const key = entityKey(e);
                const cached = getCachedSpriteFrame(key);
                if (cached) {
                    sp.spriteFrame = cached;
                } else {
                    loadSpriteFrame(key, (frame) => {
                        if (frame && sp.isValid) {
                            sp.spriteFrame = frame;
                            sp.sizeMode = Sprite.SizeMode.CUSTOM;
                        }
                    });
                }
            }
        }
        return node;
    }

    /** 滚石盖住墙、箱等静态障碍，避免被挡住；角色与特效仍在最前 */
    private stackRollingRocksAboveObstacles(): void {
        const layer = this.worldLayer;
        if (!layer) {
            return;
        }
        for (let i = 0; i < this.world.entities.length; i++) {
            const e = this.world.entities[i];
            if (e.type !== 'rock' && e.type !== 'rockCrack') {
                continue;
            }
            const node = this.entityNodes.get(e.id);
            if (node && node.active && node.parent === layer) {
                node.setSiblingIndex(layer.children.length - 1);
            }
        }
        const bringFront = (n?: Node) => {
            if (n && n.parent === layer) {
                n.setSiblingIndex(layer.children.length - 1);
            }
        };
        bringFront(this.characterNode);
        bringFront(this.flightTiltNode);
        for (let i = 0; i < this.shoeGhosts.length; i++) {
            bringFront(this.shoeGhosts[i]);
        }
        bringFront(this.auraNode);
        bringFront(this.rockShatterNode);
    }

    private releaseEntityNode(id: number, node: Node): void {
        this.entityNodes.delete(id);
        this.entityHalfH.delete(id);
        node.active = false;
        node.removeFromParent();
        if (this.entityPool.length < 80) {
            this.entityPool.push(node);
        } else {
            node.destroy();
        }
    }

    /** 滚石撞碎：碎片向外蹦散后消失 */
    private drawRockShatter(): void {
        const fx = this.world.fx;
        const node = this.rockShatterNode;
        if (!node) {
            return;
        }
        if (fx.rockShatter <= 0) {
            node.active = false;
            return;
        }
        node.active = true;
        const g = node.getComponent(Graphics);
        if (!g) {
            return;
        }
        const t = fx.rockShatter / 0.32;
        node.setPosition(this.worldToLocalX(fx.rockShatterX), this.worldToLocalY(fx.rockShatterY, 0), 0);
        g.clear();
        for (let i = 0; i < 8; i++) {
            const ang = (i / 8) * Math.PI * 2 + (1 - t) * 0.6;
            const dist = (1 - t) * (28 + (i % 3) * 10);
            const px = Math.cos(ang) * dist;
            const py = Math.sin(ang) * dist * 0.85 + (1 - t) * 12;
            const r = 3 + (i % 3);
            g.fillColor = new Color(110 + (i % 4) * 18, 100 + (i % 3) * 12, 90, Math.floor(230 * t));
            g.circle(px, py, r);
            g.fill();
        }
    }

    private refreshEffectTip(): void {
        if (!this.tipLabel || !this.tipNode) {
            return;
        }
        const msg = this.world.effectMessage;
        if (!msg) {
            this.tipNode.active = false;
            if (this.tipBgNode) {
                this.tipBgNode.active = false;
            }
            this.lastTip = '';
            return;
        }
        this.tipNode.active = true;
        if (this.tipBgNode) {
            this.tipBgNode.active = true;
        }
        if (msg !== this.lastTip) {
            this.lastTip = msg;
            this.tipLabel.string = msg;
            // 按字数收紧半透明底，避免大黑块
            const chars = Array.from(msg).length;
            const bw = Math.max(112, Math.min(200, chars * 26 + 36));
            const bh = 40;
            const bgUt = this.tipBgNode?.getComponent(UITransform);
            if (bgUt) {
                bgUt.setContentSize(bw, bh);
            }
            const g = this.tipBgNode?.getComponent(Graphics);
            if (g) {
                g.clear();
                g.fillColor.fromHEX('#000000');
                g.roundRect(-bw / 2, -bh / 2, bw, bh, 10);
                g.fill();
            }
            this.tipLabel.node.getComponent(UITransform)?.setContentSize(bw - 12, bh - 4);
        }
    }

    /**
     * 极速跑鞋残影：用角色当前姿势的半透明副本（对齐 iOS playerView 残影）。
     * 仅在水平移动时出现；静止不画残影。
     */
    private refreshShoeGhosts(
        px: number,
        py: number,
        tiltDeg: number,
        vis: { w: number; h: number },
        moving: boolean,
    ): void {
        const p = this.world.player;
        const speedOn = p.shoe > 0 || p.heroBoost > 0;
        const src = this.characterFaceNode.getComponent(Sprite);
        const trailDir = this.lastFacing === 'left' ? 1 : -1;
        const sizeChanged = vis.w !== this.lastGhostW || vis.h !== this.lastGhostH;
        if (sizeChanged) {
            this.lastGhostW = vis.w;
            this.lastGhostH = vis.h;
        }

        for (let i = 0; i < this.shoeGhosts.length; i++) {
            const ghost = this.shoeGhosts[i];
            if (!speedOn || !moving || !src?.spriteFrame) {
                ghost.active = false;
                continue;
            }
            ghost.active = true;
            const sp = ghost.getComponent(Sprite)!;
            if (sp.spriteFrame !== src.spriteFrame) {
                sp.spriteFrame = src.spriteFrame;
                sp.sizeMode = Sprite.SizeMode.CUSTOM;
            }
            if (sizeChanged) {
                const ut = ghost.getComponent(UITransform)!;
                ut.setContentSize(vis.w, vis.h);
                ut.setAnchorPoint(0.5, 0);
            }
            ghost.setScale(this.characterFaceNode.scale);
            // 残影带左右翻转时，倾角需乘 scale.x，才能与角色父节点世界倾倒方向一致
            const sx = this.characterFaceNode.scale.x || 1;
            ghost.angle = tiltDeg * Math.sign(sx);
            ghost.setPosition(px + trailDir * (i + 1) * 14, py + (i + 1) * 2, 0);
            let op = ghost.getComponent(UIOpacity);
            if (!op) {
                op = ghost.addComponent(UIOpacity);
            }
            op.opacity = Math.floor(255 * (0.18 / (i + 1)));
        }
    }

    /** 程序绘制护盾/磁铁/幸运光环；无特效时跳过，有特效时约 20fps 重绘 */
    private drawAuras(
        px: number,
        py: number,
        playerH: number,
        facing: 'left' | 'right',
        moving = false,
        dt = 0.016,
    ): void {
        if (!this.auraNode) {
            return;
        }
        const p = this.world.player;
        const fx = this.world.fx;
        const shortFx =
            fx.shieldBreak > 0 ||
            fx.luckySpark > 0 ||
            fx.firstAid > 0 ||
            fx.vitalityPulse > 0 ||
            fx.milk > 0 ||
            fx.leapBurst > 0;
        const need =
            p.lucky > 0 ||
            p.magnet > 0 ||
            p.shield > 0 ||
            p.vitality > 0 ||
            shortFx ||
            ((p.shoe > 0 || p.heroBoost > 0) && moving);

        if (!need) {
            if (this.lastAuraActive) {
                this.auraNode.getComponent(Graphics)?.clear();
                this.auraNode.active = false;
                this.lastAuraActive = false;
                this.auraDrawAcc = 0;
            }
            return;
        }

        this.auraNode.active = true;
        this.auraNode.setPosition(px, py, 0);
        this.auraDrawAcc += dt;
        // 短暂特效跟帧；持续光环约 20fps 重绘
        const shouldRedraw = !this.lastAuraActive || shortFx || this.auraDrawAcc >= 0.05;
        if (!shouldRedraw) {
            return;
        }
        this.auraDrawAcc = 0;
        this.lastAuraActive = true;

        const g = this.auraNode.getComponent(Graphics);
        if (!g) {
            return;
        }
        g.clear();
        const phase = this.world.effectClock;
        const scale = Math.max(0.72, playerH / 120);
        const trailDir = facing === 'left' ? 1 : -1;

        // —— 幸运饮料：环绕彩点（点数略减）——
        if (p.lucky > 0) {
            const radius = 80 * scale;
            for (let i = 0; i < 6; i++) {
                const angle = phase * ((Math.PI * 2) / 1.2) + i * ((Math.PI * 2) / 6);
                const yellow = i % 3 === 0;
                g.fillColor = yellow ? new Color(255, 220, 40, 230) : new Color(80, 200, 80, 210);
                g.circle(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.72, yellow ? 3.5 : 2.5);
                g.fill();
            }
        }

        // —— 超级磁铁：红蓝半环 ——
        if (p.magnet > 0) {
            const diameter = playerH * 1.4 * (0.96 + 0.04 * Math.sin((phase * Math.PI * 2) / 1.5));
            const r = diameter / 2;
            g.fillColor = new Color(255, 40, 40, 28);
            g.circle(0, 0, r);
            g.fill();
            g.strokeColor = new Color(255, 60, 60, 200);
            g.lineWidth = 5;
            g.arc(0, 0, r, Math.PI * 0.52, Math.PI * 0.98, false);
            g.stroke();
            g.strokeColor = new Color(40, 220, 230, 210);
            g.arc(0, 0, r, Math.PI * 0.02, Math.PI * 0.48, false);
            g.stroke();
        }

        // —— 防护盾 / 碎裂 ——
        if (p.shield > 0 || fx.shieldBreak > 0) {
            const breaking = fx.shieldBreak > 0;
            const progress = breaking ? 1 - fx.shieldBreak / 0.3 : 0;
            const diameter = playerH * 1.3 * (1 + (breaking ? progress * 0.3 : 0.025 * Math.sin(phase * Math.PI)));
            const r = diameter / 2;
            g.fillColor = new Color(40, 120, 255, breaking ? Math.floor(40 * (1 - progress)) : 45);
            g.circle(0, 0, r);
            g.fill();
            g.strokeColor = new Color(80, 230, 255, breaking ? Math.floor(220 * (1 - progress)) : 220);
            g.lineWidth = 3;
            g.circle(0, 0, r);
            g.stroke();
            if (breaking) {
                for (let i = 0; i < 6; i++) {
                    const a = (i * Math.PI * 2) / 6;
                    const d = 40 + progress * 60;
                    g.fillColor = new Color(80, 230, 255, Math.floor(230 * (1 - progress)));
                    g.circle(Math.cos(a) * d, Math.sin(a) * d, 4);
                    g.fill();
                }
            }
        }

        // —— 极速跑鞋尾迹（仅移动；简化短线）——
        if ((p.shoe > 0 || p.heroBoost > 0) && moving) {
            for (let i = 0; i < 3; i++) {
                g.fillColor = new Color(255, 40, 40, Math.floor((190 - i * 30)));
                g.rect(trailDir * (18 + i * 14) - 4, -playerH * 0.15, 8, 3);
                g.fill();
            }
        }

        // —— 幸运金币火花 ——
        if (fx.luckySpark > 0) {
            const t = fx.luckySpark / 0.35;
            g.fillColor = new Color(255, 230, 60, Math.floor(255 * t));
            g.circle(0, playerH * 0.2, 6 + (1 - t) * 10);
            g.fill();
            g.fillColor = new Color(255, 160, 40, Math.floor(200 * t));
            g.circle(12, playerH * 0.1, 4);
            g.fill();
        }

        // —— 急救十字 ——
        if (fx.firstAid > 0) {
            const progress = 1 - Math.min(1, fx.firstAid / 0.8);
            const alpha = Math.floor(230 * (1 - progress * 0.35));
            g.fillColor = new Color(255, 40, 40, alpha);
            const s = playerH * 0.28 * (1 + progress * 0.35);
            g.rect(-s * 0.18, -s * 0.5, s * 0.36, s);
            g.fill();
            g.rect(-s * 0.5, -s * 0.18, s, s * 0.36);
            g.fill();
        }

        // —— 活力饮料：上升红柱 ——
        if (p.vitality > 0) {
            for (let i = 0; i < 3; i++) {
                const rise = (phase * 0.75 + i * 0.31) % 1;
                const x = (i - 1) * 18;
                const y = playerH * (0.05 - rise * 0.42);
                const h = playerH * 0.55;
                g.fillColor = new Color(255, 60, 60, Math.floor(160 * (1 - rise * 0.65)));
                g.rect(x - 5, y, 10, h);
                g.fill();
            }
        }
        if (fx.vitalityPulse > 0) {
            const t = fx.vitalityPulse / 0.32;
            g.fillColor = new Color(255, 50, 50, Math.floor(220 * t));
            g.circle(0, 0, 20 + (1 - t) * 30);
            g.fill();
        }

        if (fx.milk > 0) {
            const progress = 1 - Math.min(1, fx.milk / 0.6);
            g.fillColor = new Color(255, 255, 255, Math.floor(150 * (1 - progress)));
            g.circle(0, playerH * 0.06, playerH * 0.26);
            g.fill();
            g.strokeColor = new Color(255, 255, 255, Math.floor(255 * (1 - progress)));
            g.lineWidth = 3;
            g.circle(0, 0, 16 + progress * 40);
            g.stroke();
        }

        if (fx.leapBurst > 0) {
            const t = fx.leapBurst / 0.45;
            g.strokeColor = new Color(255, 220, 80, Math.floor(220 * t));
            g.lineWidth = 3;
            g.circle(0, -playerH * 0.35, 18 + (1 - t) * 40);
            g.stroke();
        }
    }

    private refreshHearts(): void {
        const hearts = this.world.player.hearts;
        if (hearts === this.lastHeartsShown) {
            return;
        }
        this.lastHeartsShown = hearts;
        this.heartNodes.forEach((node, i) => {
            const sprite = node.getComponent(Sprite);
            if (!sprite) {
                return;
            }
            const key = i < hearts ? '游戏内主界面/血条+头像+能量条/血量/红心.png' : '游戏内主界面/血条+头像+能量条/血量/灰心.png';
            loadSpriteFrame(key, (frame) => {
                if (frame && sprite.isValid) {
                    sprite.spriteFrame = frame;
                }
            });
        });
    }

    private refreshEnergy(): void {
        const energy = this.world.player.energy;
        if (energy === this.lastEnergyShown) {
            return;
        }
        this.lastEnergyShown = energy;
        const colors = ['003-黄色能量块', '004-黄绿能量块', '005-浅绿能量块', '006-绿色能量块', '007-深绿能量块'];
        this.energyNodes.forEach((node, i) => {
            const sprite = node.getComponent(Sprite);
            if (!sprite) {
                return;
            }
            const key = i < energy
                ? `游戏内主界面/血条+头像+能量条/能量条/${colors[i]}.png`
                : '游戏内主界面/血条+头像+能量条/能量条/灰色.png';
            loadSpriteFrame(key, (frame) => {
                if (frame && sprite.isValid) {
                    sprite.spriteFrame = frame;
                }
            });
        });
    }

    private refreshHudText(): void {
        const score = Math.floor(this.world.score);
        if (this.scoreLabel && score !== this.lastScoreShown) {
            this.lastScoreShown = score;
            this.scoreLabel.string = `${score}`;
        }
        const dist = Math.floor(this.world.distanceM);
        if (this.distanceLabel && dist !== this.lastDistShown) {
            this.lastDistShown = dist;
            this.distanceLabel.string = `${dist}m / ${this.world.targetM}m`;
        }
    }

    private refreshDownKey(): void {
        if (!this.downKeyNode) {
            return;
        }
        const flying = this.world.player.flying > 0;
        if (flying === this.lastDownFlying) {
            return;
        }
        this.lastDownFlying = flying;
        let ui = this.downKeyNode.getComponent(UIOpacity);
        if (!ui) {
            ui = this.downKeyNode.addComponent(UIOpacity);
        }
        // 未飞行：半透明（不可用态）；飞行中：不透明
        ui.opacity = flying ? 255 : 110;
    }

    private refreshQuickbar(): void {
        if (!this.quickbarNode) {
            return;
        }
        const w = this.world;
        const stackSig = w.collectedQuickOrder
            .map((id) => `${id}:${w.collectedQuickCounts[id] ?? 0}`)
            .join(',');
        const sig =
            this.app.profile.loadout.join(',') +
            '|' +
            stackSig +
            '|' +
            [...this.usedCarried].join(',') +
            '|' +
            (w.player.energy >= 5 ? '1' : '0');
        if (sig === this.lastSig) {
            return;
        }
        this.lastSig = sig;
        this.quickbarNode.destroyAllChildren();
        this.energyIconNode = null;
        this.quickScrollView = null;
        this.quickScrollContent = null;
        const canvas = this.mainCanvas;
        if (!canvas) {
            return;
        }

        // 能量满：64×64 大招图标（对齐 iOS；脉冲在 pulseEnergyIcon）
        if (w.player.energy >= 5) {
            const skillItem = this.energySkillItemId();
            this.energyIconNode = makeSprite(this.quickbarNode, 'EnergySkill', 64, 64, quickIconKey(skillItem));
            this.energyIconBaseY = 178;
            canvas.place(this.energyIconNode, 968, this.energyIconBaseY);
            this.energyIconNode.on(Node.EventType.TOUCH_START, () => {
                playButtonHaptic();
                const tip = this.world.activateEnergy(this.app.profile.selectedCharacter);
                this.app.toast(tip);
                this.lastSig = '';
                this.refreshQuickbar();
            });
        }

        // 普通道具视口 76×198：堆叠拾取 + 携带；超过约 3 格可上下滑（对齐 iOS）
        const viewport = new Node('QuickScroll');
        this.quickbarNode.addChild(viewport);
        viewport.addComponent(UITransform).setContentSize(76, 198);
        viewport.addComponent(Mask);
        // 视口顶约在能量图标下方；整体低于右上导航，避免叠按钮
        canvas.place(viewport, 968, 320);

        const content = new Node('QuickContent');
        viewport.addChild(content);
        const contentUt = content.addComponent(UITransform);
        contentUt.setAnchorPoint(0.5, 1);
        content.setPosition(0, 99, 0); // 顶对齐视口

        const slotH = 64;
        const gap = 6;
        let yFromTop = 0;
        const placeInContent = (node: Node, localYFromTop: number) => {
            // content 锚点顶中：y 向下为负
            node.setPosition(0, -localYFromTop - slotH / 2, 0);
        };

        w.collectedQuickOrder.forEach((itemId, i) => {
            const count = w.collectedQuickCounts[itemId] ?? 0;
            const slot = makeSprite(content, `Picked${i}`, 58, 58, quickIconKey(itemId));
            placeInContent(slot, yFromTop);
            if (count > 1) {
                const badge = makeLabel(content, `Badge${i}`, `×${count}`, 13, '#FFFFFF', 36, 18, '#000000');
                badge.node.setPosition(18, -yFromTop - slotH / 2 - 18, 0);
            }
            slot.on(Node.EventType.TOUCH_START, () => {
                if ((this.world.collectedQuickCounts[itemId] ?? 0) <= 0) {
                    return;
                }
                playButtonHaptic();
                const tip = this.world.useItem(itemId);
                this.world.consumeCollectedItem(itemId);
                if (tip) {
                    this.world.setEffectMessage(tip);
                }
                this.lastSig = '';
                this.refreshQuickbar();
            });
            yFromTop += slotH + gap;
        });

        this.app.profile.loadout.forEach((itemId, i) => {
            const used = this.usedCarried.has(itemId);
            const slot = makeSprite(content, `Carried${i}`, 58, 58, quickIconKey(itemId));
            placeInContent(slot, yFromTop);
            let ui = slot.getComponent(UIOpacity);
            if (!ui) {
                ui = slot.addComponent(UIOpacity);
            }
            ui.opacity = used ? 97 : 255;
            if (!used) {
                slot.on(Node.EventType.TOUCH_START, () => {
                    playButtonHaptic();
                    const tip = this.world.useItem(itemId);
                    if (tip) {
                        this.world.setEffectMessage(tip);
                    }
                    this.usedCarried.add(itemId);
                    this.lastSig = '';
                    this.refreshQuickbar();
                });
            }
            yFromTop += slotH + gap;
        });

        const contentH = Math.max(198, yFromTop > 0 ? yFromTop - gap : 0);
        contentUt.setContentSize(76, contentH);

        const sv = viewport.addComponent(ScrollView);
        sv.vertical = true;
        sv.horizontal = false;
        sv.inertia = true;
        sv.brake = 0.75;
        sv.elastic = false;
        sv.cancelInnerEvents = false;
        sv.content = content;
        this.quickScrollView = sv;
        this.quickScrollContent = content;
    }

    /** 能量满图标：缩放闪烁 + 上下浮动（对齐 iOS energyPulse / flicker / bob） */
    private pulseEnergyIcon(): void {
        const node = this.energyIconNode;
        if (!node || !node.isValid || this.world.player.energy < 5) {
            return;
        }
        const t = this.world.effectClock;
        const pulse = 1 + 0.045 * Math.sin(t * Math.PI * 3.2);
        node.setScale(pulse, pulse, 1);
        let op = node.getComponent(UIOpacity);
        if (!op) {
            op = node.addComponent(UIOpacity);
        }
        op.opacity = Math.round(255 * (0.86 + 0.14 * (0.5 + 0.5 * Math.sin(t * Math.PI * 4.6))));
        const canvas = this.mainCanvas;
        if (canvas) {
            const bob = Math.sin(t * Math.PI * 2.4) * 3;
            canvas.place(node, 968, this.energyIconBaseY + bob);
        }
    }

    private energySkillItemId(): string {
        const map: Record<string, string> = {
            doraemon: 'flight_boots',
            nobita: 'speed_shoes',
            shizuka: 'shield',
            dorami: 'magnet',
        };
        return map[this.app.profile.selectedCharacter] ?? 'shield';
    }

    private handleSfx(): void {
        const w = this.world;
        const total =
            w.collectedCoins +
            w.collectedGems.blue +
            w.collectedGems.green +
            w.collectedGems.red +
            w.collectedGems.purple +
            w.collectedItems.length +
            w.collectedChests;
        if (total > this.prevTotalValue) {
            this.playSfx('pickup');
        }
        this.prevTotalValue = total;
        if (w.player.hearts < this.lastHearts) {
            // 滚石击退：iOS 局内仅强震动、不播 hurt；其它受击播 hurt
            if (w.rockKnockback) {
                haptic('heavy', this.app.profile.settings.vibrationEnabled);
            } else {
                this.playSfx('hurt');
                haptic('heavy', this.app.profile.settings.vibrationEnabled);
            }
        }
        if (w.player.shield < this.lastShield) {
            this.playSfx('confirm');
            haptic('rigid', this.app.profile.settings.vibrationEnabled);
        }
        this.lastShield = w.player.shield;
        this.lastHearts = w.player.hearts;
    }

    private loadFlightPose(facing: 'left' | 'right'): void {
        this.loadCharacterPose(flightKey(this.app.profile.selectedCharacter, facing, '竖直'));
        loadSpriteFrame(flightKey(this.app.profile.selectedCharacter, facing, '倾斜'), (frame) => {
            const sp = this.flightTiltNode?.getComponent(Sprite);
            if (frame && sp && sp.isValid) {
                sp.spriteFrame = frame;
                sp.sizeMode = Sprite.SizeMode.CUSTOM;
                this.flightTiltNode?.getComponent(UITransform)?.setContentSize(FLIGHT_TILT_W, FLIGHT_TILT_H);
            }
        });
    }

    private playSfx(name: 'pickup' | 'hurt' | 'confirm' | 'jump'): void {
        AudioService.instance.playSfx(name);
    }

    private applyCharacterFrame(frame: SpriteFrame | null): void {
        if (!this.characterNode || !this.characterFaceNode) {
            return;
        }
        const flying = this.world.player.flying > 0;
        const size = flying
            ? playerVisualSize(Math.max(this.world.flightBlend, 0.001), 0)
            : { w: CHAR_W, h: CHAR_H };
        const sprite = this.characterFaceNode.getComponent(Sprite);
        this.characterNode.getComponent(UITransform)?.setContentSize(size.w, size.h);
        this.characterFaceNode.getComponent(UITransform)?.setContentSize(size.w, size.h);
        this.characterFaceNode.getComponent(UITransform)?.setAnchorPoint(0.5, 0);
        let op = this.characterFaceNode.getComponent(UIOpacity);
        if (!op) {
            op = this.characterFaceNode.addComponent(UIOpacity);
        }
        if (sprite && frame) {
            sprite.spriteFrame = frame;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            op.opacity = Math.floor(this.world.damageOpacity * 255);
            return;
        }
        // 无贴图时保持透明，不显示占位色块
        op.opacity = 0;
    }

    private loadCharacterPose(key: string): void {
        loadSpriteFrame(key, (frame) => {
            if (frame) {
                this.applyCharacterFrame(frame);
                return;
            }
            // walk PNG 未导入时回退到已有飞行靴立姿，避免蓝块占位
            if (key.includes('人物左右走动gif')) {
                loadSpriteFrame(flightKey(this.app.profile.selectedCharacter, this.lastFacing), (fb) => {
                    this.applyCharacterFrame(fb);
                });
                return;
            }
            this.applyCharacterFrame(null);
        });
    }

    /**
     * 通关特效（对齐 iOS）：在 isCompleting 期间播放，倒计时由 RunWorld 驱动。
     * 胜利音效改到结算页播放（与 iOS settleRun 一致），此处只 haptic。
     */
    private handleCompletionVfx(dt: number): void {
        if (!this.world.success) {
            return;
        }
        const duration = this.world.completionEffectDuration;
        if (!this.effectNode) {
            const canvas = this.mainCanvas;
            if (!canvas) {
                return;
            }
            const key = this.world.completionEffectName;
            this.effectNode = makeSprite(
                canvas.node,
                'WinEffect',
                440,
                390,
                `游戏内主界面/通关素材/通关特效/${key}.png`,
            );
            canvas.place(this.effectNode, 512, 318);
            this.effectNode.setScale(0.08, 0.08, 1);
            let ui = this.effectNode.getComponent(UIOpacity);
            if (!ui) {
                ui = this.effectNode.addComponent(UIOpacity);
            }
            ui.opacity = 0;
            haptic('success', this.app.profile.settings.vibrationEnabled);
            this.effectTimer = 0;
        }
        this.effectTimer += dt;
        const remaining = this.world.completionEffectRemaining;
        const progress = Math.min(1, 1 - remaining / duration);
        let scale = 1;
        if (progress < 0.16) {
            const t = progress / 0.16;
            scale = 0.08 + 1.1 * (1 - Math.pow(1 - t, 3));
        } else if (progress < 0.28) {
            const t = (progress - 0.16) / 0.12;
            scale = 1.18 - 0.18 * t;
        }
        const opacity = Math.min(1, progress / 0.12, Math.max(0, remaining / 0.3));
        this.effectNode.setScale(scale, scale, 1);
        let ui = this.effectNode.getComponent(UIOpacity);
        if (!ui) {
            ui = this.effectNode.addComponent(UIOpacity);
        }
        ui.opacity = Math.floor(opacity * 255);
    }

    /** finished 后进入结算（成功已播完特效；失败直接进） */
    private handleFinish(): void {
        if (this.settled) {
            return;
        }
        this.settle();
    }

    private settle(): void {
        if (this.settled) {
            return;
        }
        this.settled = true;
        // 已消耗的携带道具从 loadout 移除（未用完保留，M6 统一退回库存）
        const before = this.app.profile.loadout.length;
        this.app.profile.loadout = this.app.profile.loadout.filter((id) => !this.usedCarried.has(id));
        if (this.app.profile.loadout.length !== before) {
            this.app.commitProfile();
        }
        this.app.settleRun(this.world.outcome());
    }
}
