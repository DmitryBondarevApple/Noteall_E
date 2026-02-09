"""
Pipeline API Tests
Tests CRUD operations for analysis pipelines (Сценарии анализа)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@voiceworkspace.com",
        "password": "admin123"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Auth headers for requests"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestPipelinesAPI:
    """Tests for Pipeline CRUD API"""

    created_pipeline_id = None  # Store created pipeline ID for cleanup
    
    def test_list_pipelines(self, auth_headers):
        """GET /api/pipelines - List all pipelines"""
        response = requests.get(f"{BASE_URL}/api/pipelines", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have at least the seeded default pipeline
        assert len(data) >= 1
        # Check seeded pipeline exists
        pipeline_names = [p["name"] for p in data]
        assert "Стандартный анализ встречи" in pipeline_names
        print(f"Found {len(data)} pipelines")

    def test_get_seeded_pipeline(self, auth_headers):
        """GET /api/pipelines/{id} - Get the seeded default pipeline"""
        # First get list to find seeded pipeline
        list_response = requests.get(f"{BASE_URL}/api/pipelines", headers=auth_headers)
        pipelines = list_response.json()
        seeded = next((p for p in pipelines if p["name"] == "Стандартный анализ встречи"), None)
        assert seeded is not None, "Seeded pipeline not found"
        
        # Get the pipeline details
        response = requests.get(f"{BASE_URL}/api/pipelines/{seeded['id']}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert data["name"] == "Стандартный анализ встречи"
        assert "nodes" in data
        assert "edges" in data
        assert isinstance(data["nodes"], list)
        assert isinstance(data["edges"], list)
        assert len(data["nodes"]) == 9  # Should have 9 nodes as per seeding
        assert len(data["edges"]) == 8  # Should have 8 edges as per seeding
        print(f"Seeded pipeline has {len(data['nodes'])} nodes and {len(data['edges'])} edges")

    def test_create_pipeline(self, auth_headers):
        """POST /api/pipelines - Create a new pipeline"""
        payload = {
            "name": "TEST_New Pipeline",
            "description": "Test pipeline created by pytest",
            "nodes": [
                {
                    "node_id": "test_node_1",
                    "node_type": "ai_prompt",
                    "label": "Test AI Prompt",
                    "system_message": "Test system message",
                    "inline_prompt": "Test prompt",
                    "reasoning_effort": "high",
                    "position_x": 100,
                    "position_y": 100
                },
                {
                    "node_id": "test_node_2",
                    "node_type": "parse_list",
                    "label": "Test Parser",
                    "position_x": 100,
                    "position_y": 200
                }
            ],
            "edges": [
                {"source": "test_node_1", "target": "test_node_2"}
            ],
            "is_public": False
        }
        
        response = requests.post(f"{BASE_URL}/api/pipelines", headers=auth_headers, json=payload)
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "id" in data
        assert data["name"] == "TEST_New Pipeline"
        assert data["description"] == "Test pipeline created by pytest"
        assert len(data["nodes"]) == 2
        assert len(data["edges"]) == 1
        assert data["is_public"] == False
        
        # Store ID for later tests
        TestPipelinesAPI.created_pipeline_id = data["id"]
        print(f"Created pipeline with ID: {data['id']}")

    def test_get_created_pipeline(self, auth_headers):
        """GET /api/pipelines/{id} - Verify created pipeline was persisted"""
        assert TestPipelinesAPI.created_pipeline_id is not None
        
        response = requests.get(
            f"{BASE_URL}/api/pipelines/{TestPipelinesAPI.created_pipeline_id}", 
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["name"] == "TEST_New Pipeline"
        assert data["description"] == "Test pipeline created by pytest"
        assert len(data["nodes"]) == 2
        # Verify node details persisted correctly
        ai_node = next((n for n in data["nodes"] if n["node_type"] == "ai_prompt"), None)
        assert ai_node is not None
        assert ai_node["system_message"] == "Test system message"
        assert ai_node["inline_prompt"] == "Test prompt"
        assert ai_node["reasoning_effort"] == "high"
        print("Created pipeline verified with correct node data")

    def test_update_pipeline(self, auth_headers):
        """PUT /api/pipelines/{id} - Update a pipeline"""
        assert TestPipelinesAPI.created_pipeline_id is not None
        
        update_payload = {
            "name": "TEST_Updated Pipeline",
            "description": "Updated description",
            "nodes": [
                {
                    "node_id": "test_node_1",
                    "node_type": "ai_prompt",
                    "label": "Updated AI Prompt",
                    "system_message": "Updated system message",
                    "inline_prompt": "Updated prompt",
                    "reasoning_effort": "medium",
                    "position_x": 150,
                    "position_y": 150
                }
            ],
            "edges": [],
            "is_public": True
        }
        
        response = requests.put(
            f"{BASE_URL}/api/pipelines/{TestPipelinesAPI.created_pipeline_id}",
            headers=auth_headers,
            json=update_payload
        )
        assert response.status_code == 200, f"Update failed: {response.text}"
        data = response.json()
        
        assert data["name"] == "TEST_Updated Pipeline"
        assert data["description"] == "Updated description"
        assert len(data["nodes"]) == 1
        assert len(data["edges"]) == 0
        assert data["is_public"] == True
        print("Pipeline updated successfully")

    def test_update_pipeline_verify_persistence(self, auth_headers):
        """GET - Verify update was persisted"""
        assert TestPipelinesAPI.created_pipeline_id is not None
        
        response = requests.get(
            f"{BASE_URL}/api/pipelines/{TestPipelinesAPI.created_pipeline_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["name"] == "TEST_Updated Pipeline"
        assert data["is_public"] == True
        assert len(data["nodes"]) == 1
        # Verify node update persisted
        node = data["nodes"][0]
        assert node["label"] == "Updated AI Prompt"
        assert node["reasoning_effort"] == "medium"
        print("Update persistence verified")

    def test_duplicate_pipeline(self, auth_headers):
        """POST /api/pipelines/{id}/duplicate - Duplicate a pipeline"""
        assert TestPipelinesAPI.created_pipeline_id is not None
        
        response = requests.post(
            f"{BASE_URL}/api/pipelines/{TestPipelinesAPI.created_pipeline_id}/duplicate",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Duplicate failed: {response.text}"
        data = response.json()
        
        # Verify duplicate has new ID and copied name
        assert data["id"] != TestPipelinesAPI.created_pipeline_id
        assert data["name"] == "TEST_Updated Pipeline (копия)"
        assert len(data["nodes"]) == 1  # Same number of nodes
        assert data["is_public"] == False  # Duplicates are private by default
        
        duplicate_id = data["id"]
        print(f"Duplicated pipeline with new ID: {duplicate_id}")
        
        # Clean up duplicate
        requests.delete(f"{BASE_URL}/api/pipelines/{duplicate_id}", headers=auth_headers)

    def test_delete_pipeline(self, auth_headers):
        """DELETE /api/pipelines/{id} - Delete a pipeline"""
        assert TestPipelinesAPI.created_pipeline_id is not None
        
        response = requests.delete(
            f"{BASE_URL}/api/pipelines/{TestPipelinesAPI.created_pipeline_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        # Verify deletion
        get_response = requests.get(
            f"{BASE_URL}/api/pipelines/{TestPipelinesAPI.created_pipeline_id}",
            headers=auth_headers
        )
        assert get_response.status_code == 404
        print("Pipeline deleted and verified")

    def test_get_nonexistent_pipeline(self, auth_headers):
        """GET /api/pipelines/{id} - Should return 404 for nonexistent"""
        response = requests.get(
            f"{BASE_URL}/api/pipelines/nonexistent-id-12345",
            headers=auth_headers
        )
        assert response.status_code == 404

    def test_delete_nonexistent_pipeline(self, auth_headers):
        """DELETE /api/pipelines/{id} - Should return 404 for nonexistent"""
        response = requests.delete(
            f"{BASE_URL}/api/pipelines/nonexistent-id-12345",
            headers=auth_headers
        )
        assert response.status_code == 404


class TestPipelineNodeTypes:
    """Test different node type configurations"""

    created_ids = []  # Track created pipelines for cleanup
    
    @pytest.fixture(autouse=True)
    def cleanup(self, auth_headers):
        """Cleanup test pipelines after each test class"""
        yield
        for pid in TestPipelineNodeTypes.created_ids:
            requests.delete(f"{BASE_URL}/api/pipelines/{pid}", headers=auth_headers)
        TestPipelineNodeTypes.created_ids = []

    def test_ai_prompt_node_config(self, auth_headers):
        """Test AI prompt node with all fields"""
        payload = {
            "name": "TEST_AI Prompt Node Test",
            "nodes": [
                {
                    "node_id": "ai_node",
                    "node_type": "ai_prompt",
                    "label": "AI Analysis",
                    "system_message": "You are an assistant",
                    "inline_prompt": "Analyze this: {{input}}",
                    "reasoning_effort": "high",
                    "position_x": 100,
                    "position_y": 100
                }
            ],
            "edges": [],
            "is_public": False
        }
        
        response = requests.post(f"{BASE_URL}/api/pipelines", headers=auth_headers, json=payload)
        assert response.status_code == 200
        data = response.json()
        TestPipelineNodeTypes.created_ids.append(data["id"])
        
        node = data["nodes"][0]
        assert node["node_type"] == "ai_prompt"
        assert node["system_message"] == "You are an assistant"
        assert node["inline_prompt"] == "Analyze this: {{input}}"
        assert node["reasoning_effort"] == "high"
        print("AI prompt node config validated")

    def test_batch_loop_node_config(self, auth_headers):
        """Test batch loop node with batch_size"""
        payload = {
            "name": "TEST_Batch Loop Node Test",
            "nodes": [
                {
                    "node_id": "batch_node",
                    "node_type": "batch_loop",
                    "label": "Batch Processing",
                    "batch_size": 5,
                    "position_x": 100,
                    "position_y": 100
                }
            ],
            "edges": [],
            "is_public": False
        }
        
        response = requests.post(f"{BASE_URL}/api/pipelines", headers=auth_headers, json=payload)
        assert response.status_code == 200
        data = response.json()
        TestPipelineNodeTypes.created_ids.append(data["id"])
        
        node = data["nodes"][0]
        assert node["node_type"] == "batch_loop"
        assert node["batch_size"] == 5
        print("Batch loop node config validated")

    def test_template_node_config(self, auth_headers):
        """Test template node with template_text"""
        payload = {
            "name": "TEST_Template Node Test",
            "nodes": [
                {
                    "node_id": "template_node",
                    "node_type": "template",
                    "label": "Meeting Subject",
                    "template_text": "{{meeting_subject}}",
                    "position_x": 100,
                    "position_y": 100
                }
            ],
            "edges": [],
            "is_public": False
        }
        
        response = requests.post(f"{BASE_URL}/api/pipelines", headers=auth_headers, json=payload)
        assert response.status_code == 200
        data = response.json()
        TestPipelineNodeTypes.created_ids.append(data["id"])
        
        node = data["nodes"][0]
        assert node["node_type"] == "template"
        assert node["template_text"] == "{{meeting_subject}}"
        print("Template node config validated")

    def test_all_node_types(self, auth_headers):
        """Test pipeline with all node types"""
        all_types = ["ai_prompt", "parse_list", "batch_loop", "aggregate", "template", "user_edit_list", "user_review"]
        
        nodes = [
            {
                "node_id": f"{t}_node",
                "node_type": t,
                "label": f"Test {t}",
                "position_x": 100,
                "position_y": i * 100
            }
            for i, t in enumerate(all_types)
        ]
        
        payload = {
            "name": "TEST_All Node Types",
            "nodes": nodes,
            "edges": [],
            "is_public": False
        }
        
        response = requests.post(f"{BASE_URL}/api/pipelines", headers=auth_headers, json=payload)
        assert response.status_code == 200
        data = response.json()
        TestPipelineNodeTypes.created_ids.append(data["id"])
        
        assert len(data["nodes"]) == 7
        created_types = [n["node_type"] for n in data["nodes"]]
        for t in all_types:
            assert t in created_types, f"Missing node type: {t}"
        print("All 7 node types created successfully")
