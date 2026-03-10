import { createI18n } from 'vue-i18n'
import en from './en.json'
import ru from './ru.json'

export const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem('locale') || (navigator.language.startsWith('ru') ? 'ru' : 'en'),
  fallbackLocale: 'en',
  messages: { en, ru },
})
