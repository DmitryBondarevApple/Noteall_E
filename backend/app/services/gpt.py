import logging
from openai import AsyncOpenAI
from app.core.config import OPENAI_API_KEY

logger = logging.getLogger(__name__)


async def call_gpt4o(system_message: str, user_message: str) -> str:
    """Call GPT-4o via user's OpenAI API for initial processing"""
    try:
        client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
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
    messages: list = None
) -> str:
    """
    Call GPT-5.2 via OpenAI API.
    Either pass user_message for simple 2-message call, or messages for full multi-turn conversation.
    """
    try:
        client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        
        if messages is None:
            messages = [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ]
        else:
            messages = [{"role": "system", "content": system_message}] + messages
        
        params = {
            "model": "gpt-5.2",
            "messages": messages,
        }
        
        effort_config = {
            "auto": {"temperature": 0.5},
            "minimal": {"temperature": 0.7, "max_completion_tokens": 2000},
            "low": {"temperature": 0.5, "max_completion_tokens": 4000},
            "medium": {"temperature": 0.3, "max_completion_tokens": 8000},
            "high": {"temperature": 0.2, "max_completion_tokens": 16000},
            "xhigh": {"temperature": 0.1, "max_completion_tokens": 32000},
        }
        
        config = effort_config.get(reasoning_effort, effort_config["high"])
        params.update(config)
        
        response = await client.chat.completions.create(**params)
        
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"GPT-5.2 error: {e}")
        raise e
