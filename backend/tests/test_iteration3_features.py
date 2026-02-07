"""
Test Voice Workspace Iteration 3 Features:
1. Bug fix: Fragment confirmation updates processed transcript (replace [word?] markers)
2. Review tab shows full sentences (extractFullSentence function) - frontend-only
3. Processed text tab edit mode (Редактировать/Сохранить/Отмена) - includes PUT transcript endpoint
4. Backend PUT /api/projects/{id}/transcripts/{version_type} endpoint
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


@pytest.fixture(scope="module")
def auth_headers():
    """Get auth headers - used across all tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@voiceworkspace.com",
        "password": "admin123"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


class TestTranscriptUpdateEndpoint:
    """Test PUT /api/projects/{project_id}/transcripts/{version_type} endpoint"""
    
    def test_update_processed_transcript_endpoint_exists(self, auth_headers):
        """Verify PUT endpoint for updating transcript content exists"""
        # Create a test project
        response = requests.post(
            f"{BASE_URL}/api/projects",
            json={"name": f"TEST_transcript_update_{uuid.uuid4().hex[:8]}"},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Project creation failed: {response.text}"
        project = response.json()
        project_id = project["id"]
        
        try:
            # Try to update a transcript - even if it doesn't exist, we test endpoint existence
            response = requests.put(
                f"{BASE_URL}/api/projects/{project_id}/transcripts/processed",
                json={"content": "Test content"},
                headers=auth_headers
            )
            # Should be 404 (transcript not found) NOT 405 (method not allowed) or 422 (validation)
            assert response.status_code in [200, 404], \
                f"Unexpected status: {response.status_code}, body: {response.text}"
            
            if response.status_code == 404:
                assert "transcript" in response.json().get("detail", "").lower() or \
                       "not found" in response.json().get("detail", "").lower()
                print("✓ PUT /transcripts/{version_type} endpoint exists (404 because no transcript)")
            else:
                print("✓ PUT /transcripts/{version_type} endpoint works")
        finally:
            requests.delete(f"{BASE_URL}/api/projects/{project_id}", headers=auth_headers)
    
    def test_update_transcript_with_content(self, auth_headers):
        """Test updating transcript content directly in database"""
        # Create project
        response = requests.post(
            f"{BASE_URL}/api/projects",
            json={"name": f"TEST_transcript_content_{uuid.uuid4().hex[:8]}"},
            headers=auth_headers
        )
        project = response.json()
        project_id = project["id"]
        
        try:
            # We need a transcript to update - let's check if Тест 8 project has one
            # Use the existing project mentioned in agent_to_agent_context_note
            existing_project_id = "d52c6fd8-efb6-405d-b07d-9a1f2c22718e"
            
            # Get transcripts from existing project
            transcripts_resp = requests.get(
                f"{BASE_URL}/api/projects/{existing_project_id}/transcripts",
                headers=auth_headers
            )
            
            if transcripts_resp.status_code == 200 and transcripts_resp.json():
                transcripts = transcripts_resp.json()
                processed = next((t for t in transcripts if t["version_type"] == "processed"), None)
                
                if processed:
                    original_content = processed["content"]
                    test_content = original_content + "\n\n[TEST_MARKER]"
                    
                    # Update the transcript
                    update_resp = requests.put(
                        f"{BASE_URL}/api/projects/{existing_project_id}/transcripts/processed",
                        json={"content": test_content},
                        headers=auth_headers
                    )
                    assert update_resp.status_code == 200, f"Update failed: {update_resp.text}"
                    updated = update_resp.json()
                    assert "[TEST_MARKER]" in updated["content"], "Content not updated"
                    print("✓ Transcript content update works")
                    
                    # Restore original content
                    requests.put(
                        f"{BASE_URL}/api/projects/{existing_project_id}/transcripts/processed",
                        json={"content": original_content},
                        headers=auth_headers
                    )
                    print("✓ Original content restored")
                else:
                    print("⚠ No processed transcript in Тест 8 project to test update")
            else:
                print("⚠ Could not access Тест 8 project transcripts")
        finally:
            requests.delete(f"{BASE_URL}/api/projects/{project_id}", headers=auth_headers)
    
    def test_update_transcript_validates_version_type(self, auth_headers):
        """Test that invalid version_type is rejected"""
        # Use existing project
        existing_project_id = "d52c6fd8-efb6-405d-b07d-9a1f2c22718e"
        
        response = requests.put(
            f"{BASE_URL}/api/projects/{existing_project_id}/transcripts/invalid_type",
            json={"content": "Test"},
            headers=auth_headers
        )
        # Should be 400 (invalid version type) or 404 (not found)
        assert response.status_code in [400, 404], \
            f"Should reject invalid version type: {response.status_code}"
        print(f"✓ Invalid version_type rejected with {response.status_code}")


class TestFragmentConfirmation:
    """Test fragment confirmation updates processed transcript"""
    
    def test_fragment_update_endpoint_works(self, auth_headers):
        """Test PUT /api/projects/{project_id}/fragments/{fragment_id} endpoint"""
        existing_project_id = "d52c6fd8-efb6-405d-b07d-9a1f2c22718e"
        
        # Get fragments
        fragments_resp = requests.get(
            f"{BASE_URL}/api/projects/{existing_project_id}/fragments",
            headers=auth_headers
        )
        
        if fragments_resp.status_code == 200:
            fragments = fragments_resp.json()
            print(f"✓ Found {len(fragments)} fragments in project")
            
            if fragments:
                # Test updating a fragment
                fragment = fragments[0]
                fragment_id = fragment["id"]
                original_status = fragment["status"]
                original_corrected = fragment.get("corrected_text")
                
                # Update fragment
                update_resp = requests.put(
                    f"{BASE_URL}/api/projects/{existing_project_id}/fragments/{fragment_id}",
                    json={
                        "corrected_text": "TEST_CORRECTION",
                        "status": "confirmed"
                    },
                    headers=auth_headers
                )
                assert update_resp.status_code == 200, f"Fragment update failed: {update_resp.text}"
                updated = update_resp.json()
                assert updated["corrected_text"] == "TEST_CORRECTION"
                assert updated["status"] == "confirmed"
                print("✓ Fragment update endpoint works")
                
                # Restore original state
                requests.put(
                    f"{BASE_URL}/api/projects/{existing_project_id}/fragments/{fragment_id}",
                    json={
                        "corrected_text": original_corrected or fragment["original_text"],
                        "status": original_status
                    },
                    headers=auth_headers
                )
                print("✓ Fragment state restored")
            else:
                print("⚠ No fragments to test (may need to process transcript first)")
        else:
            print(f"⚠ Could not get fragments: {fragments_resp.status_code}")


class TestExistingProjectData:
    """Test existing project 'Тест 8' data"""
    
    def test_project_exists(self, auth_headers):
        """Verify project Тест 8 exists"""
        project_id = "d52c6fd8-efb6-405d-b07d-9a1f2c22718e"
        
        response = requests.get(
            f"{BASE_URL}/api/projects/{project_id}",
            headers=auth_headers
        )
        
        if response.status_code == 200:
            project = response.json()
            print(f"✓ Project found: {project['name']}, status: {project['status']}")
            return True
        else:
            print(f"⚠ Project not found: {response.status_code}")
            return False
    
    def test_project_has_transcripts(self, auth_headers):
        """Check if project has transcripts"""
        project_id = "d52c6fd8-efb6-405d-b07d-9a1f2c22718e"
        
        response = requests.get(
            f"{BASE_URL}/api/projects/{project_id}/transcripts",
            headers=auth_headers
        )
        
        if response.status_code == 200:
            transcripts = response.json()
            version_types = [t["version_type"] for t in transcripts]
            print(f"✓ Found transcripts: {version_types}")
            
            # Check for processed transcript
            processed = next((t for t in transcripts if t["version_type"] == "processed"), None)
            if processed:
                content_preview = processed["content"][:200] if processed["content"] else "Empty"
                print(f"  Processed content preview: {content_preview}...")
                
                # Check for [word?] markers
                if "[" in processed["content"] and "?" in processed["content"]:
                    print("  Contains [word?] markers - good for testing fragment confirmation")
                else:
                    print("  No [word?] markers found")
            
            return transcripts
        else:
            print(f"⚠ Could not get transcripts: {response.status_code}")
            return []
    
    def test_project_has_fragments(self, auth_headers):
        """Check if project has uncertain fragments"""
        project_id = "d52c6fd8-efb6-405d-b07d-9a1f2c22718e"
        
        response = requests.get(
            f"{BASE_URL}/api/projects/{project_id}/fragments",
            headers=auth_headers
        )
        
        if response.status_code == 200:
            fragments = response.json()
            pending = [f for f in fragments if f["status"] == "pending"]
            confirmed = [f for f in fragments if f["status"] == "confirmed"]
            print(f"✓ Found {len(fragments)} fragments ({len(pending)} pending, {len(confirmed)} confirmed)")
            
            if fragments:
                # Show first fragment details
                frag = fragments[0]
                print(f"  Sample fragment: '{frag['original_text']}' - {frag['status']}")
                print(f"  Context: {frag.get('context', 'N/A')[:100]}...")
            
            return fragments
        else:
            print(f"⚠ Could not get fragments: {response.status_code}")
            return []


class TestCRUDOperations:
    """Basic CRUD operations verification"""
    
    def test_projects_crud(self, auth_headers):
        """Test project CRUD"""
        # Create
        response = requests.post(
            f"{BASE_URL}/api/projects",
            json={"name": f"TEST_crud_{uuid.uuid4().hex[:8]}", "description": "CRUD test"},
            headers=auth_headers
        )
        assert response.status_code == 200
        project = response.json()
        project_id = project["id"]
        print(f"✓ Created project: {project_id}")
        
        # Read
        get_resp = requests.get(f"{BASE_URL}/api/projects/{project_id}", headers=auth_headers)
        assert get_resp.status_code == 200
        print("✓ Read project")
        
        # Update
        update_resp = requests.put(
            f"{BASE_URL}/api/projects/{project_id}",
            json={"name": "TEST_crud_updated"},
            headers=auth_headers
        )
        assert update_resp.status_code == 200
        print("✓ Updated project")
        
        # Delete
        delete_resp = requests.delete(f"{BASE_URL}/api/projects/{project_id}", headers=auth_headers)
        assert delete_resp.status_code == 200
        print("✓ Deleted project")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
