"""
Test Voice Workspace Bug Fixes:
1. Speaker name substitution - applySpeakerNames function
2. Reasoning effort passed to analyze API
3. Backend ChatRequestCreate model accepts reasoning_effort
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestAuthentication:
    """Test auth endpoints"""
    
    def test_login_success(self):
        """Test admin login works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@voiceworkspace.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "admin@voiceworkspace.com"
        print("✓ Login successful")
        return data["access_token"]

    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401
        print("✓ Invalid login correctly rejected")


class TestReasoningEffortParameter:
    """Bug 2 & 3: Test reasoning_effort is properly accepted by backend"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@voiceworkspace.com",
            "password": "admin123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_analyze_endpoint_accepts_reasoning_effort(self, auth_headers):
        """Test that /api/projects/{id}/analyze accepts reasoning_effort parameter"""
        # First create a project
        response = requests.post(
            f"{BASE_URL}/api/projects",
            json={"name": "TEST_reasoning_effort_project", "description": "Test for reasoning effort"},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Project creation failed: {response.text}"
        project = response.json()
        project_id = project["id"]
        
        try:
            # Get prompts to use for analysis
            prompts_resp = requests.get(f"{BASE_URL}/api/prompts", headers=auth_headers)
            assert prompts_resp.status_code == 200
            prompts = prompts_resp.json()
            
            # Find a non-master prompt
            thematic_prompt = next((p for p in prompts if p["prompt_type"] == "thematic"), None)
            
            if thematic_prompt:
                # Test that the analyze endpoint accepts reasoning_effort parameter
                # This will fail because there's no transcript, but we want to verify the model accepts the param
                analyze_response = requests.post(
                    f"{BASE_URL}/api/projects/{project_id}/analyze",
                    json={
                        "prompt_id": thematic_prompt["id"],
                        "additional_text": "Test additional text",
                        "reasoning_effort": "high"
                    },
                    headers=auth_headers
                )
                # It should return 400 (no transcript) not 422 (validation error)
                # If reasoning_effort param was not accepted, it would be 422
                assert analyze_response.status_code in [200, 400], \
                    f"Unexpected status: {analyze_response.status_code}, body: {analyze_response.text}"
                
                if analyze_response.status_code == 400:
                    # Expected - no transcript available
                    assert "transcript" in analyze_response.json().get("detail", "").lower()
                    print("✓ reasoning_effort parameter accepted (no transcript to analyze)")
                else:
                    print("✓ Analysis completed with reasoning_effort parameter")
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/projects/{project_id}", headers=auth_headers)
    
    def test_all_reasoning_effort_values_accepted(self, auth_headers):
        """Test all valid reasoning_effort values are accepted by the model"""
        valid_efforts = ["auto", "minimal", "low", "medium", "high", "xhigh"]
        
        # Create a project
        response = requests.post(
            f"{BASE_URL}/api/projects",
            json={"name": "TEST_reasoning_values", "description": "Test reasoning values"},
            headers=auth_headers
        )
        project = response.json()
        project_id = project["id"]
        
        try:
            # Get a prompt
            prompts_resp = requests.get(f"{BASE_URL}/api/prompts", headers=auth_headers)
            prompts = prompts_resp.json()
            thematic_prompt = next((p for p in prompts if p["prompt_type"] == "thematic"), None)
            
            if thematic_prompt:
                for effort in valid_efforts:
                    analyze_response = requests.post(
                        f"{BASE_URL}/api/projects/{project_id}/analyze",
                        json={
                            "prompt_id": thematic_prompt["id"],
                            "reasoning_effort": effort
                        },
                        headers=auth_headers
                    )
                    # Should not be 422 (validation error)
                    assert analyze_response.status_code != 422, \
                        f"reasoning_effort '{effort}' was rejected: {analyze_response.text}"
                    print(f"✓ reasoning_effort '{effort}' accepted")
        finally:
            requests.delete(f"{BASE_URL}/api/projects/{project_id}", headers=auth_headers)


class TestProjectEndpoints:
    """Test project CRUD operations"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@voiceworkspace.com",
            "password": "admin123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_create_project(self, auth_headers):
        """Test project creation"""
        response = requests.post(
            f"{BASE_URL}/api/projects",
            json={"name": "TEST_project", "description": "Test project"},
            headers=auth_headers
        )
        assert response.status_code == 200
        project = response.json()
        assert project["name"] == "TEST_project"
        assert project["status"] == "new"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/projects/{project['id']}", headers=auth_headers)
        print("✓ Project creation works")
    
    def test_list_projects(self, auth_headers):
        """Test project listing"""
        response = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print("✓ Project listing works")


class TestPromptsEndpoints:
    """Test prompts API"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@voiceworkspace.com",
            "password": "admin123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_list_prompts(self, auth_headers):
        """Test prompts listing - should include seeded prompts"""
        response = requests.get(f"{BASE_URL}/api/prompts", headers=auth_headers)
        assert response.status_code == 200
        prompts = response.json()
        assert isinstance(prompts, list)
        assert len(prompts) >= 5, "Should have at least 5 seeded prompts"
        
        # Verify prompt types
        prompt_types = set(p["prompt_type"] for p in prompts)
        assert "master" in prompt_types, "Should have master prompt"
        assert "thematic" in prompt_types, "Should have thematic prompts"
        print(f"✓ Found {len(prompts)} prompts with types: {prompt_types}")


class TestSpeakersEndpoint:
    """Test speakers API for Bug 1 (speaker name substitution)"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@voiceworkspace.com",
            "password": "admin123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_speakers_endpoint_exists(self, auth_headers):
        """Test speakers endpoint exists and returns correct format"""
        # Create a project first
        response = requests.post(
            f"{BASE_URL}/api/projects",
            json={"name": "TEST_speakers_project"},
            headers=auth_headers
        )
        project = response.json()
        project_id = project["id"]
        
        try:
            # Get speakers (should be empty for new project)
            speakers_resp = requests.get(
                f"{BASE_URL}/api/projects/{project_id}/speakers",
                headers=auth_headers
            )
            assert speakers_resp.status_code == 200
            speakers = speakers_resp.json()
            assert isinstance(speakers, list)
            print("✓ Speakers endpoint works correctly")
        finally:
            requests.delete(f"{BASE_URL}/api/projects/{project_id}", headers=auth_headers)


class TestTranscriptsEndpoint:
    """Test transcripts API"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@voiceworkspace.com",
            "password": "admin123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_transcripts_endpoint_exists(self, auth_headers):
        """Test transcripts endpoint exists and returns correct format"""
        # Create a project first
        response = requests.post(
            f"{BASE_URL}/api/projects",
            json={"name": "TEST_transcripts_project"},
            headers=auth_headers
        )
        project = response.json()
        project_id = project["id"]
        
        try:
            # Get transcripts (should be empty for new project)
            transcripts_resp = requests.get(
                f"{BASE_URL}/api/projects/{project_id}/transcripts",
                headers=auth_headers
            )
            assert transcripts_resp.status_code == 200
            transcripts = transcripts_resp.json()
            assert isinstance(transcripts, list)
            print("✓ Transcripts endpoint works correctly")
        finally:
            requests.delete(f"{BASE_URL}/api/projects/{project_id}", headers=auth_headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
