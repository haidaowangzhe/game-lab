import { native, sys } from 'cc';

/**
 * 震动反馈（对齐 iOS `GameHaptics`）。
 * - 受 `vibrationEnabled` 控制
 * - Android 真机必须 Manifest 声明 `VIBRATE`，改完后重新「构建+生成」
 * - 优先反射 `AppActivity.vibrateMs(毫秒)` / `vibratePulse()`，振幅拉满
 */

export type HapticKind = 'light' | 'medium' | 'heavy' | 'rigid' | 'success' | 'warning';

/** 各档时长（毫秒）。过短（如 30ms）在多数安卓马达上几乎无感。 */
const KIND_MS: Record<HapticKind, number> = {
    light: 70,
    medium: 110,
    heavy: 180,
    rigid: 130,
    success: 120,
    warning: 150,
};

function callAndroid(method: string, signature: string, ...args: Array<number>): boolean {
    try {
        if (sys.os === sys.OS.ANDROID && native?.reflection?.callStaticMethod) {
            native.reflection.callStaticMethod('com/cocos/game/AppActivity', method, signature, ...args);
            return true;
        }
    } catch {
        // fall through
    }
    return false;
}

function vibrateAndroid(kind: HapticKind, ms: number): boolean {
    if (sys.os !== sys.OS.ANDROID) {
        return false;
    }
    if (kind === 'success' || kind === 'warning') {
        if (callAndroid('vibratePulse', '()V')) {
            return true;
        }
    }
    if (callAndroid('vibrateMs', '(I)V', Math.max(60, Math.floor(ms)))) {
        return true;
    }
    try {
        if (native?.reflection?.callStaticMethod) {
            native.reflection.callStaticMethod('com/cocos/lib/CocosHelper', 'vibrate', '(F)V', Math.max(60, ms) / 1000);
            return true;
        }
    } catch {
        // fall through
    }
    return false;
}

function vibrateFallback(ms: number, kind: HapticKind): void {
    const durationMs = Math.max(60, ms);
    try {
        const nav = typeof navigator !== 'undefined' ? navigator : null;
        if (nav && typeof nav.vibrate === 'function') {
            if (kind === 'success' || kind === 'warning') {
                nav.vibrate([0, 80, 50, 120]);
            } else {
                nav.vibrate(durationMs);
            }
            return;
        }
    } catch {
        // ignore
    }
    try {
        const device = (globalThis as { jsb?: { device?: { vibrate?: (s: number) => void } } }).jsb?.device;
        if (device && typeof device.vibrate === 'function') {
            device.vibrate(durationMs / 1000);
            return;
        }
    } catch {
        // ignore
    }
    try {
        sys.vibrate(durationMs / 1000);
    } catch {
        // ignore
    }
}

/** 按档位触发震动 */
export function haptic(kind: HapticKind, enabled: boolean): void {
    if (!enabled) {
        return;
    }
    const ms = KIND_MS[kind] ?? KIND_MS.medium;
    if (sys.isNative && sys.os === sys.OS.ANDROID) {
        if (vibrateAndroid(kind, ms)) {
            return;
        }
    }
    vibrateFallback(ms, kind);
}

/** UI 按钮点击：比 light 更明显 */
export function hapticButton(enabled: boolean): void {
    haptic('medium', enabled);
}

/** 设置页：关→开时试震，用明显一档方便确认真机有感 */
export function hapticPreview(enabled: boolean): void {
    haptic('heavy', enabled);
}
