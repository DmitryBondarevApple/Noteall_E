"""
Test suite for "Move to folder" feature (Iteration 19)
Tests:
- PUT /api/projects/{id} with folder_id updates meeting project folder
- PUT /api/projects/{id} with folder_id: null moves to root
- PUT /api/doc/projects/{id} with folder_id updates document project folder
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://context-chat-7.preview.emergentagent.com')


class TestMoveProjectToFolder:
    """Test moving meeting projects between folders"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "test123"
        })
        assert resp.status_code == 200, f"Login failed: {resp.text}"
        self.token = resp.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
    def test_move_meeting_project_to_different_folder(self):
        """Test moving meeting project from one folder to another"""
        # Create two folders
        folder1_resp = requests.post(f"{BASE_URL}/api/meeting-folders", 
            headers=self.headers,
            json={"name": "TEST_MoveFolder1"})
        assert folder1_resp.status_code == 201
        folder1_id = folder1_resp.json()["id"]
        
        folder2_resp = requests.post(f"{BASE_URL}/api/meeting-folders", 
            headers=self.headers,
            json={"name": "TEST_MoveFolder2"})
        assert folder2_resp.status_code == 201
        folder2_id = folder2_resp.json()["id"]
        
        # Create project in folder1
        project_resp = requests.post(f"{BASE_URL}/api/projects", 
            headers=self.headers,
            json={"name": "TEST_MoveProject", "folder_id": folder1_id})
        assert project_resp.status_code == 200
        project_id = project_resp.json()["id"]
        assert project_resp.json()["folder_id"] == folder1_id
        
        # Move project to folder2
        update_resp = requests.put(f"{BASE_URL}/api/projects/{project_id}",
            headers=self.headers,
            json={"folder_id": folder2_id})
        assert update_resp.status_code == 200
        assert update_resp.json()["folder_id"] == folder2_id
        
        # Verify with GET
        get_resp = requests.get(f"{BASE_URL}/api/projects/{project_id}",
            headers=self.headers)
        assert get_resp.status_code == 200
        assert get_resp.json()["folder_id"] == folder2_id
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/projects/{project_id}", headers=self.headers)
        requests.delete(f"{BASE_URL}/api/meeting-folders/{folder2_id}", headers=self.headers)
        requests.delete(f"{BASE_URL}/api/meeting-folders/{folder1_id}", headers=self.headers)
        
    def test_move_meeting_project_to_root(self):
        """Test moving meeting project to root (null folder_id)"""
        # Create folder
        folder_resp = requests.post(f"{BASE_URL}/api/meeting-folders", 
            headers=self.headers,
            json={"name": "TEST_RootMoveFolder"})
        assert folder_resp.status_code == 201
        folder_id = folder_resp.json()["id"]
        
        # Create project in folder
        project_resp = requests.post(f"{BASE_URL}/api/projects", 
            headers=self.headers,
            json={"name": "TEST_RootMoveProject", "folder_id": folder_id})
        assert project_resp.status_code == 200
        project_id = project_resp.json()["id"]
        assert project_resp.json()["folder_id"] == folder_id
        
        # Move project to root (null folder_id)
        update_resp = requests.put(f"{BASE_URL}/api/projects/{project_id}",
            headers=self.headers,
            json={"folder_id": None})
        assert update_resp.status_code == 200
        assert update_resp.json()["folder_id"] is None
        
        # Verify with GET
        get_resp = requests.get(f"{BASE_URL}/api/projects/{project_id}",
            headers=self.headers)
        assert get_resp.status_code == 200
        assert get_resp.json()["folder_id"] is None
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/projects/{project_id}", headers=self.headers)
        requests.delete(f"{BASE_URL}/api/meeting-folders/{folder_id}", headers=self.headers)


class TestMoveDocProjectToFolder:
    """Test moving document projects between folders"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "test123"
        })
        assert resp.status_code == 200, f"Login failed: {resp.text}"
        self.token = resp.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
    def test_move_doc_project_to_different_folder(self):
        """Test moving document project from one folder to another"""
        # Create two folders
        folder1_resp = requests.post(f"{BASE_URL}/api/doc/folders", 
            headers=self.headers,
            json={"name": "TEST_DocMoveFolder1"})
        assert folder1_resp.status_code == 201
        folder1_id = folder1_resp.json()["id"]
        
        folder2_resp = requests.post(f"{BASE_URL}/api/doc/folders", 
            headers=self.headers,
            json={"name": "TEST_DocMoveFolder2"})
        assert folder2_resp.status_code == 201
        folder2_id = folder2_resp.json()["id"]
        
        # Create project in folder1
        project_resp = requests.post(f"{BASE_URL}/api/doc/projects", 
            headers=self.headers,
            json={"name": "TEST_DocMoveProject", "folder_id": folder1_id})
        assert project_resp.status_code == 201
        project_id = project_resp.json()["id"]
        assert project_resp.json()["folder_id"] == folder1_id
        
        # Move project to folder2
        update_resp = requests.put(f"{BASE_URL}/api/doc/projects/{project_id}",
            headers=self.headers,
            json={"folder_id": folder2_id})
        assert update_resp.status_code == 200
        assert update_resp.json()["folder_id"] == folder2_id
        
        # Verify with GET
        get_resp = requests.get(f"{BASE_URL}/api/doc/projects/{project_id}",
            headers=self.headers)
        assert get_resp.status_code == 200
        assert get_resp.json()["folder_id"] == folder2_id
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/doc/projects/{project_id}", headers=self.headers)
        requests.delete(f"{BASE_URL}/api/doc/folders/{folder2_id}", headers=self.headers)
        requests.delete(f"{BASE_URL}/api/doc/folders/{folder1_id}", headers=self.headers)
        
    def test_doc_project_update_preserves_other_fields(self):
        """Test that folder_id update doesn't affect other fields"""
        # Create folder
        folder_resp = requests.post(f"{BASE_URL}/api/doc/folders", 
            headers=self.headers,
            json={"name": "TEST_PreserveFolder"})
        folder_id = folder_resp.json()["id"]
        
        folder2_resp = requests.post(f"{BASE_URL}/api/doc/folders", 
            headers=self.headers,
            json={"name": "TEST_PreserveFolder2"})
        folder2_id = folder2_resp.json()["id"]
        
        # Create project with description
        project_resp = requests.post(f"{BASE_URL}/api/doc/projects", 
            headers=self.headers,
            json={
                "name": "TEST_PreserveProject", 
                "folder_id": folder_id,
                "description": "Test description"
            })
        project_id = project_resp.json()["id"]
        
        # Update only folder_id
        update_resp = requests.put(f"{BASE_URL}/api/doc/projects/{project_id}",
            headers=self.headers,
            json={"folder_id": folder2_id})
        assert update_resp.status_code == 200
        
        # Verify other fields preserved
        data = update_resp.json()
        assert data["folder_id"] == folder2_id
        assert data["name"] == "TEST_PreserveProject"
        assert data["description"] == "Test description"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/doc/projects/{project_id}", headers=self.headers)
        requests.delete(f"{BASE_URL}/api/doc/folders/{folder2_id}", headers=self.headers)
        requests.delete(f"{BASE_URL}/api/doc/folders/{folder_id}", headers=self.headers)
