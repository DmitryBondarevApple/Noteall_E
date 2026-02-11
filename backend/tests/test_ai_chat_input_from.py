"""
Test AI Chat input_from Fix - Pipeline Generation

Tests that:
1. AI Chat SYSTEM_PROMPT includes input_from rules
2. Backend import_pipeline auto-fixes input_from from edges
3. AI Chat message endpoint works correctly
"""

import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin@voiceworkspace.com"
TEST_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture
def api_client(auth_token):
    """Create an authenticated requests session"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


class TestAiChatSystemPrompt:
    """Tests for AI Chat system prompt containing input_from rules"""
    
    def test_system_prompt_contains_input_from_rules(self):
        """Verify SYSTEM_PROMPT contains critical input_from instructions"""
        # Read the ai_chat.py file to check SYSTEM_PROMPT content
        ai_chat_path = "/app/backend/app/routes/ai_chat.py"
        with open(ai_chat_path, "r") as f:
            content = f.read()
        
        # Check that key input_from rules are in the system prompt
        assert "input_from" in content, "SYSTEM_PROMPT should mention input_from"
        assert "Первый узел НЕ ИМЕЕТ input_from" in content, "Should explain first node has no input_from"
        assert "Все остальные узлы ОБЯЗАТЕЛЬНО должны иметь input_from" in content, "Should require input_from for other nodes"
        assert '"input_from": ["step_1"]' in content, "Should show example of input_from array"
        print("PASS: SYSTEM_PROMPT contains correct input_from rules")


class TestImportPipelineInputFromFix:
    """Tests for import_pipeline endpoint auto-fixing input_from"""
    
    def test_import_pipeline_auto_fixes_input_from(self, api_client, auth_token):
        """Test that import_pipeline derives input_from from edges when missing"""
        # Pipeline JSON with edges but NO input_from (simulates AI-generated pipeline with null input_from)
        pipeline_data = {
            "noteall_pipeline_version": 1,
            "name": "TEST_InputFromFix",
            "description": "Test auto-fix of input_from",
            "nodes": [
                {
                    "node_id": "step_1",
                    "node_type": "ai_prompt",
                    "label": "Извлечь темы",
                    "inline_prompt": "Извлеки ключевые темы",
                    "input_from": None,  # First node - should stay null/empty
                    "position_x": 0,
                    "position_y": 0
                },
                {
                    "node_id": "step_2",
                    "node_type": "parse_list",
                    "label": "Парсинг списка",
                    "script": "items = text.split('\\n')",
                    "input_from": None,  # BUG: AI set this to null - should be auto-fixed to ["step_1"]
                    "position_x": 300,
                    "position_y": 0
                },
                {
                    "node_id": "step_3",
                    "node_type": "user_review",
                    "label": "Просмотр",
                    "input_from": None,  # BUG: AI set this to null - should be auto-fixed to ["step_2"]
                    "position_x": 600,
                    "position_y": 0
                }
            ],
            "edges": [
                {"source": "step_1", "target": "step_2"},
                {"source": "step_2", "target": "step_3"}
            ]
        }
        
        # Create a JSON file to upload
        import io
        json_bytes = json.dumps(pipeline_data).encode('utf-8')
        files = {'file': ('test_pipeline.json', io.BytesIO(json_bytes), 'application/json')}
        
        # Remove Content-Type header for multipart form data
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/pipelines/import/json", files=files, headers=headers)
        
        assert response.status_code == 201, f"Import failed: {response.status_code} - {response.text}"
        imported = response.json()
        
        # Verify the pipeline was imported
        assert imported["name"].startswith("TEST_InputFromFix"), "Pipeline name mismatch"
        
        # Verify nodes have correct input_from values
        nodes_by_id = {n["node_id"]: n for n in imported["nodes"]}
        
        # First node should have no input_from
        step_1 = nodes_by_id.get("step_1")
        assert step_1 is not None, "step_1 not found"
        assert step_1.get("input_from") in [None, []], f"First node should have no input_from, got: {step_1.get('input_from')}"
        print(f"PASS: step_1 input_from = {step_1.get('input_from')} (correct - first node)")
        
        # Second node should have input_from: ["step_1"] (auto-fixed from edges)
        step_2 = nodes_by_id.get("step_2")
        assert step_2 is not None, "step_2 not found"
        assert step_2.get("input_from") == ["step_1"], f"step_2 should have input_from: ['step_1'], got: {step_2.get('input_from')}"
        print(f"PASS: step_2 input_from = {step_2.get('input_from')} (auto-fixed)")
        
        # Third node should have input_from: ["step_2"] (auto-fixed from edges)
        step_3 = nodes_by_id.get("step_3")
        assert step_3 is not None, "step_3 not found"
        assert step_3.get("input_from") == ["step_2"], f"step_3 should have input_from: ['step_2'], got: {step_3.get('input_from')}"
        print(f"PASS: step_3 input_from = {step_3.get('input_from')} (auto-fixed)")
        
        # Clean up - delete the test pipeline
        pipeline_id = imported["id"]
        delete_resp = api_client.delete(f"{BASE_URL}/api/pipelines/{pipeline_id}")
        assert delete_resp.status_code == 200, f"Failed to delete test pipeline: {delete_resp.text}"
        print(f"PASS: Cleaned up test pipeline {pipeline_id}")


class TestAiChatMessageEndpoint:
    """Tests for AI Chat message sending (no regression)"""
    
    def test_create_and_send_message(self, auth_token):
        """Test basic AI chat workflow - create session and send message"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create a new session
        session_resp = requests.post(
            f"{BASE_URL}/api/ai-chat/sessions",
            json={"pipeline_id": None},
            headers={**headers, "Content-Type": "application/json"}
        )
        assert session_resp.status_code == 201, f"Failed to create session: {session_resp.text}"
        session = session_resp.json()
        session_id = session["id"]
        print(f"PASS: Created AI chat session {session_id}")
        
        # Send a simple message (not pipeline generation to avoid slow AI response)
        form_data = {
            "content": "Привет, что такое сценарий анализа?",
            "pipeline_context": ""
        }
        message_resp = requests.post(
            f"{BASE_URL}/api/ai-chat/sessions/{session_id}/message",
            data=form_data,
            headers=headers
        )
        
        assert message_resp.status_code == 200, f"Failed to send message: {message_resp.text}"
        result = message_resp.json()
        
        # Verify response structure
        assert "user_message" in result, "Response should have user_message"
        assert "assistant_message" in result, "Response should have assistant_message"
        assert result["user_message"]["content"] == form_data["content"], "User message content mismatch"
        assert len(result["assistant_message"]["content"]) > 0, "Assistant should respond with content"
        print(f"PASS: AI responded with {len(result['assistant_message']['content'])} chars")
        
        # Clean up - delete the session
        delete_resp = requests.delete(f"{BASE_URL}/api/ai-chat/sessions/{session_id}", headers=headers)
        assert delete_resp.status_code == 200, f"Failed to delete session: {delete_resp.text}"
        print(f"PASS: Cleaned up session {session_id}")


