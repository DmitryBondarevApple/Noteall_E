"""
Test Suite for Organization & Role Management Features (Iteration 22)
- POST /api/auth/register creates user + org (with optional organization_name field)
- POST /api/auth/login returns user with org_id and org_name
- GET /api/auth/me returns user with org_id and org_name
- GET /api/organizations/my returns current user's org
- GET /api/organizations/my/users returns org members
- POST /api/organizations/my/invite adds user to org
- DELETE /api/organizations/my/users/{id} removes user from org
- PUT /api/organizations/my/users/{id}/role changes user role within org
- PUT /api/organizations/my/users/{id}/limit sets monthly token limit
- GET /api/organizations/all (superadmin only) lists all orgs
- PUT /api/admin/users/{id}/role (superadmin only) changes any user's role
- Role-based access: regular user cannot access superadmin endpoints
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPERADMIN_EMAIL = "admin@voiceworkspace.com"
SUPERADMIN_PASSWORD = "admin123"


class TestAuthWithOrganization:
    """Test authentication endpoints with organization data"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.test_email = f"TEST_user_{uuid.uuid4().hex[:8]}@test.com"
        self.test_org_name = f"TEST_Org_{uuid.uuid4().hex[:8]}"
    
    def test_register_creates_user_and_org_with_custom_org_name(self):
        """POST /api/auth/register with organization_name creates user + org"""
        response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.test_email,
            "password": "testpass123",
            "name": "Test User",
            "organization_name": self.test_org_name
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify token returned
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        
        # Verify user data includes org
        user = data["user"]
        assert user["email"] == self.test_email
        assert user["name"] == "Test User"
        assert user["role"] == "org_admin"  # New user becomes org_admin of their org
        assert user["org_id"] is not None
        assert user["org_name"] == self.test_org_name
        
        # Store token for cleanup
        self.token = data["access_token"]
        
    def test_register_creates_org_with_user_name_if_no_org_name(self):
        """POST /api/auth/register without organization_name uses user's name"""
        test_email = f"TEST_user2_{uuid.uuid4().hex[:8]}@test.com"
        user_name = "TestUserNoOrg"
        
        response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "testpass123",
            "name": user_name
            # No organization_name
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        user = data["user"]
        assert user["org_name"] == user_name  # Uses user's name as org name
        assert user["role"] == "org_admin"
    
    def test_register_duplicate_email_fails(self):
        """POST /api/auth/register with existing email returns 400"""
        # First register
        self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.test_email,
            "password": "testpass123",
            "name": "Test User"
        })
        
        # Try duplicate
        response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.test_email,
            "password": "newpass",
            "name": "Another User"
        })
        
        assert response.status_code == 400
        assert "already registered" in response.json().get("detail", "").lower()
    
    def test_login_returns_org_id_and_org_name(self):
        """POST /api/auth/login returns user with org_id and org_name"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        assert "access_token" in data
        user = data["user"]
        assert "org_id" in user
        assert "org_name" in user
        assert user["role"] == "superadmin"
        
    def test_login_invalid_credentials(self):
        """POST /api/auth/login with wrong password returns 401"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401
    
    def test_get_me_returns_org_info(self):
        """GET /api/auth/me returns user with org_id and org_name"""
        # Login first
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        token = login_resp.json()["access_token"]
        
        # Get me
        response = self.session.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "org_id" in data
        assert "org_name" in data
        assert data["email"] == SUPERADMIN_EMAIL


