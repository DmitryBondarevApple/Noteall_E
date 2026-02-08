"""
Test iteration 5: parse_uncertain_fragments bug fixes
- Header regex now matches 'Сомнительные места' without colon
- Line-by-line parsing for «word» — description format
- Words like AX-10, степбэк, анавиды, MMD correctly extracted
"""
import pytest
import requests
import os
import re

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# ================= Direct Function Test Logic =================
# Replicate parse_uncertain_fragments logic for unit testing

def parse_uncertain_fragments_logic(text):
    """
    Replicate the backend parse_uncertain_fragments logic for testing.
    Returns a list of extracted words from the uncertain section.
    """
    uncertain_headers = [
        r'Сомнительные места[^\n]*',
        r'Сомнительные[^\n]*',
        r'Возможные ошибки[^\n]*',
        r'Ошибки распознавания[^\n]*',
    ]
    
    uncertain_section = ""
    main_text = text
    
    for header_pattern in uncertain_headers:
        match = re.search(header_pattern, text, re.IGNORECASE)
        if match:
            split_pos = match.start()
            main_text = text[:split_pos].strip()
            uncertain_section = text[match.end():].strip()
            break
    
    # Parse [word?] patterns in main text
    bracket_pattern = re.compile(r'\[+([^\[\]]+?)\?+\]+')
    seen_words = set()
    fragments = []
    
    for match in bracket_pattern.finditer(main_text):
        word = match.group(1).strip()
        if word and word.lower() not in seen_words:
            seen_words.add(word.lower())
            fragments.append({'word': word, 'source': 'bracket'})
    
    # Parse list items from uncertain section
    if uncertain_section:
        lines = [line.strip() for line in uncertain_section.split('\n') if line.strip()]
        for line in lines:
            # Strip leading numbering or bullets
            item_text = re.sub(r'^(?:\d+[\.\)]\s*|[-•]\s*)', '', line).strip()
            if not item_text:
                continue
            
            # Extract word in guillemets «», quotes, or brackets
            word_match = re.search(r'[«"\'"\[]([^»"\'"\]]+)[»"\'"\]]', item_text)
            if word_match:
                word = word_match.group(1).strip()
            else:
                # Fallback: take text before first dash or colon
                word = re.split(r'\s*[—–\-:]\s*', item_text)[0].strip()
                word = re.sub(r'^[\[\(«"\']+|[\]\)»"\']+$', '', word)
            
            if word and len(word) > 1 and word.lower() not in seen_words:
                seen_words.add(word.lower())
                fragments.append({'word': word, 'source': 'list'})
    
    return fragments, main_text, uncertain_section


class TestParseUncertainFragmentsHeaderMatching:
    """Test header pattern matching without colon"""
    
    def test_header_without_colon(self):
        """Verify 'Сомнительные места' without colon is matched"""
        text = """
Это основной текст с [AX-10?] и другими словами.

Сомнительные места
1. «AX-10» — технический код
2. «степбэк» — возможно stepback
"""
        fragments, main_text, uncertain_section = parse_uncertain_fragments_logic(text)
        
        # Should find the header and split correctly
        assert uncertain_section != "", "Uncertain section should not be empty"
        assert "Сомнительные места" not in uncertain_section, "Header should not be in uncertain section"
        assert "AX-10" in uncertain_section or "степбэк" in uncertain_section
        print(f"✅ Header without colon matched correctly")
        print(f"   Main text: {len(main_text)} chars")
        print(f"   Uncertain section: {len(uncertain_section)} chars")
    
    def test_header_with_colon(self):
        """Verify 'Сомнительные места:' with colon is also matched"""
        text = """
Основной текст.

Сомнительные места:
1. «слово» — описание
"""
        fragments, main_text, uncertain_section = parse_uncertain_fragments_logic(text)
        
        assert uncertain_section != "", "Uncertain section should not be empty"
        print(f"✅ Header with colon matched correctly")


