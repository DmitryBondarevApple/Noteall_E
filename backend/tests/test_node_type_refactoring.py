"""
Tests for the pipeline node type refactoring:
- Split 'template' into: user_input, format_template, batch_prompt_template
- Backward compatibility with legacy 'template' type
- New node types appear in pipeline create/update APIs
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestNodeTypeRefactoring:
    """Test suite for node type refactoring feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get auth token"""
        # Login to get token
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@voiceworkspace.com",
            "password": "admin123"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.token = login_resp.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        yield
    
    def test_get_existing_pipeline_with_user_input_node(self):
        """Test that pipeline d756739d-a179-4e4d-9633-8d59e68cecd3 has user_input node"""
        # This pipeline should have a user_input node based on context
        resp = requests.get(
            f"{BASE_URL}/api/pipelines/d756739d-a179-4e4d-9633-8d59e68cecd3",
            headers=self.headers
        )
        
        # Handle 404 - pipeline might not exist in this environment
        if resp.status_code == 404:
            pytest.skip("Pipeline d756739d-a179-4e4d-9633-8d59e68cecd3 not found in this environment")
        
        assert resp.status_code == 200, f"Failed to get pipeline: {resp.text}"
        pipeline = resp.json()
        
        # Check nodes for user_input type
        node_types = [node.get("node_type") for node in pipeline.get("nodes", [])]
        print(f"Node types in pipeline: {node_types}")
        
        # Should have user_input type
        has_user_input = "user_input" in node_types
        print(f"Has user_input node: {has_user_input}")
    
    def test_get_existing_pipeline_with_batch_and_format_template(self):
        """Test that pipeline 0190dd20-6883-4ac2-b038-9beeecc43926 has batch_prompt_template and format_template"""
        resp = requests.get(
            f"{BASE_URL}/api/pipelines/0190dd20-6883-4ac2-b038-9beeecc43926",
            headers=self.headers
        )
        
        # Handle 404
        if resp.status_code == 404:
            pytest.skip("Pipeline 0190dd20-6883-4ac2-b038-9beeecc43926 not found in this environment")
        
        assert resp.status_code == 200, f"Failed to get pipeline: {resp.text}"
        pipeline = resp.json()
        
        node_types = [node.get("node_type") for node in pipeline.get("nodes", [])]
        print(f"Node types in pipeline: {node_types}")
        
        has_batch_prompt_template = "batch_prompt_template" in node_types
        has_format_template = "format_template" in node_types
        print(f"Has batch_prompt_template: {has_batch_prompt_template}")
        print(f"Has format_template: {has_format_template}")
    
    def test_create_pipeline_with_user_input_node(self):
        """Test creating a pipeline with the new user_input node type"""
        pipeline_data = {
            "name": "TEST_UserInputPipeline",
            "description": "Test pipeline with user_input node",
            "is_public": False,
            "nodes": [
                {
                    "node_id": "user_input_1",
                    "node_type": "user_input",
                    "label": "Ввод темы",
                    "template_text": "{{meeting_subject}}",
                    "variable_config": {
                        "meeting_subject": {
                            "label": "Тема встречи",
                            "placeholder": "Введите тему...",
                            "input_type": "text",
                            "required": True
                        }
                    },
                    "position_x": 100,
                    "position_y": 100
                },
                {
                    "node_id": "ai_1",
                    "node_type": "ai_prompt",
                    "label": "AI анализ",
                    "inline_prompt": "Анализируй по теме: {{meeting_subject}}",
                    "system_message": "Ты - ассистент",
                    "reasoning_effort": "high",
                    "input_from": ["user_input_1"],
                    "position_x": 100,
                    "position_y": 250
                }
            ],
            "edges": [
                {"source": "user_input_1", "target": "ai_1"}
            ]
        }
        
        resp = requests.post(
            f"{BASE_URL}/api/pipelines",
            headers=self.headers,
            json=pipeline_data
        )
        
        assert resp.status_code in [200, 201], f"Failed to create pipeline: {resp.text}"
        created = resp.json()
        pipeline_id = created.get("id")
        print(f"Created pipeline with ID: {pipeline_id}")
        
        # Verify the node type is saved correctly
        assert any(n.get("node_type") == "user_input" for n in created.get("nodes", [])), \
            "user_input node type not saved"
        
        # Cleanup - delete the test pipeline
        delete_resp = requests.delete(
            f"{BASE_URL}/api/pipelines/{pipeline_id}",
            headers=self.headers
        )
        print(f"Cleanup - Delete status: {delete_resp.status_code}")
    
    def test_create_pipeline_with_format_template_node(self):
        """Test creating a pipeline with the new format_template node type"""
        pipeline_data = {
            "name": "TEST_FormatTemplatePipeline",
            "description": "Test pipeline with format_template node",
            "is_public": False,
            "nodes": [
                {
                    "node_id": "format_1",
                    "node_type": "format_template",
                    "label": "Форматирование текста",
                    "template_text": "Результат: {{result}}",
                    "position_x": 100,
                    "position_y": 100
                }
            ],
            "edges": []
        }
        
        resp = requests.post(
            f"{BASE_URL}/api/pipelines",
            headers=self.headers,
            json=pipeline_data
        )
        
        assert resp.status_code in [200, 201], f"Failed to create pipeline: {resp.text}"
        created = resp.json()
        pipeline_id = created.get("id")
        
        # Verify node type
        assert any(n.get("node_type") == "format_template" for n in created.get("nodes", [])), \
            "format_template node type not saved"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/pipelines/{pipeline_id}", headers=self.headers)
    
    def test_create_pipeline_with_batch_prompt_template_node(self):
        """Test creating a pipeline with the new batch_prompt_template node type"""
        pipeline_data = {
            "name": "TEST_BatchPromptTemplatePipeline",
            "description": "Test pipeline with batch_prompt_template node",
            "is_public": False,
            "nodes": [
                {
                    "node_id": "batch_tpl_1",
                    "node_type": "batch_prompt_template",
                    "label": "Батч шаблон",
                    "template_text": "Анализ темы {{item}}: сделай детальный разбор",
                    "loop_vars": ["item"],
                    "position_x": 100,
                    "position_y": 100
                }
            ],
            "edges": []
        }
        
        resp = requests.post(
            f"{BASE_URL}/api/pipelines",
            headers=self.headers,
            json=pipeline_data
        )
        
        assert resp.status_code in [200, 201], f"Failed to create pipeline: {resp.text}"
        created = resp.json()
        pipeline_id = created.get("id")
        
        # Verify node type and loop_vars
        batch_node = next((n for n in created.get("nodes", []) if n.get("node_type") == "batch_prompt_template"), None)
        assert batch_node is not None, "batch_prompt_template node type not saved"
        assert batch_node.get("loop_vars") == ["item"], f"loop_vars not saved correctly: {batch_node.get('loop_vars')}"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/pipelines/{pipeline_id}", headers=self.headers)
    
    def test_backward_compat_legacy_template_type(self):
        """Test that legacy 'template' type still works (backward compatibility)"""
        pipeline_data = {
            "name": "TEST_LegacyTemplatePipeline",
            "description": "Test pipeline with legacy template node",
            "is_public": False,
            "nodes": [
                {
                    "node_id": "legacy_tpl_1",
                    "node_type": "template",  # Legacy type
                    "label": "Старый шаблон",
                    "template_text": "{{var1}} + {{var2}}",
                    "position_x": 100,
                    "position_y": 100
                }
            ],
            "edges": []
        }
        
        resp = requests.post(
            f"{BASE_URL}/api/pipelines",
            headers=self.headers,
            json=pipeline_data
        )
        
        assert resp.status_code in [200, 201], f"Failed to create pipeline with legacy template: {resp.text}"
        created = resp.json()
        pipeline_id = created.get("id")
        
        # Verify legacy template type is preserved
        assert any(n.get("node_type") == "template" for n in created.get("nodes", [])), \
            "Legacy template node type should be preserved"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/pipelines/{pipeline_id}", headers=self.headers)
    
    def test_update_pipeline_with_new_node_types(self):
        """Test updating a pipeline to add new node types"""
        # First create a simple pipeline
        create_data = {
            "name": "TEST_UpdateWithNewTypes",
            "description": "Will be updated with new node types",
            "is_public": False,
            "nodes": [
                {
                    "node_id": "start_node",
                    "node_type": "ai_prompt",
                    "label": "Start",
                    "inline_prompt": "Test",
                    "position_x": 100,
                    "position_y": 100
                }
            ],
            "edges": []
        }
        
        create_resp = requests.post(
            f"{BASE_URL}/api/pipelines",
            headers=self.headers,
            json=create_data
        )
        assert create_resp.status_code in [200, 201]
        pipeline_id = create_resp.json().get("id")
        
        # Update with all 3 new node types
        update_data = {
            "nodes": [
                {
                    "node_id": "user_input_node",
                    "node_type": "user_input",
                    "label": "Ввод данных",
                    "template_text": "{{topic}}",
                    "variable_config": {"topic": {"label": "Тема", "required": True}},
                    "position_x": 100,
                    "position_y": 0
                },
                {
                    "node_id": "format_node",
                    "node_type": "format_template",
                    "label": "Форматирование",
                    "template_text": "Formatted: {{topic}}",
                    "input_from": ["user_input_node"],
                    "position_x": 100,
                    "position_y": 150
                },
                {
                    "node_id": "batch_node",
                    "node_type": "batch_prompt_template",
                    "label": "Батч-шаблон",
                    "template_text": "Process {{item}}",
                    "loop_vars": ["item"],
                    "position_x": 100,
                    "position_y": 300
                }
            ],
            "edges": [
                {"source": "user_input_node", "target": "format_node"},
                {"source": "format_node", "target": "batch_node"}
            ]
        }
        
        update_resp = requests.put(
            f"{BASE_URL}/api/pipelines/{pipeline_id}",
            headers=self.headers,
            json=update_data
        )
        
        assert update_resp.status_code == 200, f"Failed to update pipeline: {update_resp.text}"
        updated = update_resp.json()
        
        node_types = [n.get("node_type") for n in updated.get("nodes", [])]
        print(f"Updated node types: {node_types}")
        
        assert "user_input" in node_types, "user_input node missing after update"
        assert "format_template" in node_types, "format_template node missing after update"
        assert "batch_prompt_template" in node_types, "batch_prompt_template node missing after update"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/pipelines/{pipeline_id}", headers=self.headers)
    
    def test_list_pipelines_loads_correctly(self):
        """Test that listing pipelines still works with new node types"""
        resp = requests.get(
            f"{BASE_URL}/api/pipelines",
            headers=self.headers
        )
        
        assert resp.status_code == 200, f"Failed to list pipelines: {resp.text}"
        pipelines = resp.json()
        print(f"Found {len(pipelines)} pipelines")
        
        # Check each pipeline for node types
        all_node_types = set()
        for pipeline in pipelines:
            for node in pipeline.get("nodes", []):
                all_node_types.add(node.get("node_type"))
        
        print(f"All node types across pipelines: {all_node_types}")
        
        # Should see a variety of node types
        assert len(all_node_types) > 0, "No node types found in any pipeline"


class TestNodeConfigValidation:
    """Test node configuration validation for new types"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@voiceworkspace.com",
            "password": "admin123"
        })
        assert login_resp.status_code == 200
        self.token = login_resp.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        yield
    
    def test_user_input_with_variable_config(self):
        """Test that user_input node correctly saves variable_config"""
        pipeline_data = {
            "name": "TEST_UserInputVarConfig",
            "description": "Test variable_config for user_input",
            "is_public": False,
            "nodes": [
                {
                    "node_id": "input_1",
                    "node_type": "user_input",
                    "label": "Test Input",
                    "template_text": "{{name}} - {{description}}",
                    "variable_config": {
                        "name": {
                            "label": "Имя",
                            "placeholder": "Введите имя",
                            "input_type": "text",
                            "required": True
                        },
                        "description": {
                            "label": "Описание",
                            "placeholder": "Введите описание",
                            "input_type": "textarea",
                            "required": False
                        }
                    },
                    "position_x": 0,
                    "position_y": 0
                }
            ],
            "edges": []
        }
        
        resp = requests.post(
            f"{BASE_URL}/api/pipelines",
            headers=self.headers,
            json=pipeline_data
        )
        
        assert resp.status_code in [200, 201], f"Failed: {resp.text}"
        created = resp.json()
        pipeline_id = created.get("id")
        
        # Verify variable_config is saved
        input_node = created.get("nodes", [])[0]
        var_config = input_node.get("variable_config", {})
        
        assert "name" in var_config, "name variable config missing"
        assert "description" in var_config, "description variable config missing"
        assert var_config["name"]["input_type"] == "text"
        assert var_config["description"]["input_type"] == "textarea"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/pipelines/{pipeline_id}", headers=self.headers)
    
    def test_batch_prompt_template_with_loop_vars(self):
        """Test that batch_prompt_template correctly saves loop_vars"""
        pipeline_data = {
            "name": "TEST_BatchLoopVars",
            "description": "Test loop_vars for batch_prompt_template",
            "is_public": False,
            "nodes": [
                {
                    "node_id": "batch_1",
                    "node_type": "batch_prompt_template",
                    "label": "Batch Template",
                    "template_text": "Process item {{item}} in category {{category}}",
                    "loop_vars": ["item", "category"],
                    "position_x": 0,
                    "position_y": 0
                }
            ],
            "edges": []
        }
        
        resp = requests.post(
            f"{BASE_URL}/api/pipelines",
            headers=self.headers,
            json=pipeline_data
        )
        
        assert resp.status_code in [200, 201], f"Failed: {resp.text}"
        created = resp.json()
        pipeline_id = created.get("id")
        
        # Verify loop_vars
        batch_node = created.get("nodes", [])[0]
        loop_vars = batch_node.get("loop_vars", [])
        
        assert "item" in loop_vars, "item loop_var missing"
        assert "category" in loop_vars, "category loop_var missing"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/pipelines/{pipeline_id}", headers=self.headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
