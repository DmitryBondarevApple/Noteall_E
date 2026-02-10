"""
Document Agent Phase 3 - Templates and Pins API Tests
Tests: seed-templates, templates CRUD, pins CRUD, pins reorder
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

# Test credentials
TEST_USER = {"email": "test@example.com", "password": "test123"}

@pytest.fixture(scope="module")
def auth_token():
    """Get auth token for test user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USER)
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Authentication failed: {response.status_code} {response.text}")

@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Auth headers for authenticated requests"""
    return {"Authorization": f"Bearer {auth_token}"}

@pytest.fixture(scope="module")
def test_project(auth_headers):
    """Get or create a test project for pins testing"""
    # First get folders
    folders_res = requests.get(f"{BASE_URL}/api/doc/folders", headers=auth_headers)
    assert folders_res.status_code == 200
    folders = folders_res.json()
    
    # Use existing folder or create one
    if folders:
        folder_id = folders[0]["id"]
    else:
        folder_res = requests.post(f"{BASE_URL}/api/doc/folders", 
            headers=auth_headers, json={"name": "TEST_Phase3Folder"})
        assert folder_res.status_code == 201
        folder_id = folder_res.json()["id"]
    
    # Create test project for pins
    project_res = requests.post(f"{BASE_URL}/api/doc/projects",
        headers=auth_headers, json={
            "name": "TEST_Phase3Project",
            "folder_id": folder_id
        })
    assert project_res.status_code == 201
    project = project_res.json()
    
    yield project
    
    # Cleanup
    requests.delete(f"{BASE_URL}/api/doc/projects/{project['id']}", headers=auth_headers)

@pytest.fixture(scope="module")
def test_stream(auth_headers, test_project):
    """Create a test stream for pin testing"""
    stream_res = requests.post(f"{BASE_URL}/api/doc/projects/{test_project['id']}/streams",
        headers=auth_headers, json={
            "name": "TEST_Phase3Stream",
            "system_prompt": "Test prompt"
        })
    assert stream_res.status_code == 201
    stream = stream_res.json()
    
    yield stream
    
    # Cleanup
    requests.delete(f"{BASE_URL}/api/doc/projects/{test_project['id']}/streams/{stream['id']}", headers=auth_headers)


class TestSeedTemplates:
    """Tests for POST /api/doc/seed-templates"""
    
    def test_seed_templates_success(self, auth_headers):
        """Test seeding default templates"""
        response = requests.post(f"{BASE_URL}/api/doc/seed-templates", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        # Either creates templates or says they already exist
        assert "message" in data
        assert data["message"] in ["Seeded", "Templates already exist"]
    
    def test_seed_templates_idempotent(self, auth_headers):
        """Test that seeding is idempotent - second call doesn't duplicate"""
        # First call
        response1 = requests.post(f"{BASE_URL}/api/doc/seed-templates", headers=auth_headers)
        assert response1.status_code == 200
        
        # Second call
        response2 = requests.post(f"{BASE_URL}/api/doc/seed-templates", headers=auth_headers)
        assert response2.status_code == 200
        data = response2.json()
        # Should say already exist
        assert "count" in data


class TestTemplatesAPI:
    """Tests for GET /api/doc/templates"""
    
    def test_list_templates_returns_seeded(self, auth_headers):
        """Test that list templates returns seeded templates"""
        # Ensure templates are seeded
        requests.post(f"{BASE_URL}/api/doc/seed-templates", headers=auth_headers)
        
        response = requests.get(f"{BASE_URL}/api/doc/templates", headers=auth_headers)
        assert response.status_code == 200
        templates = response.json()
        
        assert isinstance(templates, list)
        assert len(templates) >= 5  # At least the 5 seeded templates
        
        # Check expected template names
        template_names = [t["name"] for t in templates]
        expected_names = [
            "Резюме документа",
            "Анализ рисков", 
            "Извлечение фактов",
            "Вопросы на уточнение",
            "Сравнение версий"
        ]
        for name in expected_names:
            assert name in template_names, f"Expected template '{name}' not found"
    
    def test_templates_have_system_prompt(self, auth_headers):
        """Test that templates have system_prompt field for stream pre-fill"""
        # Ensure templates are seeded
        requests.post(f"{BASE_URL}/api/doc/seed-templates", headers=auth_headers)
        
        response = requests.get(f"{BASE_URL}/api/doc/templates", headers=auth_headers)
        assert response.status_code == 200
        templates = response.json()
        
        for template in templates:
            assert "id" in template
            assert "name" in template
            assert "system_prompt" in template, f"Template '{template['name']}' missing system_prompt"
            # System prompt should not be empty for seeded templates
            if template["name"] in ["Резюме документа", "Анализ рисков"]:
                assert template["system_prompt"], f"Template '{template['name']}' has empty system_prompt"


