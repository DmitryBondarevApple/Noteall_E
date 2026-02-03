# Voice Workspace MVP - PRD

## Описание проекта
Платформа для транскрибации и анализа рабочих встреч на базе Deepgram и OpenAI GPT-4o.

## Дата создания
2024-02-03

## User Personas
- **Бизнес-пользователь**: менеджеры, аналитики, руководители, которые проводят много встреч
- **Администратор**: управляет общими промптами и пользователями системы

## Core Requirements (Static)
1. Личные кабинеты пользователей с JWT авторизацией
2. Создание проектов транскрибации (1 проект = 1 встреча)
3. Загрузка аудио/видео записей
4. Интеграция с Deepgram для транскрибации
5. Мастер промпт для первичной обработки
6. Интерфейс проверки спорных фрагментов
7. Разметка спикеров (Speaker 1 → Имя)
8. Хранилище промптов (мастер, тематические, личные, проектные)
9. Анализ встречи с GPT-4o
10. Роль admin: управление пользователями и общими промптами

## User Choices
- **LLM**: GPT-4o через Emergent LLM Key
- **Auth**: JWT-based (email/password)
- **Storage**: Локальное хранилище файлов
- **Theme**: Светлая тема
- **Transcription**: Deepgram (ЗАМОКАНО для MVP)

## What's Been Implemented ✅
- [x] JWT авторизация (регистрация, вход, выход)
- [x] Dashboard с проектами (CRUD)
- [x] Страница проекта с загрузкой файлов
- [x] Mock транскрибация (тестовые данные)
- [x] Просмотр транскрипта
- [x] Проверка и исправление спорных фрагментов
- [x] Разметка спикеров
- [x] Библиотека промптов (мастер, тематические, личные)
- [x] Анализ встречи с GPT-4o (работает!)
- [x] История анализов
- [x] Admin панель (пользователи, промпты)
- [x] Seed data с базовыми промптами

## Architecture
```
Frontend: React + Tailwind + Shadcn/UI
Backend: FastAPI + MongoDB
LLM: OpenAI GPT-4o (via emergentintegrations)
Transcription: Deepgram (MOCKED)
Auth: JWT tokens
Storage: Local filesystem
```

## API Endpoints
- POST /api/auth/register, /api/auth/login, GET /api/auth/me
- CRUD /api/projects, POST /api/projects/{id}/upload
- GET /api/projects/{id}/transcripts, POST .../confirm
- GET/PUT /api/projects/{id}/fragments/{id}
- GET/PUT /api/projects/{id}/speakers/{id}
- CRUD /api/prompts
- POST /api/projects/{id}/analyze, GET .../chat-history
- GET /api/admin/users, /api/admin/prompts

## MOCKED APIs ⚠️
- **Deepgram Transcription**: Возвращает тестовый транскрипт с mock данными

## P0 - Critical (Remaining)
- [ ] Интеграция реального Deepgram API (нужен API ключ)

## P1 - High Priority (Remaining)
- [ ] Подтверждение транскрипта (кнопка работает, но логика может быть улучшена)
- [ ] Проигрывание фрагментов аудио при проверке
- [ ] Экспорт финального транскрипта (PDF, DOCX)

## P2 - Nice to Have
- [ ] Google Drive интеграция для хранения файлов
- [ ] Совместный доступ к проектам
- [ ] Командные пространства
- [ ] Полнотекстовый поиск
- [ ] Мобильная версия

## Next Tasks
1. Получить Deepgram API ключ и заменить mock на реальную интеграцию
2. Добавить экспорт транскрипта
3. Улучшить UI редактора транскрипта
