import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppDispatch, RootState } from '../store';
import { updateUser } from '../store/slices/authSlice';
import { authAPI } from '../services/api';

const ProfilePage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);

  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'preferences'>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Profile form data
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });

  // Password form data
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Preferences form data
  const [preferencesData, setPreferencesData] = useState({
    preferredLanguage: 'en',
    preferredCurrency: 'EUR',
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    } else if (user) {
      setProfileData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || '',
      });
      setPreferencesData({
        preferredLanguage: user.preferredLanguage || 'en',
        preferredCurrency: user.preferredCurrency || 'EUR',
      });
    }
  }, [isAuthenticated, user, navigate]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      await dispatch(updateUser({
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        phone: profileData.phone,
      })).unwrap();
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error || 'Failed to update profile' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      setIsSaving(false);
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters long' });
      setIsSaving(false);
      return;
    }

    try {
      await authAPI.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      setMessage({ type: 'success', text: 'Password changed successfully!' });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to change password' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreferencesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      await dispatch(updateUser({
        preferredLanguage: preferencesData.preferredLanguage,
        preferredCurrency: preferencesData.preferredCurrency,
      })).unwrap();
      setMessage({ type: 'success', text: 'Preferences updated successfully!' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error || 'Failed to update preferences' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Profile & Settings</h1>
          <p className="mt-2 text-gray-600">Manage your account information and preferences</p>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => { setActiveTab('profile'); setMessage(null); }}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${
                  activeTab === 'profile' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Profile Information
              </button>
              <button
                onClick={() => { setActiveTab('password'); setMessage(null); }}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${
                  activeTab === 'password' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Change Password
              </button>
              <button
                onClick={() => { setActiveTab('preferences'); setMessage(null); }}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${
                  activeTab === 'preferences' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Preferences
              </button>
            </nav>
          </div>

          {message && (
            <div className={`mx-6 mt-4 p-4 rounded-md ${
              message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              {message.text}
            </div>
          )}

          <div className="p-6">
            {activeTab === 'profile' && (
              <form onSubmit={handleProfileSubmit} className="space-y-6">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">First Name</label>
                    <input
                      type="text"
                      value={profileData.firstName}
                      onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Last Name</label>
                    <input
                      type="text"
                      value={profileData.lastName}
                      onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Email Address</label>
                  <input
                    type="email"
                    value={profileData.email}
                    disabled
                    className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 shadow-sm px-3 py-2 border cursor-not-allowed"
                  />
                  <p className="mt-1 text-sm text-gray-500">Email cannot be changed</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                  <input
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-300"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'password' && (
              <form onSubmit={handlePasswordSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Current Password</label>
                  <input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">New Password</label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
                    required
                  />
                  <p className="mt-1 text-sm text-gray-500">Must be at least 8 characters long</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
                    required
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-300"
                  >
                    {isSaving ? 'Changing...' : 'Change Password'}
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'preferences' && (
              <form onSubmit={handlePreferencesSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Preferred Language</label>
                  <select
                    value={preferencesData.preferredLanguage}
                    onChange={(e) => setPreferencesData({ ...preferencesData, preferredLanguage: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
                  >
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                    <option value="ar">العربية</option>
                    <option value="it">Italiano</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Preferred Currency</label>
                  <select
                    value={preferencesData.preferredCurrency}
                    onChange={(e) => setPreferencesData({ ...preferencesData, preferredCurrency: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
                  >
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                    <option value="TND">TND (د.ت)</option>
                  </select>
                </div>

                <div className="bg-blue-50 p-4 rounded-md">
                  <p className="text-sm text-blue-800">
                    These preferences will be used as defaults when making new bookings and viewing prices.
                  </p>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-300"
                  >
                    {isSaving ? 'Saving...' : 'Save Preferences'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Account Information</h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Account Status</dt>
              <dd className="mt-1 text-sm text-gray-900">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  user?.isVerified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {user?.isVerified ? 'Verified' : 'Unverified'}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Member Since</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Last Login</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {user?.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'N/A'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Account Type</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {user?.isAdmin ? 'Administrator' : 'Standard User'}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage; 