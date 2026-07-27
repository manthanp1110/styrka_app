const { withMainApplication, withAppDelegate } = require('@expo/config-plugins');
require('dotenv').config();

const withMapplsKeys = (config) => {
  return withMainApplication(config, (config) => {
    let mainApplication = config.modResults.contents;
    
    // Add import if not present
    if (!mainApplication.includes('com.mappls.sdk.core.account.MapplsAccountManager')) {
      mainApplication = mainApplication.replace(
        'import android.app.Application;',
        'import android.app.Application;\nimport com.mappls.sdk.core.account.MapplsAccountManager;'
      );
    }

    // Add initialization in onCreate
    const initCode = `
    MapplsAccountManager.getInstance().setRestAPIKey(System.getenv("EXPO_PUBLIC_MAPPLS_ATLAS_REST_API_KEY"));
    MapplsAccountManager.getInstance().setMapSDKKey(System.getenv("EXPO_PUBLIC_MAPPLS_ATLAS_MAP_SDK_KEY"));
    MapplsAccountManager.getInstance().setAtlasClientId(System.getenv("EXPO_PUBLIC_MAPPLS_ATLAS_CLIENT_ID"));
    MapplsAccountManager.getInstance().setAtlasClientSecret(System.getenv("EXPO_PUBLIC_MAPPLS_ATLAS_CLIENT_SECRET"));
    `;

    // Actually, System.getenv won't work in Android runtime because env vars are for build time!
    // We should read process.env inside the plugin and inject the raw string.
    const restApiKey = process.env.EXPO_PUBLIC_MAPPLS_ATLAS_REST_API_KEY || "";
    const mapSDKKey = process.env.EXPO_PUBLIC_MAPPLS_ATLAS_MAP_SDK_KEY || "";
    const atlasClientId = process.env.EXPO_PUBLIC_MAPPLS_ATLAS_CLIENT_ID || "";
    const atlasClientSecret = process.env.EXPO_PUBLIC_MAPPLS_ATLAS_CLIENT_SECRET || "";

    const actualInitCode = `
    MapplsAccountManager.getInstance().setRestAPIKey("${restApiKey}");
    MapplsAccountManager.getInstance().setMapSDKKey("${mapSDKKey}");
    MapplsAccountManager.getInstance().setAtlasClientId("${atlasClientId}");
    MapplsAccountManager.getInstance().setAtlasClientSecret("${atlasClientSecret}");
    `;

    if (!mainApplication.includes('MapplsAccountManager.getInstance().setRestAPIKey')) {
      mainApplication = mainApplication.replace(
        'super.onCreate();',
        `super.onCreate();\n${actualInitCode}`
      );
    }
    
    config.modResults.contents = mainApplication;
    return config;
  });

  // Inject into iOS AppDelegate
  config = withAppDelegate(config, (config) => {
    let appDelegate = config.modResults.contents;
    
    if (!appDelegate.includes('#import <MapplsAPICore/MapplsAPICore.h>')) {
      appDelegate = appDelegate.replace(
        '#import "AppDelegate.h"',
        '#import "AppDelegate.h"\n#import <MapplsAPICore/MapplsAPICore.h>'
      );
    }

    const restApiKey = process.env.EXPO_PUBLIC_MAPPLS_ATLAS_REST_API_KEY || "";
    const mapSDKKey = process.env.EXPO_PUBLIC_MAPPLS_ATLAS_MAP_SDK_KEY || "";
    const atlasClientId = process.env.EXPO_PUBLIC_MAPPLS_ATLAS_CLIENT_ID || "";
    const atlasClientSecret = process.env.EXPO_PUBLIC_MAPPLS_ATLAS_CLIENT_SECRET || "";

    const initCode = `
  [MapplsAccountManager setRestAPIKey:@"${restApiKey}"];
  [MapplsAccountManager setMapSDKKey:@"${mapSDKKey}"];
  [MapplsAccountManager setAtlasClientId:@"${atlasClientId}"];
  [MapplsAccountManager setAtlasClientSecret:@"${atlasClientSecret}"];
`;

    if (!appDelegate.includes('[MapplsAccountManager setRestAPIKey')) {
      // Find didFinishLaunchingWithOptions and insert after the opening brace
      appDelegate = appDelegate.replace(
        /(didFinishLaunchingWithOptions[^\{]*\{)/,
        `$1\n${initCode}`
      );
    }
    
    config.modResults.contents = appDelegate;
    return config;
  });

  return config;
};

module.exports = withMapplsKeys;
