import re
import uuid
import logging
from datetime import datetime, timezone
from app.core.database import db

logger = logging.getLogger(__name__)


async def parse_uncertain_fragments(project_id: str, text: str):
    """
    Parse uncertain fragments from GPT-processed text.
    Handles:
    - [word?] markers in main text
    - "Сомнительные места" section at the end
    - Auto-corrected words (GPT already replaced them)
    """
    # Find and separate the "Uncertain places" section
    section_markers = [
        r'^---+\s*$\n+\s*(?:Сомнительные места|Uncertain places|Сомнения)',
        r'\n\n(?:Сомнительные места|Uncertain places|Сомнения)\s*:?\s*\n',
        r'\n(?:Сомнительные места|Uncertain places|Сомнения)\s*:\s*\n',
    ]
    
    main_text = text
    uncertain_section = None
    
    for marker in section_markers:
        match = re.search(marker, text, re.MULTILINE | re.IGNORECASE)
        if match:
            main_text = text[:match.start()].strip()
            uncertain_section = text[match.end():].strip()
            break
    
    # Check for "no uncertain places" indicators
    if uncertain_section:
        no_issues_indicators = [
            r'нет сомнительных',
            r'сомнительных мест нет',
            r'no uncertain',
            r'отсутствуют',
            r'не обнаружен',
        ]
        for indicator in no_issues_indicators:
            if re.search(indicator, uncertain_section, re.IGNORECASE):
                uncertain_section = None
                break
    
    # Remove the "Сомнительные места" section from stored transcript
    if uncertain_section or main_text != text:
        await db.transcripts.update_one(
            {"project_id": project_id, "version_type": "processed"},
            {"$set": {"content": main_text}}
        )
    
    # Helper: find full line containing a word in main text
    def find_full_line(word):
        escaped = re.escape(word)
        pattern = re.compile(rf'^.*{escaped}.*$', re.MULTILINE | re.IGNORECASE)
        m = pattern.search(main_text)
        return m.group(0).strip() if m else None
    
    # Parse [word?] patterns in main text
    bracket_pattern = re.compile(r'\[+([^\[\]]+?)\?+\]+')
    seen_words = set()
    
    for match in bracket_pattern.finditer(main_text):
        word = match.group(1).strip()
        if word and word.lower() not in seen_words:
            seen_words.add(word.lower())
            
            # Get full line as context
            line = find_full_line(word)
            if not line:
                pos = match.start()
                context_start = max(0, pos - 80)
                context_end = min(len(main_text), match.end() + 80)
                line = main_text[context_start:context_end]
            
            await db.uncertain_fragments.insert_one({
                "id": str(uuid.uuid4()),
                "project_id": project_id,
                "original_text": word,
                "corrected_text": None,
                "context": line.strip(),
                "start_time": None,
                "end_time": None,
                "suggestions": [word],
                "status": "pending",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    # Parse list items from uncertain section
    if uncertain_section:
        lines = [line.strip() for line in uncertain_section.split('\n') if line.strip()]
        for line in lines:
            item_text = re.sub(r'^(?:\d+[\.\)]\s*|[-•]\s*)', '', line).strip()
            if not item_text:
                continue
            
            # Extract word in guillemets «», quotes, or brackets
            word_match = re.search(r'[«"\'"\[]([^»"\'"\]]+)[»"\'"\]]', item_text)
            if word_match:
                word = word_match.group(1).strip()
            else:
                word = re.split(r'\s*[—–\-:]\s*', item_text)[0].strip()
                word = re.sub(r'^[\[\(«"\']+|[\]\)»"\']+$', '', word)
            
            if word and len(word) > 1 and word.lower() not in seen_words:
                seen_words.add(word.lower())
                
                # Try to extract GPT's suggested correction from the description
                suggestion = None
                suggestion_patterns = [
                    r'→\s*[«"\'"]([^»"\'"\n]+)[»"\'"]',
                    r'восстановлен\w*\s+(?:по смыслу\s+)?как\s+[«"\'"]([^»"\'"\n]+)[»"\'"]',
                    r'(?:вероятно|возможно|скорее всего)[,]?\s+[«"\'"]([^»"\'"\n]+)[»"\'"]',
                    r'(?:исправлен\w*|заменен\w*)\s+на\s+[«"\'"]([^»"\'"\n]+)[»"\'"]',
                    r'похоже на\s+[«"\'"]([^»"\'"\n]+)[»"\'"]',
                ]
                for sp in suggestion_patterns:
                    sm = re.search(sp, item_text, re.IGNORECASE)
                    if sm:
                        suggestion = sm.group(1).strip()
                        break
                
                # Check if original word is absent from main text (GPT already replaced it)
                word_in_main = re.search(re.escape(word), main_text, re.IGNORECASE)
                is_auto_corrected = not word_in_main
                
                # For auto-corrected: try to find what GPT replaced it with
                effective_correction = None
                if is_auto_corrected and suggestion:
                    if re.search(re.escape(suggestion), main_text, re.IGNORECASE):
                        effective_correction = suggestion
                
                # Find full line context
                search_word = effective_correction if effective_correction else (suggestion if suggestion else word)
                context_line = find_full_line(search_word) or find_full_line(word) or item_text
                
                await db.uncertain_fragments.insert_one({
                    "id": str(uuid.uuid4()),
                    "project_id": project_id,
                    "original_text": word,
                    "corrected_text": effective_correction if is_auto_corrected else None,
                    "context": context_line.strip(),
                    "start_time": None,
                    "end_time": None,
                    "suggestions": [s for s in [word, suggestion] if s],
                    "status": "auto_corrected" if is_auto_corrected else "pending",
                    "source": "list",
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
    
    logger.info(f"[{project_id}] Parsed {len(seen_words)} uncertain fragments")
