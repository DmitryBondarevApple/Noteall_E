import uuid
from datetime import datetime, timezone
from fastapi import APIRouter
from app.core.database import db
from app.core.security import hash_password

router = APIRouter(tags=["seed"])


@router.post("/update-master-prompt")
async def update_master_prompt():
    """Update master prompt to improved version"""
    now = datetime.now(timezone.utc).isoformat()
    
    new_content = """Я буду представлять тебе тексты транскриптов встреч.

ИСПРАВЛЕНИЕ ОШИБОК:
Местами в них будут ошибки распознавания. Если заметишь такие ошибки (слова не соответствующие теме и контексту, искажённые имена, термины, аббревиатуры) — исправь их по контексту.
Суммаризировать высказывания спикеров нельзя, твоя задача — сохранять дословные транскрипты.

ОБЪЕДИНЕНИЕ РЕПЛИК:
В текстах транскрипта будут встречаться предложения, в середине которых происходит смена спикера (например — реплика следующего спикера начинается с маленькой буквы). В этом случае перенеси остальную часть фразы (до точки) в реплику предыдущего спикера.
Пример:
Speaker 1: ...Ты расскажи, ты общался там с кем-нибудь вообще? Слушай,
Speaker 2: если честно, пока ещё нет.

Надо делать так:
Speaker 1: ...Ты расскажи, ты общался там с кем-нибудь вообще?
Speaker 2: Слушай, если честно, пока ещё нет.

ЗАМЕНА СПИКЕРОВ:
Тебе также нужно будет делать замены авторов реплик в тексте — я буду их указывать перед началом текста транскрипта, например:
Speaker 0 — Дмитрий
Speaker 1 — Сабина

ФОРМАТИРОВАНИЕ:
- Сделай выделение имен спикеров болдом
- Отделяй реплики спикеров друг от друга пробелами
- Внутри реплики спикера пробелов между строчками не делай
- Разбивай длинные куски текста на смысловые абзацы для удобства чтения, но не отделяй эти абзацы внутри реплик спикеров пробелами друг от друга

СОМНИТЕЛЬНЫЕ МЕСТА:
Все исправления, в которых ты не уверен на 100%, ОБЯЗАТЕЛЬНО укажи в секции "Сомнительные места" в конце текста. Формат:

---
Сомнительные места:
1. «исходное слово» → «исправленное слово» — краткое пояснение
2. ...

Если все исправления очевидны и сомнений нет, напиши:
---
Сомнительные места:
Нет сомнительных мест.

Пользователь сможет проверить каждое исправление и подтвердить или изменить его."""
    
    result = await db.prompts.update_one(
        {"prompt_type": "master"},
        {"$set": {"content": new_content, "updated_at": now}}
    )
    
    if result.matched_count == 0:
        return {"message": "Master prompt not found, run /seed first"}
    
    return {"message": "Master prompt updated successfully"}


@router.post("/seed")
async def seed_data():
    """Seed initial prompts and admin user"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Check if master prompt exists
    existing = await db.prompts.find_one({"prompt_type": "master"})
    if existing:
        return {"message": "Data already seeded"}
    
    prompts = [
        {
            "id": str(uuid.uuid4()),
            "name": "Мастер промпт",
            "content": """Я буду представлять тебе тексты транскриптов встреч.

ИСПРАВЛЕНИЕ ОШИБОК:
Местами в них будут ошибки распознавания. Если заметишь такие ошибки (слова не соответствующие теме и контексту, искажённые имена, термины, аббревиатуры) — исправь их по контексту.
Суммаризировать высказывания спикеров нельзя, твоя задача — сохранять дословные транскрипты.

ОБЪЕДИНЕНИЕ РЕПЛИК:
В текстах транскрипта будут встречаться предложения, в середине которых происходит смена спикера (например — реплика следующего спикера начинается с маленькой буквы). В этом случае перенеси остальную часть фразы (до точки) в реплику предыдущего спикера.
Пример:
Speaker 1: ...Ты расскажи, ты общался там с кем-нибудь вообще? Слушай,
Speaker 2: если честно, пока ещё нет.

Надо делать так:
Speaker 1: ...Ты расскажи, ты общался там с кем-нибудь вообще?
Speaker 2: Слушай, если честно, пока ещё нет.

