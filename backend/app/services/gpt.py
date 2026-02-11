import logging
from openai import AsyncOpenAI
from app.core.config import OPENAI_API_KEY
from app.core.database import db

logger = logging.getLogger(__name__)

client = AsyncOpenAI(api_key=OPENAI_API_KEY)

DEFAULT_MODEL = "gpt-5.2"


async def _get_active_model() -> str:
    settings = await db.settings.find_one({"key": "active_model"}, {"_id": 0})
    return settings["value"] if settings else DEFAULT_MODEL


async def call_gpt4o(system_message: str, user_message: str) -> str:
    """Call GPT-4o"""
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
    """Call active GPT model (dynamic from settings)"""
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
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"GPT ({model}) error: {e}")
        raise e


async def call_gpt_chat(
    system_message: str,
    messages: list,
) -> str:
    """Call GPT with full message history (supports vision/multi-turn)."""
    try:
        model = await _get_active_model()
        msgs = [{"role": "system", "content": system_message}]
        msgs.extend(messages)

        response = await client.chat.completions.create(
            model=model,
            messages=msgs,
            temperature=0.3,
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"GPT chat error: {e}")
        raise e
