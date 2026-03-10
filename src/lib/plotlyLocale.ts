import Plotly from 'plotly.js-dist-min'

/** Register Russian locale for Plotly UI strings */
const ruLocale: Partial<Plotly.Locale> = {
  moduleType: 'locale',
  name: 'ru',
  dictionary: {
    'Click to enter Colorscale title': 'Нажмите для заголовка шкалы',
    'Click to enter Plot title': 'Нажмите для заголовка',
    'Click to enter X axis title': 'Нажмите для заголовка оси X',
    'Click to enter Y axis title': 'Нажмите для заголовка оси Y',
    'Compare data on hover': 'Сравнение при наведении',
    'Double-click on legend to isolate one trace': 'Двойной клик по легенде — выделить один график',
    'Double-click to zoom back out': 'Двойной клик — сбросить масштаб',
    'Download plot as a png': 'Скачать как PNG',
    'Download plot': 'Скачать график',
    'Edit in Chart Studio': 'Редактировать в Chart Studio',
    'IE only supports svg.  Googling "googlechrome" is your best bet.': 'IE поддерживает только SVG.',
    'Lasso Select': 'Лассо',
    'Orbital rotation': 'Орбитальное вращение',
    'Pan': 'Панорамирование',
    'Produced with Plotly': 'Сделано с Plotly',
    'Reset': 'Сброс',
    'Reset axes': 'Сбросить оси',
    'Reset camera to default': 'Сбросить камеру',
    'Reset camera to last save': 'Восстановить камеру',
    'Reset view': 'Сбросить вид',
    'Reset views': 'Сбросить виды',
    'Show closest data on hover': 'Показать ближайшую точку',
    'Snapshot succeeded': 'Снимок создан',
    'Sorry, there was a problem downloading your snapshot!': 'Ошибка при сохранении снимка',
    'Taking snapshot - Loss of interactivity may occur': 'Создание снимка…',
    'Toggle Spike Lines': 'Линии отслеживания',
    'Toggle show closest data on hover': 'Показать ближайшие данные',
    'Turntable rotation': 'Вращение',
    'Zoom': 'Масштаб',
    'Zoom in': 'Увеличить',
    'Zoom out': 'Уменьшить',
    'close:': 'закрытие:',
    'high:': 'макс:',
    'incoming flow count:': 'входящий поток:',
    'low:': 'мин:',
    'open:': 'открытие:',
    'outgoing flow count:': 'исходящий поток:',
    'trace': 'график',
  },
  format: {
    days: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
    shortDays: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
    months: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
    shortMonths: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
    decimal: ',',
    thousands: ' ',
  },
}

// Register once
try {
  ;(Plotly as any).register(ruLocale)
} catch {
  // Already registered
}

/** Get Plotly config with locale set based on current i18n locale */
export function plotlyConfig(locale: string): Partial<Plotly.Config> {
  return {
    responsive: true,
    displayModeBar: false,
    locale: locale === 'ru' ? 'ru' : 'en',
  }
}
