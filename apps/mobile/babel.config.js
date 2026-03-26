const path = require('path');

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['react-native-unistyles/plugin', {
        root: path.resolve(__dirname, 'src'),
        autoProcessPaths: [path.resolve(__dirname, 'app')],
      }],
    ],
  };
};
