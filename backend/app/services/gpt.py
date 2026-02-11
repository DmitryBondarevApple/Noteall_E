import logging
from dataclasses import dataclass
from typing import Optional
from openai import AsyncOpenAI
from app.core.config import OPENAI_API_KEY
from app.core.database import db

logger = logging.getLogger(__name__)

client = AsyncOpenAI(api_key=OPENAI_API_KEY)

DEFAULT_MODEL = "gpt-5.2"


@dataclass
class GptResult:
    content: str
    model: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


async def _get_active_model() -> str:
    settings = await db.settings.find_one({"key": "active_model"}, {"_id": 0})
    return settings["value"] if settings else DEFAULT_MODEL


def _extract_usage(response) -> dict:
    usage = response.usage
    if usage:
        return {
            "prompt_tokens": usage.prompt_tokens or 0,
            "completion_tokens": usage.completion_tokens or 0,
            "total_tokens": usage.total_tokens or 0,
        }
    return {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}


async def call_gpt4o(system_message: str, user_message: str) -> str:
    """Call GPT-4o (legacy, no metering)"""
    try:
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message},
            ],
            temperature=0.3,
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"GPT-4o error: {e}")
        raise e


async def call_gpt52(
    system_message: str,
    user_message: str = None,
    reasoning_effort: str = "high",
    messages: list = None,
) -> str:
    """Call active GPT model — returns content string (backward compatible)."""
    result = await call_gpt52_metered(system_message, user_message, reasoning_effort, messages)
    return result.content


async def call_gpt52_metered(
    system_message: str,
    user_message: str = None,
    reasoning_effort: str = "high",
    messages: list = None,
) -> GptResult:
    """Call active GPT model — returns GptResult with usage data."""
    try:
        model = await _get_active_model()
        msgs = [{"role": "system", "content": system_message}]
        if messages:
            msgs.extend(messages)
        elif user_message:
            msgs.append({"role": "user", "content": user_message})

        response = await client.chat.completions.create(
            model=model,
            messages=msgs,
            temperature=0.3,
        )
        usage = _extract_usage(response)
        return GptResult(
            content=response.choices[0].message.content,
            model=model,
            **usage,
        )
    except Exception as e:
        logger.error(f"GPT ({model if 'model' in dir() else 'unknown'}) error: {e}")
        raise e


async def call_gpt_chat(
    system_message: str,
    messages: list,
) -> str:
    """Call GPT with full message history — returns content string (backward compatible)."""
    result = await call_gpt_chat_metered(system_message, messages)
    return result.content


async def call_gpt_chat_metered(
    system_message: str,
    messages: list,
) -> GptResult:
    """Call GPT with full message history — returns GptResult with usage data."""
    try:
        model = await _get_active_model()
        msgs = [{"role": "system", "content": system_message}]
        msgs.extend(messages)

        response = await client.chat.completions.create(
            model=model,
            messages=msgs,
            temperature=0.3,
        )
        usage = _extract_usage(response)
        return GptResult(
            content=response.choices[0].message.content,
            model=model,
            **usage,
        )
    except Exception as e:
        logger.error(f"GPT chat error: {e}")
        raise e
