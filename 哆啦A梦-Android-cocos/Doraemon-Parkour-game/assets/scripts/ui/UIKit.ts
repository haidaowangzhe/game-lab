import { Button, Graphics, Label, Node, resources, Sprite, SpriteFrame, UITransform, view } from 'cc';
import { AudioService } from '../core/AudioService';
import { GameAppState } from '../core/GameAppState';
import { hapticButton } from '../core/Haptics';
import { ProportionalCanvas } from './ProportionalCanvas';

/**
 * 通用 UI 构造与运行时资源加载（对齐总结 §4.4 / §1.5 路径键约定）。
 * 运行时图源：assets/resources/素材/…；路径键 = "页面目录/文件名"。
 */

const spriteFrameCache = new Map<string, SpriteFrame | null>();
const spriteFrameLoading = new Map<string, Array<(frame: SpriteFrame | null) => void>>();

/** 手机端同时 decode 过多大图会 OOM / native missing；限制并发 */
const MAX_CONCURRENT_SPRITE_LOADS = 4;
let activeSpriteLoads = 0;
const spriteLoadQueue: Array<() => void> = [];

function pumpSpriteLoadQueue(): void {
    while (activeSpriteLoads < MAX_CONCURRENT_SPRITE_LOADS && spriteLoadQueue.length > 0) {
        const job = spriteLoadQueue.shift();
        if (job) {
            job();
        }
    }
}

export function loadSpriteFrame(key: string, onLoaded: (frame: SpriteFrame | null) => void): void {
    if (spriteFrameCache.has(key)) {
        onLoaded(spriteFrameCache.get(key) ?? null);
        return;
    }
    const waiting = spriteFrameLoading.get(key);
    if (waiting) {
        waiting.push(onLoaded);
        return;
    }
    spriteFrameLoading.set(key, [onLoaded]);
    const base = key.replace(/\.(png|gif)$/i, '');
    const startLoad = () => {
        activeSpriteLoads += 1;
        resources.load(`素材/${base}/spriteFrame`, SpriteFrame, (err, frame) => {
            const result = err || !frame ? null : frame;
            if (!result) {
                console.warn(`[UIKit] 加载失败: ${key}`, err);
            }
            spriteFrameCache.set(key, result);
            const cbs = spriteFrameLoading.get(key) ?? [];
            spriteFrameLoading.delete(key);
            cbs.forEach((cb) => cb(result));
            activeSpriteLoads = Math.max(0, activeSpriteLoads - 1);
            pumpSpriteLoadQueue();
        });
    };
    spriteLoadQueue.push(startLoad);
    pumpSpriteLoadQueue();
}

/** 批量预加载（去重）；progress 0–1。已缓存键立即计为完成。限并发，避免手机爆内存。 */
export function preloadSpriteFrames(
    keys: string[],
    onProgress?: (progress: number) => void,
): Promise<void> {
    const unique = Array.from(new Set(keys.filter(Boolean)));
    if (unique.length === 0) {
        onProgress?.(1);
        return Promise.resolve();
    }
    let done = 0;
    return new Promise((resolve) => {
        const tick = () => {
            done += 1;
            onProgress?.(done / unique.length);
            if (done >= unique.length) {
                resolve();
            }
        };
        for (const key of unique) {
            loadSpriteFrame(key, () => tick());
        }
    });
}

/** 同步取缓存（预加载后可立刻贴图） */
export function getCachedSpriteFrame(key: string): SpriteFrame | null | undefined {
    return spriteFrameCache.get(key);
}

/** 创建带图片的节点（异步填图；缺失时保留空节点，不阻塞流程） */
export function makeSprite(parent: Node, name: string, w: number, h: number, key: string): Node {
    const n = new Node(name);
    parent.addChild(n);
    n.addComponent(UITransform).setContentSize(w, h);
    const sprite = n.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.type = Sprite.Type.SIMPLE;
    loadSpriteFrame(key, (frame) => {
        if (frame && n.isValid) {
            sprite.spriteFrame = frame;
            // 异步贴图到位后必须再锁显示框，否则会跳回原图像素尺寸导致错位/重叠
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            n.getComponent(UITransform)?.setContentSize(w, h);
        }
    });
    return n;
}

/** 纯色圆角矩形（占位/调试用） */
export function makeRect(parent: Node, name: string, w: number, h: number, hex: string): Node {
    const n = new Node(name);
    parent.addChild(n);
    n.addComponent(UITransform).setContentSize(w, h);
    const g = n.addComponent(Graphics);
    g.fillColor.fromHEX(hex);
    g.roundRect(-w / 2, -h / 2, w, h, 12);
    g.fill();
    return n;
}

