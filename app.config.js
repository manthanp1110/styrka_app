module.exports = ({ config }) => {
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyBTEuKfeLP-6-RREJ49VqwlNmuKEI8jQmI';
  return {
    ...config,
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
    },
    ios: {
      ...config.ios,
      config: {
        ...config.ios?.config,
        googleMapsApiKey: googleMapsApiKey,
      },
    },
  };
};
