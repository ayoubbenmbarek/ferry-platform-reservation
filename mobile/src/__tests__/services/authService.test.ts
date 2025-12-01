import { authService } from '../../services/authService';
import api, { saveToken, removeToken } from '../../services/api';
import { createMockUser } from '../../test-utils/testUtils';

// Mock the api module
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
  },
  saveToken: jest.fn(),
  removeToken: jest.fn(),
  getErrorMessage: (error: any) => {
    if (error instanceof Error) return error.message;
    if (error?.response?.data?.detail) return error.response.data.detail;
    if (error?.message) return error.message;
    return 'An error occurred';
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;
const mockedSaveToken = saveToken as jest.MockedFunction<typeof saveToken>;
const mockedRemoveToken = removeToken as jest.MockedFunction<typeof removeToken>;

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should login successfully and return user data', async () => {
      const mockUser = createMockUser();
      const mockLoginResponse = {
        data: {
          access_token: 'test-token',
          token_type: 'bearer',
        },
      };

      (mockedApi.post as jest.Mock).mockResolvedValueOnce(mockLoginResponse);
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: mockUser });

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(mockedApi.post).toHaveBeenCalledWith(
        '/auth/login',
        expect.any(URLSearchParams),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      );
      expect(mockedSaveToken).toHaveBeenCalledWith('test-token');
      expect(mockedApi.get).toHaveBeenCalledWith('/auth/me');
      expect(result).toEqual({
        access_token: 'test-token',
        token_type: 'bearer',
        user: mockUser,
      });
    });

    it('should throw error on login failure', async () => {
      (mockedApi.post as jest.Mock).mockRejectedValueOnce(new Error('Invalid credentials'));

      await expect(
        authService.login({ email: 'test@example.com', password: 'wrong' })
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('register', () => {
    it('should register and login successfully', async () => {
      const mockUser = createMockUser();
      const registerData = {
        email: 'new@example.com',
        password: 'password123',
        first_name: 'John',
        last_name: 'Doe',
      };

      // Register endpoint
      (mockedApi.post as jest.Mock)
        .mockResolvedValueOnce({ data: {} }) // register
        .mockResolvedValueOnce({ // login after register
          data: { access_token: 'new-token', token_type: 'bearer' },
        });
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: mockUser });

      const result = await authService.register(registerData);

      expect(mockedApi.post).toHaveBeenCalledWith('/auth/register', registerData);
      expect(mockedSaveToken).toHaveBeenCalledWith('new-token');
      expect(result.user).toEqual(mockUser);
    });

    it('should throw error on registration failure', async () => {
      (mockedApi.post as jest.Mock).mockRejectedValueOnce(new Error('Email already exists'));

      await expect(
        authService.register({
          email: 'existing@example.com',
          password: 'password123',
          first_name: 'John',
          last_name: 'Doe',
        })
      ).rejects.toThrow('Email already exists');
    });
  });

  describe('googleLogin', () => {
    it('should login with Google successfully', async () => {
      const mockUser = createMockUser();
      const mockResponse = {
        data: {
          access_token: 'google-token',
          token_type: 'bearer',
          user: mockUser,
        },
      };

      (mockedApi.post as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await authService.googleLogin('google-id-token');

      expect(mockedApi.post).toHaveBeenCalledWith('/auth/google', {
        id_token: 'google-id-token',
      });
      expect(mockedSaveToken).toHaveBeenCalledWith('google-token');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('appleLogin', () => {
    it('should login with Apple successfully', async () => {
      const mockUser = createMockUser();
      const mockResponse = {
        data: {
          access_token: 'apple-token',
          token_type: 'bearer',
          user: mockUser,
        },
      };

      (mockedApi.post as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await authService.appleLogin('apple-identity-token', {
        givenName: 'John',
        familyName: 'Doe',
      });

      expect(mockedApi.post).toHaveBeenCalledWith('/auth/apple', {
        identity_token: 'apple-identity-token',
        first_name: 'John',
        last_name: 'Doe',
      });
      expect(mockedSaveToken).toHaveBeenCalledWith('apple-token');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getCurrentUser', () => {
    it('should fetch current user', async () => {
      const mockUser = createMockUser();
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: mockUser });

      const result = await authService.getCurrentUser();

      expect(mockedApi.get).toHaveBeenCalledWith('/auth/me');
      expect(result).toEqual(mockUser);
    });

    it('should throw error when not authenticated', async () => {
      (mockedApi.get as jest.Mock).mockRejectedValueOnce(new Error('Unauthorized'));

      await expect(authService.getCurrentUser()).rejects.toThrow('Unauthorized');
    });
  });

  describe('logout', () => {
    it('should remove token on logout', async () => {
      await authService.logout();

      expect(mockedRemoveToken).toHaveBeenCalled();
    });
  });

  describe('requestPasswordReset', () => {
    it('should request password reset successfully', async () => {
      (mockedApi.post as jest.Mock).mockResolvedValueOnce({ data: {} });

      await authService.requestPasswordReset('test@example.com');

      expect(mockedApi.post).toHaveBeenCalledWith('/auth/password-reset/request', {
        email: 'test@example.com',
      });
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const mockUser = createMockUser({ first_name: 'Updated' });
      (mockedApi.put as jest.Mock).mockResolvedValueOnce({ data: mockUser });

      const result = await authService.updateProfile({ first_name: 'Updated' });

      expect(mockedApi.put).toHaveBeenCalledWith('/auth/me', { first_name: 'Updated' });
      expect(result.first_name).toBe('Updated');
    });
  });
});
