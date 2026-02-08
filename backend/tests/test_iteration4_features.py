"""
Tests for Iteration 4 Features:
1. Bug fix: [word?] markers escaped in Markdown via prepareForMarkdown()
2. Bug fix: Scroll position preserved when editing processed text
3. Feature: Analysis tab edit mode (pencil icon on each result)
4. Feature: Analysis results in chronological order (oldest first)
5. Backend: PUT /api/projects/{id}/chat-history/{chatId} endpoint
6. Backend: GET chat-history sorted by created_at ASC
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://voice-workspace-1.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_EMAIL = "admin@voiceworkspace.com"
TEST_PASSWORD = "admin123"
TEST_PROJECT_ID = "d52c6fd8-efb6-405d-b07d-9a1f2c22718e"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Create authenticated session"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


class TestChatHistoryEndpoint:
    """Tests for PUT /api/projects/{id}/chat-history/{chatId} endpoint"""
    
    def test_get_chat_history_returns_sorted_asc(self, api_client):
        """Chat history should be sorted by created_at ASC (oldest first)"""
        response = api_client.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/chat-history")
        assert response.status_code == 200, f"Get chat history failed: {response.text}"
        
        history = response.json()
        print(f"Chat history count: {len(history)}")
        
        if len(history) >= 2:
            # Verify ASC order (oldest first)
            for i in range(len(history) - 1):
                created_at_current = history[i].get('created_at', '')
                created_at_next = history[i + 1].get('created_at', '')
                assert created_at_current <= created_at_next, \
                    f"Chat history not sorted ASC: {created_at_current} > {created_at_next}"
            print("Chat history is correctly sorted ASC (oldest first)")
        else:
            print("Not enough chat history entries to verify sort order")
    
    def test_create_and_update_chat_response(self, api_client):
        """Test creating analysis and updating response via PUT endpoint"""
        # First, get available prompts to use for analysis
        prompts_response = api_client.get(f"{BASE_URL}/api/prompts?project_id={TEST_PROJECT_ID}")
        assert prompts_response.status_code == 200
        prompts = prompts_response.json()
        
        # Find a non-master prompt
        analysis_prompt = None
        for p in prompts:
            if p.get('prompt_type') != 'master':
                analysis_prompt = p
                break
        
        if not analysis_prompt:
            pytest.skip("No analysis prompts available")
        
        # Create a new analysis entry
        analysis_response = api_client.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/analyze",
            json={
                "prompt_id": analysis_prompt['id'],
                "additional_text": "TEST_iteration4_edit",
                "reasoning_effort": "minimal"  # Use minimal for faster response
            }
        )
        
        # Skip if analysis takes too long or fails (GPT API dependency)
        if analysis_response.status_code != 200:
            pytest.skip(f"Analysis API failed: {analysis_response.text}")
        
        chat_entry = analysis_response.json()
        chat_id = chat_entry['id']
        original_text = chat_entry['response_text']
        print(f"Created chat entry: {chat_id}")
        
        # Test PUT endpoint to update response_text
        updated_text = "TEST_UPDATED_RESPONSE_iteration4"
        update_response = api_client.put(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/chat-history/{chat_id}",
            json={"response_text": updated_text}
        )
        
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        updated_entry = update_response.json()
        assert updated_entry['response_text'] == updated_text, "Response text not updated"
        print(f"Successfully updated chat response via PUT endpoint")
        
        # Verify the update persisted by fetching history again
        history_response = api_client.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/chat-history")
        assert history_response.status_code == 200
        history = history_response.json()
        
        found_updated = False
        for entry in history:
            if entry['id'] == chat_id:
                assert entry['response_text'] == updated_text, "Update not persisted"
                found_updated = True
                break
        
        assert found_updated, "Updated chat entry not found in history"
        print("Verified: Update persisted in database")
    
    def test_update_nonexistent_chat_returns_404(self, api_client):
        """PUT to non-existent chat_id should return 404"""
        fake_chat_id = "00000000-0000-0000-0000-000000000000"
        response = api_client.put(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/chat-history/{fake_chat_id}",
            json={"response_text": "test"}
        )
        assert response.status_code == 404, f"Expected 404, got: {response.status_code}"
        print("Correctly returns 404 for non-existent chat entry")
    
    def test_update_chat_wrong_project_returns_404(self, api_client):
        """PUT to chat_id with wrong project_id should return 404"""
        # First get an existing chat entry
        history_response = api_client.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/chat-history")
        if history_response.status_code != 200 or not history_response.json():
            pytest.skip("No chat history to test with")
        
        existing_chat = history_response.json()[0]
        chat_id = existing_chat['id']
        
        # Try to update with wrong project ID
        fake_project_id = "00000000-0000-0000-0000-000000000000"
        response = api_client.put(
            f"{BASE_URL}/api/projects/{fake_project_id}/chat-history/{chat_id}",
            json={"response_text": "test"}
        )
        assert response.status_code == 404, f"Expected 404, got: {response.status_code}"
        print("Correctly returns 404 for wrong project_id")


class TestChatResponseUpdateModel:
    """Tests for ChatResponseUpdate Pydantic model"""
    
    def test_update_requires_response_text(self, api_client):
        """PUT request without response_text should fail validation"""
        # Get existing chat entry
        history_response = api_client.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/chat-history")
        if history_response.status_code != 200 or not history_response.json():
            pytest.skip("No chat history to test with")
        
        chat_id = history_response.json()[0]['id']
        
        # Send empty body
        response = api_client.put(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/chat-history/{chat_id}",
            json={}
        )
        # Should return 422 (validation error) or similar
        assert response.status_code in [400, 422], f"Expected validation error, got: {response.status_code}"
        print("Correctly validates required response_text field")


class TestTranscriptEndpoints:
    """Tests for processed transcript edit functionality"""
    
    def test_get_transcripts(self, api_client):
        """GET transcripts returns all versions"""
        response = api_client.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/transcripts")
        assert response.status_code == 200
        
        transcripts = response.json()
        print(f"Found {len(transcripts)} transcript versions")
        
        version_types = [t['version_type'] for t in transcripts]
        print(f"Version types: {version_types}")
        
        # Should have at least raw and processed
        assert 'raw' in version_types or 'processed' in version_types, "No transcripts found"
    
    def test_update_processed_transcript(self, api_client):
        """PUT /api/projects/{id}/transcripts/processed works"""
        # First get existing content
        response = api_client.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/transcripts")
        assert response.status_code == 200
        
        processed = None
        for t in response.json():
            if t['version_type'] == 'processed':
                processed = t
                break
        
        if not processed:
            pytest.skip("No processed transcript to test")
        
        original_content = processed['content']
        
        # Update with test marker
        test_marker = f"\n\n<!-- TEST_ITERATION4_MARKER_{int(time.time())} -->"
        new_content = original_content + test_marker
        
        update_response = api_client.put(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/transcripts/processed",
            json={"content": new_content}
        )
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        # Verify update
        updated = update_response.json()
        assert test_marker in updated['content'], "Test marker not in updated content"
        print("Successfully updated processed transcript")
        
        # Restore original content
        restore_response = api_client.put(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/transcripts/processed",
            json={"content": original_content}
        )
        assert restore_response.status_code == 200
        print("Restored original content")


class TestProjectData:
    """Verify project has required data for testing"""
    
    def test_project_exists(self, api_client):
        """Test project exists and is accessible"""
        response = api_client.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}")
        assert response.status_code == 200
        
        project = response.json()
        print(f"Project: {project['name']}")
        print(f"Status: {project['status']}")
        assert project['status'] == 'ready', f"Project status is {project['status']}, expected 'ready'"
    
    def test_prompts_available(self, api_client):
        """Verify prompts are available for analysis"""
        response = api_client.get(f"{BASE_URL}/api/prompts?project_id={TEST_PROJECT_ID}")
        assert response.status_code == 200
        
        prompts = response.json()
        non_master = [p for p in prompts if p['prompt_type'] != 'master']
        print(f"Available analysis prompts: {len(non_master)}")
        
        for p in non_master[:3]:
            print(f"  - {p['name']} ({p['prompt_type']})")
        
        assert len(non_master) > 0, "No analysis prompts available"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
