const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withMapplsOlf = (config) => {
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const androidAppDir = path.join(projectRoot, 'android', 'app');
      const androidAssetsDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'assets');

      // Ensure directory structures exist
      if (!fs.existsSync(androidAppDir)) {
        fs.mkdirSync(androidAppDir, { recursive: true });
      }
      if (!fs.existsSync(androidAssetsDir)) {
        fs.mkdirSync(androidAssetsDir, { recursive: true });
      }

      // Find .olf and .conf files in projectRoot
      const files = fs.readdirSync(projectRoot);
      const olfFile = files.find(f => f.endsWith('.a.olf'));
      const confFile = files.find(f => f.endsWith('.a.conf'));

      if (olfFile && confFile) {
        // Copy to android/app
        fs.copyFileSync(
          path.join(projectRoot, olfFile),
          path.join(androidAppDir, olfFile)
        );
        fs.copyFileSync(
          path.join(projectRoot, confFile),
          path.join(androidAppDir, confFile)
        );
        // Copy to android/app/src/main/assets
        fs.copyFileSync(
          path.join(projectRoot, olfFile),
          path.join(androidAssetsDir, olfFile)
        );
        fs.copyFileSync(
          path.join(projectRoot, confFile),
          path.join(androidAssetsDir, confFile)
        );
        console.log(`[Mappls Config] Copied ${olfFile} and ${confFile} to android/app and android/app/src/main/assets`);
      } else {
        console.warn(`[Mappls Config] Warning: .a.olf or .a.conf file not found in project root!`);
      }
      return config;
    },
  ]);

  // iOS: Modify Podfile and Copy .i.olf / .i.conf files into iOS project
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const projectName = config.modRequest.projectName || 'styrka';
      const iosRoot = path.join(projectRoot, 'ios');
      const destDir = path.join(iosRoot, projectName);

      // 1. Copy .i.olf and .i.conf files to ios project directory
      const files = fs.readdirSync(projectRoot);
      const olfFile = files.find((f) => f.endsWith('.i.olf'));
      const confFile = files.find((f) => f.endsWith('.i.conf'));

      if (olfFile && confFile) {
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        fs.copyFileSync(path.join(projectRoot, olfFile), path.join(destDir, olfFile));
        fs.copyFileSync(path.join(projectRoot, confFile), path.join(destDir, confFile));
        fs.copyFileSync(path.join(projectRoot, olfFile), path.join(iosRoot, olfFile));
        fs.copyFileSync(path.join(projectRoot, confFile), path.join(iosRoot, confFile));
        console.log(`[Mappls Config] Copied ${olfFile} and ${confFile} to ios/${projectName} and ios/`);
      }

      // 2. Modify Podfile for Mappls post_install hooks
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

  return config;
};

module.exports = withMapplsOlf;
