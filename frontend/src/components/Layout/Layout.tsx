import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RootState, persistor } from '../../store';
import { logout } from '../../store/slices/authSlice';

// Basic Layout component
interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation(['common']);
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);

  const languageMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Update HTML dir and lang attributes when language changes
  useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (languageMenuRef.current && !languageMenuRef.current.contains(event.target as Node)) {
        setShowLanguageMenu(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setShowUserMenu(false);

    // First purge persisted state
    await persistor.purge();

    // Then dispatch logout to clear Redux state
    dispatch(logout());

    // Navigate to home
    navigate('/');
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    setShowLanguageMenu(false);
  };

  const languages = [
    { code: 'en', name: t('language.en'), flag: '🇬🇧' },
    { code: 'fr', name: t('language.fr'), flag: '🇫🇷' },
    { code: 'it', name: t('language.it'), flag: '🇮🇹' },
    { code: 'de', name: t('language.de'), flag: '🇩🇪' },
  ];

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/" className="text-2xl font-bold text-blue-600 hover:text-blue-700">
                {t('appName')}
              </Link>
            </div>
            <nav className="flex items-center space-x-4">
              <Link to="/" className="text-gray-700 hover:text-blue-600">{t('nav.home')}</Link>
              <Link to="/contact" className="text-gray-700 hover:text-blue-600">{t('nav.contact', 'Contact')}</Link>

              {/* Language Switcher */}
              <div className="relative" ref={languageMenuRef}>
                <button
                  onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                  className="flex items-center space-x-2 text-gray-700 hover:text-blue-600 focus:outline-none px-2 py-1 rounded-md hover:bg-gray-100"
                >
                  <span className="text-xl">{currentLanguage.flag}</span>
                  <span className="hidden md:block text-sm">{currentLanguage.name}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showLanguageMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => changeLanguage(lang.code)}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center space-x-3 ${
                          i18n.language === lang.code ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                        }`}
                      >
                        <span className="text-xl">{lang.flag}</span>
                        <span>{lang.name}</span>
                        {i18n.language === lang.code && (
                          <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {isAuthenticated ? (
                <>
                  <Link to="/my-bookings" className="text-gray-700 hover:text-blue-600">{t('nav.myBookings')}</Link>

                  {/* Admin Dashboard Button */}
                  {user?.isAdmin && (
                    <Link
                      to="/admin"
                      className="bg-purple-600 text-white px-3 py-1.5 rounded-md hover:bg-purple-700 text-sm font-medium"
                    >
                      {t('nav.admin')}
                    </Link>
                  )}

                  {/* User Menu Dropdown */}
                  <div className="relative" ref={userMenuRef}>
                    <button
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      className="flex items-center space-x-2 text-gray-700 hover:text-blue-600 focus:outline-none"
                    >
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                      </div>
                      <span className="hidden md:block">{user?.firstName} {user?.lastName}</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {showUserMenu && (
                      <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                        <div className="px-4 py-2 border-b border-gray-200">
                          <p className="text-sm font-medium text-gray-900 truncate" title={user?.email}>{user?.email}</p>
                        </div>
                        <Link
                          to="/profile"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setShowUserMenu(false)}
                        >
                          {t('nav.profile')}
                        </Link>
                        <Link
                          to="/my-bookings"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setShowUserMenu(false)}
                        >
                          {t('nav.myBookings')}
                        </Link>
                        <Link
                          to="/saved-routes"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setShowUserMenu(false)}
                        >
                          {t('nav.savedRoutes', 'Saved Routes')}
                        </Link>
                        <Link
                          to="/my-alerts"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setShowUserMenu(false)}
                        >
                          {t('nav.myAlerts', 'My Alerts')}
                        </Link>
                        {user?.isAdmin && (
                          <Link
                            to="/admin"
                            className="block px-4 py-2 text-sm text-purple-600 hover:bg-gray-100 font-medium"
                            onClick={() => setShowUserMenu(false)}
                          >
                            {t('nav.admin')}
                          </Link>
                        )}
                        <button
                          onClick={handleLogout}
                          className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                        >
                          {t('nav.logout')}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Link to="/find-booking" className="text-gray-700 hover:text-blue-600">{t('nav.findBooking')}</Link>
                  <Link to="/login" className="text-gray-700 hover:text-blue-600">{t('nav.login')}</Link>
                  <Link to="/register" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                    {t('nav.register')}
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Company Info */}
            <div>
              <h3 className="text-lg font-semibold mb-4">{t('appName')}</h3>
              <p className="text-gray-400 text-sm">
                {t('footer.description', 'Your trusted partner for Mediterranean ferry bookings. Compare routes, prices, and book with confidence.')}
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-lg font-semibold mb-4">{t('footer.quickLinks', 'Quick Links')}</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/" className="text-gray-400 hover:text-white transition-colors">
                    {t('nav.home')}
                  </Link>
                </li>
                <li>
                  <Link to="/find-booking" className="text-gray-400 hover:text-white transition-colors">
                    {t('nav.findBooking')}
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="text-gray-400 hover:text-white transition-colors">
                    {t('nav.contact', 'Contact')}
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h3 className="text-lg font-semibold mb-4">{t('footer.legal', 'Legal')}</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/terms" className="text-gray-400 hover:text-white transition-colors">
                    {t('footer.terms', 'Terms & Conditions')}
                  </Link>
                </li>
                <li>
                  <Link to="/privacy-policy" className="text-gray-400 hover:text-white transition-colors">
                    {t('footer.privacy', 'Privacy Policy')}
                  </Link>
                </li>
                <li>
                  <Link to="/cancellation-policy" className="text-gray-400 hover:text-white transition-colors">
                    {t('footer.cancellation', 'Cancellation Policy')}
                  </Link>
                </li>
                <li>
                  <Link to="/cookie-policy" className="text-gray-400 hover:text-white transition-colors">
                    {t('footer.cookies', 'Cookie Policy')}
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="text-lg font-semibold mb-4">{t('footer.contactUs', 'Contact Us')}</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <a href="mailto:support@voilaferry.com" className="hover:text-white transition-colors">
                    support@voilaferry.com
                  </a>
                </li>
                <li className="flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span>+33 1 XX XX XX XX</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-gray-700 mt-8 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p className="text-gray-400 text-sm">{t('footer.copyright')}</p>
              <div className="flex space-x-4 mt-4 md:mt-0">
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
                  </svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z"/>
                  </svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout; 