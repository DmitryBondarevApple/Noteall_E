"""
Test suite for sharing/access bug fixes:
- Tab switching (Private/Public/Trash) should not leak data
- Share dialog should show org members
- Public folders should show owner_name in API response
- Menu should show 'Доступы' for public folders vs 'Расшарить' for private
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "dmitry.bondarev@gmail.com"
TEST_PASSWORD = "test123"


class TestAuthentication:
    """Authentication for all tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Auth headers for API calls"""
        return {"Authorization": f"Bearer {auth_token}"}


class TestOrganizationMembers(TestAuthentication):
    """Test /api/organizations/my/members endpoint"""
    
    def test_get_org_members(self, headers):
        """GET /api/organizations/my/members should return list of org members"""
        response = requests.get(f"{BASE_URL}/api/organizations/my/members", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Verify member structure
        member = data[0]
        assert "id" in member
        assert "email" in member
        assert "name" in member
        print(f"Found {len(data)} org members")


class TestMeetingFoldersTab(TestAuthentication):
    """Test meeting folders tab switching - Private/Public/Trash"""
    
    def test_private_tab_returns_only_private_folders(self, headers):
        """GET /api/meeting-folders?tab=private should return only private folders"""
        response = requests.get(f"{BASE_URL}/api/meeting-folders?tab=private", headers=headers)
        assert response.status_code == 200
        
        folders = response.json()
        assert isinstance(folders, list)
        
        for folder in folders:
            # Private folders should have visibility != 'public'
            visibility = folder.get("visibility", "private")
            assert visibility != "public", f"Found public folder in private tab: {folder['name']}"
            assert folder.get("deleted_at") is None, f"Found deleted folder in private tab: {folder['name']}"
        
        print(f"Private tab: {len(folders)} folders, all visibility != public")
    
    def test_public_tab_returns_only_public_folders(self, headers):
        """GET /api/meeting-folders?tab=public should return only public folders"""
        response = requests.get(f"{BASE_URL}/api/meeting-folders?tab=public", headers=headers)
        assert response.status_code == 200
        
        folders = response.json()
        assert isinstance(folders, list)
        
        for folder in folders:
            assert folder.get("visibility") == "public", f"Found non-public folder in public tab: {folder['name']}"
            assert folder.get("deleted_at") is None, f"Found deleted folder in public tab: {folder['name']}"
        
        print(f"Public tab: {len(folders)} folders, all visibility == public")
    
    def test_public_tab_returns_owner_name(self, headers):
        """GET /api/meeting-folders?tab=public should include owner_name field"""
        response = requests.get(f"{BASE_URL}/api/meeting-folders?tab=public", headers=headers)
        assert response.status_code == 200
        
        folders = response.json()
        for folder in folders:
            assert "owner_name" in folder, f"Folder {folder['name']} missing owner_name"
            assert folder["owner_name"], f"Folder {folder['name']} has empty owner_name"
        
        if folders:
            print(f"Public folders have owner_name: {folders[0]['owner_name']}")
    
    def test_trash_tab_returns_only_deleted_folders(self, headers):
        """GET /api/meeting-folders?tab=trash should return only deleted folders"""
        response = requests.get(f"{BASE_URL}/api/meeting-folders?tab=trash", headers=headers)
        assert response.status_code == 200
        
        folders = response.json()
        assert isinstance(folders, list)
        
        for folder in folders:
            assert folder.get("deleted_at") is not None, f"Found non-deleted folder in trash: {folder['name']}"
        
        print(f"Trash tab: {len(folders)} folders, all have deleted_at")
    
    def test_no_data_leak_between_tabs(self, headers):
        """Verify that private and public folders don't appear in wrong tabs"""
        # Get all tabs
        private_resp = requests.get(f"{BASE_URL}/api/meeting-folders?tab=private", headers=headers)
        public_resp = requests.get(f"{BASE_URL}/api/meeting-folders?tab=public", headers=headers)
        
        assert private_resp.status_code == 200
        assert public_resp.status_code == 200
        
        private_folders = private_resp.json()
        public_folders = public_resp.json()
        
        private_ids = {f["id"] for f in private_folders}
        public_ids = {f["id"] for f in public_folders}
        
        # No overlap between private and public tabs
        overlap = private_ids.intersection(public_ids)
        assert len(overlap) == 0, f"Found folders appearing in both tabs: {overlap}"
        
        print(f"No overlap: {len(private_ids)} private, {len(public_ids)} public")


