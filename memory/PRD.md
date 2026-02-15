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
- Обратная связь через Telegram
- Аналитика для суперадмина и org_admin
- Восстановление пароля через email (Resend)

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
│   │   │   ├── layout/AppLayout.jsx
│   │   │   ├── modals/FeedbackModal
│   │   │   ├── analytics/AnalyticsWidgets.jsx
│   │   │   └── ui/...
│   │   ├── pages/
│   │   │   ├── AuthPage.js (login/register + forgot password flow)
│   │   │   ├── ResetPasswordPage.jsx (new password form)
│   │   │   ├── AdminPage.js
│   │   │   ├── OrgDetailPage.jsx (superadmin analytics)
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
- Resend (транзакционные email — сброс пароля)

## Реализовано Feb 14, 2026

### 1. Функция "Предложить улучшение"
- Кнопка в сайдбаре → модальное окно → Telegram Bot API

### 2. Страница организации (Суперадмин)
- `/admin/org/:orgId` — KPI, графики, категории расходов, транзакции

### 3. Дашборд аналитики для админа организации
- `/admin/analytics` — аналогичный суперадминскому, привязан к org_id пользователя

### 4. Редизайн нижней части сайдбара
- Баланс → "Обратная связь" + свернуть → Профиль

### 5. Компактные бейджи спикеров
- Сокращённые имена в сводке ("Имя Ф."), полные в транскрипте

### 6. Восстановление пароля (NEW)
- **Поток:** "Забыли пароль?" → ввод email → письмо от Resend → `/reset-password/:token` → новый пароль → редирект на логин
- **Backend:**
  - `POST /api/auth/forgot-password` — генерация одноразового токена (1 час), отправка письма
  - `POST /api/auth/reset-password` — проверка токена, смена пароля
  - MongoDB коллекция: `password_resets` (token, user_id, expires_at, used)
  - Защита от enumeration — одинаковый ответ для существующих и несуществующих email
- **Frontend:**
  - Ссылка "Забыли пароль?" рядом с полем пароля на логине
  - Форма ввода email + экран "Проверьте почту"
  - Страница `/reset-password/:token` — два поля пароля + валидация
  - Экран успеха с кнопкой "Войти"
- **Email:** отправляется с `noreply@notifications.noteall.ru` через Resend API
- **Тестирование:** 100% (8/8 backend, все frontend flows)

## Бэклог
- Нет определённых задач

## Учётные данные
- Суперадмин: dmitry.bondarev@gmail.com / Qq!11111
- Telegram: backend/.env (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)
- Resend: backend/.env (RESEND_API_KEY)
- Sender: noreply@notifications.noteall.ru
