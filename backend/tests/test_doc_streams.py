"""
Test Document Agent Phase 2 - Analysis Streams API endpoints:
- Stream CRUD operations (create, list, update, delete)
- Stream messages (send message, get AI response)
- Multi-turn conversation history
- Source material context integration
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="module")
def auth_token(api_client):
    """Get authentication token"""
    # Try default test user
    login_res = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": "test@example.com",
        "password": "test123"
    })
    
    if login_res.status_code == 200:
        return login_res.json().get("access_token")
    
    # Try registering test user
    register_res = api_client.post(f"{BASE_URL}/api/auth/register", json={
        "email": "streamtest@example.com",
        "password": "streamtest123",
        "name": "Stream Test User"
    })
    
    if register_res.status_code in [200, 201]:
        return register_res.json().get("access_token")
    
    pytest.skip(f"Authentication failed - {login_res.status_code}: {login_res.text}")

@pytest.fixture(scope="module")
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


class TestHealthCheck:
    """Basic health check"""
    
    def test_api_health(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        print("API Health check PASSED")


class TestStreamsSetup:
    """Setup folder and project for stream tests"""
    
    folder_id = None
    project_id = None
    
    def test_create_folder(self, authenticated_client):
        """Create folder for stream tests"""
        response = authenticated_client.post(f"{BASE_URL}/api/doc/folders", json={
            "name": "TEST_StreamsFolder",
            "description": "Folder for testing analysis streams"
        })
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
        TestStreamsSetup.folder_id = response.json()["id"]
        print(f"Folder created: {TestStreamsSetup.folder_id}")
    
    def test_create_project(self, authenticated_client):
        """Create project for stream tests"""
        assert TestStreamsSetup.folder_id, "Folder not created"
        response = authenticated_client.post(f"{BASE_URL}/api/doc/projects", json={
            "name": "TEST_StreamsProject",
            "folder_id": TestStreamsSetup.folder_id,
            "description": "Project for testing analysis streams",
            "system_instruction": "Analyze documents and provide insights in Russian"
        })
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
        TestStreamsSetup.project_id = response.json()["id"]
        print(f"Project created: {TestStreamsSetup.project_id}")


class TestStreamsCRUD:
    """Test stream CRUD operations"""
    
    stream_id = None
    stream2_id = None
    
    def test_list_streams_empty(self, authenticated_client):
        """GET /api/doc/projects/{id}/streams - list streams (initially empty)"""
        assert TestStreamsSetup.project_id, "Project not created"
        response = authenticated_client.get(f"{BASE_URL}/api/doc/projects/{TestStreamsSetup.project_id}/streams")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Initial streams count: {len(data)}")
    
    def test_create_stream(self, authenticated_client):
        """POST /api/doc/projects/{id}/streams - create stream with name and system_prompt"""
        assert TestStreamsSetup.project_id, "Project not created"
        response = authenticated_client.post(
            f"{BASE_URL}/api/doc/projects/{TestStreamsSetup.project_id}/streams",
            json={
                "name": "TEST_Summary",
                "system_prompt": "Создай краткое резюме документа"
            }
        )
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["name"] == "TEST_Summary"
        assert data["system_prompt"] == "Создай краткое резюме документа"
        assert data["project_id"] == TestStreamsSetup.project_id
        assert isinstance(data["messages"], list)
        assert len(data["messages"]) == 0  # Empty initially
        TestStreamsCRUD.stream_id = data["id"]
        print(f"Stream created: {data['id']}")
    
    def test_create_stream_minimal(self, authenticated_client):
        """POST /api/doc/projects/{id}/streams - create stream with only name"""
        assert TestStreamsSetup.project_id, "Project not created"
        response = authenticated_client.post(
            f"{BASE_URL}/api/doc/projects/{TestStreamsSetup.project_id}/streams",
            json={"name": "TEST_RiskAnalysis"}
        )
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["name"] == "TEST_RiskAnalysis"
        assert data["system_prompt"] is None
        TestStreamsCRUD.stream2_id = data["id"]
        print(f"Minimal stream created: {data['id']}")
    
    def test_list_streams_multiple(self, authenticated_client):
        """GET /api/doc/projects/{id}/streams - verify multiple streams"""
        assert TestStreamsSetup.project_id, "Project not created"
        response = authenticated_client.get(f"{BASE_URL}/api/doc/projects/{TestStreamsSetup.project_id}/streams")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2, f"Expected at least 2 streams, got {len(data)}"
        stream_ids = [s["id"] for s in data]
        assert TestStreamsCRUD.stream_id in stream_ids
        assert TestStreamsCRUD.stream2_id in stream_ids
        print(f"Found {len(data)} streams")
    
    def test_update_stream(self, authenticated_client):
        """PUT /api/doc/projects/{id}/streams/{sid} - update stream name and system_prompt"""
        assert TestStreamsSetup.project_id, "Project not created"
        assert TestStreamsCRUD.stream_id, "Stream not created"
        response = authenticated_client.put(
            f"{BASE_URL}/api/doc/projects/{TestStreamsSetup.project_id}/streams/{TestStreamsCRUD.stream_id}",
            json={
                "name": "TEST_UpdatedSummary",
                "system_prompt": "Updated prompt: создай детальное резюме"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["name"] == "TEST_UpdatedSummary"
        assert data["system_prompt"] == "Updated prompt: создай детальное резюме"
        print("Stream updated successfully")
    
    def test_update_stream_partial(self, authenticated_client):
        """PUT /api/doc/projects/{id}/streams/{sid} - partial update (name only)"""
        assert TestStreamsSetup.project_id, "Project not created"
        assert TestStreamsCRUD.stream2_id, "Stream2 not created"
        response = authenticated_client.put(
            f"{BASE_URL}/api/doc/projects/{TestStreamsSetup.project_id}/streams/{TestStreamsCRUD.stream2_id}",
            json={"name": "TEST_UpdatedRiskAnalysis"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["name"] == "TEST_UpdatedRiskAnalysis"
        print("Partial stream update successful")
    
    def test_stream_not_found(self, authenticated_client):
        """GET streams for nonexistent project should return 404"""
        response = authenticated_client.get(f"{BASE_URL}/api/doc/projects/nonexistent-project-id/streams")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Nonexistent project correctly returns 404")


class TestStreamMessages:
    """Test stream message sending and AI responses"""
    
    def test_send_message_get_response(self, authenticated_client):
        """POST /api/doc/projects/{id}/streams/{sid}/messages - send message and get AI response"""
        assert TestStreamsSetup.project_id, "Project not created"
        assert TestStreamsCRUD.stream_id, "Stream not created"
        
        # Send a simple message
        response = authenticated_client.post(
            f"{BASE_URL}/api/doc/projects/{TestStreamsSetup.project_id}/streams/{TestStreamsCRUD.stream_id}/messages",
            json={"content": "Привет! Расскажи кратко о себе."},
            timeout=60  # AI may take time
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "user_message" in data
        assert "assistant_message" in data
        
        user_msg = data["user_message"]
        assert user_msg["role"] == "user"
        assert user_msg["content"] == "Привет! Расскажи кратко о себе."
        assert "timestamp" in user_msg
        
        assistant_msg = data["assistant_message"]
        assert assistant_msg["role"] == "assistant"
        assert len(assistant_msg["content"]) > 0
        assert "timestamp" in assistant_msg
        
        print(f"AI Response length: {len(assistant_msg['content'])} chars")
        print(f"AI Response preview: {assistant_msg['content'][:200]}...")
    
    def test_multi_turn_conversation(self, authenticated_client):
        """Send second message - verify conversation history preserved"""
        assert TestStreamsSetup.project_id, "Project not created"
        assert TestStreamsCRUD.stream_id, "Stream not created"
        
        # Send follow-up message
        response = authenticated_client.post(
            f"{BASE_URL}/api/doc/projects/{TestStreamsSetup.project_id}/streams/{TestStreamsCRUD.stream_id}/messages",
            json={"content": "А что ты умеешь делать?"},
            timeout=60
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response
        assert data["user_message"]["content"] == "А что ты умеешь делать?"
        assert len(data["assistant_message"]["content"]) > 0
        print(f"Multi-turn AI Response: {data['assistant_message']['content'][:200]}...")
    
    def test_verify_messages_persisted(self, authenticated_client):
        """Verify messages are stored in stream"""
        assert TestStreamsSetup.project_id, "Project not created"
        assert TestStreamsCRUD.stream_id, "Stream not created"
        
        # Get streams to check messages
        response = authenticated_client.get(f"{BASE_URL}/api/doc/projects/{TestStreamsSetup.project_id}/streams")
        assert response.status_code == 200
        streams = response.json()
        
        # Find our test stream
        test_stream = next((s for s in streams if s["id"] == TestStreamsCRUD.stream_id), None)
        assert test_stream is not None, "Test stream not found"
        
        messages = test_stream.get("messages", [])
        # Should have at least 4 messages (2 user + 2 assistant)
        assert len(messages) >= 4, f"Expected at least 4 messages, got {len(messages)}"
        
        # Verify alternating roles
        for i, msg in enumerate(messages):
            expected_role = "user" if i % 2 == 0 else "assistant"
            assert msg["role"] == expected_role, f"Message {i} has wrong role: {msg['role']}"
        
        print(f"Verified {len(messages)} messages persisted in stream")


class TestStreamDelete:
    """Test stream deletion"""
    
    def test_delete_stream(self, authenticated_client):
        """DELETE /api/doc/projects/{id}/streams/{sid} - delete stream"""
        assert TestStreamsSetup.project_id, "Project not created"
        assert TestStreamsCRUD.stream2_id, "Stream2 not created"
        
        response = authenticated_client.delete(
            f"{BASE_URL}/api/doc/projects/{TestStreamsSetup.project_id}/streams/{TestStreamsCRUD.stream2_id}"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("Stream deleted successfully")
        
        # Verify deletion
        response = authenticated_client.get(f"{BASE_URL}/api/doc/projects/{TestStreamsSetup.project_id}/streams")
        assert response.status_code == 200
        streams = response.json()
        stream_ids = [s["id"] for s in streams]
        assert TestStreamsCRUD.stream2_id not in stream_ids, "Deleted stream still exists"
        print("Verified stream deletion")
    
    def test_delete_nonexistent_stream(self, authenticated_client):
        """DELETE nonexistent stream should return 404"""
        assert TestStreamsSetup.project_id, "Project not created"
        
        response = authenticated_client.delete(
            f"{BASE_URL}/api/doc/projects/{TestStreamsSetup.project_id}/streams/nonexistent-stream-id"
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Nonexistent stream deletion correctly returns 404")


class TestCleanup:
    """Cleanup test data"""
    
    def test_delete_remaining_stream(self, authenticated_client):
        """Delete remaining test stream"""
        if TestStreamsCRUD.stream_id and TestStreamsSetup.project_id:
            response = authenticated_client.delete(
                f"{BASE_URL}/api/doc/projects/{TestStreamsSetup.project_id}/streams/{TestStreamsCRUD.stream_id}"
            )
            if response.status_code == 200:
                print("Remaining stream deleted")
    
    def test_delete_project(self, authenticated_client):
        """Delete test project"""
        if TestStreamsSetup.project_id:
            response = authenticated_client.delete(f"{BASE_URL}/api/doc/projects/{TestStreamsSetup.project_id}")
            if response.status_code == 200:
                print("Test project deleted")
    
    def test_delete_folder(self, authenticated_client):
        """Delete test folder"""
        if TestStreamsSetup.folder_id:
            response = authenticated_client.delete(f"{BASE_URL}/api/doc/folders/{TestStreamsSetup.folder_id}")
            if response.status_code == 200:
                print("Test folder deleted")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
