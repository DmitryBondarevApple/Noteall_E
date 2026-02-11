import uuid
import json
import logging
from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from app.core.database import db
from app.core.security import get_current_user
from app.models.pipeline import (
    PipelineCreate, PipelineUpdate, PipelineResponse
)
from app.services.gpt import call_gpt52, call_gpt52_metered
from app.services.metering import check_user_monthly_limit, check_org_balance, deduct_credits_and_record

router = APIRouter(prefix="/pipelines", tags=["pipelines"])
logger = logging.getLogger(__name__)


class GenerateRequest(BaseModel):
    prompt: str
    pipeline_id: Optional[str] = None


@router.get("", response_model=List[PipelineResponse])
async def list_pipelines(user=Depends(get_current_user)):
    """List all pipelines accessible to the user (own + public)"""
    query = {
        "$or": [
            {"user_id": user["id"]},
            {"is_public": True}
        ]
    }
    pipelines = await db.pipelines.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [PipelineResponse(**p) for p in pipelines]


@router.get("/{pipeline_id}", response_model=PipelineResponse)
async def get_pipeline(pipeline_id: str, user=Depends(get_current_user)):
    pipeline = await db.pipelines.find_one(
        {"id": pipeline_id, "$or": [{"user_id": user["id"]}, {"is_public": True}]},
        {"_id": 0}
    )
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return PipelineResponse(**pipeline)


@router.post("", response_model=PipelineResponse, status_code=201)
async def create_pipeline(data: PipelineCreate, user=Depends(get_current_user)):
    pipeline_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    pipeline_doc = {
        "id": pipeline_id,
        "name": data.name,
        "description": data.description,
        "nodes": [n.model_dump() for n in data.nodes],
        "edges": [e.model_dump() for e in data.edges],
        "user_id": user["id"],
        "is_public": data.is_public,
        "created_at": now,
        "updated_at": now
    }

    await db.pipelines.insert_one(pipeline_doc)
    return PipelineResponse(**pipeline_doc)


@router.put("/{pipeline_id}", response_model=PipelineResponse)
async def update_pipeline(
    pipeline_id: str,
    data: PipelineUpdate,
    user=Depends(get_current_user)
):
    pipeline = await db.pipelines.find_one({"id": pipeline_id})
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    if pipeline["user_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not allowed")

    update_data = {}
    if data.name is not None:
        update_data["name"] = data.name
    if data.description is not None:
        update_data["description"] = data.description
    if data.nodes is not None:
        update_data["nodes"] = [n.model_dump() for n in data.nodes]
    if data.edges is not None:
        update_data["edges"] = [e.model_dump() for e in data.edges]
    if data.is_public is not None:
        update_data["is_public"] = data.is_public

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.pipelines.update_one({"id": pipeline_id}, {"$set": update_data})
    updated = await db.pipelines.find_one({"id": pipeline_id}, {"_id": 0})
    return PipelineResponse(**updated)


@router.delete("/{pipeline_id}")
async def delete_pipeline(pipeline_id: str, user=Depends(get_current_user)):
    pipeline = await db.pipelines.find_one({"id": pipeline_id})
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    if pipeline["user_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not allowed")

    await db.pipelines.delete_one({"id": pipeline_id})
    return {"message": "Pipeline deleted"}


@router.post("/{pipeline_id}/duplicate", response_model=PipelineResponse)
async def duplicate_pipeline(pipeline_id: str, user=Depends(get_current_user)):
    """Duplicate a pipeline (useful for copying public pipelines)"""
    original = await db.pipelines.find_one(
        {"id": pipeline_id, "$or": [{"user_id": user["id"]}, {"is_public": True}]},
        {"_id": 0}
    )
    if not original:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    new_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    new_doc = {
        **original,
        "id": new_id,
        "name": f"{original['name']} (копия)",
        "user_id": user["id"],
        "is_public": False,
        "created_at": now,
        "updated_at": now
    }
    new_doc.pop("_id", None)

    await db.pipelines.insert_one(new_doc)
    return PipelineResponse(**new_doc)


