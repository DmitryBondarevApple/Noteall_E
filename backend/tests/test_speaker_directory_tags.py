"""
Tests for Speaker Directory with Tags - Iteration 18
Tests /api/speaker-directory CRUD with tags support
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSpeakerDirectoryTags:
    """Tests for speaker directory API with tags field"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login with test credentials
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "test123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Track created speakers for cleanup
        self.created_speakers = []
        
        yield
        
        # Cleanup created test speakers
        for speaker_id in self.created_speakers:
            try:
                self.session.delete(f"{BASE_URL}/api/speaker-directory/{speaker_id}")
            except:
                pass
        self.session.close()
    
    def test_list_speaker_directory(self):
        """GET /api/speaker-directory returns list"""
        response = self.session.get(f"{BASE_URL}/api/speaker-directory")
        
        assert response.status_code == 200, f"List failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Speaker directory has {len(data)} entries")
    
    def test_create_speaker_with_tags(self):
        """POST /api/speaker-directory with tags array creates speaker"""
        payload = {
            "name": "TEST_Speaker Tags",
            "email": "test.speaker@example.com",
            "company": "Test Corp",
            "role": "Developer",
            "phone": "+7 999 123-45-67",
            "tags": ["руководство", "техотдел", "партнёр"]
        }
        
        response = self.session.post(f"{BASE_URL}/api/speaker-directory", json=payload)
        
        assert response.status_code == 200, f"Create failed: {response.text}"
        created = response.json()
        
        # Track for cleanup
        self.created_speakers.append(created["id"])
        
        # Verify data
        assert created["name"] == payload["name"]
        assert created["email"] == payload["email"]
        assert created["company"] == payload["company"]
        assert created["role"] == payload["role"]
        assert "id" in created
        assert "tags" in created
        assert isinstance(created["tags"], list)
        assert created["tags"] == ["руководство", "техотдел", "партнёр"]
        print("PASS: Created speaker with tags")
    
    def test_create_speaker_without_tags(self):
        """POST /api/speaker-directory without tags defaults to empty list"""
        payload = {
            "name": "TEST_Speaker NoTags",
            "company": "NoTags Corp"
        }
        
        response = self.session.post(f"{BASE_URL}/api/speaker-directory", json=payload)
        
        assert response.status_code == 200, f"Create failed: {response.text}"
        created = response.json()
        self.created_speakers.append(created["id"])
        
        # Tags should default to empty list
        assert "tags" in created
        assert isinstance(created["tags"], list)
        assert created["tags"] == []
        print("PASS: Created speaker without tags - defaults to empty list")
    
    def test_update_speaker_tags(self):
        """PUT /api/speaker-directory/{id} updates tags"""
        # First create a speaker
        create_payload = {
            "name": "TEST_Update Tags",
            "company": "UpdateTags Corp",
            "tags": ["original"]
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/speaker-directory", json=create_payload)
        assert create_response.status_code == 200
        created = create_response.json()
        speaker_id = created["id"]
        self.created_speakers.append(speaker_id)
        
        # Update tags
        update_payload = {
            "tags": ["updated", "new-tag", "важный"]
        }
        
        update_response = self.session.put(
            f"{BASE_URL}/api/speaker-directory/{speaker_id}",
            json=update_payload
        )
        
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        updated = update_response.json()
        
        assert updated["tags"] == ["updated", "new-tag", "важный"]
        print("PASS: Updated speaker tags")
    
    def test_update_speaker_name_and_tags(self):
        """PUT /api/speaker-directory/{id} updates both name and tags"""
        # Create speaker
        create_response = self.session.post(f"{BASE_URL}/api/speaker-directory", json={
            "name": "TEST_Update Both",
            "company": "Both Corp",
            "tags": ["old"]
        })
        assert create_response.status_code == 200
        speaker_id = create_response.json()["id"]
        self.created_speakers.append(speaker_id)
        
        # Update name and tags
        update_response = self.session.put(
            f"{BASE_URL}/api/speaker-directory/{speaker_id}",
            json={
                "name": "TEST_Updated Name",
                "tags": ["new", "важный"]
            }
        )
        
        assert update_response.status_code == 200
        updated = update_response.json()
        
        assert updated["name"] == "TEST_Updated Name"
        assert updated["tags"] == ["new", "важный"]
        print("PASS: Updated speaker name and tags together")
    
    def test_get_speaker_returns_tags(self):
        """GET /api/speaker-directory returns speakers with tags field"""
        # Create speaker with tags
        create_response = self.session.post(f"{BASE_URL}/api/speaker-directory", json={
            "name": "TEST_Get Tags",
            "tags": ["fetchable", "test"]
        })
        assert create_response.status_code == 200
        speaker_id = create_response.json()["id"]
        self.created_speakers.append(speaker_id)
        
        # Get single speaker
        get_response = self.session.get(f"{BASE_URL}/api/speaker-directory/{speaker_id}")
        
        assert get_response.status_code == 200, f"Get failed: {get_response.text}"
        speaker = get_response.json()
        
        assert speaker["tags"] == ["fetchable", "test"]
        print("PASS: GET speaker returns tags")
    
    def test_search_by_tag(self):
        """GET /api/speaker-directory?q=tag searches in tags"""
        # Create speaker with unique tag
        unique_tag = "UNIQUE_TAG_XYZ123"
        create_response = self.session.post(f"{BASE_URL}/api/speaker-directory", json={
            "name": "TEST_Search By Tag",
            "tags": [unique_tag, "common"]
        })
        assert create_response.status_code == 200
        speaker_id = create_response.json()["id"]
        self.created_speakers.append(speaker_id)
        
        # Search by tag
        search_response = self.session.get(
            f"{BASE_URL}/api/speaker-directory?q={unique_tag}"
        )
        
        assert search_response.status_code == 200
        results = search_response.json()
        
        # Should find the speaker with that tag
        found = any(
            unique_tag in (r.get("tags", []) or []) 
            for r in results
        )
        assert found, f"Search should find speaker with tag '{unique_tag}'"
        print("PASS: Search finds speakers by tag")
    
    def test_search_by_name(self):
        """GET /api/speaker-directory?q=name searches in name"""
        # Create speaker with unique name
        unique_name = "TEST_UniqueSearchName123"
        create_response = self.session.post(f"{BASE_URL}/api/speaker-directory", json={
            "name": unique_name,
            "company": "Search Test Corp"
        })
        assert create_response.status_code == 200
        speaker_id = create_response.json()["id"]
        self.created_speakers.append(speaker_id)
        
        # Search by name
        search_response = self.session.get(
            f"{BASE_URL}/api/speaker-directory?q=UniqueSearchName123"
        )
        
        assert search_response.status_code == 200
        results = search_response.json()
        
        found = any(unique_name in r.get("name", "") for r in results)
        assert found, f"Search should find speaker with name '{unique_name}'"
        print("PASS: Search finds speakers by name")
    
    def test_search_by_company(self):
        """GET /api/speaker-directory?q=company searches in company"""
        # Create speaker with unique company
        unique_company = "UniqueCompanyXYZ789"
        create_response = self.session.post(f"{BASE_URL}/api/speaker-directory", json={
            "name": "TEST_Company Search",
            "company": unique_company
        })
        assert create_response.status_code == 200
        speaker_id = create_response.json()["id"]
        self.created_speakers.append(speaker_id)
        
        # Search by company
        search_response = self.session.get(
            f"{BASE_URL}/api/speaker-directory?q={unique_company}"
        )
        
        assert search_response.status_code == 200
        results = search_response.json()
        
        found = any(unique_company in (r.get("company", "") or "") for r in results)
        assert found, f"Search should find speaker with company '{unique_company}'"
        print("PASS: Search finds speakers by company")
    
    def test_delete_speaker(self):
        """DELETE /api/speaker-directory/{id} removes speaker"""
        # Create speaker
        create_response = self.session.post(f"{BASE_URL}/api/speaker-directory", json={
            "name": "TEST_Delete Me",
            "tags": ["delete-test"]
        })
        assert create_response.status_code == 200
        speaker_id = create_response.json()["id"]
        
        # Delete speaker
        delete_response = self.session.delete(f"{BASE_URL}/api/speaker-directory/{speaker_id}")
        
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        
        # Verify deleted
        get_response = self.session.get(f"{BASE_URL}/api/speaker-directory/{speaker_id}")
        assert get_response.status_code == 404, "Speaker should not exist after delete"
        
        print("PASS: Speaker deleted successfully")
    
    def test_get_nonexistent_speaker_returns_404(self):
        """GET /api/speaker-directory/{id} returns 404 for nonexistent"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = self.session.get(f"{BASE_URL}/api/speaker-directory/{fake_id}")
        
        assert response.status_code == 404
        print("PASS: 404 for nonexistent speaker")
    
    def test_update_nonexistent_speaker_returns_404(self):
        """PUT /api/speaker-directory/{id} returns 404 for nonexistent"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = self.session.put(
            f"{BASE_URL}/api/speaker-directory/{fake_id}",
            json={"name": "Test"}
        )
        
        assert response.status_code == 404
        print("PASS: 404 for updating nonexistent speaker")
    
    def test_delete_nonexistent_speaker_returns_404(self):
        """DELETE /api/speaker-directory/{id} returns 404 for nonexistent"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = self.session.delete(f"{BASE_URL}/api/speaker-directory/{fake_id}")
        
        assert response.status_code == 404
        print("PASS: 404 for deleting nonexistent speaker")
    
    def test_speaker_response_structure(self):
        """Verify speaker response has all expected fields"""
        # Create speaker with all fields
        create_response = self.session.post(f"{BASE_URL}/api/speaker-directory", json={
            "name": "TEST_Full Structure",
            "email": "full@test.com",
            "company": "Full Corp",
            "role": "Full Role",
            "phone": "+7 999 111-22-33",
            "telegram": "@fulltest",
            "whatsapp": "+7 999 111-22-33",
            "comment": "Test comment",
            "tags": ["tag1", "tag2"]
        })
        assert create_response.status_code == 200
        speaker = create_response.json()
        self.created_speakers.append(speaker["id"])
        
        # Verify structure
        required_fields = [
            "id", "user_id", "name", "email", "company", "role",
            "phone", "telegram", "whatsapp", "comment", "tags",
            "created_at", "updated_at"
        ]
        
        for field in required_fields:
            assert field in speaker, f"Missing field: {field}"
        
        # Verify optional photo_url field is present (can be None)
        assert "photo_url" in speaker
        
        print("PASS: Speaker response has all required fields")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
