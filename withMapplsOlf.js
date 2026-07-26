const { withDangerousMod } = require('@expo/config-plugins');
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
};

module.exports = withMapplsOlf;