@router.post("/generate", response_model=PipelineResponse, status_code=201)
async def generate_pipeline(data: GenerateRequest, user=Depends(get_current_user)):
    """AI-ассистент: генерация сценария по промпту"""

    system_prompt = """Ты — AI-ассистент платформы Noteall. Твоя задача — создавать сценарии анализа документов и транскриптов встреч.

Сценарий — это граф из узлов (nodes) и связей (edges). Каждый узел имеет тип и конфигурацию.

ДОСТУПНЫЕ ТИПЫ УЗЛОВ:
1. "ai_prompt" — AI-промпт. Отправляет текст в GPT для анализа. Параметры: inline_prompt (текст промпта), system_message (системное сообщение).
2. "parse_list" — Скрипт парсинга. Разбирает текст на список элементов. Параметр: script (Python-выражение для парсинга, например "items = text.split('\\n')").
3. "batch_loop" — Батч-цикл. Обрабатывает каждый элемент списка через подключённый AI-промпт. Параметр: batch_size (размер батча, по умолчанию 3).
4. "aggregate" — Агрегация. Собирает результаты батч-обработки в единый текст.
5. "template" — Шаблон/Переменная. Задаёт шаблон текста с переменными {{var}}. Параметр: template_text.
6. "user_edit_list" — Редактирование списка пользователем. Позволяет пользователю отредактировать список перед продолжением.
7. "user_review" — Просмотр результата. Показывает финальный результат пользователю.

ПРАВИЛА ПОСТРОЕНИЯ ГРАФА:
- Первый узел получает исходный текст (транскрипт или документ) автоматически.
- Узлы связаны через edges: {source: "node_id", target: "node_id"}.
- Для fan-out (один узел → несколько): создай несколько edges от одного source.
- Для fan-in (несколько → один): укажи input_from: ["node_id_1", "node_id_2"] у целевого узла.
- Располагай узлы на canvas: position_x (горизонталь, шаг ~300), position_y (вертикаль, шаг ~150).

ФОРМАТ ОТВЕТА — строго JSON:
{
  "name": "Название сценария",
  "description": "Краткое описание",
  "nodes": [
    {
      "node_id": "уникальный_id",
      "node_type": "ai_prompt",
      "label": "Название узла",
      "inline_prompt": "Текст промпта...",
      "position_x": 0,
      "position_y": 0
    }
  ],
  "edges": [
    {"source": "node_id_1", "target": "node_id_2"}
  ]
}

Создавай практичные, рабочие сценарии. Промпты в узлах должны быть подробными и на русском языке.
Отвечай ТОЛЬКО валидным JSON без markdown-обёртки."""

    try:
        result = await call_gpt52(
            system_message=system_prompt,
            user_message=data.prompt,
            reasoning_effort="high"
        )

        # Parse JSON from response
        result = result.strip()
        if result.startswith("```"):
            result = result.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        pipeline_data = json.loads(result)

        if not isinstance(pipeline_data, dict) or "nodes" not in pipeline_data:
            raise ValueError("Invalid pipeline structure")

        pipeline_id = data.pipeline_id or str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        # If updating existing pipeline
        if data.pipeline_id:
            existing = await db.pipelines.find_one({"id": data.pipeline_id, "user_id": user["id"]})
            if not existing:
                raise HTTPException(status_code=404, detail="Pipeline not found")

            await db.pipelines.update_one(
                {"id": data.pipeline_id},
                {"$set": {
                    "name": pipeline_data.get("name", existing.get("name", "Сценарий")),
                    "description": pipeline_data.get("description", ""),
                    "nodes": pipeline_data.get("nodes", []),
                    "edges": pipeline_data.get("edges", []),
                    "generation_prompt": data.prompt,
                    "updated_at": now,
                }}
            )
            updated = await db.pipelines.find_one({"id": data.pipeline_id}, {"_id": 0})
            return PipelineResponse(**updated)

        # Create new pipeline
        pipeline_doc = {
            "id": pipeline_id,
            "name": pipeline_data.get("name", "AI-сценарий"),
            "description": pipeline_data.get("description", ""),
            "nodes": pipeline_data.get("nodes", []),
            "edges": pipeline_data.get("edges", []),
            "generation_prompt": data.prompt,
            "user_id": user["id"],
            "is_public": False,
            "created_at": now,
            "updated_at": now,
        }

        await db.pipelines.insert_one(pipeline_doc)
        return PipelineResponse(**pipeline_doc)

    except json.JSONDecodeError as e:
        logger.error(f"AI response parse error: {e}\nResponse: {result[:500]}")
        raise HTTPException(status_code=500, detail="AI вернул некорректный формат. Попробуйте переформулировать запрос.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Pipeline generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка генерации: {str(e)}")


@router.get("/{pipeline_id}/export")
async def export_pipeline(pipeline_id: str, user=Depends(get_current_user)):
    """Export pipeline as JSON"""
    pipeline = await db.pipelines.find_one(
        {"id": pipeline_id, "$or": [{"user_id": user["id"]}, {"is_public": True}]},
        {"_id": 0}
    )
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    export_data = {
        "noteall_pipeline_version": 1,
        "name": pipeline["name"],
        "description": pipeline.get("description", ""),
        "nodes": pipeline.get("nodes", []),
        "edges": pipeline.get("edges", []),
    }
    return export_data


@router.post("/import/json", response_model=PipelineResponse, status_code=201)
async def import_pipeline(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Import pipeline from JSON file"""
    import json

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Файл превышает 5MB")

    try:
        data = json.loads(content.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="Некорректный JSON файл")

    if not isinstance(data, dict) or "nodes" not in data:
        raise HTTPException(status_code=400, detail="Неверный формат сценария")

    name = data.get("name", "Импортированный сценарий")

    existing = await db.pipelines.find_one({"name": name, "user_id": user["id"]})
    if existing:
        name = f"{name} (импорт)"

    pipeline_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    pipeline_doc = {
        "id": pipeline_id,
        "name": name,
        "description": data.get("description", ""),
        "nodes": data.get("nodes", []),
        "edges": data.get("edges", []),
        "user_id": user["id"],
        "is_public": False,
        "created_at": now,
        "updated_at": now,
    }

    await db.pipelines.insert_one(pipeline_doc)
    return PipelineResponse(**pipeline_doc)
