const { withPodfile, withXcodeProject, withEntitlementsPlist } = require("expo/config-plugins");

// Expo SDK 54's Constants pod invokes an unquoted absolute script path.
// Keep this project in its existing directory, including the space in Job On.
module.exports = function withRoomPlanBuild(config) {
  if(process.env.HOMETAKING_PERSONAL_TEAM === "1") config=withEntitlementsPlist(config, mod=>{delete mod.modResults["com.apple.developer.applesignin"];return mod;});
  config = withXcodeProject(config, (mod) => {
    for (const phase of Object.values(
      mod.modResults.hash.project.objects.PBXShellScriptBuildPhase,
    )) {
      if (
        typeof phase !== "object" ||
        !phase.name?.includes("Bundle React Native code and images")
      )
        continue;
      const script = JSON.parse(phase.shellScript);
      phase.shellScript = JSON.stringify(
        script.replace(/^`(.*react-native-xcode\.sh.*)`$/m, 'bash "$($1)"'),
      );
    }
    return mod;
  });
  return withPodfile(config, (config) => {
    const marker = "# Hometaking: quote the Constants build script path";
    if (!config.modResults.contents.includes(marker)) {
      const anchor = "post_install do |installer|";
      if (!config.modResults.contents.includes(anchor))
        throw new Error(
          "Cannot locate CocoaPods post_install for the Constants path fix.",
        );
      config.modResults.contents = config.modResults.contents.replace(
        anchor,
        `${anchor}
    ${marker}
    installer.pods_project.targets.each do |target|
      next unless target.name == 'EXConstants'
      target.shell_script_build_phases.each do |phase|
        if phase.name.include?('Generate app.config')
          phase.shell_script = 'bash "\${PODS_ROOT}/../../scripts/ios/expo-constants.sh"'
        end
      end
    end
`,
      );
    }
    return config;
  });
};
