"""
Test Results Tab Backend API Endpoints
- GET /api/projects/:id/analysis-results - returns only full-analysis and result-analysis results
- DELETE /api/projects/:id/chat-history/:id - deletes a result
- POST /api/projects/:id/save-full-analysis - accepts pipeline_id and pipeline_name fields
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "password"

# Test project ID from previous iterations
TEST_PROJECT_ID = "daf833a1-7fec-4e50-9610-53ce9c766c4b"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code != 200:
        # Try to register if login fails
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "name": "Test User"
        })
        if reg_response.status_code == 200:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            })
    
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.fail(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture
def auth_headers(auth_token):
    """Headers with authentication"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestAnalysisResultsEndpoint:
    """Test GET /api/projects/:id/analysis-results endpoint"""
    
    def test_get_analysis_results_success(self, auth_headers):
        """Test fetching analysis results returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/analysis-results",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of results"
        
        # Verify results only contain full-analysis or result-analysis
        for result in data:
            assert result.get("prompt_id") in ["full-analysis", "result-analysis"], \
                f"Unexpected prompt_id: {result.get('prompt_id')}"
            assert "id" in result
            assert "response_text" in result
            assert "created_at" in result
        
        print(f"Found {len(data)} analysis results")
    
    def test_get_analysis_results_unauthorized(self):
        """Test fetching without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/analysis-results")
        assert response.status_code == 401
    
    def test_get_analysis_results_project_not_found(self, auth_headers):
        """Test fetching for non-existent project returns 404"""
        fake_id = str(uuid.uuid4())
        response = requests.get(
            f"{BASE_URL}/api/projects/{fake_id}/analysis-results",
            headers=auth_headers
        )
        assert response.status_code == 404


class TestSaveFullAnalysisEndpoint:
    """Test POST /api/projects/:id/save-full-analysis endpoint"""
    
    def test_save_full_analysis_with_pipeline_fields(self, auth_headers):
        """Test saving full analysis with pipeline_id and pipeline_name"""
        test_pipeline_id = str(uuid.uuid4())
        test_pipeline_name = "TEST_Pipeline_Analysis"
        
        payload = {
            "subject": "TEST_Full Analysis Subject",
            "content": "# Test Analysis Content\n\nThis is a test analysis result.",
            "pipeline_id": test_pipeline_id,
            "pipeline_name": test_pipeline_name
        }
        
        response = requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/save-full-analysis",
            headers=auth_headers,
            json=payload
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "id" in data, "Response should contain id"
        assert data.get("prompt_id") == "full-analysis", "prompt_id should be 'full-analysis'"
        assert data.get("response_text") == payload["content"]
        assert data.get("pipeline_id") == test_pipeline_id, "pipeline_id should be saved"
        assert data.get("pipeline_name") == test_pipeline_name, "pipeline_name should be saved"
        assert "Мастер-анализ:" in data.get("prompt_content", ""), "prompt_content should contain subject"
        
        # Store the ID for cleanup
        TestSaveFullAnalysisEndpoint.created_result_id = data["id"]
        print(f"Created analysis result with id: {data['id']}")
    
    def test_save_full_analysis_without_pipeline_fields(self, auth_headers):
        """Test saving full analysis without optional pipeline fields"""
        payload = {
            "subject": "TEST_Simple Analysis",
            "content": "Simple analysis content without pipeline"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/save-full-analysis",
            headers=auth_headers,
            json=payload
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "id" in data
        assert data.get("pipeline_id") is None or data.get("pipeline_id") == ""
        
        # Store for cleanup
        TestSaveFullAnalysisEndpoint.created_result_id2 = data["id"]
    
    def test_save_full_analysis_unauthorized(self):
        """Test saving without auth returns 401"""
        payload = {
            "subject": "Test",
            "content": "Test content"
        }
        response = requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/save-full-analysis",
            json=payload
        )
        assert response.status_code == 401


class TestDeleteChatHistoryEndpoint:
    """Test DELETE /api/projects/:id/chat-history/:id endpoint"""
    
    def test_delete_chat_history_success(self, auth_headers):
        """Test deleting a chat history entry"""
        # First create a result to delete
        payload = {
            "subject": "TEST_To Be Deleted",
            "content": "This result will be deleted"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/save-full-analysis",
            headers=auth_headers,
            json=payload
        )
        
        assert create_response.status_code == 200
        result_id = create_response.json()["id"]
        
        # Now delete it
        delete_response = requests.delete(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/chat-history/{result_id}",
            headers=auth_headers
        )
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}: {delete_response.text}"
        assert delete_response.json().get("message") == "Deleted"
        
        # Verify it's deleted by trying to get analysis results
        get_response = requests.get(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/analysis-results",
            headers=auth_headers
        )
        results = get_response.json()
        deleted_ids = [r["id"] for r in results]
        assert result_id not in deleted_ids, "Deleted result should not appear in list"
        
        print(f"Successfully deleted result with id: {result_id}")
    
    def test_delete_chat_history_not_found(self, auth_headers):
        """Test deleting non-existent entry returns 404"""
        fake_id = str(uuid.uuid4())
        response = requests.delete(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/chat-history/{fake_id}",
            headers=auth_headers
        )
        assert response.status_code == 404
    
    def test_delete_chat_history_unauthorized(self):
        """Test deleting without auth returns 401"""
        fake_id = str(uuid.uuid4())
        response = requests.delete(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/chat-history/{fake_id}"
        )
        assert response.status_code == 401


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_results(self, auth_headers):
        """Clean up TEST_ prefixed results"""
        # Get all results
        response = requests.get(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/analysis-results",
            headers=auth_headers
        )
        
        if response.status_code == 200:
            results = response.json()
            deleted_count = 0
            for result in results:
                if result.get("prompt_content", "").startswith("Мастер-анализ: TEST_"):
                    del_response = requests.delete(
                        f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/chat-history/{result['id']}",
                        headers=auth_headers
                    )
                    if del_response.status_code == 200:
                        deleted_count += 1
            
            print(f"Cleaned up {deleted_count} TEST_ results")
