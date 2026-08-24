import Foundation

enum SaveStore {
    private static let fileName = "doraemon_parkour_save_v1.json"

    private static var url: URL? {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first?
            .appendingPathComponent(fileName)
    }

    static func load() -> PlayerProfile {
        guard let url, let data = try? Data(contentsOf: url), let profile = try? JSONDecoder().decode(PlayerProfile.self, from: data) else {
            return PlayerProfile()
        }
        return profile
    }

    static func save(_ profile: PlayerProfile) {
        guard let url, let data = try? JSONEncoder().encode(profile) else { return }
        do {
            try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            try data.write(to: url, options: .atomic)
        } catch {
            #if DEBUG
            print("Save failed: \(error)")
            #endif
        }
    }
}