ЗАМЕНА СПИКЕРОВ:
Тебе также нужно будет делать замены авторов реплик в тексте — я буду их указывать перед началом текста транскрипта, например:
Speaker 0 — Дмитрий
Speaker 1 — Сабина

ФОРМАТИРОВАНИЕ:
- Сделай выделение имен спикеров болдом
- Отделяй реплики спикеров друг от друга пробелами
- Внутри реплики спикера пробелов между строчками не делай
- Разбивай длинные куски текста на смысловые абзацы для удобства чтения, но не отделяй эти абзацы внутри реплик спикеров пробелами друг от друга

СОМНИТЕЛЬНЫЕ МЕСТА:
Все исправления, в которых ты не уверен на 100%, ОБЯЗАТЕЛЬНО укажи в секции "Сомнительные места" в конце текста. Формат:

---
Сомнительные места:
1. «исходное слово» → «исправленное слово» — краткое пояснение
2. ...

Если все исправления очевидны и сомнений нет, напиши:
---
Сомнительные места:
Нет сомнительных мест.

Пользователь сможет проверить каждое исправление и подтвердить или изменить его.""",
            "prompt_type": "master",
            "user_id": None,
            "project_id": None,
            "is_public": True,
            "created_at": now,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Протокол встречи",
            "content": "На основе транскрипта составь структурированный протокол встречи: 1. Участники, 2. Основные темы обсуждения, 3. Принятые решения, 4. Назначенные задачи с ответственными, 5. Следующие шаги",
            "prompt_type": "thematic",
            "user_id": None,
            "project_id": None,
            "is_public": True,
            "created_at": now,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Ключевые решения",
            "content": "Выдели все ключевые решения, которые были приняты на встрече. Для каждого решения укажи: что решили, кто предложил, были ли возражения",
            "prompt_type": "thematic",
            "user_id": None,
            "project_id": None,
            "is_public": True,
            "created_at": now,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Задачи и дедлайны",
            "content": "Составь список всех задач, упомянутых на встрече. Для каждой задачи укажи: описание, ответственный (если назначен), срок (если упоминался), приоритет (если обсуждался)",
            "prompt_type": "thematic",
            "user_id": None,
            "project_id": None,
            "is_public": True,
            "created_at": now,
            "updated_at": now
        }
    ]
    
    for prompt in prompts:
        await db.prompts.insert_one(prompt)
    
    # Create admin user if not exists
    admin = await db.users.find_one({"email": "admin@voiceworkspace.com"})
    if not admin:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": "admin@voiceworkspace.com",
            "password": hash_password("admin123"),
            "name": "Admin",
            "role": "admin",
            "created_at": now
        })
    
    # Seed default pipeline if not exists
    existing_pipeline = await db.pipelines.find_one({"name": "Стандартный анализ встречи"})
    if not existing_pipeline:
        await db.pipelines.insert_one({
            "id": str(uuid.uuid4()),
            "name": "Стандартный анализ встречи",
            "description": "Извлечение тем, анализ по темам батчами, итоговое резюме",
            "nodes": [
                {
                    "node_id": "input_subject",
                    "node_type": "template",
                    "label": "Тема встречи",
                    "template_text": "{{meeting_subject}}",
                    "input_from": None,
                    "position_x": 250, "position_y": 0,
                    "prompt_id": None, "inline_prompt": None, "system_message": None,
                    "reasoning_effort": None, "batch_size": None
                },
                {
                    "node_id": "extract_topics",
                    "node_type": "ai_prompt",
                    "label": "Извлечение тем",
                    "inline_prompt": "Данный текст является транскриптом встречи для \"{{meeting_subject}}\".\nСоставь общий список обсужденных тем.\nВыдай только нумерованный список тем, без дополнительных пояснений.\nФормат:\n1. Тема\n2. Тема\n...",
                    "system_message": "Ты — ассистент для анализа встреч. Выдавай только запрошенную информацию без лишних комментариев.",
                    "reasoning_effort": "medium",
                    "input_from": ["input_subject"],
                    "position_x": 250, "position_y": 120,
                    "prompt_id": None, "template_text": None, "batch_size": None
                },
                {
                    "node_id": "parse_topics",
                    "node_type": "parse_list",
                    "label": "Парсинг тем",
                    "input_from": ["extract_topics"],
                    "position_x": 250, "position_y": 240,
                    "prompt_id": None, "inline_prompt": None, "system_message": None,
                    "reasoning_effort": None, "batch_size": None, "template_text": None
                },
                {
                    "node_id": "edit_topics",
                    "node_type": "user_edit_list",
                    "label": "Редактирование тем",
                    "input_from": ["parse_topics"],
                    "position_x": 250, "position_y": 360,
                    "prompt_id": None, "inline_prompt": None, "system_message": None,
                    "reasoning_effort": None, "batch_size": None, "template_text": None
                },
                {
                    "node_id": "batch_analyze",
                    "node_type": "batch_loop",
                    "label": "Батч-анализ тем",
                    "batch_size": 3,
                    "input_from": ["edit_topics"],
                    "position_x": 250, "position_y": 480,
                    "prompt_id": None, "inline_prompt": None, "system_message": None,
                    "reasoning_effort": None, "template_text": None
                },
                {
                    "node_id": "analyze_prompt",
                    "node_type": "ai_prompt",
                    "label": "Анализ порции тем",
                    "inline_prompt": "Сделай анализ следующих тем:\n{{topics_batch}}\n\nСтрой предложения не от чьего-то имени, а в безличной форме - излагаем факты.\nФормат: в заголовке пишем краткое описание темы, булитные списки внутри тем не нужны - пишем просто отдельными абзацами.",
                    "system_message": "Ты анализируешь транскрипт встречи по теме \"{{meeting_subject}}\". Анализируй только указанные темы, используя информацию из транскрипта.",
                    "reasoning_effort": "high",
                    "input_from": ["batch_analyze"],
                    "position_x": 250, "position_y": 600,
                    "prompt_id": None, "template_text": None, "batch_size": None
                },
                {
                    "node_id": "aggregate_results",
                    "node_type": "aggregate",
                    "label": "Склейка результатов",
                    "input_from": ["analyze_prompt"],
                    "position_x": 250, "position_y": 720,
                    "prompt_id": None, "inline_prompt": None, "system_message": None,
                    "reasoning_effort": None, "batch_size": None, "template_text": None
                },
                {
                    "node_id": "summarize",
                    "node_type": "ai_prompt",
                    "label": "Итоговое резюме",
                    "inline_prompt": "На основе следующего подробного анализа встречи по теме \"{{meeting_subject}}\":\n\n{{aggregated_text}}\n\nСделай общее резюме наиболее существенных с точки зрения ключевой цели тем, итоговый вывод о чем договорились и план дальнейших шагов.\nФормат: краткий связный текст без списков.",
                    "system_message": "Ты — ассистент для создания резюме встреч. Пиши кратко и по существу.",
                    "reasoning_effort": "high",
                    "input_from": ["aggregate_results"],
                    "position_x": 250, "position_y": 840,
                    "prompt_id": None, "template_text": None, "batch_size": None
                },
                {
                    "node_id": "final_review",
                    "node_type": "user_review",
                    "label": "Просмотр результата",
                    "input_from": ["summarize", "aggregate_results"],
                    "position_x": 250, "position_y": 960,
                    "prompt_id": None, "inline_prompt": None, "system_message": None,
                    "reasoning_effort": None, "batch_size": None, "template_text": None
                }
            ],
            "edges": [
                {"source": "input_subject", "target": "extract_topics", "source_handle": None, "target_handle": None},
                {"source": "extract_topics", "target": "parse_topics", "source_handle": None, "target_handle": None},
                {"source": "parse_topics", "target": "edit_topics", "source_handle": None, "target_handle": None},
                {"source": "edit_topics", "target": "batch_analyze", "source_handle": None, "target_handle": None},
                {"source": "batch_analyze", "target": "analyze_prompt", "source_handle": None, "target_handle": None},
                {"source": "analyze_prompt", "target": "aggregate_results", "source_handle": None, "target_handle": None},
                {"source": "aggregate_results", "target": "summarize", "source_handle": None, "target_handle": None},
                {"source": "summarize", "target": "final_review", "source_handle": None, "target_handle": None}
            ],
            "user_id": None,
            "is_public": True,
            "created_at": now,
            "updated_at": now
        })
    
    return {"message": "Data seeded successfully"}
