import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

const ResendVerificationPage: React.FC = () => {
  const { t } = useTranslation(['common']);
  const [searchParams] = useSearchParams();
  const emailFromUrl = searchParams.get('email') || '';

  const [email, setEmail] = useState(emailFromUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const [autoSubmitted, setAutoSubmitted] = useState(false);

  const sendVerificationEmail = async (emailToSend: string) => {
    setIsLoading(true);
    setError('');

    try {
      await api.post('/auth/resend-verification', null, { params: { email: emailToSend } });
      setIsSuccess(true);
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Failed to resend verification email';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-submit if email is provided in URL
  useEffect(() => {
    if (emailFromUrl && !autoSubmitted) {
      setAutoSubmitted(true);
      sendVerificationEmail(emailFromUrl);
    }
  }, [emailFromUrl, autoSubmitted]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    sendVerificationEmail(email);
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
                <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="mt-6 text-2xl font-bold text-gray-900">
                {t('auth.verificationSent', 'Verification Email Sent')}
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                {t('auth.verificationSentDesc', 'If an account exists with this email, you will receive a verification link shortly. Please check your inbox and spam folder.')}
              </p>
              <div className="mt-6">
                <Link
                  to="/login"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                >
                  {t('auth.goToLogin', 'Go to Login')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100">
            <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            {t('auth.resendVerification', 'Resend Verification Email')}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {t('auth.resendVerificationDesc', "Enter your email address and we'll send you a new verification link.")}
          </p>
        </div>

        <div className="mt-8 bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                {t('auth.email', 'Email address')}
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('common.sending', 'Sending...')}
                  </>
                ) : (
                  t('auth.sendVerificationLink', 'Send Verification Link')
                )}
              </button>
            </div>

            <div className="text-center text-sm">
              <Link to="/login" className="text-blue-600 hover:text-blue-500">
                {t('auth.backToLogin', 'Back to Login')}
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResendVerificationPage;
