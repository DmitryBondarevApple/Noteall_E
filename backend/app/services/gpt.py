import logging
from openai import AsyncOpenAI
from app.core.config import OPENAI_API_KEY

logger = logging.getLogger(__name__)

client = AsyncOpenAI(api_key=OPENAI_API_KEY)


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
    """Call GPT-5.2 with reasoning"""
    try:
        msgs = [{"role": "system", "content": system_message}]
        if messages:
            msgs.extend(messages)
        elif user_message:
            msgs.append({"role": "user", "content": user_message})

        response = await client.chat.completions.create(
            model="gpt-5.2",
            messages=msgs,
            temperature=0.3,
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"GPT-5.2 error: {e}")
        raise e