export function makeLabel(
    parent: Node,
    name: string,
    text: string,
    size: number,
    hex: string,
    w = 1000,
    h = 60,
    outlineHex?: string,
): Label {
    const n = new Node(name);
    parent.addChild(n);
    n.addComponent(UITransform).setContentSize(w, h);
    const label = n.addComponent(Label);
    label.string = text;
    label.fontSize = size;
    label.lineHeight = size + 6;
    label.color.fromHEX(hex);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    if (outlineHex) {
        label.enableOutline = true;
        label.outlineColor.fromHEX(outlineHex);
        label.outlineWidth = Math.max(2, Math.round(size / 10));
    }
    return label;
}

/** UI 按钮点击震动（方向键 / 局内拾取不走这里） */
export function playButtonHaptic(): void {
    hapticButton(GameAppState.instance.profile.settings.vibrationEnabled);
}

/** 纯代码文字按钮（占位用；点击播 sfx_tap） */
export function makeTextButton(
    parent: Node,
    name: string,
    w: number,
    h: number,
    text: string,
    onClick: () => void,
): Node {
    const n = makeRect(parent, name, w, h, '#2E6EBE');
    const button = n.addComponent(Button);
    button.transition = Button.Transition.SCALE;
    const label = makeLabel(n, 'Label', text, 22, '#FFFFFF', w, h);
    label.node.setPosition(0, 0);
    n.on(Button.EventType.CLICK, () => {
        AudioService.instance.playSfx('tap');
        playButtonHaptic();
        onClick();
    });
    return n;
}

/** 图片按钮（点击播 sfx_tap） */
export function makeImageButton(
    parent: Node,
    name: string,
    w: number,
    h: number,
    key: string,
    onClick: () => void,
    silent = false,
): Node {
    const n = makeSprite(parent, name, w, h, key);
    const button = n.addComponent(Button);
    button.transition = Button.Transition.SCALE;
    n.on(Button.EventType.CLICK, () => {
        if (!silent) {
            AudioService.instance.playSfx('tap');
        }
        playButtonHaptic();
        onClick();
    });
    return n;
}

/** 全屏背景（铺满视口，保持素材比例 cover，避免地面被纵向压扁） */
export function fillBackground(parent: Node, key: string): Node {
    const visible = view.getVisibleSize();
    const aspect = 1850 / 850;
    let w = visible.width;
    let h = visible.width / aspect;
    if (h < visible.height) {
        h = visible.height;
        w = visible.height * aspect;
    }
    return makeSprite(parent, 'Background', w, h, key);
}

/** 纯色全屏背景（无图占位/深色底） */
export function fillSolidBackground(parent: Node, hex: string): Node {
    const visible = view.getVisibleSize();
    const n = new Node('Background');
    parent.addChild(n);
    n.addComponent(UITransform).setContentSize(visible.width, visible.height);
    const g = n.addComponent(Graphics);
    g.fillColor.fromHEX(hex);
    g.rect(-visible.width / 2, -visible.height / 2, visible.width, visible.height);
    g.fill();
    return n;
}

/**
 * 半透明黑遮罩（对齐 iOS RootView.sectionPresentation / ModalMask）。
 * opacity01：0~1，商城/背包路由底为 0.48，弹层为 0.55。
 */
export function fillDimOverlay(parent: Node, opacity01 = 0.48): Node {
    const visible = view.getVisibleSize();
    const n = new Node('DimOverlay');
    parent.addChild(n);
    n.addComponent(UITransform).setContentSize(visible.width, visible.height);
    const g = n.addComponent(Graphics);
    g.fillColor.fromHEX('#000000');
    g.fillColor.a = Math.round(Math.min(1, Math.max(0, opacity01)) * 255);
    g.rect(-visible.width / 2, -visible.height / 2, visible.width, visible.height);
    g.fill();
    return n;
}

/** 创建设计画布并应用缩放（画布节点位于父节点中心） */
export function makeProportionalCanvas(
    parent: Node,
    name: string,
    designWidth: number,
    designHeight: number,
): ProportionalCanvas {
    const node = new Node(name);
    parent.addChild(node);
    node.addComponent(UITransform);
    const canvas = node.addComponent(ProportionalCanvas);
    canvas.designWidth = designWidth;
    canvas.designHeight = designHeight;
    canvas.apply();
    return canvas;
}

/**
 * 弹层画布再乘 fit，避免贴屏幕边（对齐 iOS ModalMask 内边距）。
 * 竖向详情建议 ~0.82，横向面板 ~0.88。
 */
export function applyModalFit(canvas: ProportionalCanvas, fit = 0.85): void {
    canvas.apply();
    const s = canvas.node.scale.x * fit;
    canvas.node.setScale(s, s, 1);
}
