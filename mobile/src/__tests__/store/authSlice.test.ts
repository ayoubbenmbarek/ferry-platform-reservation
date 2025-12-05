import { configureStore } from '@reduxjs/toolkit';
import authReducer, {
  login,
  register,
  logout,
  googleLogin,
  appleLogin,
  checkAuth,
  updateProfile,
  clearError,
  setUser,
} from '../../store/slices/authSlice';
import { authService } from '../../services/authService';
import { getToken } from '../../services/api';
import { createMockUser } from '../../test-utils/testUtils';

// Mock the services
jest.mock('../../services/authService');
jest.mock('../../services/api', () => ({
  getToken: jest.fn(),
}));

const mockedAuthService = authService as jest.Mocked<typeof authService>;
const mockedGetToken = getToken as jest.MockedFunction<typeof getToken>;

describe('authSlice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: { auth: authReducer },
    });
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = store.getState().auth;
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(true);
      expect(state.error).toBeNull();
    });
  });

  describe('sync actions', () => {
    it('should clear error', () => {
      // First set an error state
      store = configureStore({
        reducer: { auth: authReducer },
        preloadedState: {
          auth: {
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: 'Some error',
          },
        },
      });

      store.dispatch(clearError());
      expect(store.getState().auth.error).toBeNull();
    });

    it('should set user', () => {
      const mockUser = createMockUser();
      store.dispatch(setUser(mockUser));
      expect(store.getState().auth.user).toEqual(mockUser);
    });
  });

  describe('login thunk', () => {
    const credentials = { email: 'test@example.com', password: 'password123' };
    const mockResponse = {
      access_token: 'test-token',
      user: createMockUser(),
    };

    it('should handle successful login', async () => {
      mockedAuthService.login.mockResolvedValueOnce(mockResponse);

      await store.dispatch(login(credentials));

      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(true);
      expect(state.token).toBe('test-token');
      expect(state.user).toEqual(mockResponse.user);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should handle login failure', async () => {
      const errorMessage = 'Invalid credentials';
      mockedAuthService.login.mockRejectedValueOnce(new Error(errorMessage));

      await store.dispatch(login(credentials));

      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(false);
      expect(state.token).toBeNull();
      expect(state.user).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe(errorMessage);
    });

    it('should set loading state during login', async () => {
      mockedAuthService.login.mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(() => resolve(mockResponse), 100))
      );

      const promise = store.dispatch(login(credentials));
      expect(store.getState().auth.isLoading).toBe(true);

      await promise;
      expect(store.getState().auth.isLoading).toBe(false);
    });
  });

  describe('register thunk', () => {
    const registerData = {
      email: 'new@example.com',
      password: 'password123',
      first_name: 'John',
      last_name: 'Doe',
    };
    const mockResponse = {
      access_token: 'new-token',
      user: createMockUser({ email: 'new@example.com' }),
    };

    it('should handle successful registration', async () => {
      mockedAuthService.register.mockResolvedValueOnce(mockResponse);

      await store.dispatch(register(registerData));

      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(true);
      expect(state.token).toBe('new-token');
      expect(state.user?.email).toBe('new@example.com');
      expect(state.error).toBeNull();
    });

    it('should handle registration failure', async () => {
      const errorMessage = 'Email already exists';
      mockedAuthService.register.mockRejectedValueOnce(new Error(errorMessage));

      await store.dispatch(register(registerData));

      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBe(errorMessage);
    });
  });

  describe('googleLogin thunk', () => {
    const mockIdToken = 'google-id-token';
    const mockResponse = {
      access_token: 'google-auth-token',
      user: createMockUser({ email: 'google@example.com' }),
    };

    it('should handle successful Google login', async () => {
      mockedAuthService.googleLogin.mockResolvedValueOnce(mockResponse);

      await store.dispatch(googleLogin(mockIdToken));

      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(true);
      expect(state.token).toBe('google-auth-token');
      expect(state.user?.email).toBe('google@example.com');
    });

    it('should handle Google login failure', async () => {
      const errorMessage = 'Google auth failed';
      mockedAuthService.googleLogin.mockRejectedValueOnce(new Error(errorMessage));

      await store.dispatch(googleLogin(mockIdToken));

      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBe(errorMessage);
    });
  });

  describe('appleLogin thunk', () => {
    const appleData = {
      identityToken: 'apple-identity-token',
      fullName: { givenName: 'John', familyName: 'Appleseed' },
    };
    const mockResponse = {
      access_token: 'apple-auth-token',
      user: createMockUser({ email: 'apple@example.com' }),
    };

    it('should handle successful Apple login', async () => {
      mockedAuthService.appleLogin.mockResolvedValueOnce(mockResponse);

      await store.dispatch(appleLogin(appleData));

      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(true);
      expect(state.token).toBe('apple-auth-token');
    });

    it('should handle Apple login failure', async () => {
      const errorMessage = 'Apple auth failed';
      mockedAuthService.appleLogin.mockRejectedValueOnce(new Error(errorMessage));

      await store.dispatch(appleLogin(appleData));

      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBe(errorMessage);
    });
  });

  describe('logout thunk', () => {
    it('should handle logout', async () => {
      // First, set authenticated state
      store = configureStore({
        reducer: { auth: authReducer },
        preloadedState: {
          auth: {
            user: createMockUser(),
            token: 'test-token',
            isAuthenticated: true,
            isLoading: false,
            error: null,
          },
        },
      });

      mockedAuthService.logout.mockResolvedValueOnce(undefined);

      await store.dispatch(logout());

      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(false);
      expect(state.token).toBeNull();
      expect(state.user).toBeNull();
    });
  });

  describe('checkAuth thunk', () => {
    it('should restore auth state when token exists', async () => {
      const mockUser = createMockUser();
      mockedGetToken.mockResolvedValueOnce('stored-token');
      mockedAuthService.getCurrentUser.mockResolvedValueOnce(mockUser);

      await store.dispatch(checkAuth());

      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(true);
      expect(state.token).toBe('stored-token');
      expect(state.user).toEqual(mockUser);
      expect(state.isLoading).toBe(false);
    });

    it('should not authenticate when no token exists', async () => {
      mockedGetToken.mockResolvedValueOnce(null);

      await store.dispatch(checkAuth());

      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });

    it('should handle checkAuth failure', async () => {
      mockedGetToken.mockRejectedValueOnce(new Error('Storage error'));

      await store.dispatch(checkAuth());

      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('updateProfile thunk', () => {
    const updatedData = { first_name: 'Jane', last_name: 'Smith' };
    const updatedUser = createMockUser({ ...updatedData });

    beforeEach(() => {
      store = configureStore({
        reducer: { auth: authReducer },
        preloadedState: {
          auth: {
            user: createMockUser(),
            token: 'test-token',
            isAuthenticated: true,
            isLoading: false,
            error: null,
          },
        },
      });
    });

    it('should handle successful profile update', async () => {
      mockedAuthService.updateProfile.mockResolvedValueOnce(updatedUser);

      await store.dispatch(updateProfile(updatedData));

      const state = store.getState().auth;
      expect(state.user?.first_name).toBe('Jane');
      expect(state.user?.last_name).toBe('Smith');
    });

    it('should handle profile update failure', async () => {
      const errorMessage = 'Update failed';
      mockedAuthService.updateProfile.mockRejectedValueOnce(new Error(errorMessage));

      await store.dispatch(updateProfile(updatedData));

      const state = store.getState().auth;
      expect(state.error).toBe(errorMessage);
    });
  });
});