class TestPinsCRUD:
    """Tests for Pins CRUD operations"""
    
    def test_create_pin_success(self, auth_headers, test_project, test_stream):
        """Test creating a pin from stream message"""
        pin_data = {
            "stream_id": test_stream["id"],
            "message_index": 0,
            "content": "TEST_Pin content from AI response"
        }
        response = requests.post(f"{BASE_URL}/api/doc/projects/{test_project['id']}/pins",
            headers=auth_headers, json=pin_data)
        
        assert response.status_code == 201
        pin = response.json()
        
        assert "id" in pin
        assert pin["stream_id"] == test_stream["id"]
        assert pin["message_index"] == 0
        assert pin["content"] == "TEST_Pin content from AI response"
        assert "order" in pin
        assert "created_at" in pin
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/doc/projects/{test_project['id']}/pins/{pin['id']}", headers=auth_headers)
    
    def test_list_pins_sorted_by_order(self, auth_headers, test_project, test_stream):
        """Test that pins are returned sorted by order"""
        # Create multiple pins
        pins_created = []
        for i in range(3):
            pin_res = requests.post(f"{BASE_URL}/api/doc/projects/{test_project['id']}/pins",
                headers=auth_headers, json={
                    "stream_id": test_stream["id"],
                    "message_index": i,
                    "content": f"TEST_Pin content {i}"
                })
            assert pin_res.status_code == 201
            pins_created.append(pin_res.json())
        
        # List pins
        response = requests.get(f"{BASE_URL}/api/doc/projects/{test_project['id']}/pins",
            headers=auth_headers)
        assert response.status_code == 200
        pins = response.json()
        
        # Verify sorted by order (ascending)
        for i in range(len(pins) - 1):
            assert pins[i]["order"] <= pins[i+1]["order"], "Pins not sorted by order"
        
        # Cleanup
        for pin in pins_created:
            requests.delete(f"{BASE_URL}/api/doc/projects/{test_project['id']}/pins/{pin['id']}", headers=auth_headers)
    
    def test_update_pin_content(self, auth_headers, test_project, test_stream):
        """Test updating pin content"""
        # Create pin
        pin_res = requests.post(f"{BASE_URL}/api/doc/projects/{test_project['id']}/pins",
            headers=auth_headers, json={
                "stream_id": test_stream["id"],
                "message_index": 0,
                "content": "Original content"
            })
        assert pin_res.status_code == 201
        pin = pin_res.json()
        
        # Update pin
        update_res = requests.put(f"{BASE_URL}/api/doc/projects/{test_project['id']}/pins/{pin['id']}",
            headers=auth_headers, json={"content": "Updated content"})
        assert update_res.status_code == 200
        updated = update_res.json()
        assert updated["content"] == "Updated content"
        
        # Verify via GET
        list_res = requests.get(f"{BASE_URL}/api/doc/projects/{test_project['id']}/pins", headers=auth_headers)
        pins = list_res.json()
        found = next((p for p in pins if p["id"] == pin["id"]), None)
        assert found is not None
        assert found["content"] == "Updated content"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/doc/projects/{test_project['id']}/pins/{pin['id']}", headers=auth_headers)
    
    def test_delete_pin(self, auth_headers, test_project, test_stream):
        """Test deleting a pin"""
        # Create pin
        pin_res = requests.post(f"{BASE_URL}/api/doc/projects/{test_project['id']}/pins",
            headers=auth_headers, json={
                "stream_id": test_stream["id"],
                "message_index": 0,
                "content": "TEST_To be deleted"
            })
        assert pin_res.status_code == 201
        pin_id = pin_res.json()["id"]
        
        # Delete pin
        delete_res = requests.delete(f"{BASE_URL}/api/doc/projects/{test_project['id']}/pins/{pin_id}",
            headers=auth_headers)
        assert delete_res.status_code == 200
        
        # Verify deleted - GET should not include this pin
        list_res = requests.get(f"{BASE_URL}/api/doc/projects/{test_project['id']}/pins", headers=auth_headers)
        pins = list_res.json()
        assert not any(p["id"] == pin_id for p in pins)
    
    def test_pin_not_found(self, auth_headers, test_project):
        """Test 404 for non-existent pin"""
        response = requests.put(f"{BASE_URL}/api/doc/projects/{test_project['id']}/pins/non-existent-id",
            headers=auth_headers, json={"content": "test"})
        assert response.status_code == 404


