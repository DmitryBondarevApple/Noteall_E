"""
Test Meeting Folders API and Navigation Restructuring Backend APIs
Tests for iteration 16 - Navigation and UX restructuring
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication for testing"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "test123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}


class TestMeetingFoldersAPI(TestAuth):
    """Meeting Folders CRUD API Tests"""
    
    created_folder_ids = []
    created_project_ids = []
    
    def test_create_folder(self, auth_headers):
        """POST /api/meeting-folders - create meeting folder"""
        response = requests.post(
            f"{BASE_URL}/api/meeting-folders",
            json={"name": "TEST_Folder_Root", "description": "Test root folder"},
            headers=auth_headers
        )
        assert response.status_code == 201, f"Create folder failed: {response.text}"
        data = response.json()
        assert data["name"] == "TEST_Folder_Root"
        assert data["description"] == "Test root folder"
        assert "id" in data
        assert data["parent_id"] is None
        self.__class__.created_folder_ids.append(data["id"])
        print(f"✓ Created folder: {data['id']}")
    
    def test_create_nested_folder(self, auth_headers):
        """POST /api/meeting-folders - create nested folder"""
        parent_id = self.__class__.created_folder_ids[0]
        response = requests.post(
            f"{BASE_URL}/api/meeting-folders",
            json={"name": "TEST_Folder_Nested", "parent_id": parent_id},
            headers=auth_headers
        )
        assert response.status_code == 201, f"Create nested folder failed: {response.text}"
        data = response.json()
        assert data["name"] == "TEST_Folder_Nested"
        assert data["parent_id"] == parent_id
        self.__class__.created_folder_ids.append(data["id"])
        print(f"✓ Created nested folder: {data['id']}")
    
    def test_create_folder_invalid_parent(self, auth_headers):
        """POST /api/meeting-folders - fail with invalid parent_id"""
        response = requests.post(
            f"{BASE_URL}/api/meeting-folders",
            json={"name": "TEST_Invalid", "parent_id": "nonexistent-id"},
            headers=auth_headers
        )
        assert response.status_code == 404, f"Should fail with 404: {response.text}"
        print("✓ Invalid parent_id returns 404")
    
    def test_list_folders(self, auth_headers):
        """GET /api/meeting-folders - list meeting folders"""
        response = requests.get(
            f"{BASE_URL}/api/meeting-folders",
            headers=auth_headers
        )
        assert response.status_code == 200, f"List folders failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        # Verify our test folders are present
        folder_names = [f["name"] for f in data]
        assert "TEST_Folder_Root" in folder_names
        print(f"✓ Listed {len(data)} folders")
    
    def test_update_folder(self, auth_headers):
        """PUT /api/meeting-folders/{id} - update folder"""
        folder_id = self.__class__.created_folder_ids[0]
        response = requests.put(
            f"{BASE_URL}/api/meeting-folders/{folder_id}",
            json={"name": "TEST_Folder_Root_Updated", "description": "Updated desc"},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Update folder failed: {response.text}"
        data = response.json()
        assert data["name"] == "TEST_Folder_Root_Updated"
        assert data["description"] == "Updated desc"
        print(f"✓ Updated folder: {folder_id}")
    
    def test_update_nonexistent_folder(self, auth_headers):
        """PUT /api/meeting-folders/{id} - fail with nonexistent folder"""
        response = requests.put(
            f"{BASE_URL}/api/meeting-folders/nonexistent-id",
            json={"name": "Test"},
            headers=auth_headers
        )
        assert response.status_code == 404, f"Should fail with 404: {response.text}"
        print("✓ Nonexistent folder update returns 404")
    
    def test_delete_folder_not_empty_nested(self, auth_headers):
        """DELETE /api/meeting-folders/{id} - fail if folder has children"""
        # Try to delete parent folder which has nested folder
        parent_id = self.__class__.created_folder_ids[0]
        response = requests.delete(
            f"{BASE_URL}/api/meeting-folders/{parent_id}",
            headers=auth_headers
        )
        assert response.status_code == 400, f"Should fail with 400: {response.text}"
        assert "not empty" in response.json().get("detail", "").lower()
        print("✓ Delete folder with children returns 400")


class TestProjectsWithFolder(TestAuth):
    """Test Projects API with folder_id"""
    
    folder_id = None
    project_id = None
    
    def test_create_project_in_folder(self, auth_headers):
        """POST /api/projects with folder_id - creates project in folder"""
        # First create a folder
        folder_resp = requests.post(
            f"{BASE_URL}/api/meeting-folders",
            json={"name": "TEST_Project_Folder"},
            headers=auth_headers
        )
        assert folder_resp.status_code == 201
        self.__class__.folder_id = folder_resp.json()["id"]
        
        # Create project in folder
        response = requests.post(
            f"{BASE_URL}/api/projects",
            json={
                "name": "TEST_Project_In_Folder",
                "description": "Test project",
                "folder_id": self.__class__.folder_id
            },
            headers=auth_headers
        )
        assert response.status_code == 200, f"Create project failed: {response.text}"
        data = response.json()
        assert data["name"] == "TEST_Project_In_Folder"
        assert data["folder_id"] == self.__class__.folder_id
        self.__class__.project_id = data["id"]
        print(f"✓ Created project in folder: {data['id']}")
    
    def test_list_projects_by_folder(self, auth_headers):
        """GET /api/projects?folder_id=xxx - filters projects by folder"""
        response = requests.get(
            f"{BASE_URL}/api/projects",
            params={"folder_id": self.__class__.folder_id},
            headers=auth_headers
        )
        assert response.status_code == 200, f"List projects failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        # Should only contain our test project
        project_names = [p["name"] for p in data]
        assert "TEST_Project_In_Folder" in project_names
        # All projects should have our folder_id
        for p in data:
            assert p.get("folder_id") == self.__class__.folder_id
        print(f"✓ Listed {len(data)} projects in folder")
    
    def test_delete_folder_not_empty_project(self, auth_headers):
        """DELETE /api/meeting-folders/{id} - fail if folder has projects"""
        response = requests.delete(
            f"{BASE_URL}/api/meeting-folders/{self.__class__.folder_id}",
            headers=auth_headers
        )
        assert response.status_code == 400, f"Should fail with 400: {response.text}"
        assert "not empty" in response.json().get("detail", "").lower()
        print("✓ Delete folder with projects returns 400")
    
    def test_cleanup_project(self, auth_headers):
        """Cleanup test project"""
        if self.__class__.project_id:
            response = requests.delete(
                f"{BASE_URL}/api/projects/{self.__class__.project_id}",
                headers=auth_headers
            )
            assert response.status_code == 200
            print(f"✓ Deleted project: {self.__class__.project_id}")
    
    def test_cleanup_folder_now_empty(self, auth_headers):
        """DELETE /api/meeting-folders/{id} - succeed when empty"""
        if self.__class__.folder_id:
            response = requests.delete(
                f"{BASE_URL}/api/meeting-folders/{self.__class__.folder_id}",
                headers=auth_headers
            )
            assert response.status_code == 200, f"Delete empty folder failed: {response.text}"
            print(f"✓ Deleted empty folder: {self.__class__.folder_id}")


class TestCleanup(TestAuth):
    """Cleanup test data"""
    
    def test_cleanup_nested_folder(self, auth_headers):
        """Delete nested folder first"""
        if len(TestMeetingFoldersAPI.created_folder_ids) > 1:
            nested_id = TestMeetingFoldersAPI.created_folder_ids[1]
            response = requests.delete(
                f"{BASE_URL}/api/meeting-folders/{nested_id}",
                headers=auth_headers
            )
            assert response.status_code == 200
            print(f"✓ Deleted nested folder: {nested_id}")
    
    def test_cleanup_root_folder(self, auth_headers):
        """Delete root folder"""
        if len(TestMeetingFoldersAPI.created_folder_ids) > 0:
            root_id = TestMeetingFoldersAPI.created_folder_ids[0]
            response = requests.delete(
                f"{BASE_URL}/api/meeting-folders/{root_id}",
                headers=auth_headers
            )
            assert response.status_code == 200
            print(f"✓ Deleted root folder: {root_id}")


class TestExistingAPIs(TestAuth):
    """Test existing APIs still work after restructuring"""
    
    def test_pipelines_api(self, auth_headers):
        """GET /api/pipelines - still works"""
        response = requests.get(
            f"{BASE_URL}/api/pipelines",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Pipelines API failed: {response.text}"
        print(f"✓ Pipelines API works")
    
    def test_prompts_api(self, auth_headers):
        """GET /api/prompts - still works"""
        response = requests.get(
            f"{BASE_URL}/api/prompts",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Prompts API failed: {response.text}"
        print(f"✓ Prompts API works")
    
    def test_speaker_directory_api(self, auth_headers):
        """GET /api/speaker-directory - still works"""
        response = requests.get(
            f"{BASE_URL}/api/speaker-directory",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Speaker directory API failed: {response.text}"
        print(f"✓ Speaker directory API works")
    
    def test_health_endpoint(self):
        """GET /api/health - still works"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        print("✓ Health endpoint works")
