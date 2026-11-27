module.exports = {
  preset: '@react-native/jest-preset',
  cacheDirectory: '<rootDir>/.cache/jest',
  transform: {
    ...require('@react-native/jest-preset').transform,
    '^.+\\.jsx$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-native-async-storage)/)',
  ],
};
