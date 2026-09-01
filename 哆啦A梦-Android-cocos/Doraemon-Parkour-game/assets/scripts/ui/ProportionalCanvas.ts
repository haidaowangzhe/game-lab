import { _decorator, Component, Node, UITransform, Vec3, view } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 设计画布等比缩放（对齐总结 §4.4 / 规范 §11）。
 * 画布原点左上、y 向下；节点锚点 (0.5, 0.5)；
 * 设计坐标 → 本节点本地坐标由 place() / designToLocal() 提供。
 * scale = min(可视宽/设计宽, 可视高/设计高)。
 */
@ccclass('ProportionalCanvas')
export class ProportionalCanvas extends Component {
    @property
    designWidth = 1280;

    @property
    designHeight = 720;

    private _scale = 1;

    onLoad(): void {
        this.apply();
        view.setResizeCallback(() => this.apply());
    }

    onDestroy(): void {
        view.setResizeCallback(null);
    }

    get scale(): number {
        return this._scale;
    }

    apply(): void {
        const visible = view.getVisibleSize();
        this._scale = Math.min(visible.width / this.designWidth, visible.height / this.designHeight);
        this.getComponent(UITransform)?.setContentSize(this.designWidth, this.designHeight);
        this.node.setScale(this._scale, this._scale, 1);
        this.node.setPosition(0, 0, 0);
    }

    /** 设计坐标（左上原点，y 向下）→ 本节点本地坐标（锚点中心） */
    designToLocal(x: number, y: number): Vec3 {
        return new Vec3(x - this.designWidth / 2, this.designHeight / 2 - y, 0);
    }

    /** 将子节点放到设计坐标处（子节点锚点中心） */
    place(node: Node, x: number, y: number): void {
        node.setPosition(this.designToLocal(x, y));
    }
}
