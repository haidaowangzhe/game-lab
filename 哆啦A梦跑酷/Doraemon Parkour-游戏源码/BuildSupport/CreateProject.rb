require "xcodeproj"

root = File.expand_path("..", __dir__)
project_path = File.join(root, "DoraemonParkour.xcodeproj")
project = Xcodeproj::Project.new(project_path)
target = project.new_target(:application, "Doraemon Parkour", :ios, "15.0")

main_group = project.main_group.new_group("DoraemonParkour", "DoraemonParkour")
Dir.glob(File.join(root, "DoraemonParkour", "**", "*.swift")).sort.each do |path|
  relative = path.delete_prefix(File.join(root, "DoraemonParkour") + "/")
  ref = main_group.new_file(relative)
  target.source_build_phase.add_file_reference(ref)
end

assets = main_group.new_file("Assets.xcassets")
target.resources_build_phase.add_file_reference(assets)

audio_group = main_group.new_group("Audio", "Resources/Audio")
Dir.glob(File.join(root, "DoraemonParkour", "Resources", "Audio", "*.wav")).sort.each do |path|
  ref = audio_group.new_file(File.basename(path))
  target.resources_build_phase.add_file_reference(ref)
end

source_assets = project.main_group.new_file("../设计资料/素材")
source_assets.name = "素材"
source_assets.last_known_file_type = "folder"
target.resources_build_phase.add_file_reference(source_assets)

target.build_configurations.each do |config|
  settings = config.build_settings
  settings["PRODUCT_BUNDLE_IDENTIFIER"] = "com.itzzw.doraemonparkour"
  settings["PRODUCT_NAME"] = "Doraemon Parkour"
  settings["INFOPLIST_FILE"] = "DoraemonParkour/Info.plist"
  settings["GENERATE_INFOPLIST_FILE"] = "NO"
  settings["MARKETING_VERSION"] = "1"
  settings["CURRENT_PROJECT_VERSION"] = "1"
  settings["IPHONEOS_DEPLOYMENT_TARGET"] = "15.0"
  settings["TARGETED_DEVICE_FAMILY"] = "1,2"
  settings["SWIFT_VERSION"] = "5.0"
  settings["ASSETCATALOG_COMPILER_APPICON_NAME"] = "AppIcon"
  settings["CODE_SIGN_STYLE"] = "Automatic"
  settings["ENABLE_USER_SCRIPT_SANDBOXING"] = "YES"
end

project.save

