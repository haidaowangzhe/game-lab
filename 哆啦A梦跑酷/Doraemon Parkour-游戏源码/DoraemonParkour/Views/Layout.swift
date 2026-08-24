import SwiftUI

private struct GameHapticsEnabledKey: EnvironmentKey {
    static let defaultValue = true
}

extension EnvironmentValues {
    var gameHapticsEnabled: Bool {
        get { self[GameHapticsEnabledKey.self] }
        set { self[GameHapticsEnabledKey.self] = newValue }
    }
}

struct GameHapticButtonStyle: ButtonStyle {
    @Environment(\.gameHapticsEnabled) private var hapticsEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.88 : 1)
            .onChange(of: configuration.isPressed) { pressed in
                if pressed { GameHaptics.impact(.light, enabled: hapticsEnabled) }
            }
    }
}

enum GameLayout {
    static let designSize = CGSize(width: 1366, height: 768)
    static let safePadding: CGFloat = 24
    static let minimumHit: CGFloat = 44
    static let panelCorner: CGFloat = 22
    static let navy = Color(red: 0.02, green: 0.12, blue: 0.34)
    static let royalBlue = Color(red: 0.02, green: 0.30, blue: 0.72)
    static let gold = Color(red: 0.96, green: 0.67, blue: 0.12)
    static let parchment = Color(red: 1.0, green: 0.97, blue: 0.88)
}

struct PixelText: ViewModifier {
    var size: CGFloat
    var color: Color = .white

    func body(content: Content) -> some View {
        content
            .font(.system(size: size, weight: .black, design: .rounded))
            .foregroundColor(color)
            .shadow(color: .black.opacity(0.9), radius: 0, x: 2, y: 2)
    }
}

extension View {
    func pixelText(_ size: CGFloat, color: Color = .white) -> some View {
        modifier(PixelText(size: size, color: color))
    }
}

struct BluePanel<Content: View>: View {
    let content: Content
    init(@ViewBuilder content: () -> Content) { self.content = content() }

    var body: some View {
        content
            .padding(20)
            .background(GameLayout.parchment)
            .overlay(RoundedRectangle(cornerRadius: GameLayout.panelCorner).stroke(GameLayout.gold, lineWidth: 5))
            .overlay(RoundedRectangle(cornerRadius: GameLayout.panelCorner - 6).stroke(GameLayout.royalBlue, lineWidth: 5).padding(5))
            .clipShape(RoundedRectangle(cornerRadius: GameLayout.panelCorner))
            .shadow(color: .black.opacity(0.35), radius: 12, y: 7)
    }
}

struct GameTextButton: View {
    let title: String
    var enabled: Bool = true
    var compact = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: compact ? 18 : 23, weight: .black, design: .rounded))
                .foregroundColor(.white)
                .frame(minWidth: compact ? 88 : 150, minHeight: GameLayout.minimumHit)
                .padding(.horizontal, compact ? 8 : 16)
                .background(enabled ? GameLayout.royalBlue : Color.gray)
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(GameLayout.gold, lineWidth: 3))
                .clipShape(RoundedRectangle(cornerRadius: 10))
        }
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.55)
        .buttonStyle(GameHapticButtonStyle())
    }
}

struct ModalMask<Content: View>: View {
    let content: Content
    init(@ViewBuilder content: () -> Content) { self.content = content() }
    var body: some View {
        GeometryReader { proxy in
            ZStack {
                Color.black.opacity(0.55).ignoresSafeArea()
                content
                    .padding(16)
                    .frame(maxWidth: min(920, proxy.size.width - 24), maxHeight: min(660, proxy.size.height - 16))
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
        }
        .zIndex(100)
    }
}

/// Lays out a page in the coordinate space of its supplied complete design and
/// uniformly scales the whole composition to fit the available screen.
/// Nothing inside the canvas is stretched or cropped.
struct ProportionalCanvas<Content: View>: View {
    let designSize: CGSize
    let content: Content

    init(size: CGSize, @ViewBuilder content: () -> Content) {
        designSize = size
        self.content = content()
    }

    var body: some View {
        GeometryReader { proxy in
            let scale = min(proxy.size.width / designSize.width, proxy.size.height / designSize.height)
            content
                .frame(width: designSize.width, height: designSize.height)
                .scaleEffect(scale, anchor: .center)
                .position(x: proxy.size.width / 2, y: proxy.size.height / 2)
        }
    }
}
