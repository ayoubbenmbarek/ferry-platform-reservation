// i18n configuration for internationalization
const i18n = {
  init: () => {
    // Initialize i18n
    console.log('i18n initialized');
  },
  language: 'en',
  changeLanguage: (lang: string) => {
    console.log('Language changed to:', lang);
  },
  t: (key: string) => {
    // Simple translation function
    const translations: { [key: string]: string } = {
      'welcome': 'Welcome',
      'search': 'Search',
      'book': 'Book',
      'login': 'Login',
      'register': 'Register',
    };
    return translations[key] || key;
  }
};

// Initialize i18n
i18n.init();

export default i18n; 