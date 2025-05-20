// Multi-language Support Implementation for Legal AI Reach Out Platform
// This file implements internationalization with support for Dutch, English, Spanish, French, and Chinese

// Import required libraries
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

// Initialize i18n
i18n
  // Load translations from backend
  .use(Backend)
  // Detect user language
  .use(LanguageDetector)
  // Pass the i18n instance to react-i18next
  .use(initReactI18next)
  // Initialize i18next
  .init({
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development',
    
    // Supported languages
    supportedLngs: ['en', 'nl', 'es', 'fr', 'zh'],
    
    // Default namespace
    defaultNS: 'common',
    
    // Backend configuration
    backend: {
      // Path to load translations from
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    
    // Detection options
    detection: {
      // Order of language detection
      order: ['querystring', 'cookie', 'localStorage', 'navigator', 'htmlTag'],
      
      // Cache user language
      caches: ['localStorage', 'cookie'],
      
      // Cookie options
      cookieExpirationDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
      cookieDomain: window.location.hostname,
    },
    
    // Interpolation options
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    
    // React options
    react: {
      useSuspense: true,
    },
  });

// Export i18n instance
export default i18n;

// Language utility functions
export const getLanguageName = (code) => {
  const languageNames = {
    en: 'English',
    nl: 'Nederlands',
    es: 'Español',
    fr: 'Français',
    zh: '中文'
  };
  
  return languageNames[code] || code;
};

// Language switcher component
export const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  
  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    setIsOpen(false);
  };
  
  return (
    <div className="language-switcher">
      <button 
        className="language-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className="current-language">{getLanguageName(i18n.language)}</span>
        <span className="dropdown-icon">▼</span>
      </button>
      
      {isOpen && (
        <ul className="language-dropdown">
          {i18n.options.supportedLngs
            .filter(lng => lng !== 'cimode') // Remove cimode
            .map(lng => (
              <li key={lng}>
                <button 
                  className={i18n.language === lng ? 'active' : ''}
                  onClick={() => changeLanguage(lng)}
                >
                  {getLanguageName(lng)}
                </button>
              </li>
            ))
          }
        </ul>
      )}
    </div>
  );
};

// Translation hook wrapper for easier usage
export const useTranslatedContent = (namespace = 'common') => {
  const { t, i18n } = useTranslation(namespace);
  
  return {
    t,
    currentLanguage: i18n.language,
    changeLanguage: i18n.changeLanguage,
    dir: i18n.dir(), // Text direction (rtl or ltr)
    isRTL: i18n.dir() === 'rtl',
  };
};

// Legal terminology translation helper
export const translateLegalTerm = (term, language = null) => {
  const { t, i18n } = useTranslation('legal');
  const targetLanguage = language || i18n.language;
  
  // If term is not found in translations, return the original term
  const translated = t(term, { lng: targetLanguage });
  return translated === term ? term : translated;
};

// Date and time formatter with localization
export const formatLocalizedDate = (date, format = 'medium', language = null) => {
  const { i18n } = useTranslation();
  const targetLanguage = language || i18n.language;
  
  // Use Intl.DateTimeFormat for localized date formatting
  const dateFormatter = new Intl.DateTimeFormat(targetLanguage, getDateFormatOptions(format));
  return dateFormatter.format(new Date(date));
};

// Get date format options based on format string
const getDateFormatOptions = (format) => {
  switch (format) {
    case 'short':
      return { 
        year: 'numeric', 
        month: 'numeric', 
        day: 'numeric' 
      };
    case 'long':
      return { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      };
    case 'time':
      return { 
        hour: 'numeric', 
        minute: 'numeric' 
      };
    case 'full':
      return { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: 'numeric', 
        minute: 'numeric'
      };
    case 'medium':
    default:
      return { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      };
  }
};

// Number formatter with localization
export const formatLocalizedNumber = (number, options = {}, language = null) => {
  const { i18n } = useTranslation();
  const targetLanguage = language || i18n.language;
  
  // Use Intl.NumberFormat for localized number formatting
  const numberFormatter = new Intl.NumberFormat(targetLanguage, options);
  return numberFormatter.format(number);
};

// Currency formatter with localization
export const formatLocalizedCurrency = (amount, currency = 'EUR', language = null) => {
  const { i18n } = useTranslation();
  const targetLanguage = language || i18n.language;
  
  // Use Intl.NumberFormat for localized currency formatting
  const currencyFormatter = new Intl.NumberFormat(targetLanguage, {
    style: 'currency',
    currency: currency,
  });
  
  return currencyFormatter.format(amount);
};

// Translation loader for dynamic content
export const loadDynamicTranslations = async (namespace, language = null) => {
  const { i18n } = useTranslation();
  const targetLanguage = language || i18n.language;
  
  try {
    // Check if namespace is already loaded
    if (i18n.hasResourceBundle(targetLanguage, namespace)) {
      return true;
    }
    
    // Load translations from backend
    const response = await fetch(`/locales/${targetLanguage}/${namespace}.json`);
    const translations = await response.json();
    
    // Add translations to i18n
    i18n.addResourceBundle(targetLanguage, namespace, translations);
    
    return true;
  } catch (error) {
    console.error(`Failed to load translations for ${namespace} in ${targetLanguage}:`, error);
    return false;
  }
};

// Translation context provider for app-wide access
export const TranslationProvider = ({ children }) => {
  const { i18n } = useTranslation();
  
  // Update document language attribute when language changes
  useEffect(() => {
    document.documentElement.lang = i18n.language;
    document.documentElement.dir = i18n.dir();
    
    // Add language-specific class to body
    document.body.className = document.body.className
      .replace(/lang-\w+/g, '')
      .trim();
    document.body.classList.add(`lang-${i18n.language}`);
  }, [i18n.language, i18n.dir]);
  
  return children;
};

// Example usage:
/*
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher, formatLocalizedDate, formatLocalizedCurrency } from './multi-language-support';

const MyComponent = () => {
  const { t } = useTranslation();
  
  return (
    <div>
      <LanguageSwitcher />
      
      <h1>{t('welcome')}</h1>
      <p>{t('intro.text')}</p>
      
      <div>
        <p>{t('date')}: {formatLocalizedDate(new Date())}</p>
        <p>{t('price')}: {formatLocalizedCurrency(1234.56)}</p>
      </div>
    </div>
  );
};
*/
