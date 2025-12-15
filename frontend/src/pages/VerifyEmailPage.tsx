import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';

const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState('');

  // Resend form state
  const [showResendForm, setShowResendForm] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState('');

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResending(true);
    setResendError('');

    try {
      await api.post('/auth/resend-verification', null, { params: { email: resendEmail } });
      setResendSuccess(true);
    } catch (err: any) {
      setResendError(err.response?.data?.detail || 'Failed to resend verification email');
    } finally {
      setIsResending(false);
    }
  };

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setError('Invalid verification link');
        setIsLoading(false);
        return;
      }

      try {
        await api.get(`/auth/verify-email?token=${token}`);
        setIsVerified(true);
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Email verification failed');
      } finally {
        setIsLoading(false);
      }
    };

    verifyEmail();
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16">
              <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h2 className="mt-6 text-xl font-semibold text-gray-900">Verifying your email...</h2>
          </div>
        </div>
      </div>
    );
  }

  if (isVerified) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
              <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-bold text-gray-900">Email Verified!</h2>
            <p className="mt-2 text-sm text-gray-600">
              Your email has been successfully verified. You now have full access to all features.
            </p>
            <div className="mt-6 space-y-3">
              <Link
                to="/login"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                Go to Login
              </Link>
              <p className="text-sm text-gray-500">
                or{' '}
                <Link to="/" className="text-blue-600 hover:text-blue-500">
                  go to homepage
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show resend success
  if (resendSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
              <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mt-6 text-2xl font-bold text-gray-900">Verification Email Sent</h2>
            <p className="mt-2 text-sm text-gray-600">
              If an account exists with this email, you will receive a verification link shortly.
              Please check your inbox and spam folder.
            </p>
            <div className="mt-6">
              <Link
                to="/login"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                Go to Login
              </Link>
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
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100">
            <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">Verification Failed</h2>
          <p className="mt-2 text-sm text-gray-600">
            {error}
          </p>

          {!showResendForm ? (
            <div className="mt-6">
              <Link
                to="/login"
                className="text-blue-600 hover:text-blue-500 font-medium"
              >
                Go to Login
              </Link>
              <p className="mt-2 text-sm text-gray-500">
                Need a new verification link?{' '}
                <button
                  onClick={() => setShowResendForm(true)}
                  className="text-blue-600 hover:text-blue-500 font-medium"
                >
                  Resend verification email
                </button>
              </p>
            </div>
          ) : (
            <div className="mt-6">
              <form onSubmit={handleResend} className="space-y-4">
                {resendError && (
                  <p className="text-sm text-red-600">{resendError}</p>
                )}
                <div>
                  <input
                    type="email"
                    required
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isResending}
                  className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isResending ? 'Sending...' : 'Send Verification Link'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowResendForm(false)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
