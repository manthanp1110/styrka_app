const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withAndroidConfig(config) {
  // 1. Add Service to Manifest
  config = withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults.manifest;
    const app = androidManifest.application[0];
    
    if (!app.service) {
      app.service = [];
    }
    
    const hasLocationService = app.service.some(
      (s) => s.$['android:name'] === 'expo.modules.location.services.LocationTaskService'
    );
    
    if (!hasLocationService) {
      app.service.push({
        $: {
          'android:name': 'expo.modules.location.services.LocationTaskService',
          'android:exported': 'false',
          'android:foregroundServiceType': 'location',
        },
      });
    } else {
      const service = app.service.find(
        (s) => s.$['android:name'] === 'expo.modules.location.services.LocationTaskService'
      );
      service.$['android:foregroundServiceType'] = 'location';
    }
    
    return config;
  });

  // 2. Add Proguard Rules
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const proguardPath = path.join(projectRoot, 'android', 'app', 'proguard-rules.pro');
      
      if (fs.existsSync(proguardPath)) {
        let content = fs.readFileSync(proguardPath, 'utf8');
        if (!content.includes('com.mappls.sdk.**')) {
          content += '\n# Mappls / Mapbox Rules\n-keep class com.mappls.sdk.** { *; }\n-keep class com.mapbox.** { *; }\n-dontwarn com.mappls.sdk.**\n-dontwarn com.mapbox.**\n';
          fs.writeFileSync(proguardPath, content);
        }
      }
      return config;
    },
  ]);

  return config;
};
