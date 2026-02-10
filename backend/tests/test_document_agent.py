"""
Test Document Agent API endpoints:
- Folders CRUD (hierarchical tree structure)
- Doc Projects CRUD
- Doc Attachments (file upload, URL)
- Templates CRUD
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="module")
def auth_token(api_client):
    """Get authentication token by registering/logging in test user"""
    # First try to register
    register_res = api_client.post(f"{BASE_URL}/api/auth/register", json={
        "email": "doctest@example.com",
        "password": "doctest123",
        "name": "Doc Test User"
    })
    
    if register_res.status_code in [200, 201]:
        return register_res.json().get("access_token")
    
    # If registration fails (user exists), try login
    login_res = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": "doctest@example.com",
        "password": "doctest123"
    })
    
    if login_res.status_code == 200:
        return login_res.json().get("access_token")
    
    # Try default test user
    login_res = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": "test@example.com",
        "password": "test123"
    })
    
    if login_res.status_code == 200:
        return login_res.json().get("access_token")
    
    pytest.skip(f"Authentication failed - {login_res.status_code}: {login_res.text}")

@pytest.fixture(scope="module")
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


class TestHealthCheck:
    """Basic health check to verify API is running"""
    
    def test_api_health(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("Health check PASSED")


class TestDocFolders:
    """Test folder CRUD operations for hierarchical structure"""
    
    created_folder_id = None
    subfolder_id = None
    
    def test_create_folder(self, authenticated_client):
        """POST /api/doc/folders - create folder"""
        response = authenticated_client.post(f"{BASE_URL}/api/doc/folders", json={
            "name": "TEST_TestFolder",
            "description": "Test folder for document agent"
        })
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["name"] == "TEST_TestFolder"
        assert data["description"] == "Test folder for document agent"
        assert data["parent_id"] is None  # Root folder
        TestDocFolders.created_folder_id = data["id"]
        print(f"Folder created with id: {data['id']}")
    
    def test_list_folders(self, authenticated_client):
        """GET /api/doc/folders - list all folders"""
        response = authenticated_client.get(f"{BASE_URL}/api/doc/folders")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Find our test folder
        test_folder = next((f for f in data if f["id"] == TestDocFolders.created_folder_id), None)
        assert test_folder is not None, "Created folder not found in list"
        print(f"Found {len(data)} folders")
    
    def test_create_nested_folder(self, authenticated_client):
        """POST /api/doc/folders - create subfolder"""
        assert TestDocFolders.created_folder_id, "Parent folder not created"
        response = authenticated_client.post(f"{BASE_URL}/api/doc/folders", json={
            "name": "TEST_SubFolder",
            "parent_id": TestDocFolders.created_folder_id,
            "description": "Nested test folder"
        })
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["parent_id"] == TestDocFolders.created_folder_id
        TestDocFolders.subfolder_id = data["id"]
        print(f"Subfolder created with id: {data['id']}, parent: {data['parent_id']}")
    
    def test_update_folder(self, authenticated_client):
        """PUT /api/doc/folders/{id} - update folder"""
        assert TestDocFolders.created_folder_id, "Folder not created"
        response = authenticated_client.put(
            f"{BASE_URL}/api/doc/folders/{TestDocFolders.created_folder_id}",
            json={"name": "TEST_UpdatedFolder", "description": "Updated description"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["name"] == "TEST_UpdatedFolder"
        assert data["description"] == "Updated description"
        print("Folder updated successfully")
    
    def test_delete_nonempty_folder_fails(self, authenticated_client):
        """DELETE /api/doc/folders/{id} - should fail if folder has subfolders"""
        assert TestDocFolders.created_folder_id, "Folder not created"
        assert TestDocFolders.subfolder_id, "Subfolder not created"
        response = authenticated_client.delete(f"{BASE_URL}/api/doc/folders/{TestDocFolders.created_folder_id}")
        assert response.status_code == 400, f"Expected 400 for non-empty folder, got {response.status_code}"
        print("Non-empty folder deletion correctly blocked")
    
    def test_delete_subfolder(self, authenticated_client):
        """DELETE /api/doc/folders/{id} - delete empty subfolder"""
        assert TestDocFolders.subfolder_id, "Subfolder not created"
        response = authenticated_client.delete(f"{BASE_URL}/api/doc/folders/{TestDocFolders.subfolder_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("Subfolder deleted successfully")
        TestDocFolders.subfolder_id = None
    
    def test_delete_folder(self, authenticated_client):
        """DELETE /api/doc/folders/{id} - delete now-empty folder"""
        assert TestDocFolders.created_folder_id, "Folder not created"
        response = authenticated_client.delete(f"{BASE_URL}/api/doc/folders/{TestDocFolders.created_folder_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("Folder deleted successfully")
        TestDocFolders.created_folder_id = None


class TestDocProjects:
    """Test doc project CRUD operations"""
    
    folder_id = None
    project_id = None
    
    def test_create_folder_for_projects(self, authenticated_client):
        """Create a folder to hold projects"""
        response = authenticated_client.post(f"{BASE_URL}/api/doc/folders", json={
            "name": "TEST_ProjectsFolder"
        })
        assert response.status_code == 201
        TestDocProjects.folder_id = response.json()["id"]
        print(f"Folder for projects created: {TestDocProjects.folder_id}")
    
    def test_create_project(self, authenticated_client):
        """POST /api/doc/projects - create project in folder"""
        assert TestDocProjects.folder_id, "Folder not created"
        response = authenticated_client.post(f"{BASE_URL}/api/doc/projects", json={
            "name": "TEST_DocumentProject",
            "folder_id": TestDocProjects.folder_id,
            "description": "Test document analysis project",
            "system_instruction": "Analyze this document thoroughly"
        })
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["name"] == "TEST_DocumentProject"
        assert data["folder_id"] == TestDocProjects.folder_id
        assert data["status"] == "draft"
        TestDocProjects.project_id = data["id"]
        print(f"Project created: {data['id']}")
    
    def test_create_project_invalid_folder_fails(self, authenticated_client):
        """POST /api/doc/projects - should fail with invalid folder_id"""
        response = authenticated_client.post(f"{BASE_URL}/api/doc/projects", json={
            "name": "Invalid Project",
            "folder_id": "nonexistent-folder-id"
        })
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Invalid folder correctly rejected")
    
    def test_list_projects(self, authenticated_client):
        """GET /api/doc/projects - list all projects"""
        response = authenticated_client.get(f"{BASE_URL}/api/doc/projects")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        test_project = next((p for p in data if p["id"] == TestDocProjects.project_id), None)
        assert test_project is not None
        print(f"Found {len(data)} projects")
    
    def test_list_projects_filtered_by_folder(self, authenticated_client):
        """GET /api/doc/projects?folder_id=X - filter by folder"""
        response = authenticated_client.get(
            f"{BASE_URL}/api/doc/projects",
            params={"folder_id": TestDocProjects.folder_id}
        )
        assert response.status_code == 200
        data = response.json()
        assert all(p["folder_id"] == TestDocProjects.folder_id for p in data)
        print(f"Filtered projects: {len(data)}")
    
    def test_get_project_with_attachments(self, authenticated_client):
        """GET /api/doc/projects/{id} - get project with attachments list"""
        assert TestDocProjects.project_id, "Project not created"
        response = authenticated_client.get(f"{BASE_URL}/api/doc/projects/{TestDocProjects.project_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == TestDocProjects.project_id
        assert "attachments" in data
        assert isinstance(data["attachments"], list)
        print(f"Project retrieved with {len(data['attachments'])} attachments")
    
    def test_update_project(self, authenticated_client):
        """PUT /api/doc/projects/{id} - update project"""
        assert TestDocProjects.project_id, "Project not created"
        response = authenticated_client.put(
            f"{BASE_URL}/api/doc/projects/{TestDocProjects.project_id}",
            json={
                "name": "TEST_UpdatedProject",
                "description": "Updated description",
                "status": "in_progress"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["name"] == "TEST_UpdatedProject"
        assert data["status"] == "in_progress"
        print("Project updated successfully")


class TestDocAttachments:
    """Test doc attachments (file upload and URL)"""
    
    url_attachment_id = None
    
    def test_add_url_attachment(self, authenticated_client):
        """POST /api/doc/projects/{id}/attachments/url - add URL attachment"""
        assert TestDocProjects.project_id, "Project not created"
        response = authenticated_client.post(
            f"{BASE_URL}/api/doc/projects/{TestDocProjects.project_id}/attachments/url",
            json={
                "url": "https://example.com/test-doc.pdf",
                "name": "Test Document Link"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["file_type"] == "url"
        assert data["name"] == "Test Document Link"
        assert data["source_url"] == "https://example.com/test-doc.pdf"
        TestDocAttachments.url_attachment_id = data["id"]
        print(f"URL attachment created: {data['id']}")
    
    def test_verify_attachment_in_project(self, authenticated_client):
        """GET /api/doc/projects/{id} - verify attachment appears in project"""
        assert TestDocProjects.project_id, "Project not created"
        response = authenticated_client.get(f"{BASE_URL}/api/doc/projects/{TestDocProjects.project_id}")
        assert response.status_code == 200
        data = response.json()
        attachments = data.get("attachments", [])
        assert len(attachments) > 0, "No attachments found"
        url_att = next((a for a in attachments if a["id"] == TestDocAttachments.url_attachment_id), None)
        assert url_att is not None, "URL attachment not found in project"
        print(f"Verified attachment in project, total: {len(attachments)}")
    
    def test_delete_attachment(self, authenticated_client):
        """DELETE /api/doc/projects/{id}/attachments/{att_id} - delete attachment"""
        assert TestDocProjects.project_id, "Project not created"
        assert TestDocAttachments.url_attachment_id, "Attachment not created"
        response = authenticated_client.delete(
            f"{BASE_URL}/api/doc/projects/{TestDocProjects.project_id}/attachments/{TestDocAttachments.url_attachment_id}"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("Attachment deleted successfully")
        TestDocAttachments.url_attachment_id = None


class TestDocTemplates:
    """Test doc templates CRUD operations"""
    
    template_id = None
    
    def test_create_template(self, authenticated_client):
        """POST /api/doc/templates - create template"""
        response = authenticated_client.post(f"{BASE_URL}/api/doc/templates", json={
            "name": "TEST_DocTemplate",
            "description": "Test document template",
            "sections": [
                {"title": "Introduction", "description": "Overview section"},
                {"title": "Analysis", "description": "Main analysis", "subsections": [
                    {"title": "Part A"},
                    {"title": "Part B"}
                ]}
            ]
        })
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["name"] == "TEST_DocTemplate"
        assert len(data["sections"]) == 2
        TestDocTemplates.template_id = data["id"]
        print(f"Template created: {data['id']}")
    
    def test_list_templates(self, authenticated_client):
        """GET /api/doc/templates - list templates"""
        response = authenticated_client.get(f"{BASE_URL}/api/doc/templates")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        test_template = next((t for t in data if t["id"] == TestDocTemplates.template_id), None)
        assert test_template is not None
        print(f"Found {len(data)} templates")
    
    def test_update_template(self, authenticated_client):
        """PUT /api/doc/templates/{id} - update template"""
        assert TestDocTemplates.template_id, "Template not created"
        response = authenticated_client.put(
            f"{BASE_URL}/api/doc/templates/{TestDocTemplates.template_id}",
            json={
                "name": "TEST_UpdatedTemplate",
                "description": "Updated template description"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["name"] == "TEST_UpdatedTemplate"
        print("Template updated successfully")
    
    def test_delete_template(self, authenticated_client):
        """DELETE /api/doc/templates/{id} - delete template"""
        assert TestDocTemplates.template_id, "Template not created"
        response = authenticated_client.delete(f"{BASE_URL}/api/doc/templates/{TestDocTemplates.template_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("Template deleted successfully")
        TestDocTemplates.template_id = None


class TestCleanup:
    """Cleanup test data"""
    
    def test_delete_project(self, authenticated_client):
        """Delete test project"""
        if TestDocProjects.project_id:
            response = authenticated_client.delete(f"{BASE_URL}/api/doc/projects/{TestDocProjects.project_id}")
            assert response.status_code == 200
            print("Test project deleted")
    
    def test_delete_folder(self, authenticated_client):
        """Delete test folder"""
        if TestDocProjects.folder_id:
            response = authenticated_client.delete(f"{BASE_URL}/api/doc/folders/{TestDocProjects.folder_id}")
            assert response.status_code == 200
            print("Test folder deleted")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
