"""
Test Full Analysis Wizard Feature - Iteration 6
Tests for:
- /api/projects/{project_id}/analyze-raw endpoint
- /api/projects/{project_id}/save-full-analysis endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin@voiceworkspace.com"
TEST_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json().get("access_token")


@pytest.fixture(scope="module")
def authenticated_client(auth_token):
    """Session with auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


@pytest.fixture(scope="module")
def test_project_id(authenticated_client):
    """Get a project with transcript for testing"""
    # List projects and find one with 'ready' status
    response = authenticated_client.get(f"{BASE_URL}/api/projects")
    assert response.status_code == 200, f"Failed to list projects: {response.text}"
    
    projects = response.json()
    # Find a project with ready status (has transcript)
    ready_projects = [p for p in projects if p.get('status') == 'ready']
    
    if not ready_projects:
        pytest.skip("No ready projects found for testing")
    
    return ready_projects[0]['id']


class TestAnalyzeRawEndpoint:
    """Tests for /api/projects/{project_id}/analyze-raw endpoint"""
    
    def test_analyze_raw_success(self, authenticated_client, test_project_id):
        """Test successful raw analysis call"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/projects/{test_project_id}/analyze-raw",
            json={
                "system_message": "Ты — ассистент для анализа встреч.",
                "user_message": "Перечисли основные темы обсуждения.",
                "reasoning_effort": "medium"
            }
        )
        
        assert response.status_code == 200, f"analyze-raw failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "response_text" in data, "Missing response_text in response"
        assert isinstance(data["response_text"], str), "response_text should be string"
        assert len(data["response_text"]) > 0, "response_text should not be empty"
        
        print(f"analyze-raw response length: {len(data['response_text'])} chars")
    
    def test_analyze_raw_without_reasoning_effort(self, authenticated_client, test_project_id):
        """Test analyze-raw with default reasoning_effort"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/projects/{test_project_id}/analyze-raw",
            json={
                "system_message": "Ты — ассистент.",
                "user_message": "Кратко опиши содержание."
            }
        )
        
        assert response.status_code == 200, f"analyze-raw without reasoning_effort failed: {response.text}"
        data = response.json()
        assert "response_text" in data
    
    def test_analyze_raw_invalid_project(self, authenticated_client):
        """Test analyze-raw with non-existent project"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/projects/non-existent-project-id/analyze-raw",
            json={
                "system_message": "Test",
                "user_message": "Test"
            }
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_analyze_raw_missing_fields(self, authenticated_client, test_project_id):
        """Test analyze-raw with missing required fields"""
        # Missing user_message
        response = authenticated_client.post(
            f"{BASE_URL}/api/projects/{test_project_id}/analyze-raw",
            json={
                "system_message": "Test"
            }
        )
        
        assert response.status_code == 422, f"Expected 422 for missing field, got {response.status_code}"


class TestSaveFullAnalysisEndpoint:
    """Tests for /api/projects/{project_id}/save-full-analysis endpoint"""
    
    def test_save_full_analysis_success(self, authenticated_client, test_project_id):
        """Test successful save of full analysis"""
        test_subject = "TEST_Тестовый анализ встречи"
        test_content = """# Резюме встречи: Тестовый анализ

## Краткое саммари

Это тестовое резюме для проверки функционала сохранения.

---

## Подробный анализ по темам

### Тема 1: Тестовая тема

Подробное описание тестовой темы.
"""
        
        response = authenticated_client.post(
            f"{BASE_URL}/api/projects/{test_project_id}/save-full-analysis",
            json={
                "subject": test_subject,
                "content": test_content
            }
        )
        
        assert response.status_code == 200, f"save-full-analysis failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "id" in data, "Missing id in response"
        assert "project_id" in data, "Missing project_id in response"
        assert data["project_id"] == test_project_id, "project_id mismatch"
        assert "prompt_id" in data, "Missing prompt_id in response"
        assert data["prompt_id"] == "full-analysis", "prompt_id should be 'full-analysis'"
        assert "prompt_content" in data, "Missing prompt_content in response"
        assert test_subject in data["prompt_content"], "Subject not in prompt_content"
        assert "response_text" in data, "Missing response_text in response"
        assert data["response_text"] == test_content, "Content mismatch"
        assert "created_at" in data, "Missing created_at in response"
        
        print(f"Saved full analysis with id: {data['id']}")
        return data["id"]
    
    def test_save_full_analysis_appears_in_history(self, authenticated_client, test_project_id):
        """Test that saved analysis appears in chat history"""
        # First save a new analysis
        test_subject = "TEST_Проверка истории"
        test_content = "Тестовый контент для проверки истории"
        
        save_response = authenticated_client.post(
            f"{BASE_URL}/api/projects/{test_project_id}/save-full-analysis",
            json={
                "subject": test_subject,
                "content": test_content
            }
        )
        assert save_response.status_code == 200
        saved_id = save_response.json()["id"]
        
        # Now check chat history
        history_response = authenticated_client.get(
            f"{BASE_URL}/api/projects/{test_project_id}/chat-history"
        )
        assert history_response.status_code == 200
        
        history = history_response.json()
        saved_entry = next((h for h in history if h["id"] == saved_id), None)
        
        assert saved_entry is not None, "Saved analysis not found in chat history"
        assert saved_entry["prompt_id"] == "full-analysis"
        assert saved_entry["response_text"] == test_content
        
        print(f"Verified saved analysis in chat history: {saved_id}")
    
    def test_save_full_analysis_invalid_project(self, authenticated_client):
        """Test save-full-analysis with non-existent project"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/projects/non-existent-project-id/save-full-analysis",
            json={
                "subject": "Test",
                "content": "Test content"
            }
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_save_full_analysis_missing_fields(self, authenticated_client, test_project_id):
        """Test save-full-analysis with missing required fields"""
        # Missing content
        response = authenticated_client.post(
            f"{BASE_URL}/api/projects/{test_project_id}/save-full-analysis",
            json={
                "subject": "Test"
            }
        )
        
        assert response.status_code == 422, f"Expected 422 for missing field, got {response.status_code}"


