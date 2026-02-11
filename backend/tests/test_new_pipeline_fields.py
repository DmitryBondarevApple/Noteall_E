"""
Test for new pipeline fields: loop_vars and prompt_source_node
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestNewPipelineFields:
    """Test new fields: loop_vars for template nodes, prompt_source_node for batch_loop nodes"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@voiceworkspace.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_pipeline_has_new_fields(self):
        """Verify existing pipeline returns loop_vars and prompt_source_node fields"""
        # Get the first pipeline (Автоанализ транскрипта)
        response = requests.get(f"{BASE_URL}/api/pipelines", headers=self.headers)
        assert response.status_code == 200
        
        pipelines = response.json()
        assert len(pipelines) > 0, "No pipelines found"
        
        pipeline_id = pipelines[0]["id"]
        
        # Get pipeline details
        response = requests.get(f"{BASE_URL}/api/pipelines/{pipeline_id}", headers=self.headers)
        assert response.status_code == 200
        pipeline = response.json()
        
        print(f"Pipeline: {pipeline['name']}")
        print(f"Nodes count: {len(pipeline['nodes'])}")
        
        # Check nodes for new fields
        for node in pipeline['nodes']:
            node_type = node.get('node_type')
            node_label = node.get('label', '')[:40]
            
            if node_type == 'template':
                # Template nodes should have loop_vars field (can be null or list)
                assert 'loop_vars' in node or node.get('loop_vars') is None, f"Template node missing loop_vars: {node_label}"
                print(f"Template node '{node_label}': loop_vars = {node.get('loop_vars')}")
            
            if node_type == 'batch_loop':
                # batch_loop nodes should have prompt_source_node field (can be null or string)
                assert 'prompt_source_node' in node or node.get('prompt_source_node') is None, f"batch_loop node missing prompt_source_node: {node_label}"
                print(f"batch_loop node '{node_label}': prompt_source_node = {node.get('prompt_source_node')}")
    
    def test_create_pipeline_with_new_fields(self):
        """Create pipeline with loop_vars and prompt_source_node"""
        test_pipeline = {
            "name": "TEST_Pipeline_NewFields",
            "description": "Test pipeline with new fields",
            "nodes": [
                {
                    "node_id": "template_1",
                    "node_type": "template",
                    "label": "Test Template",
                    "template_text": "Process {{item}}",
                    "loop_vars": ["item"],  # NEW FIELD
                    "position_x": 0,
                    "position_y": 0
                },
                {
                    "node_id": "batch_1",
                    "node_type": "batch_loop",
                    "label": "Test Batch Loop",
                    "batch_size": 3,
                    "prompt_source_node": "template_1",  # NEW FIELD
                    "position_x": 200,
                    "position_y": 0
                }
            ],
            "edges": [
                {"source": "template_1", "target": "batch_1"}
            ],
            "is_public": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/pipelines",
            json=test_pipeline,
            headers=self.headers
        )
        
        print(f"Create response status: {response.status_code}")
        if response.status_code != 200 and response.status_code != 201:
            print(f"Error: {response.text}")
        
        assert response.status_code in [200, 201], f"Failed to create pipeline: {response.text}"
        
        created = response.json()
        pipeline_id = created['id']
        print(f"Created pipeline ID: {pipeline_id}")
        
        # Verify fields were saved correctly
        template_node = next((n for n in created['nodes'] if n['node_type'] == 'template'), None)
        batch_node = next((n for n in created['nodes'] if n['node_type'] == 'batch_loop'), None)
        
        assert template_node is not None, "Template node not found in response"
        assert batch_node is not None, "batch_loop node not found in response"
        
        # Check loop_vars
        assert template_node.get('loop_vars') == ["item"], f"loop_vars mismatch: {template_node.get('loop_vars')}"
        print(f"✓ loop_vars saved correctly: {template_node.get('loop_vars')}")
        
        # Check prompt_source_node
        assert batch_node.get('prompt_source_node') == "template_1", f"prompt_source_node mismatch: {batch_node.get('prompt_source_node')}"
        print(f"✓ prompt_source_node saved correctly: {batch_node.get('prompt_source_node')}")
        
        # Cleanup - delete test pipeline
        delete_response = requests.delete(f"{BASE_URL}/api/pipelines/{pipeline_id}", headers=self.headers)
        assert delete_response.status_code in [200, 204], f"Failed to delete test pipeline: {delete_response.text}"
        print(f"✓ Test pipeline cleaned up")

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
