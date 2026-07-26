const { withProjectBuildGradle } = require('@expo/config-plugins');

const withMapplsMaven = (config) => {
  return withProjectBuildGradle(config, async (config) => {
    let buildGradle = config.modResults.contents;
    
    // Check if it's already added
    if (!buildGradle.includes('maven.mappls.com/repository/mappls')) {
      const mavenStr = "        maven { url 'https://maven.mappls.com/repository/mappls/' }\n";
      
      // Inject inside allprojects -> repositories
      buildGradle = buildGradle.replace(
        /allprojects\s*\{\s*repositories\s*\{/,
        `allprojects {\n    repositories {\n${mavenStr}`
      );
    }
    
    config.modResults.contents = buildGradle;
    return config;
  });
};

module.exports = withMapplsMaven;
