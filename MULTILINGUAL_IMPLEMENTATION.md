# 🌍 Multilingual Implementation Guide

## Overview
This document describes the complete multilingual (i18n) implementation for the Maritime Reservation Platform using **react-i18next**.

---

## ✅ Implemented Features

### 1. **Supported Languages**
- 🇬🇧 **English (EN)** - Primary language
- 🇫🇷 **French (FR)** - Mediterranean routes
- 🇸🇦 **Arabic (AR)** - RTL support, Middle East/North Africa
- 🇮🇹 **Italian (IT)** - Mediterranean market
- 🇩🇪 **German (DE)** - European tourism

### 2. **Language Detection Strategy**
The system detects user language in this priority order:
1. **URL parameter** → `?lang=fr`
2. **Cookie** → `i18next` cookie
3. **localStorage** → `i18nextLng`
4. **Browser language** → `navigator.language`
5. **User preference** (if logged in) → `user.preferred_language`
6. **Fallback** → English (EN)

### 3. **RTL Support**
- **Automatic RTL detection** for Arabic
- Updates `document.documentElement.dir` to `rtl` or `ltr`
- Updates `document.documentElement.lang` attribute
- Layout adjusts automatically for right-to-left languages

---

## 📁 File Structure

### Frontend Translation Files
```
frontend/public/locales/
├── en/
│   ├── common.json      # Navigation, footer, buttons
│   ├── auth.json        # Login, register, password reset
│   ├── search.json      # Ferry search page
│   ├── booking.json     # Booking flow
│   ├── payment.json     # Payment page
│   ├── profile.json     # User profile
│   └── admin.json       # Admin dashboard
├── fr/
│   ├── common.json
│   ├── auth.json
│   ├── search.json
│   └── ...
├── ar/
│   └── ...
├── it/
│   └── ...
└── de/
    └── ...
```

### Backend Email Templates (To Be Implemented)
```
backend/app/templates/emails/
├── en/
│   ├── booking_confirmation.html
│   ├── payment_success.html
│   ├── cancellation_confirmation.html
│   └── refund_confirmation.html
├── fr/
├── ar/
├── it/
└── de/
```

---

## 🔧 Configuration

### i18n Configuration (`frontend/src/i18n.ts`)
```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

i18n
  .use(HttpBackend)              // Load translations from /public/locales
  .use(LanguageDetector)         // Detect user language
  .use(initReactI18next)         // Pass to React
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'fr', 'ar', 'it', 'de'],
    ns: ['common', 'search', 'booking', 'payment', 'auth', 'profile', 'admin'],
    defaultNS: 'common',
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
  });
```

---

## 🎨 UI Components

### Language Switcher (In Navbar)
- **Location**: `frontend/src/components/Layout/Layout.tsx`
- **Features**:
  - Flag icons for each language
  - Dropdown menu with all supported languages
  - Current language highlighted
  - Automatically saves to localStorage and cookie

### Usage in Components
```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t, i18n } = useTranslation(['common', 'search']);

  return (
    <div>
      <h1>{t('common:nav.home')}</h1>
      <p>{t('search:title')}</p>
      <button onClick={() => i18n.changeLanguage('fr')}>
        Français
      </button>
    </div>
  );
}
```

### Translation Keys Examples
```typescript
// Simple translation
t('nav.home')                    // "Home"

// Nested keys
t('common.loading')              // "Loading..."

// With namespace
t('auth:login.title')            // "Login to Your Account"

// Interpolation
t('search:results.seatsAvailable', { count: 5 })  // "5 seats available"
```

---

## 📝 Translation File Examples

### English (`en/common.json`)
```json
{
  "appName": "Maritime Reservations",
  "nav": {
    "home": "Home",
    "search": "Search",
    "myBookings": "My Bookings",
    "login": "Login",
    "register": "Sign Up"
  },
  "common": {
    "loading": "Loading...",
    "error": "An error occurred",
    "save": "Save",
    "cancel": "Cancel"
  }
}
```

### French (`fr/common.json`)
```json
{
  "appName": "Réservations Maritimes",
  "nav": {
    "home": "Accueil",
    "search": "Rechercher",
    "myBookings": "Mes Réservations",
    "login": "Connexion",
    "register": "S'inscrire"
  },
  "common": {
    "loading": "Chargement...",
    "error": "Une erreur s'est produite",
    "save": "Enregistrer",
    "cancel": "Annuler"
  }
}
```

### Arabic (`ar/common.json`)
```json
{
  "appName": "الحجوزات البحرية",
  "nav": {
    "home": "الرئيسية",
    "search": "بحث",
    "myBookings": "حجوزاتي",
    "login": "تسجيل الدخول",
    "register": "إنشاء حساب"
  },
  "common": {
    "loading": "جاري التحميل...",
    "error": "حدث خطأ",
    "save": "حفظ",
    "cancel": "إلغاء"
  }
}
```

---

## 🚀 How to Use

### For Users
1. **Click the language selector** in the navbar (shows current flag)
2. **Select desired language** from dropdown
3. **Entire UI updates** instantly
4. **Preference is saved** in browser (localStorage + cookie)

### For Developers

