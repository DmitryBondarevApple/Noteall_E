"""
Test the Dynamic Wizard Engine settings in the Pipeline API.
Tests wizard display settings: step_title, step_description, continue_button_label,
pause_after, variable_config, and node-type specific options.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestWizardSettings:
    """Test wizard settings in pipeline nodes"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@voiceworkspace.com", "password": "admin123"}
        )
        assert login_response.status_code == 200, "Login failed"
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def test_pipeline_list_returns_wizard_fields(self):
        """GET /pipelines returns pipelines with wizard settings"""
        response = requests.get(f"{BASE_URL}/api/pipelines", headers=self.headers)
        assert response.status_code == 200
        
        pipelines = response.json()
        assert len(pipelines) > 0, "No pipelines found"
        
        # Find the seeded pipeline with wizard settings
        std_pipeline = next((p for p in pipelines if p["name"] == "Стандартный анализ встречи"), None)
        assert std_pipeline is not None, "Seeded pipeline not found"
        
        # Check that nodes have wizard settings fields
        nodes = std_pipeline["nodes"]
        assert len(nodes) > 0
        
        for node in nodes:
            # All nodes should have these wizard fields
            assert "step_title" in node
            assert "step_description" in node
            assert "continue_button_label" in node
            assert "pause_after" in node
        
        print(f"PASSED: Pipeline list returns {len(nodes)} nodes with wizard fields")

    def test_template_node_wizard_settings(self):
        """Template node has step_title, variable_config"""
        response = requests.get(f"{BASE_URL}/api/pipelines", headers=self.headers)
        pipelines = response.json()
        std_pipeline = next((p for p in pipelines if p["name"] == "Стандартный анализ встречи"), None)
        
        # Find template node (input_subject)
        template_node = next((n for n in std_pipeline["nodes"] if n["node_type"] == "template"), None)
        assert template_node is not None
        
        # Check wizard settings
        assert template_node["step_title"] == "Настройка", f"Got: {template_node['step_title']}"
        assert template_node["step_description"] == "Укажите тему встречи для анализа"
        assert template_node["continue_button_label"] == "Извлечь темы"
        
        # Check variable_config
        assert template_node["variable_config"] is not None
        var_config = template_node["variable_config"]
        assert "meeting_subject" in var_config
        assert var_config["meeting_subject"]["label"] == "Предмет обсуждения"
        assert var_config["meeting_subject"]["placeholder"] is not None
        assert var_config["meeting_subject"]["input_type"] == "text"
        assert var_config["meeting_subject"]["required"] == True
        
        print("PASSED: Template node has correct wizard settings and variable_config")

    def test_user_edit_list_node_wizard_settings(self):
        """user_edit_list node has step_title, allow_add, allow_edit, allow_delete, min_selected"""
        response = requests.get(f"{BASE_URL}/api/pipelines", headers=self.headers)
        pipelines = response.json()
        std_pipeline = next((p for p in pipelines if p["name"] == "Стандартный анализ встречи"), None)
        
        # Find user_edit_list node (edit_topics)
        edit_node = next((n for n in std_pipeline["nodes"] if n["node_type"] == "user_edit_list"), None)
        assert edit_node is not None
        
        # Check wizard settings
        assert edit_node["step_title"] == "Темы", f"Got: {edit_node['step_title']}"
        assert edit_node["step_description"] == "Проверьте и отредактируйте список тем для анализа"
        assert edit_node["continue_button_label"] == "Начать анализ"
        
        # Check node-specific options
        assert edit_node["allow_add"] == True
        assert edit_node["allow_edit"] == True
        assert edit_node["allow_delete"] == True
        assert edit_node["min_selected"] == 1
        
        print("PASSED: user_edit_list node has correct wizard settings")

    def test_user_review_node_wizard_settings(self):
        """user_review node has allow_review_edit, show_export, show_save"""
        response = requests.get(f"{BASE_URL}/api/pipelines", headers=self.headers)
        pipelines = response.json()
        std_pipeline = next((p for p in pipelines if p["name"] == "Стандартный анализ встречи"), None)
        
        # Find user_review node (final_review)
        review_node = next((n for n in std_pipeline["nodes"] if n["node_type"] == "user_review"), None)
        assert review_node is not None
        
        # Check wizard settings
        assert review_node["step_title"] == "Результат"
        assert review_node["step_description"] == "Проверьте и при необходимости отредактируйте результат"
        
        # Check node-specific options
        assert review_node["allow_review_edit"] == True
        assert review_node["show_export"] == True
        assert review_node["show_save"] == True
        
        print("PASSED: user_review node has correct wizard settings")

    def test_non_interactive_node_pause_after(self):
        """Non-interactive node (batch_loop) has pause_after setting"""
        response = requests.get(f"{BASE_URL}/api/pipelines", headers=self.headers)
        pipelines = response.json()
        std_pipeline = next((p for p in pipelines if p["name"] == "Стандартный анализ встречи"), None)
        
        # Find batch_loop node (batch_analyze)
        batch_node = next((n for n in std_pipeline["nodes"] if n["node_type"] == "batch_loop"), None)
        assert batch_node is not None
        
        # Check pause_after is True for this node
        assert batch_node["pause_after"] == True, f"Got: {batch_node['pause_after']}"
        assert batch_node["step_title"] == "Анализ"
        assert batch_node["step_description"] == "Анализ тем выполняется по порциям"
        assert batch_node["continue_button_label"] == "Собрать документ"
        
        print("PASSED: batch_loop node has pause_after=True")

    def test_create_pipeline_with_wizard_settings(self):
        """POST /pipelines accepts wizard settings"""
        pipeline_data = {
            "name": "TEST_wizard_pipeline",
            "description": "Test pipeline with wizard settings",
            "nodes": [
                {
                    "node_id": "test_template",
                    "node_type": "template",
                    "label": "Test Template",
                    "template_text": "{{test_var}}",
                    "position_x": 0,
                    "position_y": 0,
                    "step_title": "Test Step",
                    "step_description": "This is a test description",
                    "continue_button_label": "Continue",
                    "pause_after": False,
                    "variable_config": {
                        "test_var": {
                            "label": "Test Variable",
                            "placeholder": "Enter test value",
                            "input_type": "text",
                            "required": True
                        }
                    }
                },
                {
                    "node_id": "test_edit_list",
                    "node_type": "user_edit_list",
                    "label": "Test Edit List",
                    "position_x": 200,
                    "position_y": 0,
                    "step_title": "Edit Items",
                    "step_description": "Select items to process",
                    "continue_button_label": "Process",
                    "allow_add": False,
                    "allow_edit": True,
                    "allow_delete": False,
                    "min_selected": 2
                },
                {
                    "node_id": "test_review",
                    "node_type": "user_review",
                    "label": "Test Review",
                    "position_x": 400,
                    "position_y": 0,
                    "step_title": "Review Result",
                    "step_description": "Check the result",
                    "allow_review_edit": False,
                    "show_export": False,
                    "show_save": True
                }
            ],
            "edges": [
                {"source": "test_template", "target": "test_edit_list"},
                {"source": "test_edit_list", "target": "test_review"}
            ],
            "is_public": False
        }
        
        response = requests.post(f"{BASE_URL}/api/pipelines", headers=self.headers, json=pipeline_data)
        assert response.status_code == 201, f"Create failed: {response.text}"
        
        created = response.json()
        pipeline_id = created["id"]
        
        # Verify wizard settings were saved
        get_response = requests.get(f"{BASE_URL}/api/pipelines/{pipeline_id}", headers=self.headers)
        assert get_response.status_code == 200
        
        pipeline = get_response.json()
        
        # Check template node
        template_node = next((n for n in pipeline["nodes"] if n["node_id"] == "test_template"), None)
        assert template_node["step_title"] == "Test Step"
        assert template_node["step_description"] == "This is a test description"
        assert template_node["continue_button_label"] == "Continue"
        assert template_node["variable_config"]["test_var"]["label"] == "Test Variable"
        
        # Check user_edit_list node
        edit_node = next((n for n in pipeline["nodes"] if n["node_id"] == "test_edit_list"), None)
        assert edit_node["allow_add"] == False
        assert edit_node["allow_edit"] == True
        assert edit_node["allow_delete"] == False
        assert edit_node["min_selected"] == 2
        
        # Check user_review node
        review_node = next((n for n in pipeline["nodes"] if n["node_id"] == "test_review"), None)
        assert review_node["allow_review_edit"] == False
        assert review_node["show_export"] == False
        assert review_node["show_save"] == True
        
        # Cleanup
        delete_response = requests.delete(f"{BASE_URL}/api/pipelines/{pipeline_id}", headers=self.headers)
        assert delete_response.status_code in [200, 204]
        
        print("PASSED: Pipeline with wizard settings created and verified")

    def test_update_pipeline_wizard_settings(self):
        """PUT /pipelines/:id updates wizard settings"""
        # First create a pipeline
        pipeline_data = {
            "name": "TEST_update_wizard",
            "description": "Test pipeline for update",
            "nodes": [
                {
                    "node_id": "node1",
                    "node_type": "template",
                    "label": "Node 1",
                    "template_text": "{{var1}}",
                    "position_x": 0,
                    "position_y": 0,
                    "step_title": "Original Title",
                    "step_description": "Original description"
                }
            ],
            "edges": [],
            "is_public": False
        }
        
        create_response = requests.post(f"{BASE_URL}/api/pipelines", headers=self.headers, json=pipeline_data)
        assert create_response.status_code == 201
        pipeline_id = create_response.json()["id"]
        
        # Update wizard settings
        update_data = {
            "nodes": [
                {
                    "node_id": "node1",
                    "node_type": "template",
                    "label": "Node 1",
                    "template_text": "{{var1}}",
                    "position_x": 0,
                    "position_y": 0,
                    "step_title": "Updated Title",
                    "step_description": "Updated description",
                    "continue_button_label": "Next Step",
                    "variable_config": {
                        "var1": {
                            "label": "Updated Label",
                            "placeholder": "Updated placeholder",
                            "input_type": "textarea",
                            "required": False
                        }
                    }
                }
            ]
        }
        
        update_response = requests.put(f"{BASE_URL}/api/pipelines/{pipeline_id}", headers=self.headers, json=update_data)
        assert update_response.status_code == 200
        
        # Verify update
        get_response = requests.get(f"{BASE_URL}/api/pipelines/{pipeline_id}", headers=self.headers)
        pipeline = get_response.json()
        
        node = pipeline["nodes"][0]
        assert node["step_title"] == "Updated Title"
        assert node["step_description"] == "Updated description"
        assert node["continue_button_label"] == "Next Step"
        assert node["variable_config"]["var1"]["label"] == "Updated Label"
        assert node["variable_config"]["var1"]["input_type"] == "textarea"
        assert node["variable_config"]["var1"]["required"] == False
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/pipelines/{pipeline_id}", headers=self.headers)
        
        print("PASSED: Pipeline wizard settings updated successfully")

    def test_character_limits_respected(self):
        """Verify character limits are documented (40, 200, 25)"""
        response = requests.get(f"{BASE_URL}/api/pipelines", headers=self.headers)
        pipelines = response.json()
        std_pipeline = next((p for p in pipelines if p["name"] == "Стандартный анализ встречи"), None)
        
        for node in std_pipeline["nodes"]:
            if node["step_title"]:
                assert len(node["step_title"]) <= 40, f"step_title too long: {len(node['step_title'])}"
            if node["step_description"]:
                assert len(node["step_description"]) <= 200, f"step_description too long: {len(node['step_description'])}"
            if node["continue_button_label"]:
                assert len(node["continue_button_label"]) <= 25, f"continue_button_label too long: {len(node['continue_button_label'])}"
        
        print("PASSED: All character limits respected")


