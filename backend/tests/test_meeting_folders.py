"""
Test Meeting Folders API and Navigation Restructuring Backend APIs
Tests for iteration 16 - Navigation and UX restructuring
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Module-level storage for test data
test_data = {
    "auth_token": None,
    "folder_ids": [],
    "project_ids": []
}

@pytest.fixture(scope="module", autouse=True)
def setup_auth():
    """Setup authentication for all tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "test@example.com",
        "password": "test123"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    test_data["auth_token"] = response.json().get("access_token")
    print(f"✓ Authenticated successfully")
    yield
    # Cleanup at end
    headers = {"Authorization": f"Bearer {test_data['auth_token']}"}
    # Delete projects first
    for pid in reversed(test_data["project_ids"]):
        try:
            requests.delete(f"{BASE_URL}/api/projects/{pid}", headers=headers)
        except:
            pass
    # Delete folders (nested first)
    for fid in reversed(test_data["folder_ids"]):
        try:
            requests.delete(f"{BASE_URL}/api/meeting-folders/{fid}", headers=headers)
        except:
            pass
    print("✓ Cleanup complete")

def get_headers():
    return {"Authorization": f"Bearer {test_data['auth_token']}"}


# ============ Meeting Folders CRUD Tests ============

def test_health_endpoint():
    """GET /api/health - basic health check"""
    response = requests.get(f"{BASE_URL}/api/health")
    assert response.status_code == 200
    print("✓ Health endpoint works")

def test_create_folder():
    """POST /api/meeting-folders - create meeting folder"""
    response = requests.post(
        f"{BASE_URL}/api/meeting-folders",
        json={"name": "TEST_Folder_Root", "description": "Test root folder"},
        headers=get_headers()
    )
    assert response.status_code == 201, f"Create folder failed: {response.text}"
    data = response.json()
    assert data["name"] == "TEST_Folder_Root"
    assert data["description"] == "Test root folder"
    assert "id" in data
    assert data["parent_id"] is None
    test_data["folder_ids"].append(data["id"])
    print(f"✓ Created folder: {data['id']}")

def test_create_nested_folder():
    """POST /api/meeting-folders - create nested folder"""
    assert len(test_data["folder_ids"]) > 0, "No parent folder created"
    parent_id = test_data["folder_ids"][0]
    response = requests.post(
        f"{BASE_URL}/api/meeting-folders",
        json={"name": "TEST_Folder_Nested", "parent_id": parent_id},
        headers=get_headers()
    )
    assert response.status_code == 201, f"Create nested folder failed: {response.text}"
    data = response.json()
    assert data["name"] == "TEST_Folder_Nested"
    assert data["parent_id"] == parent_id
    test_data["folder_ids"].append(data["id"])
    print(f"✓ Created nested folder: {data['id']}")

def test_create_folder_invalid_parent():
    """POST /api/meeting-folders - fail with invalid parent_id"""
    response = requests.post(
        f"{BASE_URL}/api/meeting-folders",
        json={"name": "TEST_Invalid", "parent_id": "nonexistent-id"},
        headers=get_headers()
    )
    assert response.status_code == 404, f"Should fail with 404: {response.text}"
    print("✓ Invalid parent_id returns 404")

def test_list_folders():
    """GET /api/meeting-folders - list meeting folders"""
    response = requests.get(
        f"{BASE_URL}/api/meeting-folders",
        headers=get_headers()
    )
    assert response.status_code == 200, f"List folders failed: {response.text}"
    data = response.json()
    assert isinstance(data, list)
    # Verify our test folders are present
    folder_names = [f["name"] for f in data]
    assert "TEST_Folder_Root" in folder_names
    print(f"✓ Listed {len(data)} folders")

def test_update_folder():
    """PUT /api/meeting-folders/{id} - update folder"""
    assert len(test_data["folder_ids"]) > 0, "No folder created"
    folder_id = test_data["folder_ids"][0]
    response = requests.put(
        f"{BASE_URL}/api/meeting-folders/{folder_id}",
        json={"name": "TEST_Folder_Root_Updated", "description": "Updated desc"},
        headers=get_headers()
    )
    assert response.status_code == 200, f"Update folder failed: {response.text}"
    data = response.json()
    assert data["name"] == "TEST_Folder_Root_Updated"
    assert data["description"] == "Updated desc"
    print(f"✓ Updated folder: {folder_id}")

