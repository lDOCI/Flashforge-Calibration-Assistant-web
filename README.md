# Flashforge Calibration Assistant v2.0

**[Open App / Открыть приложение](https://ldoci.github.io/Flashforge-Calibration-Assistant-web/)**

Web app for calibrating Flashforge Adventurer 5M / 5M Pro / 5X 3D printers.

Веб-приложение для калибровки 3D-принтеров Flashforge Adventurer 5M / 5M Pro / 5X.

---

## EN

### Features

- **3-stage bed leveling:** belts → screws → aluminum tape
  - Belt adjustment with exact GT2 20T tooth count
  - Precise screw turn instructions (direction + amount)
  - Tape layer count with placement map
- **Prediction** of bed level changes after each adjustment
- **2D heatmap & 3D surface** with color-coded deviations
- **Multiple bed maps** — load and compare several maps simultaneously (tabs)
- **Input Shaper analysis** for X/Y axes with PSD plots and shaper recommendations
- **Visual instructions** with animated diagrams (belts, screws, tape grid)
- **Share results** via link (data compressed into URL)
- **Auto language detection** (English / Russian)
- **Light & dark theme**
- **Runs in browser** — no install needed, all calculations client-side

### How to use

#### Option 1: USB drive (stock firmware)

1. Insert a USB drive into the printer
2. Go to **Settings** → **Machine Info**
3. Tap **Get Configuration**
4. Remove the drive and upload `printer.cfg` to the app

#### Option 2: SSH

Download the SSH utility from [`cli/`](cli/) or use [WinSCP](https://winscp.net/eng/download.php) to manually grab `printer.cfg` from the printer.

Config path on printer: `/opt/config/printer.cfg`

### Input Shaper

Upload accelerometer CSV files (`calibration_data_*.csv` from `/tmp` on the printer) to get shaper recommendations for X and Y axes.

---

## RU

### Возможности

- **Трёхэтапное выравнивание стола:** ремни → винты → алюминиевый скотч
  - Регулировка ремней с точным указанием количества зубьев GT2 20T
  - Точные инструкции по повороту винтов (направление + величина)
  - Расчёт количества слоёв скотча с указанием мест
- **Предсказание изменений** уровня стола после каждой регулировки
- **2D тепловая карта и 3D-график** с цветовой индикацией перекосов
- **Несколько карт одновременно** — загружайте и сравнивайте карты в табах
- **Анализ Input Shaper** по осям X/Y с графиками PSD и рекомендациями по шейперам
- **Визуальные инструкции** с анимированными диаграммами (ремни, винты, скотч)
- **Шаринг результатов** по ссылке (данные сжимаются в URL)
- **Автоопределение языка** (русский / английский)
- **Светлая и тёмная** тема
- **Работает в браузере** без установки, все вычисления на клиенте

### Как пользоваться

#### Способ 1: Через флешку (стоковая прошивка)

1. Вставьте USB-флешку в принтер
2. Перейдите в **Настройки** → **Информация о машине**
3. Нажмите **Получить конфигурацию**
4. Извлеките флешку и загрузите `printer.cfg` на сайт

#### Способ 2: Через SSH

Скачайте SSH-утилиту из папки [`cli/`](cli/) или используйте [WinSCP](https://winscp.net/eng/download.php) для ручного скачивания `printer.cfg` с принтера.

Путь к конфигу на принтере: `/opt/config/printer.cfg`

### Input Shaper

Загрузите CSV-файлы акселерометра (`calibration_data_*.csv` из `/tmp` на принтере) для получения рекомендаций по шейперам для осей X и Y.

---

## Tech stack

Vue 3 + TypeScript + Vite + Pinia + Plotly.js + Vue I18n

## Author

**I_DOC_I**

## License

MIT
