"""
Test suite for Attachments API endpoints
Tests file upload, URL attachments, listing, deletion, and text extraction
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "password"
TEST_PROJECT_ID = "daf833a1-7fec-4e50-9610-53ce9c766c4b"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for test user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestAttachmentsList:
    """Test GET /api/projects/:id/attachments"""
    
    def test_list_attachments_success(self, auth_token):
        """List all attachments for a project"""
        response = requests.get(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/attachments",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} attachments")
        
        # Verify attachment structure
        for att in data:
            assert "id" in att, "Attachment should have id"
            assert "name" in att, "Attachment should have name"
            assert "file_type" in att, "Attachment should have file_type"
            assert "project_id" in att, "Attachment should have project_id"
            assert att["project_id"] == TEST_PROJECT_ID
            print(f"  - {att['name']} ({att['file_type']})")
    
    def test_list_attachments_no_auth(self):
        """List attachments without auth should fail"""
        response = requests.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/attachments")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
    
    def test_list_attachments_invalid_project(self, auth_token):
        """List attachments for non-existent project"""
        response = requests.get(
            f"{BASE_URL}/api/projects/invalid-project-id/attachments",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestFileUpload:
    """Test POST /api/projects/:id/attachments for file upload"""
    
    def test_upload_txt_file(self, auth_token):
        """Upload a TXT file and verify text extraction"""
        # Create a test TXT file content
        test_content = "This is test content for text extraction.\nLine 2.\nLine 3."
        files = {
            'file': ('test_upload.txt', test_content.encode('utf-8'), 'text/plain')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/attachments",
            files=files,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) >= 1, "Should have at least 1 attachment returned"
        
        att = data[0]
        assert att["file_type"] == "text", f"Expected file_type 'text', got '{att['file_type']}'"
        assert att["name"] == "test_upload.txt"
        assert att["extracted_text"] is not None, "Text file should have extracted_text"
        assert "This is test content" in att["extracted_text"], "Extracted text should contain content"
        
        print(f"TXT upload SUCCESS: {att['id']}")
        print(f"Extracted text preview: {att['extracted_text'][:100]}...")
        
        # Cleanup: delete the attachment
        cleanup = requests.delete(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/attachments/{att['id']}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert cleanup.status_code == 200, "Cleanup failed"
    
    def test_upload_csv_file(self, auth_token):
        """Upload a CSV file"""
        csv_content = "name,value\nrow1,100\nrow2,200"
        files = {
            'file': ('test_data.csv', csv_content.encode('utf-8'), 'text/csv')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/attachments",
            files=files,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        att = data[0]
        assert att["file_type"] == "text", "CSV should be detected as text type"
        assert att["extracted_text"] is not None
        
        print(f"CSV upload SUCCESS: {att['id']}")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/attachments/{att['id']}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
    
    def test_upload_md_file(self, auth_token):
        """Upload a Markdown file"""
        md_content = "# Test Title\n\n- Item 1\n- Item 2\n\nSome **bold** text."
        files = {
            'file': ('readme.md', md_content.encode('utf-8'), 'text/markdown')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/attachments",
            files=files,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        att = data[0]
        assert att["file_type"] == "text"
        assert att["extracted_text"] is not None
        
        print(f"MD upload SUCCESS: {att['id']}")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/attachments/{att['id']}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
    
    def test_upload_unsupported_format(self, auth_token):
        """Upload unsupported file format should fail"""
        files = {
            'file': ('script.exe', b'fake binary', 'application/octet-stream')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/attachments",
            files=files,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 400, f"Expected 400 for unsupported format, got {response.status_code}"
        assert "не поддерживается" in response.json().get("detail", ""), "Error should mention unsupported format"
        print("Unsupported format rejection SUCCESS")


class TestUrlAttachment:
    """Test POST /api/projects/:id/attachments/url"""
    
    def test_add_url_attachment(self, auth_headers, auth_token):
        """Add a URL attachment"""
        response = requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/attachments/url",
            json={"url": "https://example.com/test", "name": "Test URL"},
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["file_type"] == "url", f"Expected file_type 'url', got '{data['file_type']}'"
        assert data["source_url"] == "https://example.com/test"
        assert data["name"] == "Test URL"
        
        print(f"URL attachment SUCCESS: {data['id']}")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/attachments/{data['id']}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
    
    def test_add_url_without_name(self, auth_headers, auth_token):
        """Add URL without explicit name (uses URL as name)"""
        response = requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/attachments/url",
            json={"url": "https://docs.google.com/spreadsheets/d/12345"},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["file_type"] == "url"
        assert data["source_url"] == "https://docs.google.com/spreadsheets/d/12345"
        # Name should be auto-generated from URL (truncated to 80 chars)
        assert len(data["name"]) <= 80
        
        print(f"URL without name SUCCESS: {data['id']}")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/attachments/{data['id']}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
    
    def test_add_url_invalid_project(self, auth_headers):
        """Add URL to non-existent project"""
        response = requests.post(
            f"{BASE_URL}/api/projects/invalid-id/attachments/url",
            json={"url": "https://example.com"},
            headers=auth_headers
        )
        assert response.status_code == 404


class TestAttachmentDeletion:
    """Test DELETE /api/projects/:id/attachments/:id"""
    
    def test_delete_attachment(self, auth_token):
        """Create and delete an attachment"""
        # Create
        files = {'file': ('to_delete.txt', b'delete me', 'text/plain')}
        create_resp = requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/attachments",
            files=files,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert create_resp.status_code == 200
        att_id = create_resp.json()[0]["id"]
        
        # Delete
        del_resp = requests.delete(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/attachments/{att_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert del_resp.status_code == 200
        assert "Deleted" in del_resp.json().get("message", "")
        
        # Verify deletion - GET list should not contain this attachment
        list_resp = requests.get(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/attachments",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        attachment_ids = [a["id"] for a in list_resp.json()]
        assert att_id not in attachment_ids, "Deleted attachment should not be in list"
        
        print("Delete attachment SUCCESS")
    
    def test_delete_nonexistent_attachment(self, auth_token):
        """Delete non-existent attachment"""
        response = requests.delete(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/attachments/nonexistent-id",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404


class TestFileTypeDetection:
    """Test file type detection for different file extensions"""
    
    def test_pdf_file_type(self, auth_token):
        """PDF should be detected as 'pdf' type"""
        # Create minimal PDF content (just header for type detection)
        pdf_content = b'%PDF-1.4\n%minimal test content'
        files = {'file': ('document.pdf', pdf_content, 'application/pdf')}
        
        response = requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/attachments",
            files=files,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()[0]
        assert data["file_type"] == "pdf", f"Expected 'pdf', got '{data['file_type']}'"
        print(f"PDF type detection SUCCESS")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/attachments/{data['id']}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
    
    def test_image_file_types(self, auth_token):
        """Image files should be detected as 'image' type"""
        # Test PNG
        png_content = b'\x89PNG\r\n\x1a\n' + b'\x00' * 100  # Minimal PNG header
        files = {'file': ('image.png', png_content, 'image/png')}
        
        response = requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/attachments",
            files=files,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()[0]
        assert data["file_type"] == "image", f"Expected 'image', got '{data['file_type']}'"
        print(f"PNG image type detection SUCCESS")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/attachments/{data['id']}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )


class TestAnalyzeWithAttachments:
    """Test POST /api/projects/:id/analyze-raw with attachment_ids"""
    
    def test_analyze_raw_accepts_attachment_ids(self, auth_headers, auth_token):
        """Verify analyze-raw endpoint accepts attachment_ids parameter"""
        # First create an attachment
        files = {'file': ('context.txt', b'Additional context for analysis.', 'text/plain')}
        create_resp = requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/attachments",
            files=files,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert create_resp.status_code == 200
        att_id = create_resp.json()[0]["id"]
        
        # Now test analyze-raw with attachment_ids
        # Note: This will require a transcript, so we just test the parameter acceptance
        analyze_resp = requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/analyze-raw",
            json={
                "system_message": "Test system message",
                "user_message": "Test user message",
                "reasoning_effort": "low",
                "attachment_ids": [att_id]
            },
            headers=auth_headers
        )
        
        # If project has no transcript, we get 400, not 422 (validation error)
        # This confirms the attachment_ids field is accepted
        if analyze_resp.status_code == 400:
            error_detail = analyze_resp.json().get("detail", "")
            # 400 with "No transcript found" means the request body was valid
            assert "transcript" in error_detail.lower(), f"Unexpected error: {error_detail}"
            print("analyze-raw accepts attachment_ids parameter SUCCESS (no transcript available)")
        else:
            # If project has transcript, we should get 200
            assert analyze_resp.status_code == 200, f"Unexpected status: {analyze_resp.status_code}"
            print("analyze-raw with attachment_ids SUCCESS")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/attachments/{att_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )


class TestExistingAttachments:
    """Test existing attachments from admin user"""
    
    def test_list_existing_admin_attachments(self):
        """List existing attachments (admin has some on Test Project)"""
        # Login as admin
        auth_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@voiceworkspace.com",
            "password": "admin123"
        })
        
        if auth_resp.status_code != 200:
            pytest.skip("Admin login failed")
        
        token = auth_resp.json().get("access_token")
        
        # List attachments for the test project
        response = requests.get(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/attachments",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # Note: The test project belongs to test@test.com, not admin
        # So admin should get 404
        assert response.status_code == 404, "Admin should not access test user's project"
        print("Project ownership check SUCCESS")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