def test_update_nonexistent_folder():
    """PUT /api/meeting-folders/{id} - fail with nonexistent folder"""
    response = requests.put(
        f"{BASE_URL}/api/meeting-folders/nonexistent-id",
        json={"name": "Test"},
        headers=get_headers()
    )
    assert response.status_code == 404, f"Should fail with 404: {response.text}"
    print("✓ Nonexistent folder update returns 404")

def test_delete_folder_not_empty_nested():
    """DELETE /api/meeting-folders/{id} - soft deletes folder with children (trash)"""
    assert len(test_data["folder_ids"]) > 0, "No folder created"
    parent_id = test_data["folder_ids"][0]
    response = requests.delete(
        f"{BASE_URL}/api/meeting-folders/{parent_id}",
        headers=get_headers()
    )
    # Phase 1: soft delete now works even if folder has children
    assert response.status_code == 200, f"Soft delete failed: {response.text}"
    print("✓ Delete folder with children moves to trash (soft delete)")


# ============ Projects with folder_id Tests ============

def test_create_project_in_folder():
    """POST /api/projects with folder_id - creates project in folder"""
    # Create a new folder for this test
    folder_resp = requests.post(
        f"{BASE_URL}/api/meeting-folders",
        json={"name": "TEST_Project_Folder"},
        headers=get_headers()
    )
    assert folder_resp.status_code == 201
    folder_id = folder_resp.json()["id"]
    test_data["folder_ids"].append(folder_id)
    
    # Create project in folder
    response = requests.post(
        f"{BASE_URL}/api/projects",
        json={
            "name": "TEST_Project_In_Folder",
            "description": "Test project",
            "folder_id": folder_id
        },
        headers=get_headers()
    )
    assert response.status_code == 200, f"Create project failed: {response.text}"
    data = response.json()
    assert data["name"] == "TEST_Project_In_Folder"
    assert data["folder_id"] == folder_id
    test_data["project_ids"].append(data["id"])
    print(f"✓ Created project in folder: {data['id']}")

def test_list_projects_by_folder():
    """GET /api/projects?folder_id=xxx - filters projects by folder"""
    assert len(test_data["folder_ids"]) > 2, "Project folder not created"
    folder_id = test_data["folder_ids"][2]  # TEST_Project_Folder
    
    response = requests.get(
        f"{BASE_URL}/api/projects",
        params={"folder_id": folder_id},
        headers=get_headers()
    )
    assert response.status_code == 200, f"List projects failed: {response.text}"
    data = response.json()
    assert isinstance(data, list)
    # Should contain our test project
    project_names = [p["name"] for p in data]
    assert "TEST_Project_In_Folder" in project_names
    # All projects should have our folder_id
    for p in data:
        assert p.get("folder_id") == folder_id
    print(f"✓ Listed {len(data)} projects in folder")

def test_delete_folder_not_empty_project():
    """DELETE /api/meeting-folders/{id} - fail if folder has projects"""
    assert len(test_data["folder_ids"]) > 2, "Project folder not created"
    folder_id = test_data["folder_ids"][2]  # TEST_Project_Folder
    
    response = requests.delete(
        f"{BASE_URL}/api/meeting-folders/{folder_id}",
        headers=get_headers()
    )
    assert response.status_code == 400, f"Should fail with 400: {response.text}"
    assert "not empty" in response.json().get("detail", "").lower()
    print("✓ Delete folder with projects returns 400")


# ============ Existing APIs Still Work ============

def test_pipelines_api():
    """GET /api/pipelines - still works"""
    response = requests.get(
        f"{BASE_URL}/api/pipelines",
        headers=get_headers()
    )
    assert response.status_code == 200, f"Pipelines API failed: {response.text}"
    print(f"✓ Pipelines API works")

def test_prompts_api():
    """GET /api/prompts - still works"""
    response = requests.get(
        f"{BASE_URL}/api/prompts",
        headers=get_headers()
    )
    assert response.status_code == 200, f"Prompts API failed: {response.text}"
    print(f"✓ Prompts API works")

def test_speaker_directory_api():
    """GET /api/speaker-directory - still works"""
    response = requests.get(
        f"{BASE_URL}/api/speaker-directory",
        headers=get_headers()
    )
    assert response.status_code == 200, f"Speaker directory API failed: {response.text}"
    print(f"✓ Speaker directory API works")

def test_projects_list_api():
    """GET /api/projects - still works"""
    response = requests.get(
        f"{BASE_URL}/api/projects",
        headers=get_headers()
    )
    assert response.status_code == 200, f"Projects list API failed: {response.text}"
    print(f"✓ Projects list API works")
