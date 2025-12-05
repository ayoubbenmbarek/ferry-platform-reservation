// Jest setup file for React Native testing
// Note: Jest native matchers are now built into @testing-library/react-native v12.4+

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      apiBaseUrl: 'http://localhost:8010/api/v1',
      stripePublishableKey: 'pk_test_mock',
      googleClientId: 'mock-google-client-id',
    },
    hostUri: 'localhost:8081',
  },
}));

// Mock expo-web-browser
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
  openAuthSessionAsync: jest.fn(() => Promise.resolve({ type: 'cancel' })),
  maybeCompleteAuthSession: jest.fn(() => ({ type: 'success' })),
}));

// Mock expo-auth-session
jest.mock('expo-auth-session', () => ({
  useAuthRequest: jest.fn(() => [null, null, jest.fn()]),
  makeRedirectUri: jest.fn(() => 'mock://redirect'),
  ResponseType: { Token: 'token' },
}));

// Mock expo-auth-session/providers/google
jest.mock('expo-auth-session/providers/google', () => ({
  useAuthRequest: jest.fn(() => [null, null, jest.fn()]),
}));

// Mock expo-apple-authentication
jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  signInAsync: jest.fn(() =>
    Promise.resolve({
      user: 'mock-user-id',
      identityToken: 'mock-identity-token',
      fullName: { givenName: 'John', familyName: 'Doe' },
    })
  ),
  AppleAuthenticationScope: {
    FULL_NAME: 0,
    EMAIL: 1,
  },
}));

// Mock expo-local-authentication
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(() => Promise.resolve(true)),
  isEnrolledAsync: jest.fn(() => Promise.resolve(true)),
  supportedAuthenticationTypesAsync: jest.fn(() => Promise.resolve([1])),
  authenticateAsync: jest.fn(() => Promise.resolve({ success: true })),
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
    IRIS: 3,
  },
}));

// Mock @react-native-community/netinfo
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(() => Promise.resolve({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  })),
  addEventListener: jest.fn(() => jest.fn()),
}));

// Mock @stripe/stripe-react-native
jest.mock('@stripe/stripe-react-native', () => ({
  StripeProvider: ({ children }: { children: React.ReactNode }) => children,
  CardField: () => null,
  useConfirmPayment: () => ({
    confirmPayment: jest.fn(() =>
      Promise.resolve({
        paymentIntent: { status: 'Succeeded' },
        error: null,
      })
    ),
    loading: false,
  }),
  useStripe: () => ({
    confirmPayment: jest.fn(),
    createPaymentMethod: jest.fn(),
  }),
}));

// Mock react-native-paper with minimal implementation
jest.mock('react-native-paper', () => ({
  Provider: ({ children }: { children: React.ReactNode }) => children,
  Portal: ({ children }: { children: React.ReactNode }) => children,
  Text: 'Text',
  Button: 'Button',
  Card: { Content: 'CardContent' },
  ActivityIndicator: 'ActivityIndicator',
  Divider: 'Divider',
  Snackbar: 'Snackbar',
  TextInput: 'TextInput',
  Checkbox: { Item: 'CheckboxItem' },
  RadioButton: { Group: 'RadioButtonGroup', Item: 'RadioButtonItem' },
  Switch: 'Switch',
  MD3LightTheme: {},
  MD3DarkTheme: {},
  adaptNavigationTheme: () => ({ LightTheme: {}, DarkTheme: {} }),
  useTheme: () => ({
    colors: {
      primary: '#6200ee',
      background: '#ffffff',
      surface: '#ffffff',
      error: '#B00020',
    },
  }),
}));

// Mock @react-navigation/native
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockReset = jest.fn();
const mockDispatch = jest.fn();
const mockReplace = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    reset: mockReset,
    dispatch: mockDispatch,
    replace: mockReplace,
  }),
  useRoute: () => ({
    params: {},
  }),
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
  NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
  createNavigationContainerRef: () => ({
    current: null,
    isReady: () => true,
  }),
  CommonActions: {
    reset: jest.fn(),
    navigate: jest.fn(),
  },
}));

// Mock axios
jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => ({
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
      interceptors: {
        request: { use: jest.fn(), eject: jest.fn() },
        response: { use: jest.fn(), eject: jest.fn() },
      },
    })),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn() },
      response: { use: jest.fn(), eject: jest.fn() },
    },
  },
}));

// Mock react-native Platform
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'ios',
  select: jest.fn((obj) => obj.ios || obj.default),
}));

// Mock Alert
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

// Silence console warnings in tests
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeAll(() => {
  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Animated') ||
        args[0].includes('useNativeDriver') ||
        args[0].includes('deprecated') ||
        args[0].includes('using mock data') ||
        args[0].includes('Failed to fetch'))
    ) {
      return;
    }
    originalConsoleWarn.apply(console, args);
  };

  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning:') ||
        args[0].includes('act(...)') ||
        args[0].includes('microphone permission') ||
        args[0].includes('Error requesting') ||
        args[0].includes('Error checking') ||
        args[0].includes('Error starting recording') ||
        args[0].includes('Error stopping recording') ||
        args[0].includes('Error canceling recording') ||
        args[0].includes('Error transcribing') ||
        args[0].includes('Error cleaning up'))
    ) {
      return;
    }
    originalConsoleError.apply(console, args);
  };
});

afterAll(() => {
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

// Export mock functions for use in tests
export const navigationMocks = {
  mockNavigate,
  mockGoBack,
  mockReset,
  mockDispatch,
  mockReplace,
};

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});
