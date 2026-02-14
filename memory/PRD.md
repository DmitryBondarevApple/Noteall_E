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

## Архитектура
```
/app
├── backend/
│   ├── app/
│   │   ├── core/ (config, database, security)
│   │   ├── routes/ (auth, projects, documents, meeting_folders, feedback, ...)
│   │   ├── services/ (access_control, metering)
│   │   └── main.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/ (layout/AppLayout, modals/FeedbackModal, ui/...)
│   │   ├── pages/ (MeetingsPage, DocumentsPage, ConstructorPage, ...)
│   │   ├── contexts/ (AuthContext, CreditsContext)
│   │   └── lib/ (api.js)
│   └── package.json
```

## Интеграции
- OpenAI GPT-4o (Emergent LLM Key)
- Deepgram Nova-3 (транскрибация)
- AWS S3 / Timeweb S3 (хранение файлов)
- Free Currency Converter API
- **Telegram Bot API** (обратная связь)

## Реализованные фичи (до Feb 2026)
- Полная система хранения (Private/Public/Trash)
- Шаринг с каскадными правами
- Отображение владельца папки
- Корзина с корректной логикой для owner/non-owner
- Биллинг, приглашения, управление организациями

## Реализовано Feb 14, 2026
### Функция "Предложить улучшение" (Suggest Improvements)
- Кнопка в сайдбаре "Предложить улучшение"
- Модальное окно с полями: текст предложения, email (предзаполнен из профиля), Telegram
- При отправке — скриншот текущей страницы (html2canvas) + отправка в Telegram чат через Bot API
- Backend: POST /api/feedback/suggest (multipart/form-data)
- Telegram: sendPhoto (со скриншотом) / sendMessage (без скриншота)
- Тестирование: 100% backend (8/8), 100% frontend

## Бэклог
- Нет определённых задач на данный момент

## Учётные данные для тестирования
- Суперадмин: dmitry.bondarev@gmail.com / Qq!11111
- Telegram Bot Token: в backend/.env (TELEGRAM_BOT_TOKEN)
- Telegram Chat ID: в backend/.env (TELEGRAM_CHAT_ID)
