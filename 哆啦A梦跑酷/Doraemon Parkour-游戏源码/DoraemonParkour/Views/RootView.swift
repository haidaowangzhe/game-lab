import SwiftUI

struct RootView: View {
    @EnvironmentObject private var state: GameAppState

    var body: some View {
        ZStack {
            switch state.screen {
            case .loading: LoadingView()
            case .home: HomeView()
            case .levels: LevelSelectView()
            case .run: RunGameView(sessionID: state.runSessionID, level: state.selectedLevel, character: state.selectedCharacter, loadout: state.profile.loadout)
            case .inventory:
                sectionPresentation { InventoryView() }
            case .shop:
                sectionPresentation { ShopView() }
            case .settings: SettingsView()
            case .result: ResultView()
            }

            if state.showSettingsOverlay {
                ModalMask { SettingsView(embedded: true) }
            }
            if state.showInventoryOverlay {
                ModalMask { InventoryView(embedded: true) }
            }
            if state.showRecharge {
                ModalMask { RechargePromptView() }
            }
            if state.showAbout {
                ModalMask { InfoTextModal(kind: .about) }
            }
            if state.showPrivacy {
                ModalMask { InfoTextModal(kind: .privacy) }
            }
            if let overlay = state.chestOverlay {
                ModalMask { ChestOverlayView(overlay: overlay) }
            }
            if let toast = state.toast {
                Text(toast)
                    .font(.headline)
                    .foregroundColor(.white)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 12)
                    .background(Color.black.opacity(0.78))
                    .clipShape(Capsule())
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
                    .allowsHitTesting(false)
                    .transition(.opacity)
                    .zIndex(200)
            }
        }
        .environment(\.gameHapticsEnabled, state.profile.settings.vibrationEnabled)
        .buttonStyle(GameHapticButtonStyle())
        .animation(.easeInOut(duration: 0.18), value: state.toast)
        .ignoresSafeArea(.keyboard)
    }

    private func sectionPresentation<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        ZStack {
            sectionBackground(state.returnScreen)
            Color.black.opacity(0.48).ignoresSafeArea()
            content()
        }
    }

    @ViewBuilder
    private func sectionBackground(_ source: AppScreen) -> some View {
        switch source {
        case .loading:
            LoadingView()
        case .home:
            HomeView()
        case .levels:
            LevelSelectView()
        case .run:
            RunGameView(sessionID: state.runSessionID, level: state.selectedLevel, character: state.selectedCharacter, loadout: state.profile.loadout)
        case .inventory:
            // The only standalone route into inventory is the home page. This
            // also reconstructs the correct background after returning from shop.
            ZStack {
                HomeView()
                Color.black.opacity(0.48).ignoresSafeArea()
                InventoryView()
            }
        case .shop:
            HomeView()
        case .settings:
            SettingsView()
        case .result:
            ResultView()
        }
    }
}
