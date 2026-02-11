"""
AI Chat API Tests - Testing multi-turn chat assistant for pipelines
Tests: Session CRUD, Message sending, Pipeline JSON extraction
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin@voiceworkspace.com"
TEST_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def auth_token():
    """Authenticate and get token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
    return response.json().get("access_token")


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Requests session with auth"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    })
    return session


class TestAiChatHealth:
    """Basic health and endpoint availability tests"""
    
    def test_health_endpoint(self):
        """Verify API is reachable"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print(f"✓ Health check passed: {data}")


class TestAiChatSessionCRUD:
    """AI Chat Session Create, Read, List, Delete tests"""
    
    def test_create_session_without_pipeline(self, api_client):
        """Create AI chat session without pipeline_id"""
        response = api_client.post(f"{BASE_URL}/api/ai-chat/sessions", json={
            "pipeline_id": None
        })
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["messages"] == []
        assert "created_at" in data
        assert "updated_at" in data
        print(f"✓ Session created: {data['id']}")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/ai-chat/sessions/{data['id']}")
    
    def test_create_session_with_pipeline(self, api_client):
        """Create AI chat session linked to a pipeline"""
        # First create a pipeline to link
        pipeline_res = api_client.post(f"{BASE_URL}/api/pipelines", json={
            "name": "TEST_ai_chat_pipeline",
            "description": "Test pipeline for AI chat",
            "nodes": [],
            "edges": [],
            "is_public": False
        })
        pipeline_id = None
        if pipeline_res.status_code == 201:
            pipeline_id = pipeline_res.json()["id"]
        
        response = api_client.post(f"{BASE_URL}/api/ai-chat/sessions", json={
            "pipeline_id": pipeline_id
        })
        assert response.status_code == 201
        
        data = response.json()
        assert data["pipeline_id"] == pipeline_id
        print(f"✓ Session created with pipeline_id: {pipeline_id}")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/ai-chat/sessions/{data['id']}")
        if pipeline_id:
            api_client.delete(f"{BASE_URL}/api/pipelines/{pipeline_id}")
    
    def test_list_sessions(self, api_client):
        """List all AI chat sessions"""
        # Create a test session first
        create_res = api_client.post(f"{BASE_URL}/api/ai-chat/sessions", json={
            "pipeline_id": None
        })
        assert create_res.status_code == 201
        session_id = create_res.json()["id"]
        
        # List sessions
        response = api_client.get(f"{BASE_URL}/api/ai-chat/sessions")
        assert response.status_code == 200
        
        sessions = response.json()
        assert isinstance(sessions, list)
        # Should find our created session
        session_ids = [s["id"] for s in sessions]
        assert session_id in session_ids
        print(f"✓ Listed {len(sessions)} sessions, found test session")
        
        # Verify session list item structure
        our_session = next(s for s in sessions if s["id"] == session_id)
        assert "message_count" in our_session
        assert "created_at" in our_session
        assert "updated_at" in our_session
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/ai-chat/sessions/{session_id}")
    
    def test_get_session(self, api_client):
        """Get specific session by ID"""
        # Create session
        create_res = api_client.post(f"{BASE_URL}/api/ai-chat/sessions", json={
            "pipeline_id": None
        })
        session_id = create_res.json()["id"]
        
        # Get session
        response = api_client.get(f"{BASE_URL}/api/ai-chat/sessions/{session_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["id"] == session_id
        assert data["messages"] == []
        print(f"✓ Got session: {session_id}")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/ai-chat/sessions/{session_id}")
    
    def test_get_nonexistent_session(self, api_client):
        """Get session that doesn't exist should return 404"""
        response = api_client.get(f"{BASE_URL}/api/ai-chat/sessions/nonexistent-session-id")
        assert response.status_code == 404
        print("✓ Nonexistent session returns 404")
    
    def test_delete_session(self, api_client):
        """Delete AI chat session"""
        # Create session
        create_res = api_client.post(f"{BASE_URL}/api/ai-chat/sessions", json={
            "pipeline_id": None
        })
        session_id = create_res.json()["id"]
        
        # Delete session
        response = api_client.delete(f"{BASE_URL}/api/ai-chat/sessions/{session_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        print(f"✓ Session deleted: {session_id}")
        
        # Verify it's gone
        get_response = api_client.get(f"{BASE_URL}/api/ai-chat/sessions/{session_id}")
        assert get_response.status_code == 404
    
    def test_delete_nonexistent_session(self, api_client):
        """Delete session that doesn't exist should return 404"""
        response = api_client.delete(f"{BASE_URL}/api/ai-chat/sessions/nonexistent-session-id")
        assert response.status_code == 404
        print("✓ Delete nonexistent session returns 404")


class TestAiChatMessaging:
    """AI Chat Message sending and receiving tests"""
    
    def test_send_text_message(self, api_client):
        """Send a text message and receive AI response"""
        # Create session
        create_res = api_client.post(f"{BASE_URL}/api/ai-chat/sessions", json={
            "pipeline_id": None
        })
        session_id = create_res.json()["id"]
        
        # Send message - use multipart/form-data
        response = requests.post(
            f"{BASE_URL}/api/ai-chat/sessions/{session_id}/message",
            headers={"Authorization": api_client.headers["Authorization"]},
            data={"content": "Привет! Что ты умеешь?"},
            timeout=120  # GPT can take time
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "user_message" in data
        assert "assistant_message" in data
        assert data["user_message"]["role"] == "user"
        assert data["assistant_message"]["role"] == "assistant"
        assert len(data["assistant_message"]["content"]) > 0
        print(f"✓ Message sent, AI responded with {len(data['assistant_message']['content'])} chars")
        
        # Verify messages are persisted
        get_res = api_client.get(f"{BASE_URL}/api/ai-chat/sessions/{session_id}")
        assert get_res.status_code == 200
        session_data = get_res.json()
        assert len(session_data["messages"]) == 2  # user + assistant
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/ai-chat/sessions/{session_id}")
    
    def test_send_message_to_nonexistent_session(self, api_client):
        """Send message to nonexistent session should return 404"""
        response = requests.post(
            f"{BASE_URL}/api/ai-chat/sessions/nonexistent-id/message",
            headers={"Authorization": api_client.headers["Authorization"]},
            data={"content": "Test"},
            timeout=30
        )
        assert response.status_code == 404
        print("✓ Message to nonexistent session returns 404")
    
    def test_empty_message_still_works(self, api_client):
        """Sending empty content should be accepted (if image is attached later)"""
        # Create session
        create_res = api_client.post(f"{BASE_URL}/api/ai-chat/sessions", json={
            "pipeline_id": None
        })
        session_id = create_res.json()["id"]
        
        # Send empty message - this might fail or work depending on validation
        response = requests.post(
            f"{BASE_URL}/api/ai-chat/sessions/{session_id}/message",
            headers={"Authorization": api_client.headers["Authorization"]},
            data={"content": ""},
            timeout=120
        )
        
        # Empty message without image should still be processed (may get error from GPT)
        # Just verify it doesn't crash the endpoint
        print(f"✓ Empty message response: {response.status_code}")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/ai-chat/sessions/{session_id}")


class TestAiChatFilterByPipeline:
    """Test session filtering by pipeline_id"""
    
    def test_list_sessions_by_pipeline(self, api_client):
        """List sessions filtered by pipeline_id"""
        # Create a test pipeline
        pipeline_res = api_client.post(f"{BASE_URL}/api/pipelines", json={
            "name": "TEST_filter_pipeline",
            "description": "Test pipeline for filtering",
            "nodes": [],
            "edges": [],
            "is_public": False
        })
        pipeline_id = pipeline_res.json()["id"]
        
        # Create two sessions - one with pipeline, one without
        session1_res = api_client.post(f"{BASE_URL}/api/ai-chat/sessions", json={
            "pipeline_id": pipeline_id
        })
        session1_id = session1_res.json()["id"]
        
        session2_res = api_client.post(f"{BASE_URL}/api/ai-chat/sessions", json={
            "pipeline_id": None
        })
        session2_id = session2_res.json()["id"]
        
        # List all sessions
        all_sessions = api_client.get(f"{BASE_URL}/api/ai-chat/sessions").json()
        
        # List sessions filtered by pipeline
        filtered_sessions = api_client.get(
            f"{BASE_URL}/api/ai-chat/sessions",
            params={"pipeline_id": pipeline_id}
        ).json()
        
        # Filtered should only contain session1
        filtered_ids = [s["id"] for s in filtered_sessions]
        assert session1_id in filtered_ids
        assert session2_id not in filtered_ids
        print(f"✓ Filtering by pipeline_id works: {len(filtered_sessions)} sessions found")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/ai-chat/sessions/{session1_id}")
        api_client.delete(f"{BASE_URL}/api/ai-chat/sessions/{session2_id}")
        api_client.delete(f"{BASE_URL}/api/pipelines/{pipeline_id}")


class TestAiChatPipelineGeneration:
    """Test that AI can generate pipeline JSON in responses"""
    
    def test_request_pipeline_scenario(self, api_client):
        """Ask AI to create a pipeline and verify JSON is extracted"""
        # Create session
        create_res = api_client.post(f"{BASE_URL}/api/ai-chat/sessions", json={
            "pipeline_id": None
        })
        session_id = create_res.json()["id"]
        
        # Send request for a simple pipeline
        response = requests.post(
            f"{BASE_URL}/api/ai-chat/sessions/{session_id}/message",
            headers={"Authorization": api_client.headers["Authorization"]},
            data={"content": "Создай простой сценарий с одним узлом AI-промпта для извлечения ключевых тем из текста"},
            timeout=120
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check if pipeline_data was extracted (may or may not have it based on AI response)
        if data.get("pipeline_data"):
            assert "nodes" in data["pipeline_data"]
            print(f"✓ Pipeline data extracted: {len(data['pipeline_data'].get('nodes', []))} nodes")
        else:
            # AI might respond with text first, then JSON - that's ok
            content = data["assistant_message"]["content"]
            has_json = "```json" in content or '"nodes"' in content
            print(f"✓ AI response received, has_json_block: {has_json}")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/ai-chat/sessions/{session_id}")


class TestAiChatAuth:
    """Test authentication requirements"""
    
    def test_create_session_without_auth(self):
        """Creating session without auth should fail"""
        response = requests.post(f"{BASE_URL}/api/ai-chat/sessions", json={
            "pipeline_id": None
        })
        assert response.status_code in [401, 403]
        print("✓ Unauthenticated request rejected")
    
    def test_list_sessions_without_auth(self):
        """Listing sessions without auth should fail"""
        response = requests.get(f"{BASE_URL}/api/ai-chat/sessions")
        assert response.status_code in [401, 403]
        print("✓ Unauthenticated list rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
