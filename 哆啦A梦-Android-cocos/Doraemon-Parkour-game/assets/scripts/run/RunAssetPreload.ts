import { CHARACTER_PORTRAIT_NAMES } from '../data/GameData';
import { walkFrameKeys } from './WalkAnim';
import { preloadSpriteFrames } from '../ui/UIKit';

const CHAR_FOLDER: Record<string, string> = {
    doraemon: '哆啦A梦',
    nobita: '大熊',
    shizuka: '静香',
    dorami: '哆啦美',
};

function walkFallbackKey(charId: string): string {
    const map: Record<string, string> = {
        doraemon: '哆啦A梦/哆啦A梦_walk.png',
        nobita: '大熊/大熊_walk.png',
        shizuka: '静香/静香_walk.png',
        dorami: '哆啦美/哆啦美_walk.png',
    };
    return `游戏内主界面/人物运动/人物左右走动gif/${map[charId] ?? map.doraemon}`;
}

/**
 * 进局前必须就绪的素材（角色优先，再 HUD／常见掉落／机关）。
 * 商城／背包大图不进此列表，避免拖慢进关。
 */
export function runCriticalAssetKeys(charId: string): string[] {
    const folder = CHAR_FOLDER[charId] ?? CHAR_FOLDER.doraemon;
    const portrait = CHARACTER_PORTRAIT_NAMES[charId] ?? '哆啦A梦';
    const root = '游戏内主界面';
    const keys: string[] = [
        // —— 角色（最高优先，列表靠前）——
        walkFallbackKey(charId),
        ...walkFrameKeys(charId),
        `${root}/背景图.png`,
        `${root}/血条+头像+能量条/人物头像（方形的）/角色卡_${portrait}.png`,
        `${root}/血条+头像+能量条/血量/红心.png`,
        `${root}/血条+头像+能量条/血量/灰心.png`,
        `${root}/血条+头像+能量条/能量条/001-蓝色血条.png`,
        `${root}/血条+头像+能量条/能量条/003-黄色能量块.png`,
        `${root}/血条+头像+能量条/能量条/004-黄绿能量块.png`,
        `${root}/血条+头像+能量条/能量条/005-浅绿能量块.png`,
        `${root}/血条+头像+能量条/能量条/006-绿色能量块.png`,
        `${root}/血条+头像+能量条/能量条/007-深绿能量块.png`,
        `${root}/血条+头像+能量条/能量条/灰色.png`,
        `${root}/得分距离文字/001-得分标签.png`,
        `${root}/得分距离文字/002-距离标签.png`,
        // —— 导航 / 方向键 ——
        `${root}/按钮/导航按钮-背包.png`,
        `${root}/按钮/音量开启关闭/控制按钮-音量开启新版.png`,
        `${root}/按钮/音量开启关闭/控制按钮-音量关闭新版.png`,
        `${root}/按钮/暂停开始/控制按钮-暂停大图.png`,
        `${root}/按钮/关卡设置按钮.png`,
        `${root}/按钮/导航按钮-首页.png`,
        `${root}/按钮/方向键/方向按钮-左.png`,
        `${root}/按钮/方向键/方向按钮-右.png`,
        `${root}/按钮/方向键/方向按钮-上.png`,
        `${root}/按钮/方向键/方向按钮-下.png`,
        // —— 常见掉落 / 机关 ——
        `${root}/游戏内随机掉落素材/货币/金币.png`,
        `${root}/游戏内随机掉落素材/货币/蓝宝石.png`,
        `${root}/游戏内随机掉落素材/货币/绿宝石.png`,
        `${root}/游戏内随机掉落素材/货币/红宝石.png`,
        `${root}/游戏内随机掉落素材/货币/紫宝石.png`,
        `${root}/游戏内随机掉落素材/宝箱/木宝箱.png`,
        `${root}/游戏内随机掉落素材/宝箱/银宝箱.png`,
        `${root}/游戏内随机掉落素材/宝箱/黄金宝箱.png`,
        `${root}/游戏内随机掉落素材/宝箱/紫金宝箱.png`,
        `${root}/游戏内随机掉落素材/通用道具/能量牛奶.png`,
        `${root}/游戏内随机掉落素材/通用道具/极速跑鞋.png`,
        `${root}/游戏内随机掉落素材/通用道具/防护盾.png`,
        `${root}/游戏内随机掉落素材/通用道具/超级磁铁.png`,
        `${root}/游戏内随机掉落素材/通用道具/飞行靴.png`,
        `${root}/关卡机关与障碍素材/障碍物/木箱.png`,
        `${root}/关卡机关与障碍素材/障碍物/石球_大型.png`,
        `${root}/关卡机关与障碍素材/障碍物/岩石.png`,
        `${root}/关卡机关与障碍素材/障碍物/水泥方块.png`,
        `${root}/关卡机关与障碍素材/障碍物/石墙.png`,
        `${root}/关卡机关与障碍素材/障碍物/红色油桶组.png`,
        `${root}/关卡机关与障碍素材/障碍物/蓝色油桶组.png`,
        `${root}/关卡机关与障碍素材/悬浮台/悬浮地1.png`,
        `${root}/关卡机关与障碍素材/悬浮台/悬浮地2.png`,
        `${root}/关卡机关与障碍素材/悬浮台/悬浮地3.png`,
        `${root}/关卡机关与障碍素材/悬浮台/悬浮地4.png`,
        `${root}/关卡机关与障碍素材/陷阱/地刺_三连.png`,
        `${root}/关卡机关与障碍素材/陷阱/石球_小型.png`,
        `${root}/关卡机关与障碍素材/陷阱/石球_裂纹.png`,
        `${root}/关卡机关与障碍素材/陷阱/吊链落刺.png`,
        `${root}/关卡机关与障碍素材/陷阱/墙面侧刺.png`,
        `${root}/关卡机关与障碍素材/陷阱/木板侧刺.png`,
        `${root}/关卡机关与障碍素材/陷阱/长矛.png`,
        `${root}/关卡机关与障碍素材/陷阱/箭矢_向下.png`,
        `${root}/关卡机关与障碍素材/陷阱/箭矢_向左.png`,
        `${root}/关卡机关与障碍素材/陷阱/箭矢_向右.png`,
        `${root}/通关素材/终点/终点大门-蓝色.png`,
        `${root}/通关素材/终点/终点大门-红色.png`,
        `${root}/通关素材/终点/终点大门-紫色.png`,
        // 快捷栏成品图标（出战角色食物 + 通用）
        `${root}/道具快捷栏/通用道具/能量牛奶.png`,
        `${root}/道具快捷栏/通用道具/极速跑鞋.png`,
        `${root}/道具快捷栏/通用道具/防护盾.png`,
        `${root}/道具快捷栏/通用道具/超级磁铁.png`,
        `${root}/道具快捷栏/通用道具/飞行靴.png`,
    ];

    // 基础食物（按角色）
    const foodByChar: Record<string, string> = {
        doraemon: `${root}/游戏内随机掉落素材/食物道具/哆啦A梦专用/迷你铜锣烧.png`,
        nobita: `${root}/游戏内随机掉落素材/食物道具/大熊专用/蜂蜜松饼.png`,
        shizuka: `${root}/游戏内随机掉落素材/食物道具/静香专用/甜心棒棒糖.png`,
        dorami: `${root}/游戏内随机掉落素材/食物道具/哆啦美专用/新鲜橙子.png`,
    };
    keys.push(foodByChar[charId] ?? foodByChar.doraemon);

    // 飞行靴立姿（进关后可能立刻用到，体积相对走动大但仍值得预载）
    for (const facing of ['面向左', '面向右'] as const) {
        const suffix = facing === '面向左' ? '向左' : '向右';
        keys.push(
            `${root}/人物运动/使用道具后的角色状态/飞行靴/${folder}/${facing}/${portrait}-飞行靴-竖直-${suffix}.png`,
        );
    }

    return keys;
}

/** 进局预加载；onProgress 0–1 */
export function preloadRunAssets(
    charId: string,
    onProgress?: (progress: number) => void,
): Promise<void> {
    return preloadSpriteFrames(runCriticalAssetKeys(charId), onProgress);
}
