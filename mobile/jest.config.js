module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: [
    '<rootDir>/src/setupTests.ts',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@stripe/stripe-react-native|react-native-paper|react-native-vector-icons|react-native-safe-area-context|react-native-screens|react-native-gesture-handler|react-native-reanimated|@react-native-async-storage/async-storage|expo-secure-store|expo-haptics|expo-constants|expo-web-browser|expo-auth-session|date-fns)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/types/**/*',
    '!src/**/__tests__/**/*',
    '!src/test-utils/**/*',
  ],
  coverageThreshold: {
    global: {
      branches: 15,
      functions: 30,
      lines: 30,
      statements: 30,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testEnvironment: 'node',
  clearMocks: true,
  resetMocks: true,
};
