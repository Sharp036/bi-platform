import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en.json'
import ru from './locales/ru.json'
import de from './locales/de.json'
import fr from './locales/fr.json'
import es from './locales/es.json'
import pt from './locales/pt.json'
import zh from './locales/zh.json'
import ja from './locales/ja.json'
import ko from './locales/ko.json'
import ar from './locales/ar.json'
import hi from './locales/hi.json'
import it from './locales/it.json'
import nl from './locales/nl.json'
import pl from './locales/pl.json'
import tr from './locales/tr.json'
import sv from './locales/sv.json'
import cs from './locales/cs.json'
import uk from './locales/uk.json'
import vi from './locales/vi.json'
import th from './locales/th.json'
import id from './locales/id.json'
import ro from './locales/ro.json'
import hu from './locales/hu.json'
import el from './locales/el.json'
import fi from './locales/fi.json'
import da from './locales/da.json'
import no from './locales/no.json'
import he from './locales/he.json'

export interface SupportedLanguage {
  code: string
  nativeName: string
  dir?: 'rtl'
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', nativeName: 'English' },
  { code: 'ru', nativeName: 'Русский' },
  { code: 'de', nativeName: 'Deutsch' },
  { code: 'fr', nativeName: 'Français' },
  { code: 'es', nativeName: 'Español' },
  { code: 'pt', nativeName: 'Português' },
  { code: 'zh', nativeName: '中文 (简体)' },
  { code: 'ja', nativeName: '日本語' },
  { code: 'ko', nativeName: '한국어' },
  { code: 'ar', nativeName: 'العربية', dir: 'rtl' },
  { code: 'hi', nativeName: 'हिन्दी' },
  { code: 'it', nativeName: 'Italiano' },
  { code: 'nl', nativeName: 'Nederlands' },
  { code: 'pl', nativeName: 'Polski' },
  { code: 'tr', nativeName: 'Türkçe' },
  { code: 'sv', nativeName: 'Svenska' },
  { code: 'cs', nativeName: 'Čeština' },
  { code: 'uk', nativeName: 'Українська' },
  { code: 'vi', nativeName: 'Tiếng Việt' },
  { code: 'th', nativeName: 'ไทย' },
  { code: 'id', nativeName: 'Bahasa Indonesia' },
  { code: 'ro', nativeName: 'Română' },
  { code: 'hu', nativeName: 'Magyar' },
  { code: 'el', nativeName: 'Ελληνικά' },
  { code: 'fi', nativeName: 'Suomi' },
  { code: 'da', nativeName: 'Dansk' },
  { code: 'no', nativeName: 'Norsk' },
  { code: 'he', nativeName: 'עברית', dir: 'rtl' },
]

const savedLang = localStorage.getItem('language')
const browserLang = navigator.language.split('-')[0]
const initialLang = savedLang || (SUPPORTED_LANGUAGES.some(l => l.code === browserLang) ? browserLang : 'en')

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ru: { translation: ru },
      de: { translation: de },
      fr: { translation: fr },
      es: { translation: es },
      pt: { translation: pt },
      zh: { translation: zh },
      ja: { translation: ja },
      ko: { translation: ko },
      ar: { translation: ar },
      hi: { translation: hi },
      it: { translation: it },
      nl: { translation: nl },
      pl: { translation: pl },
      tr: { translation: tr },
      sv: { translation: sv },
      cs: { translation: cs },
      uk: { translation: uk },
      vi: { translation: vi },
      th: { translation: th },
      id: { translation: id },
      ro: { translation: ro },
      hu: { translation: hu },
      el: { translation: el },
      fi: { translation: fi },
      da: { translation: da },
      no: { translation: no },
      he: { translation: he },
    },
    lng: initialLang,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })

i18n.on('languageChanged', (lng) => {
  const lang = SUPPORTED_LANGUAGES.find(l => l.code === lng)
  document.documentElement.dir = lang?.dir === 'rtl' ? 'rtl' : 'ltr'
})

export default i18n
