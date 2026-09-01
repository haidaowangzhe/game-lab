import { sys } from 'cc';
import { SAVE_KEY, SAVE_VERSION, defaultProfile, SaveProfile, SettingsProfile } from '../data/GameData';

/**
 * 本地存档读写骨架（对齐规范 §14 / 总结 §4.6）。
 * 读档失败一律回新档默认，不崩溃；清缓存只清结算摘要，保留进度。
 */
export class SaveStore {
    /** 读取存档；缺失/损坏时回新档默认 */
    load(): SaveProfile {
        try {
            const raw = sys.localStorage.getItem(SAVE_KEY);
            if (!raw) {
                return defaultProfile();
            }
            const parsed = JSON.parse(raw) as Partial<SaveProfile>;
            return this.mergeDefaults(parsed);
        } catch (e) {
            console.warn('[SaveStore] 读档失败，使用新档默认', e);
            return defaultProfile();
        }
    }

    /** 写入存档；失败不抛异常，返回是否成功 */
    save(profile: SaveProfile): boolean {
        try {
            sys.localStorage.setItem(SAVE_KEY, JSON.stringify(profile));
            return true;
        } catch (e) {
            console.warn('[SaveStore] 存档写入失败', e);
            return false;
        }
    }

    /** 清缓存：只清上次结算摘要，保留进度与解锁 */
    clearCache(profile: SaveProfile): boolean {
        profile.lastRunSummary = null;
        return this.save(profile);
    }

    /** 恢复新档默认（重置存档本体） */
    reset(): SaveProfile {
        try {
            sys.localStorage.removeItem(SAVE_KEY);
        } catch (e) {
            console.warn('[SaveStore] 重置存档失败', e);
        }
        return defaultProfile();
    }

    /** 结构合并：老档缺字段用默认补齐，防止升级后空指针 */
    private mergeDefaults(parsed: Partial<SaveProfile>): SaveProfile {
        const def = defaultProfile();
        const merged: SaveProfile = {
            ...def,
            ...parsed,
            settings: this.mergeSettings(def.settings, parsed.settings),
            itemInventory: { ...def.itemInventory, ...(parsed.itemInventory ?? {}) },
            chestInventory: { ...(parsed.chestInventory ?? {}) },
            keyInventory: { ...(parsed.keyInventory ?? {}) },
            levelStars: { ...(parsed.levelStars ?? {}) },
            firstClear: { ...(parsed.firstClear ?? {}) },
            nodeClaims: { ...(parsed.nodeClaims ?? {}) },
            unlockedCharacters: Array.isArray(parsed.unlockedCharacters)
                ? [...parsed.unlockedCharacters]
                : [...def.unlockedCharacters],
            loadout: Array.isArray(parsed.loadout) ? [...parsed.loadout] : [...def.loadout],
            version: SAVE_VERSION,
        };
        return merged;
    }

    private mergeSettings(def: SettingsProfile, src?: Partial<SettingsProfile>): SettingsProfile {
        return { ...def, ...(src ?? {}) };
    }
}
