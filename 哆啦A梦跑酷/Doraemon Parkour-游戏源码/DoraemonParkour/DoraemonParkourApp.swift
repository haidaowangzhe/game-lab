import SwiftUI

@main
struct DoraemonParkourApp: App {
    @StateObject private var appState = GameAppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appState)
                .preferredColorScheme(.light)
        }
    }
}

