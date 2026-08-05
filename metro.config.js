const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Blocklist android native build artifacts (.cxx, build, .gradle) from Metro file watcher
config.resolver.blockList = [
  /android\/app\/\.cxx\/.*/,
  /android\/app\/build\/.*/,
  /android\/\.gradle\/.*/,
];

// Enable package exports resolution
config.resolver.unstable_enablePackageExports = true;

module.exports = withNativeWind(config, { input: "./global.css" });
