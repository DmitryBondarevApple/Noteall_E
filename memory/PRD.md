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
│   │   │   ├── layout/AppLayout.jsx (sidebar with redesigned bottom section)
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
- Backend: POST /api/feedback/suggest → Telegram Bot API

### 2. Страница организации (Суперадмин)
- Полноценная страница `/admin/org/:orgId`
- Фильтр периода: День / Неделя / Месяц / Всё время
- KPI-карточки, разбивка расходов по категориям, графики, транзакции
- Вкладка "Пополнить": ручное пополнение баланса

### 3. Дашборд аналитики для админа организации
- Новая страница `/admin/analytics` для org_admin
- Backend: GET /api/billing/org/my-analytics
- KPI-карточки, разбивка расходов, графики
- 3 вкладки: Динамика / Пользователи / Транзакции
- Общие компоненты в `AnalyticsWidgets.jsx`
- Тестирование: 100% (17/17 backend, frontend passed)

### 4. Редизайн нижней части сайдбара
- Баланс-виджет вверху нижнего блока (компактный)
- "Обратная связь" + кнопка свернуть — в одну строку
- Профиль (имя + организация) — чистый блок внизу
- Работает корректно и в свёрнутом режиме

## Бэклог
- Нет определённых задач на данный момент

## Учётные данные для тестирования
- Суперадмин: dmitry.bondarev@gmail.com / Qq!11111