class TestWizardStagesConstruction:
    """Test that wizard stages are correctly derived from pipeline nodes"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@voiceworkspace.com", "password": "admin123"}
        )
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def test_seeded_pipeline_has_interactive_nodes(self):
        """Seeded pipeline has template, user_edit_list, user_review nodes"""
        response = requests.get(f"{BASE_URL}/api/pipelines", headers=self.headers)
        pipelines = response.json()
        std_pipeline = next((p for p in pipelines if p["name"] == "Стандартный анализ встречи"), None)
        
        node_types = [n["node_type"] for n in std_pipeline["nodes"]]
        
        # Check interactive node types are present
        assert "template" in node_types
        assert "user_edit_list" in node_types
        assert "user_review" in node_types
        
        # Count interactive nodes (should create wizard stages)
        interactive_count = sum(1 for t in node_types if t in ["template", "user_edit_list", "user_review"])
        assert interactive_count >= 3, f"Expected at least 3 interactive nodes, got {interactive_count}"
        
        # Check pause_after nodes (should also create stages)
        pause_nodes = [n for n in std_pipeline["nodes"] if n.get("pause_after")]
        assert len(pause_nodes) >= 1, "Expected at least 1 node with pause_after=True"
        
        print(f"PASSED: Pipeline has {interactive_count} interactive nodes and {len(pause_nodes)} pause nodes")

    def test_edges_define_execution_order(self):
        """Pipeline edges define node execution order"""
        response = requests.get(f"{BASE_URL}/api/pipelines", headers=self.headers)
        pipelines = response.json()
        std_pipeline = next((p for p in pipelines if p["name"] == "Стандартный анализ встречи"), None)
        
        edges = std_pipeline["edges"]
        nodes = std_pipeline["nodes"]
        
        # All nodes except first should be targets
        sources = {e["source"] for e in edges}
        targets = {e["target"] for e in edges}
        node_ids = {n["node_id"] for n in nodes}
        
        # First node should only be a source, not a target
        first_node = None
        for nid in node_ids:
            if nid in sources and nid not in targets:
                first_node = nid
                break
        
        assert first_node is not None, "Should have a starting node"
        
        # Last node should only be a target, not a source
        last_node = None
        for nid in node_ids:
            if nid in targets and nid not in sources:
                last_node = nid
                break
        
        assert last_node is not None, "Should have an ending node"
        
        print(f"PASSED: Pipeline execution order: {first_node} -> ... -> {last_node}")