class TestPipelineEdgesConsistency:
    """Tests for pipeline edge and input_from consistency"""
    
    def test_create_pipeline_with_edges(self, api_client):
        """Test creating a pipeline with edges and verify input_from is preserved"""
        pipeline_data = {
            "name": "TEST_EdgeConsistency",
            "description": "Test edge and input_from consistency",
            "nodes": [
                {
                    "node_id": "node_a",
                    "node_type": "ai_prompt",
                    "label": "Node A",
                    "inline_prompt": "Test prompt A",
                    "input_from": [],
                    "position_x": 0,
                    "position_y": 0
                },
                {
                    "node_id": "node_b",
                    "node_type": "parse_list",
                    "label": "Node B",
                    "script": "items = text.split()",
                    "input_from": ["node_a"],  # Explicitly set
                    "position_x": 300,
                    "position_y": 0
                }
            ],
            "edges": [
                {"source": "node_a", "target": "node_b"}
            ],
            "is_public": False
        }
        
        response = api_client.post(f"{BASE_URL}/api/pipelines", json=pipeline_data)
        assert response.status_code == 201, f"Failed to create pipeline: {response.text}"
        created = response.json()
        
        # Verify nodes
        nodes_by_id = {n["node_id"]: n for n in created["nodes"]}
        assert nodes_by_id["node_b"]["input_from"] == ["node_a"], "input_from should be preserved"
        print("PASS: Pipeline created with correct input_from")
        
        # Clean up
        pipeline_id = created["id"]
        delete_resp = api_client.delete(f"{BASE_URL}/api/pipelines/{pipeline_id}")
        assert delete_resp.status_code == 200
        print(f"PASS: Cleaned up test pipeline {pipeline_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
