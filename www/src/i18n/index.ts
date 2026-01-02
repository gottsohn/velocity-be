import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import all translation files
import en from './locales/en.json';
import da from './locales/da.json';
import de from './locales/de.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import ig from './locales/ig.json';
import it from './locales/it.json';
import nl from './locales/nl.json';
import pcm from './locales/pcm.json';
import pl from './locales/pl.json';
import pt from './locales/pt.json';
import ru from './locales/ru.json';
import sw from './locales/sw.json';
import tr from './locales/tr.json';
import yo from './locales/yo.json';
import zh from './locales/zh.json';
import zu from './locales/zu.json';

export const resources = {
  en: { translation: en },
  da: { translation: da },
  de: { translation: de },
  es: { translation: es },
  fr: { translation: fr },
  ig: { translation: ig },
  it: { translation: it },
  nl: { translation: nl },
  pcm: { translation: pcm },
  pl: { translation: pl },
  pt: { translation: pt },
  ru: { translation: ru },
  sw: { translation: sw },
  tr: { translation: tr },
  yo: { translation: yo },
  zh: { translation: zh },
  zu: { translation: zu },
} as const;

export const languages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'ig', name: 'Igbo', nativeName: 'Igbo' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'pcm', name: 'Nigerian Pidgin', nativeName: 'Naija' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'yo', name: 'Yoruba', nativeName: 'Yorùbá' },
  { code: 'zh', name: 'Chinese (HK)', nativeName: '中文 (香港)' },
  { code: 'zu', name: 'Zulu', nativeName: 'isiZulu' },
] as const;

const LANGUAGE_STORAGE_KEY = 'velocity-language';

// Get stored language or detect from browser
const getStoredLanguage = (): string | null => {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    return null;
  }
};

// Store language preference
export const setStoredLanguage = (lang: string): void => {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {
    // localStorage not available
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    lng: getStoredLanguage() || undefined, // Use stored language if available, otherwise detect
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
  });

// Save language to localStorage whenever it changes
i18n.on('languageChanged', (lng) => {
  setStoredLanguage(lng);
});

export default i18n;
