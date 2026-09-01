import { _decorator, Component, Graphics, Label, Node, UITransform, view } from 'cc';
const { ccclass } = _decorator;

/**
 * Toast 提示层（对齐 iOS RootView toast）：
 * 短文案胶囊置于**整屏正中**；半透明黑底；不拦截点击。
 * 所有 `GameAppState.toast(...)` 均经此层展示。
 */
@ccclass('ToastLayer')
export class ToastLayer extends Component {
    private _root?: Node;

    onLoad(): void {
        const root = new Node('ToastRoot');
        this.node.addChild(root);
        const ut = root.addComponent(UITransform);
        const visible = view.getVisibleSize();
        ut.setContentSize(visible.width, visible.height);
        this._root = root;
    }

    clearMessages(): void {
        if (!this._root) {
            return;
        }
        this._root.destroyAllChildren();
    }

    showMessages(messages: readonly string[]): void {
        this.clearMessages();
        if (!this._root) {
            return;
        }
        const visible = view.getVisibleSize();
        this._root.getComponent(UITransform)?.setContentSize(visible.width, visible.height);

        const count = messages.length;
        messages.forEach((msg, i) => {
            // 多条时相对屏幕中心略作竖直错开，整体仍居中
            const offsetY = (count - 1) * 34 - i * 68;
            this.spawnToast(msg, i, offsetY);
        });
    }

    private spawnToast(msg: string, index: number, offsetY: number): void {
        const n = new Node(`Toast${index}`);
        this._root!.addChild(n);

        const padX = 28;
        const padY = 14;
        const fontSize = 24;
        // 按字数估宽，钳制在屏宽内
        const approxW = Math.min(Math.max(msg.length * (fontSize + 2) + padX * 2, 160), view.getVisibleSize().width * 0.78);
        const boxH = fontSize + padY * 2 + 4;
        const ut = n.addComponent(UITransform);
        ut.setContentSize(approxW, boxH);
        n.setPosition(0, offsetY, 0);

        // 胶囊底：半透明黑（对齐 iOS Color.black.opacity(0.78) + Capsule）
        const g = n.addComponent(Graphics);
        g.fillColor.fromHEX('#000000');
        g.fillColor.a = 199; // ≈0.78
        const hw = approxW / 2;
        const hh = boxH / 2;
        const r = hh;
        g.roundRect(-hw, -hh, approxW, boxH, r);
        g.fill();

        const labelNode = new Node('Text');
        n.addChild(labelNode);
        labelNode.addComponent(UITransform).setContentSize(approxW - padX, boxH);
        labelNode.setPosition(0, 0, 0);
        const label = labelNode.addComponent(Label);
        label.string = msg;
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 4;
        label.overflow = Label.Overflow.SHRINK;
        label.color.fromHEX('#FFFFFF');
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.enableOutline = true;
        label.outlineColor.fromHEX('#000000');
        label.outlineWidth = 2;
    }
}
