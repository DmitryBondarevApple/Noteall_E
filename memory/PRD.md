# PRD — noteall.ru

## Описание продукта
AI-платформа для транскрибации и анализа встреч и документов. Полнофункциональное приложение (FastAPI + React + MongoDB).

## Основные возможности
- Управление проектами/встречами с приватными, публичными папками и корзиной
- Шаринг папок с каскадными правами доступа
- AI-транскрибация и анализ (Deepgram, OpenAI)
- Конструктор пайплайнов
- Биллинг и управление кредитами
- S3 хранилище файлов
- Система приглашений пользователей
- Обратная связь через Telegram (функция "Предложить улучшение")
- Полноценная страница организации для суперадмина с аналитикой
- Дашборд аналитики для админа организации

## Архитектура
```
/app
├── backend/
│   ├── app/
│   │   ├── core/ (config, database, security)
│   │   ├── routes/ (auth, projects, documents, meeting_folders, feedback, billing, ...)
│   │   ├── services/ (access_control, metering)
│   │   └── main.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/AppLayout
│   │   │   ├── modals/FeedbackModal
│   │   │   ├── analytics/AnalyticsWidgets.jsx (shared: KpiCard, CategoryBar, CategoryLegend, PeriodFilter)
│   │   │   └── ui/...
│   │   ├── pages/
│   │   │   ├── AdminPage.js
│   │   │   ├── OrgDetailPage.jsx (superadmin org analytics)
│   │   │   ├── OrgAdminDashboard.jsx (org admin analytics)
│   │   │   └── ...
│   │   ├── contexts/ (AuthContext, CreditsContext)
│   │   └── lib/ (api.js)
│   └── package.json
```

## Интеграции
- OpenAI GPT-4o (Emergent LLM Key)
- Deepgram Nova-3 (транскрибация)
- AWS S3 / Timeweb S3 (хранение файлов)
- Free Currency Converter API
- Telegram Bot API (обратная связь)

## Реализовано Feb 14, 2026

### 1. Функция "Предложить улучшение"
- Кнопка в сайдбаре, модальное окно (текст, email предзаполнен, Telegram)
- Чекбокс для скриншота (по умолчанию включён)
- Скриншот делается ПОСЛЕ закрытия модалки (без оверлея)
- Backend: POST /api/feedback/suggest → Telegram Bot API
- Тестирование: 100% (8/8 backend, frontend passed)

### 2. Страница организации (Суперадмин)
- Полноценная страница `/admin/org/:orgId` вместо модалки
- Фильтр периода: День / Неделя / Месяц / Всё время
- KPI-карточки: Баланс, Всего оплачено, Потрачено за период, Ср. расход/мес, AI-запросов
- **Разбивка расходов по 3 категориям:** Транскрибация / Анализ (AI) / Хранение
  - Цветная полоса (stacked bar)
  - Легенда с иконками и суммами
- Вкладка "Динамика": area chart (по дням, stacked по категориям) + pie chart (структура)
- Вкладка "Пользователи": таблица с ролями и лимитами
- Вкладка "Транзакции": фильтрованные по периоду
- Вкладка "Пополнить": ручное пополнение баланса
- Тестирование: 100% (19/19 backend, frontend passed)

### 3. Дашборд аналитики для админа организации
- Новая страница `/admin/analytics` для org_admin
- Кнопка "Аналитика" на странице `/admin` для перехода
- Backend: GET /api/billing/org/my-analytics — переиспользует агрегацию суперадмина, привязан к org_id текущего пользователя
- KPI-карточки, разбивка расходов по категориям, графики динамики и структуры
- 3 вкладки: Динамика / Пользователи / Транзакции (без "Пополнить")
- Период-фильтр: День / Неделя / Месяц / Всё время
- Общие компоненты вынесены в `AnalyticsWidgets.jsx` (KpiCard, CategoryBar, CategoryLegend, PeriodFilter)
- Тестирование: 100% (17/17 backend, frontend passed)

## Бэклог
- Нет определённых задач на данный момент

## Учётные данные для тестирования
- Суперадмин: dmitry.bondarev@gmail.com / Qq!11111
- Telegram: в backend/.env (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)