class TestOrganizationEndpoints:
    """Test organization management endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated sessions"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as superadmin
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        assert login_resp.status_code == 200, f"Superadmin login failed: {login_resp.text}"
        self.superadmin_token = login_resp.json()["access_token"]
        self.superadmin_user = login_resp.json()["user"]
    
    def test_get_my_org(self):
        """GET /api/organizations/my returns current user's org"""
        response = self.session.get(
            f"{BASE_URL}/api/organizations/my",
            headers={"Authorization": f"Bearer {self.superadmin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        org = response.json()
        
        assert "id" in org
        assert "name" in org
        assert "owner_id" in org
        assert "created_at" in org
    
    def test_get_my_users(self):
        """GET /api/organizations/my/users returns org members"""
        response = self.session.get(
            f"{BASE_URL}/api/organizations/my/users",
            headers={"Authorization": f"Bearer {self.superadmin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        users = response.json()
        
        assert isinstance(users, list)
        if len(users) > 0:
            user = users[0]
            assert "id" in user
            assert "email" in user
            assert "name" in user
            assert "role" in user
            assert "monthly_token_limit" in user


class TestInvitationFlow:
    """Test user invitation and org membership"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test org and admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Create a new org admin for testing invitations
        self.org_admin_email = f"TEST_orgadmin_{uuid.uuid4().hex[:8]}@test.com"
        self.org_name = f"TEST_InviteOrg_{uuid.uuid4().hex[:8]}"
        
        reg_resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.org_admin_email,
            "password": "testpass123",
            "name": "Org Admin",
            "organization_name": self.org_name
        })
        
        assert reg_resp.status_code == 200, f"Org admin registration failed: {reg_resp.text}"
        self.org_admin_token = reg_resp.json()["access_token"]
        self.org_id = reg_resp.json()["user"]["org_id"]
        
        yield
        
        # Cleanup is handled by test database
    
    def test_invite_user_to_org(self):
        """POST /api/organizations/my/invite creates invitation"""
        invite_email = f"TEST_invited_{uuid.uuid4().hex[:8]}@test.com"
        
        response = self.session.post(
            f"{BASE_URL}/api/organizations/my/invite",
            json={"email": invite_email},
            headers={"Authorization": f"Bearer {self.org_admin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert "message" in response.json()
    
    def test_invite_duplicate_fails(self):
        """POST /api/organizations/my/invite with existing invite returns 400"""
        invite_email = f"TEST_dup_{uuid.uuid4().hex[:8]}@test.com"
        
        # First invite
        self.session.post(
            f"{BASE_URL}/api/organizations/my/invite",
            json={"email": invite_email},
            headers={"Authorization": f"Bearer {self.org_admin_token}"}
        )
        
        # Duplicate invite
        response = self.session.post(
            f"{BASE_URL}/api/organizations/my/invite",
            json={"email": invite_email},
            headers={"Authorization": f"Bearer {self.org_admin_token}"}
        )
        
        assert response.status_code == 400
        assert "already" in response.json().get("detail", "").lower()
    
    def test_invited_user_joins_org_on_register(self):
        """Invited user joins the org when they register"""
        invite_email = f"TEST_joiner_{uuid.uuid4().hex[:8]}@test.com"
        
        # Invite the user
        inv_resp = self.session.post(
            f"{BASE_URL}/api/organizations/my/invite",
            json={"email": invite_email},
            headers={"Authorization": f"Bearer {self.org_admin_token}"}
        )
        assert inv_resp.status_code == 200
        
        # User registers with the invited email
        reg_resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": invite_email,
            "password": "testpass123",
            "name": "Invited User"
        })
        
        assert reg_resp.status_code == 200, f"Registration failed: {reg_resp.text}"
        user = reg_resp.json()["user"]
        
        # User should join the inviting org, not create their own
        assert user["org_id"] == self.org_id
        assert user["role"] == "user"  # Invited users are regular users
        assert user["org_name"] == self.org_name


class TestOrgUserManagement:
    """Test managing users within an organization"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup org with admin and member"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Create org admin
        self.org_admin_email = f"TEST_mgmtadmin_{uuid.uuid4().hex[:8]}@test.com"
        self.org_name = f"TEST_MgmtOrg_{uuid.uuid4().hex[:8]}"
        
        reg_resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.org_admin_email,
            "password": "testpass123",
            "name": "Management Admin",
            "organization_name": self.org_name
        })
        
        self.org_admin_token = reg_resp.json()["access_token"]
        self.org_admin_id = reg_resp.json()["user"]["id"]
        self.org_id = reg_resp.json()["user"]["org_id"]
        
        # Invite and register a member
        self.member_email = f"TEST_member_{uuid.uuid4().hex[:8]}@test.com"
        
        self.session.post(
            f"{BASE_URL}/api/organizations/my/invite",
            json={"email": self.member_email},
            headers={"Authorization": f"Bearer {self.org_admin_token}"}
        )
        
        member_reg = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.member_email,
            "password": "testpass123",
            "name": "Team Member"
        })
        
        self.member_token = member_reg.json()["access_token"]
        self.member_id = member_reg.json()["user"]["id"]
    
    def test_update_user_role_within_org(self):
        """PUT /api/organizations/my/users/{id}/role changes role"""
        response = self.session.put(
            f"{BASE_URL}/api/organizations/my/users/{self.member_id}/role?role=org_admin",
            headers={"Authorization": f"Bearer {self.org_admin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert "message" in response.json()
        
        # Verify role changed
        users_resp = self.session.get(
            f"{BASE_URL}/api/organizations/my/users",
            headers={"Authorization": f"Bearer {self.org_admin_token}"}
        )
        
        users = users_resp.json()
        member = next((u for u in users if u["id"] == self.member_id), None)
        assert member is not None
        assert member["role"] == "org_admin"
    
    def test_update_role_invalid_role_fails(self):
        """PUT /api/organizations/my/users/{id}/role with invalid role returns 400"""
        response = self.session.put(
            f"{BASE_URL}/api/organizations/my/users/{self.member_id}/role?role=superadmin",
            headers={"Authorization": f"Bearer {self.org_admin_token}"}
        )
        
        assert response.status_code == 400  # superadmin is not valid for org-level role change
    
    def test_cannot_change_own_role(self):
        """PUT /api/organizations/my/users/{id}/role for self returns 400"""
        response = self.session.put(
            f"{BASE_URL}/api/organizations/my/users/{self.org_admin_id}/role?role=user",
            headers={"Authorization": f"Bearer {self.org_admin_token}"}
        )
        
        assert response.status_code == 400
        assert "cannot" in response.json().get("detail", "").lower()
    
    def test_set_user_token_limit(self):
        """PUT /api/organizations/my/users/{id}/limit sets monthly token limit"""
        response = self.session.put(
            f"{BASE_URL}/api/organizations/my/users/{self.member_id}/limit",
            json={"monthly_token_limit": 50000},
            headers={"Authorization": f"Bearer {self.org_admin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify limit set
        users_resp = self.session.get(
            f"{BASE_URL}/api/organizations/my/users",
            headers={"Authorization": f"Bearer {self.org_admin_token}"}
        )
        
        users = users_resp.json()
        member = next((u for u in users if u["id"] == self.member_id), None)
        assert member["monthly_token_limit"] == 50000
    
    def test_remove_user_from_org(self):
        """DELETE /api/organizations/my/users/{id} removes user from org"""
        response = self.session.delete(
            f"{BASE_URL}/api/organizations/my/users/{self.member_id}",
            headers={"Authorization": f"Bearer {self.org_admin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify user removed
        users_resp = self.session.get(
            f"{BASE_URL}/api/organizations/my/users",
            headers={"Authorization": f"Bearer {self.org_admin_token}"}
        )
        
        users = users_resp.json()
        member = next((u for u in users if u["id"] == self.member_id), None)
        assert member is None  # User no longer in org
    
    def test_cannot_remove_self(self):
        """DELETE /api/organizations/my/users/{id} for self returns 400"""
        response = self.session.delete(
            f"{BASE_URL}/api/organizations/my/users/{self.org_admin_id}",
            headers={"Authorization": f"Bearer {self.org_admin_token}"}
        )
        
        assert response.status_code == 400


class TestSuperadminEndpoints:
    """Test superadmin-only endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup superadmin and regular user sessions"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as superadmin
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        self.superadmin_token = login_resp.json()["access_token"]
        
        # Create a regular user
        self.user_email = f"TEST_regular_{uuid.uuid4().hex[:8]}@test.com"
        reg_resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.user_email,
            "password": "testpass123",
            "name": "Regular User"
        })
        self.user_token = reg_resp.json()["access_token"]
        self.user_id = reg_resp.json()["user"]["id"]
    
    def test_list_all_orgs_superadmin(self):
        """GET /api/organizations/all returns all orgs for superadmin"""
        response = self.session.get(
            f"{BASE_URL}/api/organizations/all",
            headers={"Authorization": f"Bearer {self.superadmin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        orgs = response.json()
        
        assert isinstance(orgs, list)
        if len(orgs) > 0:
            org = orgs[0]
            assert "id" in org
            assert "name" in org
            assert "user_count" in org
    
    def test_list_all_orgs_forbidden_for_regular_user(self):
        """GET /api/organizations/all returns 403 for regular user"""
        response = self.session.get(
            f"{BASE_URL}/api/organizations/all",
            headers={"Authorization": f"Bearer {self.user_token}"}
        )
        
        # Regular users are org_admin of their own org, but not superadmin
        # So they should get 403 for superadmin-only endpoints
        assert response.status_code == 403
    
    def test_list_all_users_superadmin(self):
        """GET /api/admin/users returns all users for superadmin"""
        response = self.session.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {self.superadmin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        users = response.json()
        
        assert isinstance(users, list)
        assert len(users) > 0
    
    def test_list_all_users_forbidden_for_org_admin(self):
        """GET /api/admin/users returns 403 for org_admin (non-superadmin)"""
        response = self.session.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {self.user_token}"}
        )
        
        assert response.status_code == 403
    
    def test_superadmin_change_any_user_role(self):
        """PUT /api/admin/users/{id}/role allows superadmin to change any role"""
        response = self.session.put(
            f"{BASE_URL}/api/admin/users/{self.user_id}/role?role=superadmin",
            headers={"Authorization": f"Bearer {self.superadmin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Change back to user
        self.session.put(
            f"{BASE_URL}/api/admin/users/{self.user_id}/role?role=user",
            headers={"Authorization": f"Bearer {self.superadmin_token}"}
        )
    
    def test_superadmin_role_change_invalid_role(self):
        """PUT /api/admin/users/{id}/role with invalid role returns 400"""
        response = self.session.put(
            f"{BASE_URL}/api/admin/users/{self.user_id}/role?role=invalid_role",
            headers={"Authorization": f"Bearer {self.superadmin_token}"}
        )
        
        assert response.status_code == 400


class TestRoleBasedAccess:
    """Test role-based access control"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup users with different roles"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as superadmin
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        self.superadmin_token = login_resp.json()["access_token"]
        
        # Create org_admin
        self.org_admin_email = f"TEST_orgadmin_{uuid.uuid4().hex[:8]}@test.com"
        reg_resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.org_admin_email,
            "password": "testpass123",
            "name": "Org Admin"
        })
        self.org_admin_token = reg_resp.json()["access_token"]
        self.org_admin_id = reg_resp.json()["user"]["id"]
        
        # Create regular user by inviting them
        self.user_email = f"TEST_user_{uuid.uuid4().hex[:8]}@test.com"
        self.session.post(
            f"{BASE_URL}/api/organizations/my/invite",
            json={"email": self.user_email},
            headers={"Authorization": f"Bearer {self.org_admin_token}"}
        )
        
        user_reg = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.user_email,
            "password": "testpass123",
            "name": "Regular User"
        })
        self.user_token = user_reg.json()["access_token"]
        self.user_id = user_reg.json()["user"]["id"]
    
    def test_regular_user_cannot_access_org_users(self):
        """Regular users cannot access /api/organizations/my/users"""
        response = self.session.get(
            f"{BASE_URL}/api/organizations/my/users",
            headers={"Authorization": f"Bearer {self.user_token}"}
        )
        
        assert response.status_code == 403
    
    def test_regular_user_can_access_my_org(self):
        """Regular users can access their org info via /api/organizations/my"""
        response = self.session.get(
            f"{BASE_URL}/api/organizations/my",
            headers={"Authorization": f"Bearer {self.user_token}"}
        )
        
        assert response.status_code == 200
    
    def test_regular_user_cannot_invite(self):
        """Regular users cannot invite others"""
        response = self.session.post(
            f"{BASE_URL}/api/organizations/my/invite",
            json={"email": "someuser@test.com"},
            headers={"Authorization": f"Bearer {self.user_token}"}
        )
        
        assert response.status_code == 403
    
    def test_org_admin_can_invite(self):
        """Org admins can invite users"""
        response = self.session.post(
            f"{BASE_URL}/api/organizations/my/invite",
            json={"email": f"TEST_new_{uuid.uuid4().hex[:8]}@test.com"},
            headers={"Authorization": f"Bearer {self.org_admin_token}"}
        )
        
        assert response.status_code == 200
    
    def test_org_admin_cannot_access_all_orgs(self):
        """Org admins cannot access superadmin endpoint"""
        response = self.session.get(
            f"{BASE_URL}/api/organizations/all",
            headers={"Authorization": f"Bearer {self.org_admin_token}"}
        )
        
        assert response.status_code == 403
    
    def test_superadmin_can_access_all_endpoints(self):
        """Superadmin can access all endpoints"""
        # My org
        resp1 = self.session.get(
            f"{BASE_URL}/api/organizations/my",
            headers={"Authorization": f"Bearer {self.superadmin_token}"}
        )
        assert resp1.status_code == 200
        
        # My users
        resp2 = self.session.get(
            f"{BASE_URL}/api/organizations/my/users",
            headers={"Authorization": f"Bearer {self.superadmin_token}"}
        )
        assert resp2.status_code == 200
        
        # All orgs
        resp3 = self.session.get(
            f"{BASE_URL}/api/organizations/all",
            headers={"Authorization": f"Bearer {self.superadmin_token}"}
        )
        assert resp3.status_code == 200
        
        # All users
        resp4 = self.session.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {self.superadmin_token}"}
        )
        assert resp4.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
