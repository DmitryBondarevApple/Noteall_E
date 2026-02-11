import logging
import uuid
from emergentintegrations.llm.chat import LlmChat, UserMessage
from app.core.config import EMERGENT_LLM_KEY

logger = logging.getLogger(__name__)


async def call_gpt4o(system_message: str, user_message: str) -> str:
    """Call GPT-4o via Emergent LLM Key"""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=str(uuid.uuid4()),
            system_message=system_message,
        ).with_model("openai", "gpt-4o")

        msg = UserMessage(text=user_message)
        response = await chat.send_message(msg)
        return response
    except Exception as e:
        logger.error(f"GPT-4o error: {e}")
        raise e


async def call_gpt52(
    system_message: str,
    user_message: str = None,
    reasoning_effort: str = "high",
    messages: list = None,
) -> str:
    """Call GPT-5.2 via Emergent LLM Key"""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=str(uuid.uuid4()),
            system_message=system_message,
        ).with_model("openai", "gpt-5.2")

        if messages:
            # Multi-turn: send messages one by one, return last response
            last_response = ""
            for m in messages:
                if m.get("role") == "user":
                    msg = UserMessage(text=m["content"])
                    last_response = await chat.send_message(msg)
            return last_response
        else:
            msg = UserMessage(text=user_message)
            response = await chat.send_message(msg)
            return response
    except Exception as e:
        logger.error(f"GPT-5.2 error: {e}")
        raise e