class TestFullAnalysisWorkflow:
    """Integration tests for the full analysis workflow"""
    
    def test_extract_topics_workflow(self, authenticated_client, test_project_id):
        """Test the topic extraction step of the wizard"""
        # Simulate Step 1: Extract topics from transcript
        response = authenticated_client.post(
            f"{BASE_URL}/api/projects/{test_project_id}/analyze-raw",
            json={
                "system_message": "Ты — ассистент для анализа встреч. Выдавай только запрошенную информацию без лишних комментариев.",
                "user_message": """Данный текст является транскриптом встречи.
Составь общий список обсужденных тем.
Выдай только нумерованный список тем, без дополнительных пояснений.
Формат: 
1. Тема
2. Тема
...""",
                "reasoning_effort": "medium"
            }
        )
        
        assert response.status_code == 200, f"Topic extraction failed: {response.text}"
        data = response.json()
        
        # Verify we got a response with topics
        assert "response_text" in data
        response_text = data["response_text"]
        
        # Check that response contains numbered items
        lines = response_text.strip().split('\n')
        topic_lines = [l for l in lines if l.strip() and (l.strip()[0].isdigit() or l.strip().startswith('-'))]
        
        print(f"Extracted {len(topic_lines)} potential topics")
        assert len(topic_lines) > 0, "No topics extracted from transcript"
    
    def test_batch_analysis_workflow(self, authenticated_client, test_project_id):
        """Test the batch analysis step of the wizard"""
        # Simulate Step 3: Analyze a batch of topics
        topics = ["Обсуждение проекта", "Планирование задач", "Распределение ресурсов"]
        topics_list = "\n".join([f"{i+1}. {t}" for i, t in enumerate(topics)])
        
        response = authenticated_client.post(
            f"{BASE_URL}/api/projects/{test_project_id}/analyze-raw",
            json={
                "system_message": "Ты анализируешь транскрипт встречи. Анализируй только указанные темы, используя информацию из транскрипта.",
                "user_message": f"""Сделай анализ следующих тем:
{topics_list}

Строй предложения не от чьего-то имени, а в безличной форме - излагаем факты.
Формат: в заголовке пишем краткое описание темы, булитные списки внутри тем не нужны - пишем просто отдельными абзацами.""",
                "reasoning_effort": "high"
            }
        )
        
        assert response.status_code == 200, f"Batch analysis failed: {response.text}"
        data = response.json()
        
        assert "response_text" in data
        assert len(data["response_text"]) > 50, "Analysis response too short"
        
        print(f"Batch analysis response length: {len(data['response_text'])} chars")
    
    def test_summary_generation_workflow(self, authenticated_client, test_project_id):
        """Test the summary generation step of the wizard"""
        # Simulate Step 4: Generate summary
        detailed_analysis = """### Тема 1: Обсуждение проекта
Обсуждались основные аспекты проекта.

### Тема 2: Планирование задач
Были определены ключевые задачи."""
        
        response = authenticated_client.post(
            f"{BASE_URL}/api/projects/{test_project_id}/analyze-raw",
            json={
                "system_message": "Ты — ассистент для создания резюме встреч. Пиши кратко и по существу.",
                "user_message": f"""На основе следующего подробного анализа встречи:

{detailed_analysis}

Сделай общее резюме наиболее существенных с точки зрения ключевой цели тем, итоговый вывод о чем договорились и план дальнейших шагов.
Формат: краткий связный текст без списков.""",
                "reasoning_effort": "high"
            }
        )
        
        assert response.status_code == 200, f"Summary generation failed: {response.text}"
        data = response.json()
        
        assert "response_text" in data
        assert len(data["response_text"]) > 20, "Summary too short"
        
        print(f"Summary generation response length: {len(data['response_text'])} chars")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