class TestPinsReorder:
    """Tests for POST /api/doc/projects/{id}/pins/reorder"""
    
    def test_reorder_pins(self, auth_headers, test_project, test_stream):
        """Test reordering pins by pin_ids array"""
        # Create 3 pins
        pins_created = []
        for i in range(3):
            pin_res = requests.post(f"{BASE_URL}/api/doc/projects/{test_project['id']}/pins",
                headers=auth_headers, json={
                    "stream_id": test_stream["id"],
                    "message_index": i,
                    "content": f"TEST_Reorder Pin {i}"
                })
            assert pin_res.status_code == 201
            pins_created.append(pin_res.json())
        
        # Original order: 0, 1, 2
        original_ids = [p["id"] for p in pins_created]
        
        # Reorder to: 2, 0, 1
        new_order = [original_ids[2], original_ids[0], original_ids[1]]
        
        reorder_res = requests.post(f"{BASE_URL}/api/doc/projects/{test_project['id']}/pins/reorder",
            headers=auth_headers, json={"pin_ids": new_order})
        assert reorder_res.status_code == 200
        
        # Verify new order via GET
        list_res = requests.get(f"{BASE_URL}/api/doc/projects/{test_project['id']}/pins",
            headers=auth_headers)
        pins = list_res.json()
        
        # Filter only test pins
        test_pins = [p for p in pins if "TEST_Reorder Pin" in p["content"]]
        test_pins_sorted = sorted(test_pins, key=lambda x: x["order"])
        
        assert len(test_pins_sorted) >= 3
        # First pin should now be the one with content "TEST_Reorder Pin 2"
        assert "TEST_Reorder Pin 2" in test_pins_sorted[0]["content"]
        
        # Cleanup
        for pin in pins_created:
            requests.delete(f"{BASE_URL}/api/doc/projects/{test_project['id']}/pins/{pin['id']}", headers=auth_headers)


class TestPinsErrorHandling:
    """Test error cases for pins API"""
    
    def test_create_pin_project_not_found(self, auth_headers):
        """Test 404 when project doesn't exist"""
        response = requests.post(f"{BASE_URL}/api/doc/projects/non-existent-project/pins",
            headers=auth_headers, json={
                "stream_id": "some-stream",
                "message_index": 0,
                "content": "test"
            })
        assert response.status_code == 404
    
    def test_list_pins_project_not_found(self, auth_headers):
        """Test 404 when listing pins for non-existent project"""
        response = requests.get(f"{BASE_URL}/api/doc/projects/non-existent-project/pins",
            headers=auth_headers)
        assert response.status_code == 404
    
    def test_delete_pin_not_found(self, auth_headers, test_project):
        """Test 404 when deleting non-existent pin"""
        response = requests.delete(f"{BASE_URL}/api/doc/projects/{test_project['id']}/pins/non-existent-pin",
            headers=auth_headers)
        assert response.status_code == 404


class TestTemplatePreFill:
    """Test that templates contain correct data for stream pre-fill"""
    
    def test_template_structure_for_ui(self, auth_headers):
        """Test template structure matches frontend expectations"""
        # Seed first
        requests.post(f"{BASE_URL}/api/doc/seed-templates", headers=auth_headers)
        
        response = requests.get(f"{BASE_URL}/api/doc/templates", headers=auth_headers)
        assert response.status_code == 200
        templates = response.json()
        
        for template in templates:
            # All fields needed by frontend
            assert "id" in template
            assert "name" in template  # Used for stream name pre-fill
            assert "description" in template  # Shown in dropdown
            assert "system_prompt" in template  # Used for stream system_prompt pre-fill
            assert "is_public" in template


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
