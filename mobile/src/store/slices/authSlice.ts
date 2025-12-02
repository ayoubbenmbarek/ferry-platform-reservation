import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authService } from '../../services/authService';
import { biometricService } from '../../services/biometricService';
import { User, AuthState } from '../../types';
import { getToken, setToken } from '../../services/api';

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

// Check auth status on app load
export const checkAuth = createAsyncThunk('auth/checkAuth', async () => {
  const token = await getToken();
  if (token) {
    const user = await authService.getCurrentUser();
    return { token, user };
  }
  return null;
});

// Login
export const login = createAsyncThunk(
  'auth/login',
  async (credentials: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const response = await authService.login(credentials);

      // If biometric is enabled, update the stored token to keep it fresh
      const biometricEnabled = await biometricService.isBiometricEnabled();
      if (biometricEnabled && response.token) {
        await biometricService.updateStoredToken(response.token);
      }

      return response;
    } catch (error: any) {
      console.error('AuthSlice login error:', error.message);
      return rejectWithValue(error.message || 'Login failed. Please try again.');
    }
  }
);

// Register
export const register = createAsyncThunk(
  'auth/register',
  async (
    data: { email: string; password: string; first_name: string; last_name: string; phone?: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await authService.register(data);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

// Google login
export const googleLogin = createAsyncThunk(
  'auth/googleLogin',
  async (idToken: string, { rejectWithValue }) => {
    try {
      const response = await authService.googleLogin(idToken);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

// Apple login
export const appleLogin = createAsyncThunk(
  'auth/appleLogin',
  async (
    data: { identityToken: string; fullName?: { givenName?: string; familyName?: string } },
    { rejectWithValue }
  ) => {
    try {
      const response = await authService.appleLogin(data.identityToken, data.fullName);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

// Biometric login
export const biometricLogin = createAsyncThunk(
  'auth/biometricLogin',
  async (_, { rejectWithValue }) => {
    try {
      console.log('[BiometricLogin] Starting biometric login...');
      const result = await biometricService.biometricLogin();
      console.log('[BiometricLogin] Biometric service result:', { success: result.success, error: result.error, hasToken: !!result.token });

      if (!result.success) {
        console.log('[BiometricLogin] Biometric auth failed:', result.error);
        return rejectWithValue(result.error || 'Biometric login failed');
      }

      // Set the token in API service
      console.log('[BiometricLogin] Setting token in API service...');
      await setToken(result.token!);

      // Validate token and get user data
      console.log('[BiometricLogin] Validating token and getting user data...');
      const user = await authService.getCurrentUser();
      console.log('[BiometricLogin] Got user:', user?.email);

      return { token: result.token!, user };
    } catch (error: any) {
      console.error('[BiometricLogin] Error:', error.message);

      // Check for token expiration/validation errors
      const isAuthError =
        error.message?.includes('401') ||
        error.message?.includes('Unauthorized') ||
        error.message?.includes('expired') ||
        error.message?.includes('Could not validate') ||
        error.message?.includes('credentials');

      if (isAuthError) {
        console.log('[BiometricLogin] Token appears expired, clearing stored token');
        await biometricService.clearStoredToken();
        return rejectWithValue('Session expired. Please sign in with your password to restore Face ID.');
      }

      return rejectWithValue(error.message || 'Login failed. Please try again.');
    }
  }
);

// Logout
export const logout = createAsyncThunk('auth/logout', async () => {
  await authService.logout();
  // Note: We intentionally DO NOT clear biometric credentials on logout
  // This allows users to sign back in using Face ID / Touch ID
  // Biometric credentials are only cleared when user explicitly disables biometric in settings
});

// Update profile
export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (data: Partial<User>, { rejectWithValue }) => {
    try {
      const user = await authService.updateProfile(data);
      return user;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Check auth
    builder
      .addCase(checkAuth.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(checkAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload) {
          state.token = action.payload.token;
          state.user = action.payload.user;
          state.isAuthenticated = true;
        }
      })
      .addCase(checkAuth.rejected, (state) => {
        state.isLoading = false;
        state.isAuthenticated = false;
      });

    // Login
    builder
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.token = action.payload.access_token;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Register
    builder
      .addCase(register.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.isLoading = false;
        state.token = action.payload.access_token;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Google login
    builder
      .addCase(googleLogin.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(googleLogin.fulfilled, (state, action) => {
        state.isLoading = false;
        state.token = action.payload.access_token;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(googleLogin.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Apple login
    builder
      .addCase(appleLogin.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(appleLogin.fulfilled, (state, action) => {
        state.isLoading = false;
        state.token = action.payload.access_token;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(appleLogin.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Biometric login
    builder
      .addCase(biometricLogin.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(biometricLogin.fulfilled, (state, action) => {
        state.isLoading = false;
        state.token = action.payload.token;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(biometricLogin.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Logout
    builder.addCase(logout.fulfilled, (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
    });

    // Update profile
    builder
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.user = action.payload;
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const { clearError, setUser } = authSlice.actions;
export default authSlice.reducer;