#### Adding a New Translation
1. **Add key to English file** (`en/namespace.json`)
2. **Copy to all other languages** and translate
3. **Use in component** with `t('namespace:key')`

Example:
```bash
# 1. Add to en/common.json
"newFeature": {
  "title": "New Feature"
}

# 2. Add to fr/common.json
"newFeature": {
  "title": "Nouvelle Fonctionnalité"
}

# 3. Use in component
{t('common:newFeature.title')}
```

#### Adding a New Language
1. **Update i18n.ts** → Add to `supportedLngs` array
2. **Create directory** → `public/locales/xx/`
3. **Copy translation files** from `en/` and translate
4. **Add to language switcher** → Update `languages` array in `Layout.tsx`

---

## 🔄 Backend Integration (To Do)

### Email Templates by Language
```python
# backend/app/services/email_service.py

def send_booking_confirmation(self, booking_data, to_email, language='en'):
    """Send booking confirmation in user's preferred language."""

    # Select template based on language
    template_path = f'emails/{language}/booking_confirmation.html'

    # Fallback to English if language not supported
    if not os.path.exists(template_path):
        template_path = 'emails/en/booking_confirmation.html'

    # Render and send email
    html_content = self.render_template(template_path, booking_data)
    self.send_email(to_email, subject, html_content)
```

### User Preference Sync
When user logs in, load their `preferred_language` and set it:
```typescript
// After login success
i18n.changeLanguage(user.preferredLanguage);
```

When user changes language while logged in, update backend:
```typescript
// On language change
const updateUserPreference = async (language: string) => {
  await api.patch('/users/me', { preferred_language: language });
};
```

---

## 📊 Translation Coverage

### Currently Translated
- ✅ Navigation (navbar, footer)
- ✅ Authentication (login, register, password reset)
- ✅ Search page structure
- ⏳ Booking page (placeholder)
- ⏳ Payment page (placeholder)
- ⏳ Profile page (placeholder)
- ⏳ Admin dashboard (placeholder)

### To Be Translated
- [ ] Home page content
- [ ] Booking flow (all steps)
- [ ] Payment page
- [ ] Profile settings
- [ ] Admin dashboard
- [ ] Error messages
- [ ] Email templates (backend)
- [ ] Success/confirmation messages

---

## 🎯 Best Practices

### 1. **Always use translation keys**
```typescript
// ❌ Bad
<button>Login</button>

// ✅ Good
<button>{t('auth:login.loginButton')}</button>
```

### 2. **Keep keys organized**
```json
{
  "page": {
    "section": {
      "element": "Translation"
    }
  }
}
```

### 3. **Use namespaces**
```typescript
// Group related translations
useTranslation(['common', 'booking'])
```

### 4. **Handle pluralization**
```json
{
  "seats": "{{count}} seat",
  "seats_plural": "{{count}} seats"
}
```

```typescript
t('seats', { count: 5 })  // "5 seats"
t('seats', { count: 1 })  // "1 seat"
```

### 5. **Date/time formatting**
Use i18next with date libraries:
```typescript
import { format } from 'date-fns';
import { fr, ar, it, de } from 'date-fns/locale';

const locales = { en: undefined, fr, ar, it, de };
format(new Date(), 'PPP', { locale: locales[i18n.language] });
```

---

## 🧪 Testing

### Manual Testing
1. Switch to each language using the selector
2. Navigate through all pages
3. Check RTL layout for Arabic
4. Verify date/time/currency formatting

### Automated Testing
```typescript
import { render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';

test('renders in French', () => {
  i18n.changeLanguage('fr');
  const { getByText } = render(
    <I18nextProvider i18n={i18n}>
      <MyComponent />
    </I18nextProvider>
  );
  expect(getByText('Accueil')).toBeInTheDocument();
});
```

---

## 📈 Next Steps

1. ✅ Configure react-i18next
2. ✅ Create translation file structure
3. ✅ Add language switcher to navbar
4. ✅ Implement RTL support for Arabic
5. ⏳ Complete all page translations (booking, payment, profile)
6. ⏳ Add multi-language email templates (backend)
7. ⏳ Sync user language preference with backend
8. ⏳ Add currency formatting based on language
9. ⏳ Translate error messages from API
10. ⏳ Add date/time formatting per locale

---

## 🐛 Troubleshooting

### Translation not showing
- Check if translation file exists in `public/locales/{lang}/{namespace}.json`
- Verify namespace is loaded in `useTranslation(['namespace'])`
- Check browser console for i18n errors

### RTL not working
- Check `document.documentElement.dir` in browser DevTools
- Verify Arabic language code is exactly `'ar'`
- Some CSS may need RTL-specific rules

### Language not persisting
- Check localStorage for `i18nextLng` key
- Check cookies for `i18next` value
- Verify LanguageDetector is configured

---

## 📚 Resources

- [react-i18next Documentation](https://react.i18next.com/)
- [i18next Documentation](https://www.i18next.com/)
- [Language Codes (ISO 639-1)](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes)
- [RTL Styling Guide](https://rtlstyling.com/)

---

**Implementation Date**: 2024-11-22
**Status**: ✅ Core Implementation Complete
**Coverage**: Navigation, Authentication, Search (partial)
