import { Sprite, SpriteFrame } from 'cc';
import { loadSpriteFrame } from '../ui/UIKit';

/** iOS AnimatedAssetView：每帧约 0.12s；静止显示首帧，移动时循环 GIF 帧序列。 */
const FRAME_DT = 0.12;

const CHAR_FOLDER: Record<string, string> = {
    doraemon: '哆啦A梦',
    nobita: '大熊',
    shizuka: '静香',
    dorami: '哆啦美',
};

/** 走动 GIF 拆帧路径（Cocos 不直接播 GIF，用帧序列） */
export function walkFrameKeys(charId: string, count = 4): string[] {
    const folder = CHAR_FOLDER[charId] ?? CHAR_FOLDER.doraemon;
    const root = `游戏内主界面/人物运动/人物左右走动gif/${folder}/frames`;
    const keys: string[] = [];
    for (let i = 0; i < count; i++) {
        keys.push(`${root}/${String(i).padStart(2, '0')}.png`);
    }
    return keys;
}

export class WalkAnim {
    private frames: SpriteFrame[] = [];
    private index = 0;
    private acc = 0;
    private ready = false;

    load(charId: string, onReady?: () => void): void {
        this.frames = [];
        this.index = 0;
        this.acc = 0;
        this.ready = false;
        const keys = walkFrameKeys(charId);
        let pending = keys.length;
        const slots: Array<SpriteFrame | null> = new Array(keys.length).fill(null);
        keys.forEach((key, i) => {
            loadSpriteFrame(key, (frame) => {
                slots[i] = frame;
                pending--;
                if (pending <= 0) {
                    this.frames = slots.filter((f): f is SpriteFrame => !!f);
                    this.ready = this.frames.length > 0;
                    onReady?.();
                }
            });
        });
    }

    /** 移动中播动画；静止定格首帧 */
    tick(dt: number, moving: boolean, sprite: Sprite | null): void {
        if (!sprite || !this.ready || this.frames.length === 0) {
            return;
        }
        if (!moving) {
            this.index = 0;
            this.acc = 0;
            if (sprite.spriteFrame !== this.frames[0]) {
                sprite.spriteFrame = this.frames[0];
            }
            return;
        }
        this.acc += dt;
        while (this.acc >= FRAME_DT) {
            this.acc -= FRAME_DT;
            this.index = (this.index + 1) % this.frames.length;
            sprite.spriteFrame = this.frames[this.index];
        }
    }

    applyCurrent(sprite: Sprite | null): void {
        if (!sprite || !this.ready || this.frames.length === 0) {
            return;
        }
        sprite.spriteFrame = this.frames[this.index] ?? this.frames[0];
    }

    get firstFrame(): SpriteFrame | null {
        return this.frames[0] ?? null;
    }
}
