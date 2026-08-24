import SwiftUI
import UIKit
import ImageIO

enum AssetPath {
    static let homeBackground = "首页/背景图.png"
    static let levelBackground = "关卡选择页/背景图.png"
    static let runBackground = "游戏内主界面/背景图.png"
    static let loadingBackground = "加载页/启动页背景-模糊.png"

    static func image(_ relativePath: String) -> UIImage? {
        let path = relativePath.hasPrefix("素材/") ? relativePath : "素材/\(relativePath)"
        guard let root = Bundle.main.resourceURL else { return nil }
        return UIImage(contentsOfFile: root.appendingPathComponent(path).path)
    }

    static func data(_ relativePath: String) -> Data? {
        let path = relativePath.hasPrefix("素材/") ? relativePath : "素材/\(relativePath)"
        guard let root = Bundle.main.resourceURL else { return nil }
        return try? Data(contentsOf: root.appendingPathComponent(path))
    }
}

struct AssetImage: View {
    let path: String
    var contentMode: ContentMode = .fit

    var body: some View {
        Group {
            if let image = AssetPath.image(path) {
                Image(uiImage: image).resizable().aspectRatio(contentMode: contentMode)
            } else {
                ZStack {
                    RoundedRectangle(cornerRadius: 8).fill(Color.black.opacity(0.18))
                    Text(path.components(separatedBy: "/").last ?? "缺图")
                        .font(.caption2).foregroundColor(.white).lineLimit(2)
                }
            }
        }
    }
}

struct AnimatedAssetView: UIViewRepresentable {
    let path: String
    var contentMode: UIView.ContentMode = .scaleAspectFit
    var isAnimating = true

    final class AnimationContainerView: UIView {
        let imageView = UIImageView()

        override init(frame: CGRect) {
            super.init(frame: frame)
            imageView.frame = bounds
            imageView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            imageView.clipsToBounds = false
            addSubview(imageView)
        }

        required init?(coder: NSCoder) { nil }

        // UIImageView 自带的 intrinsicContentSize 会让 GIF 按原始像素宽度参与
        // SwiftUI 布局，随后又被外层角色框裁掉。容器不提供固有尺寸，始终服从
        // SwiftUI 给出的角色框，内部图片再按 aspectFit 完整缩放。
        override var intrinsicContentSize: CGSize { .zero }
    }

    final class Coordinator {
        let animatedImage: UIImage?
        let stillImage: UIImage?

        init(data: Data?) {
            animatedImage = AnimatedAssetView.animatedImage(data: data)
            stillImage = AnimatedAssetView.firstFrameImage(data: data)
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(data: AssetPath.data(path))
    }

    func makeUIView(context: Context) -> AnimationContainerView {
        let view = AnimationContainerView()
        view.imageView.contentMode = contentMode
        view.imageView.image = isAnimating ? context.coordinator.animatedImage : context.coordinator.stillImage
        return view
    }

    func updateUIView(_ uiView: AnimationContainerView, context: Context) {
        let image = isAnimating ? context.coordinator.animatedImage : context.coordinator.stillImage
        uiView.imageView.contentMode = contentMode
        if uiView.imageView.image !== image { uiView.imageView.image = image }
    }

    private static func animatedImage(data: Data?) -> UIImage? {
        guard let data, let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
        let count = CGImageSourceGetCount(source)
        var frames: [UIImage] = []
        var duration: TimeInterval = 0
        for index in 0..<count {
            guard let cg = CGImageSourceCreateImageAtIndex(source, index, nil) else { continue }
            frames.append(UIImage(cgImage: cg))
            duration += 0.12
        }
        return frames.isEmpty ? nil : UIImage.animatedImage(with: frames, duration: max(duration, 0.25))
    }

    private static func firstFrameImage(data: Data?) -> UIImage? {
        guard let data, let source = CGImageSourceCreateWithData(data as CFData, nil),
              let cgImage = CGImageSourceCreateImageAtIndex(source, 0, nil) else { return nil }
        return UIImage(cgImage: cgImage)
    }
}
