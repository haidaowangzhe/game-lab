import { AudioClip, AudioSource, Node, resources } from 'cc';

export type BgmName = 'home' | 'run' | 'result';
export type SfxName = 'tap' | 'confirm' | 'jump' | 'hurt' | 'pickup' | 'chest' | 'win';

/**
 * 全游戏统一轻快 BGM（资源来自「轻快bgm.mp3」转码的 bgm_home）。
 * home / run / result 共用同一轨，切页不换歌，避免叠播与嘈杂感。
 */
const BGM_CLIP = 'audio/bgm_home';

const BGM_PATHS: Record<BgmName, string> = {
    home: BGM_CLIP,
    run: BGM_CLIP,
    result: BGM_CLIP,
};

const SFX_PATHS: Record<SfxName, string> = {
    tap: 'audio/sfx_tap',
    confirm: 'audio/sfx_confirm',
    jump: 'audio/sfx_jump',
    hurt: 'audio/sfx_hurt',
    pickup: 'audio/sfx_pickup',
    chest: 'audio/sfx_chest',
    win: 'audio/sfx_win',
};

/**
 * 音频服务：统一 BGM + SFX；音量 0–10 → 0–1；关音乐停 BGM。
 */
export class AudioService {
    private static _instance: AudioService | null = null;

    static get instance(): AudioService {
        if (!this._instance) {
            this._instance = new AudioService();
        }
        return this._instance;
    }

    private bgmSource: AudioSource | null = null;
    private sfxSource: AudioSource | null = null;
    private currentBgm: BgmName | null = null;
    private currentBgmPath: string | null = null;
    private bgmLoadToken = 0;
    private readonly clipCache = new Map<string, AudioClip>();

    musicVolume = 8;
    soundVolume = 8;

    init(bgmNode: Node, sfxNode: Node): void {
        this.bgmSource = bgmNode.addComponent(AudioSource);
        this.sfxSource = sfxNode.addComponent(AudioSource);
        this.applyVolumes(this.musicVolume, this.soundVolume);
    }

    applyVolumes(music: number, sound: number): void {
        this.musicVolume = music;
        this.soundVolume = sound;
        if (this.bgmSource) {
            this.bgmSource.volume = music / 10;
            if (music <= 0) {
                this.bgmSource.stop();
            } else if (this.currentBgmPath && !this.bgmSource.playing) {
                this.bgmSource.play();
            }
        }
        if (this.sfxSource) {
            this.sfxSource.volume = sound / 10;
        }
    }

    playBgm(name: BgmName): void {
        if (this.musicVolume <= 0) {
            this.currentBgm = name;
            return;
        }
        const path = BGM_PATHS[name];
        // 同一音轨已在播：只记逻辑名，不重载、不重启（进局/结算不换歌）
        if (path === this.currentBgmPath && this.bgmSource?.playing) {
            this.currentBgm = name;
            return;
        }
        this.currentBgm = name;
        this.currentBgmPath = path;
        const token = ++this.bgmLoadToken;
        this.loadClip(path, (clip) => {
            if (!clip || !this.bgmSource || token !== this.bgmLoadToken) {
                return;
            }
            // 先停再换，避免旧轨与新轨叠在一起发出嘈杂声
            if (this.bgmSource.playing) {
                this.bgmSource.stop();
            }
            this.bgmSource.clip = clip;
            this.bgmSource.loop = true;
            this.bgmSource.volume = this.musicVolume / 10;
            this.bgmSource.play();
        });
    }

    playSfx(name: SfxName): void {
        if (!this.sfxSource || this.soundVolume <= 0) {
            return;
        }
        this.loadClip(SFX_PATHS[name], (clip) => {
            if (clip && this.sfxSource) {
                this.sfxSource.playOneShot(clip, this.soundVolume / 10);
            }
        });
    }

    private loadClip(path: string, onLoaded: (clip: AudioClip | null) => void): void {
        const cached = this.clipCache.get(path);
        if (cached) {
            onLoaded(cached);
            return;
        }
        resources.load(path, AudioClip, (err, clip) => {
            if (err || !clip) {
                console.warn(`[AudioService] 加载失败: ${path}`, err);
                onLoaded(null);
                return;
            }
            this.clipCache.set(path, clip);
            onLoaded(clip);
        });
    }
}
