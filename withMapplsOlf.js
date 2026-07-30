const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withMapplsOlf = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const androidAppDir = path.join(projectRoot, 'android', 'app');

      // Ensure the android/app directory exists (it should during prebuild)
      if (!fs.existsSync(androidAppDir)) {
        fs.mkdirSync(androidAppDir, { recursive: true });
      }

      // Find .olf and .conf files in projectRoot
      const files = fs.readdirSync(projectRoot);
      const olfFile = files.find(f => f.endsWith('.a.olf'));
      const confFile = files.find(f => f.endsWith('.a.conf'));

      if (olfFile && confFile) {
        fs.copyFileSync(
          path.join(projectRoot, olfFile),
          path.join(androidAppDir, olfFile)
        );
        fs.copyFileSync(
          path.join(projectRoot, confFile),
          path.join(androidAppDir, confFile)
        );
        console.log(`[Mappls Config] Copied ${olfFile} and ${confFile} to android/app`);
      } else {
        console.warn(`[Mappls Config] Warning: .a.olf or .a.conf file not found in project root!`);
      }
      return config;
    },
  ]);

  // iOS: Modify Podfile
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const file = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      if (fs.existsSync(file)) {
        let contents = fs.readFileSync(file, 'utf8');
        if (!contents.includes('$MAPPLS_MAPS.post_install(installer)')) {
          contents = contents.replace(
            /post_install do \|installer\|/,
            `post_install do |installer|\n    $MAPPLS_MAPS.post_install(installer)\n    $MAPPLS_TRACKING_WIDGET.post_install(installer)`
          );
          fs.writeFileSync(file, contents);
          console.log(`[Mappls Config] Added post_install hooks to Podfile`);
        }
      }
      return config;
    },
  ]);

  // iOS: Add .i.olf and .i.conf to Xcode project
  config = withXcodeProject(config, async (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const projectName = config.modRequest.projectName;
    const iosRoot = path.join(projectRoot, 'ios');
    const destDir = path.join(iosRoot, projectName);

    const files = fs.readdirSync(projectRoot);
    const olfFile = files.find(f => f.endsWith('.i.olf'));
    const confFile = files.find(f => f.endsWith('.i.conf'));

    if (olfFile && confFile) {
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      // Copy files to the ios project directory
      fs.copyFileSync(path.join(projectRoot, olfFile), path.join(destDir, olfFile));
      fs.copyFileSync(path.join(projectRoot, confFile), path.join(destDir, confFile));

      const xcodeProject = config.modResults;
      // Add files to the xcode project
      xcodeProject.addResourceFile(path.join(projectName, olfFile), { target: xcodeProject.getFirstTarget().uuid });
      xcodeProject.addResourceFile(path.join(projectName, confFile), { target: xcodeProject.getFirstTarget().uuid });
      
      console.log(`[Mappls Config] Copied and linked ${olfFile} and ${confFile} for iOS`);
    } else {
      console.warn(`[Mappls Config] Warning: .i.olf or .i.conf file not found in project root!`);
    }

    return config;
  });

  return config;
};

module.exports = withMapplsOlf;