class TestParseUncertainFragmentsWordExtraction:
    """Test word extraction from «word» — description format"""
    
    def test_guillemet_word_extraction(self):
        """Test extraction of words in guillemets «word»"""
        text = """
Основной текст.

Сомнительные места
1. «AX-10» — технический код оборудования
2. «степбэк» — возможно stepback
3. «анавиды» — неясное слово
4. «MMD» — аббревиатура
"""
        fragments, _, _ = parse_uncertain_fragments_logic(text)
        
        extracted_words = [f['word'] for f in fragments if f['source'] == 'list']
        print(f"Extracted words from guillemets: {extracted_words}")
        
        assert 'AX-10' in extracted_words, "AX-10 should be extracted"
        assert 'степбэк' in extracted_words, "степбэк should be extracted"
        assert 'анавиды' in extracted_words, "анавиды should be extracted"
        assert 'MMD' in extracted_words, "MMD should be extracted"
        print(f"✅ All guillemet words extracted correctly: {extracted_words}")
    
    def test_mixed_quote_formats(self):
        """Test extraction with different quote formats"""
        text = """
Текст.

Сомнительные места
- «слово1» — описание
- "слово2" — описание
- 'слово3' — описание
"""
        fragments, _, _ = parse_uncertain_fragments_logic(text)
        extracted_words = [f['word'] for f in fragments if f['source'] == 'list']
        
        assert 'слово1' in extracted_words
        assert 'слово2' in extracted_words
        assert 'слово3' in extracted_words
        print(f"✅ Mixed quote formats extracted: {extracted_words}")
    
    def test_numbered_list_parsing(self):
        """Test parsing numbered list items"""
        text = """
Текст.

Сомнительные места
1. «первое» — описание
2. «второе» — описание
3) «третье» — описание
"""
        fragments, _, _ = parse_uncertain_fragments_logic(text)
        extracted_words = [f['word'] for f in fragments if f['source'] == 'list']
        
        assert 'первое' in extracted_words
        assert 'второе' in extracted_words
        assert 'третье' in extracted_words
        print(f"✅ Numbered list parsed correctly: {extracted_words}")
    
    def test_bullet_list_parsing(self):
        """Test parsing bullet list items"""
        text = """
Текст.

Сомнительные места
- «пункт1» — описание
• «пункт2» — описание
"""
        fragments, _, _ = parse_uncertain_fragments_logic(text)
        extracted_words = [f['word'] for f in fragments if f['source'] == 'list']
        
        assert 'пункт1' in extracted_words
        assert 'пункт2' in extracted_words
        print(f"✅ Bullet list parsed correctly: {extracted_words}")
    
    def test_fallback_dash_split(self):
        """Test fallback to dash split when no quotes"""
        text = """
Текст.

Сомнительные места
1. слово — описание без кавычек
"""
        fragments, _, _ = parse_uncertain_fragments_logic(text)
        extracted_words = [f['word'] for f in fragments if f['source'] == 'list']
        
        assert 'слово' in extracted_words
        print(f"✅ Fallback dash split works: {extracted_words}")


class TestParseUncertainFragmentsBracketPatterns:
    """Test [word?] bracket pattern extraction from main text"""
    
    def test_single_bracket_pattern(self):
        """Test [word?] pattern"""
        text = """
Это текст с [сомнительное?] словом.

Сомнительные места
"""
        fragments, _, _ = parse_uncertain_fragments_logic(text)
        bracket_words = [f['word'] for f in fragments if f['source'] == 'bracket']
        
        assert 'сомнительное' in bracket_words
        print(f"✅ Single bracket pattern works: {bracket_words}")
    
    def test_double_bracket_pattern(self):
        """Test [[word??]] pattern"""
        text = """
Текст с [[двойное??]] словом.

Сомнительные места
"""
        fragments, _, _ = parse_uncertain_fragments_logic(text)
        bracket_words = [f['word'] for f in fragments if f['source'] == 'bracket']
        
        assert 'двойное' in bracket_words
        print(f"✅ Double bracket pattern works: {bracket_words}")


class TestBackendAPITranscriptUpdate:
    """Test PUT /api/projects/{id}/transcripts/processed endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@voiceworkspace.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_update_processed_transcript(self, auth_token):
        """Test updating processed transcript content"""
        project_id = "d52c6fd8-efb6-405d-b07d-9a1f2c22718e"  # Тест 8
        
        # First get current transcript
        headers = {"Authorization": f"Bearer {auth_token}"}
        get_response = requests.get(
            f"{BASE_URL}/api/projects/{project_id}/transcripts",
            headers=headers
        )
        
        assert get_response.status_code == 200, f"GET failed: {get_response.text}"
        transcripts = get_response.json()
        
        processed = next((t for t in transcripts if t['version_type'] == 'processed'), None)
        if not processed:
            pytest.skip("No processed transcript exists for this project")
        
        original_content = processed['content']
        
        # Update with same content (non-destructive test)
        put_response = requests.put(
            f"{BASE_URL}/api/projects/{project_id}/transcripts/processed",
            headers=headers,
            json={"content": original_content}
        )
        
        assert put_response.status_code == 200, f"PUT failed: {put_response.text}"
        updated = put_response.json()
        assert updated['content'] == original_content
        print(f"✅ PUT /api/projects/{project_id}/transcripts/processed works")
    
    def test_update_invalid_version_type(self, auth_token):
        """Test updating with invalid version type returns 400"""
        project_id = "d52c6fd8-efb6-405d-b07d-9a1f2c22718e"
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        put_response = requests.put(
            f"{BASE_URL}/api/projects/{project_id}/transcripts/invalid_type",
            headers=headers,
            json={"content": "test"}
        )
        
        assert put_response.status_code == 400
        print(f"✅ Invalid version type returns 400")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