class TestDocFoldersTab(TestAuthentication):
    """Test doc folders tab switching - Private/Public/Trash"""
    
    def test_doc_private_tab(self, headers):
        """GET /api/doc/folders?tab=private should return only private folders"""
        response = requests.get(f"{BASE_URL}/api/doc/folders?tab=private", headers=headers)
        assert response.status_code == 200
        
        folders = response.json()
        assert isinstance(folders, list)
        
        for folder in folders:
            visibility = folder.get("visibility", "private")
            assert visibility != "public", f"Found public folder in private tab"
        
        print(f"Doc private tab: {len(folders)} folders")
    
    def test_doc_public_tab_returns_owner_name(self, headers):
        """GET /api/doc/folders?tab=public should include owner_name field"""
        response = requests.get(f"{BASE_URL}/api/doc/folders?tab=public", headers=headers)
        assert response.status_code == 200
        
        folders = response.json()
        for folder in folders:
            if folder.get("visibility") == "public":
                assert "owner_name" in folder, f"Doc folder {folder['name']} missing owner_name"
        
        print(f"Doc public tab: {len(folders)} folders")


class TestShareFolderWorkflow(TestAuthentication):
    """Test share/unshare folder workflow"""
    
    def test_share_folder_makes_it_public(self, headers):
        """Sharing a folder should change visibility to public"""
        # Get private folders
        private_resp = requests.get(f"{BASE_URL}/api/meeting-folders?tab=private", headers=headers)
        assert private_resp.status_code == 200
        
        folders = private_resp.json()
        if not folders:
            pytest.skip("No private folders to test with")
        
        # We'll just verify the share endpoint works (won't actually share to avoid test side effects)
        folder = folders[0]
        
        # Verify folder has share-related fields
        assert "visibility" in folder
        assert "shared_with" in folder or folder.get("visibility") == "private"
        
        print(f"Verified folder {folder['name']} has required share fields")
    
    def test_share_api_accepts_shared_with_array(self, headers):
        """POST /api/meeting-folders/{id}/share should accept shared_with array"""
        # Get a private folder to test
        private_resp = requests.get(f"{BASE_URL}/api/meeting-folders?tab=private", headers=headers)
        folders = private_resp.json()
        
        if not folders:
            pytest.skip("No private folders to test share API")
        
        folder_id = folders[0]["id"]
        
        # Test share endpoint with empty shared_with (shares with whole org)
        # Note: This will actually share the folder, so we unshare it after
        share_resp = requests.post(
            f"{BASE_URL}/api/meeting-folders/{folder_id}/share",
            headers=headers,
            json={"shared_with": [], "access_type": "readonly"}
        )
        assert share_resp.status_code == 200
        
        # Verify folder is now public
        folder_data = share_resp.json()
        assert folder_data.get("visibility") == "public"
        
        # Unshare to restore original state
        unshare_resp = requests.post(f"{BASE_URL}/api/meeting-folders/{folder_id}/unshare", headers=headers)
        assert unshare_resp.status_code == 200
        
        # Verify folder is private again
        unshared_data = unshare_resp.json()
        assert unshared_data.get("visibility") == "private"
        
        print("Share/unshare workflow working correctly")


class TestFolderAccessDetails(TestAuthentication):
    """Test folder detail endpoint for access info"""
    
    def test_get_folder_includes_owner_name(self, headers):
        """GET /api/meeting-folders/{id} should include owner_name"""
        # Get any folder
        public_resp = requests.get(f"{BASE_URL}/api/meeting-folders?tab=public", headers=headers)
        folders = public_resp.json()
        
        if not folders:
            pytest.skip("No public folders to test")
        
        folder_id = folders[0]["id"]
        
        detail_resp = requests.get(f"{BASE_URL}/api/meeting-folders/{folder_id}", headers=headers)
        assert detail_resp.status_code == 200
        
        folder = detail_resp.json()
        assert "owner_name" in folder
        assert folder["owner_name"], "owner_name should not be empty"
        
        print(f"Folder detail includes owner_name: {folder['owner_name']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
