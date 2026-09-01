import { _decorator, BlockInputEvents, Button, Component, Graphics, Node, UITransform, view } from 'cc';
const { ccclass } = _decorator;

/**
 * 弹窗遮罩（对齐总结 §5.2 / §1.7 / iOS ModalMask）：
 * 半透明黑 0.55；阻断下层（商城/背包按钮等）全部点击；
 * 内容挂在 content 节点，由具体 Modal 组件填充。
 */
@ccclass('ModalMask')
export class ModalMask extends Component {
    private _maskGraphics?: Graphics;
    private _content?: Node;

    onLoad(): void {
        const ut = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
        const visible = view.getVisibleSize();
        ut.setContentSize(visible.width, visible.height);

        // 阻断穿透到 pageLayer（仅靠 Graphics 不会参与命中）
        if (!this.node.getComponent(BlockInputEvents)) {
            this.node.addComponent(BlockInputEvents);
        }
        let blocker = this.node.getComponent(Button);
        if (!blocker) {
            blocker = this.node.addComponent(Button);
        }
        blocker.transition = Button.Transition.NONE;

        const g = this.node.addComponent(Graphics);
        this._maskGraphics = g;
        this.redraw();

        this._content = new Node('Content');
        this.node.addChild(this._content);
        const cut = this._content.addComponent(UITransform);
        // 与遮罩同尺寸，避免子按钮因父节点过小点不中
        cut.setContentSize(visible.width, visible.height);
    }

    get content(): Node | undefined {
        return this._content;
    }

    redraw(): void {
        if (!this._maskGraphics) {
            return;
        }
        const ut = this.node.getComponent(UITransform);
        const w = ut ? ut.width : 1280;
        const h = ut ? ut.height : 720;
        const g = this._maskGraphics;
        g.clear();
        g.fillColor.fromHEX('#000000');
        g.fillColor.a = 140; // ≈ 0.55
        g.rect(-w / 2, -h / 2, w, h);
        g.fill();
    }
}
