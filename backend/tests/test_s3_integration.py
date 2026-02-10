"""
Test S3 Integration for Voice Workspace

Tests S3 upload, download, delete for:
1. Doc Attachments (POST/GET/DELETE /api/doc/projects/{id}/attachments)
2. Meeting Attachments (POST/GET/DELETE /api/projects/{id}/attachments)
3. Verifies s3_key is set and file_path is null when S3 is enabled
"""
import os
import io
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

class TestS3Integration:
    """S3 Integration tests for all file uploads"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "test"
        })
        assert response.status_code == 200, f"Auth failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}"
        }
    
    @pytest.fixture(scope="class")
    def doc_folder_and_project(self, headers):
        """Create doc folder and project for testing"""
        # Create folder
        folder_resp = requests.post(
            f"{BASE_URL}/api/doc/folders",
            headers={**headers, "Content-Type": "application/json"},
            json={"name": "TEST_S3_Doc_Folder", "description": "For S3 testing"}
        )
        assert folder_resp.status_code == 201, f"Create doc folder failed: {folder_resp.text}"
        folder = folder_resp.json()
        
        # Create project in folder
        project_resp = requests.post(
            f"{BASE_URL}/api/doc/projects",
            headers={**headers, "Content-Type": "application/json"},
            json={"name": "TEST_S3_Doc_Project", "folder_id": folder["id"]}
        )
        assert project_resp.status_code == 201, f"Create doc project failed: {project_resp.text}"
        project = project_resp.json()
        
        yield {"folder": folder, "project": project}
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/doc/projects/{project['id']}", headers=headers)
        requests.delete(f"{BASE_URL}/api/doc/folders/{folder['id']}", headers=headers)
    
    @pytest.fixture(scope="class")
    def meeting_folder_and_project(self, headers):
        """Create meeting folder and project for testing"""
        # Create meeting folder
        folder_resp = requests.post(
            f"{BASE_URL}/api/meeting-folders",
            headers={**headers, "Content-Type": "application/json"},
            json={"name": "TEST_S3_Meeting_Folder"}
        )
        assert folder_resp.status_code == 201, f"Create meeting folder failed: {folder_resp.text}"
        folder = folder_resp.json()
        
        # Create project in folder
        project_resp = requests.post(
            f"{BASE_URL}/api/projects",
            headers={**headers, "Content-Type": "application/json"},
            json={"name": "TEST_S3_Meeting_Project", "folder_id": folder["id"]}
        )
        assert project_resp.status_code in [200, 201], f"Create meeting project failed: {project_resp.text}"
        project = project_resp.json()
        
        yield {"folder": folder, "project": project}
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/projects/{project['id']}", headers=headers)
        requests.delete(f"{BASE_URL}/api/meeting-folders/{folder['id']}", headers=headers)

    # ==================== DOC ATTACHMENTS S3 TESTS ====================
    
    def test_doc_attachment_upload_to_s3(self, headers, doc_folder_and_project):
        """Test uploading file to doc project stores in S3"""
        project_id = doc_folder_and_project["project"]["id"]
        
        # Create a test file in memory
        test_content = b"This is a test file for S3 upload testing"
        files = {"file": ("test_s3_upload.txt", io.BytesIO(test_content), "text/plain")}
        
        response = requests.post(
            f"{BASE_URL}/api/doc/projects/{project_id}/attachments",
            headers=headers,
            files=files
        )
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        
        # Verify S3 storage
        assert data.get("s3_key") is not None, "s3_key should be set when S3 is enabled"
        assert data.get("file_path") is None, "file_path should be null when using S3"
        assert "doc_attachments/" in data["s3_key"], "s3_key should have doc_attachments prefix"
        assert data["name"] == "test_s3_upload.txt"
        assert data["size"] == len(test_content)
        
        # Store attachment_id for later tests
        self.__class__.doc_attachment_id = data["id"]
        self.__class__.doc_project_id = project_id
        print(f"✓ Doc attachment uploaded to S3: {data['s3_key']}")
    
    def test_doc_attachment_download_from_s3(self, headers):
        """Test downloading doc attachment redirects to presigned S3 URL"""
        project_id = self.__class__.doc_project_id
        attachment_id = self.__class__.doc_attachment_id
        
        response = requests.get(
            f"{BASE_URL}/api/doc/projects/{project_id}/attachments/{attachment_id}/download",
            headers=headers,
            allow_redirects=False  # Don't follow redirect to check presigned URL
        )
        
        # Should be 307 redirect to S3 presigned URL
        assert response.status_code in [302, 307], f"Expected redirect, got {response.status_code}: {response.text}"
        
        location = response.headers.get("Location", "")
        assert "s3.twcstorage.ru" in location, f"Should redirect to S3: {location}"
        assert "X-Amz-Signature" in location or "Signature" in location, "Should have presigned signature"
        print(f"✓ Doc attachment download redirects to S3 presigned URL")
    
    def test_doc_attachment_delete_from_s3(self, headers):
        """Test deleting doc attachment removes from S3"""
        project_id = self.__class__.doc_project_id
        attachment_id = self.__class__.doc_attachment_id
        
        response = requests.delete(
            f"{BASE_URL}/api/doc/projects/{project_id}/attachments/{attachment_id}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Delete failed: {response.text}"
        data = response.json()
        assert data.get("message") == "Deleted"
        
        # Verify attachment is gone
        get_response = requests.get(
            f"{BASE_URL}/api/doc/projects/{project_id}/attachments/{attachment_id}/download",
            headers=headers,
            allow_redirects=False
        )
        assert get_response.status_code == 404, "Attachment should be deleted"
        print(f"✓ Doc attachment deleted from S3")

    # ==================== MEETING ATTACHMENTS S3 TESTS ====================
    
    def test_meeting_attachment_upload_to_s3(self, headers, meeting_folder_and_project):
        """Test uploading file to meeting project stores in S3"""
        project_id = meeting_folder_and_project["project"]["id"]
        
        # Create a test file in memory
        test_content = b"This is a meeting attachment test for S3 upload"
        files = {"file": ("meeting_test.txt", io.BytesIO(test_content), "text/plain")}
        
        response = requests.post(
            f"{BASE_URL}/api/projects/{project_id}/attachments",
            headers=headers,
            files=files
        )
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        
        # Response is a list (meeting attachments can return multiple from ZIP)
        assert isinstance(data, list), f"Expected list response, got {type(data)}"
        assert len(data) > 0, "Should have at least one attachment"
        
        attachment = data[0]
        # Verify S3 storage
        # Note: Meeting attachments response doesn't include s3_key in response model
        # but we can verify file_path is null
        assert attachment.get("file_path") is None, "file_path should be null when using S3"
        assert attachment["name"] == "meeting_test.txt"
        assert attachment["size"] == len(test_content)
        
        # Store for later tests
        self.__class__.meeting_attachment_id = attachment["id"]
        self.__class__.meeting_project_id = project_id
        print(f"✓ Meeting attachment uploaded to S3")
    
    def test_meeting_attachment_download_from_s3(self, headers):
        """Test downloading meeting attachment redirects to presigned S3 URL"""
        project_id = self.__class__.meeting_project_id
        attachment_id = self.__class__.meeting_attachment_id
        
        response = requests.get(
            f"{BASE_URL}/api/projects/{project_id}/attachments/{attachment_id}/download",
            headers=headers,
            allow_redirects=False
        )
        
        # Should be 307 redirect to S3 presigned URL
        assert response.status_code in [302, 307], f"Expected redirect, got {response.status_code}: {response.text}"
        
        location = response.headers.get("Location", "")
        assert "s3.twcstorage.ru" in location, f"Should redirect to S3: {location}"
        assert "X-Amz-Signature" in location or "Signature" in location, "Should have presigned signature"
        print(f"✓ Meeting attachment download redirects to S3 presigned URL")
    
    def test_meeting_attachment_delete_from_s3(self, headers):
        """Test deleting meeting attachment removes from S3"""
        project_id = self.__class__.meeting_project_id
        attachment_id = self.__class__.meeting_attachment_id
        
        response = requests.delete(
            f"{BASE_URL}/api/projects/{project_id}/attachments/{attachment_id}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Delete failed: {response.text}"
        data = response.json()
        assert data.get("message") == "Deleted"
        
        # Verify attachment is gone
        get_response = requests.get(
            f"{BASE_URL}/api/projects/{project_id}/attachments/{attachment_id}/download",
            headers=headers,
            allow_redirects=False
        )
        assert get_response.status_code == 404, "Attachment should be deleted"
        print(f"✓ Meeting attachment deleted from S3")
    
    # ==================== ADDITIONAL S3 TESTS ====================
    
    def test_pdf_upload_to_s3(self, headers, doc_folder_and_project):
        """Test uploading PDF stores correctly in S3"""
        project_id = doc_folder_and_project["project"]["id"]
        
        # Create a minimal PDF-like content (not a real PDF but tests the flow)
        test_content = b"%PDF-1.4 Test PDF content for S3 testing"
        files = {"file": ("test_document.pdf", io.BytesIO(test_content), "application/pdf")}
        
        response = requests.post(
            f"{BASE_URL}/api/doc/projects/{project_id}/attachments",
            headers=headers,
            files=files
        )
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        
        # Verify S3 storage
        assert data.get("s3_key") is not None, "s3_key should be set"
        assert data.get("file_path") is None, "file_path should be null"
        assert data["file_type"] == "pdf"
        
        # Clean up
        requests.delete(
            f"{BASE_URL}/api/doc/projects/{project_id}/attachments/{data['id']}",
            headers=headers
        )
        print(f"✓ PDF uploaded to S3 successfully")
    
    def test_image_upload_to_s3(self, headers, meeting_folder_and_project):
        """Test uploading image stores correctly in S3"""
        project_id = meeting_folder_and_project["project"]["id"]
        
        # Create minimal PNG header
        test_content = b'\x89PNG\r\n\x1a\n' + b'Test image content'
        files = {"file": ("test_image.png", io.BytesIO(test_content), "image/png")}
        
        response = requests.post(
            f"{BASE_URL}/api/projects/{project_id}/attachments",
            headers=headers,
            files=files
        )
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list) and len(data) > 0
        attachment = data[0]
        assert attachment.get("file_path") is None, "file_path should be null when using S3"
        assert attachment["file_type"] == "image"
        
        # Clean up
        requests.delete(
            f"{BASE_URL}/api/projects/{project_id}/attachments/{attachment['id']}",
            headers=headers
        )
        print(f"✓ Image uploaded to S3 successfully")


class TestHealthAndBasicEndpoints:
    """Basic health and status tests"""
    
    def test_health_endpoint(self):
        """Test health check returns 200"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ Health check passed")
    
    def test_login_endpoint(self):
        """Test login works with provided credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "test"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data.get("token_type") == "bearer"
        print("✓ Login endpoint working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
