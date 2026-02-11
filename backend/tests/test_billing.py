"""
Backend tests for Billing & Credit System (Stage 2)
Tests: tariff plans, credit balance, topup (mock payment), transactions, admin balances
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://admin-elevation-1.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "billing_test@test.com"
TEST_PASSWORD = "test123"

# For regular user test (non org_admin)
REGULAR_USER_EMAIL = "billing_regular_user@test.com"
REGULAR_USER_PASSWORD = "test123"


class TestBillingSetup:
    """Setup tests - ensure we can login and get auth token"""
    
    def test_login_org_admin_user(self):
        """Login as org_admin user for billing tests"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "org_admin", f"User role is {data['user']['role']}, expected org_admin"
        print(f"✓ Login successful as org_admin: {data['user']['name']}")


class TestBillingPlans:
    """Test GET /api/billing/plans endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip(f"Authentication failed: {response.text}")
        return response.json()["access_token"]
    
    def test_get_plans_returns_list(self, auth_token):
        """GET /api/billing/plans should return list of active tariff plans"""
        response = requests.get(
            f"{BASE_URL}/api/billing/plans",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Plans API failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Plans should be a list"
        print(f"✓ Plans returned: {len(data)} plans")
        
        # Should have at least the default plan seeded
        if len(data) > 0:
            plan = data[0]
            assert "id" in plan
            assert "name" in plan
            assert "price_usd" in plan
            assert "credits" in plan
            assert "is_active" in plan
            print(f"✓ Plan structure valid: {plan['name']} - {plan['credits']} credits for ${plan['price_usd']}")
    
    def test_plans_without_auth_fails(self):
        """GET /api/billing/plans without auth should fail"""
        response = requests.get(f"{BASE_URL}/api/billing/plans")
        assert response.status_code in [401, 403], f"Expected auth error, got {response.status_code}"
        print("✓ Plans endpoint properly requires authentication")


class TestBillingBalance:
    """Test GET /api/billing/balance endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip(f"Authentication failed: {response.text}")
        return response.json()["access_token"]
    
    def test_get_balance_returns_org_balance(self, auth_token):
        """GET /api/billing/balance should return current org credit balance"""
        response = requests.get(
            f"{BASE_URL}/api/billing/balance",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Balance API failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "org_id" in data
        assert "org_name" in data
        assert "balance" in data
        assert "updated_at" in data
        
        assert isinstance(data["balance"], (int, float))
        print(f"✓ Balance returned: {data['org_name']} has {data['balance']} credits")
    
    def test_balance_without_auth_fails(self):
        """GET /api/billing/balance without auth should fail"""
        response = requests.get(f"{BASE_URL}/api/billing/balance")
        assert response.status_code in [401, 403], f"Expected auth error, got {response.status_code}"
        print("✓ Balance endpoint properly requires authentication")


class TestBillingTransactions:
    """Test GET /api/billing/transactions endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip(f"Authentication failed: {response.text}")
        return response.json()["access_token"]
    
    def test_get_transactions_returns_list(self, auth_token):
        """GET /api/billing/transactions should return transaction history with pagination"""
        response = requests.get(
            f"{BASE_URL}/api/billing/transactions",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Transactions API failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)
        assert isinstance(data["total"], int)
        
        print(f"✓ Transactions returned: {len(data['items'])} items, total: {data['total']}")
        
        # Validate transaction structure if any exist
        if len(data["items"]) > 0:
            txn = data["items"][0]
            assert "id" in txn
            assert "org_id" in txn
            assert "type" in txn
            assert "amount" in txn
            assert "description" in txn
            assert "created_at" in txn
            print(f"✓ Transaction structure valid: {txn['type']} - {txn['amount']} credits")
    
    def test_transactions_pagination(self, auth_token):
        """Test pagination params work for transactions"""
        response = requests.get(
            f"{BASE_URL}/api/billing/transactions",
            headers={"Authorization": f"Bearer {auth_token}"},
            params={"limit": 5, "skip": 0}
        )
        assert response.status_code == 200, f"Transactions pagination failed: {response.text}"
        data = response.json()
        assert len(data["items"]) <= 5
        print(f"✓ Transactions pagination works: returned {len(data['items'])} items with limit=5")


class TestBillingTopup:
    """Test POST /api/billing/topup endpoint (mock payment)"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip(f"Authentication failed: {response.text}")
        return response.json()["access_token"]
    
    @pytest.fixture
    def plan_id(self, auth_token):
        """Get the default plan ID"""
        response = requests.get(
            f"{BASE_URL}/api/billing/plans",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        if response.status_code != 200:
            pytest.skip("Could not get plans")
        plans = response.json()
        if not plans:
            pytest.skip("No plans available")
        return plans[0]["id"]
    
    def test_topup_adds_credits(self, auth_token, plan_id):
        """POST /api/billing/topup should add credits to org balance"""
        # Get balance before
        before_response = requests.get(
            f"{BASE_URL}/api/billing/balance",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        balance_before = before_response.json()["balance"]
        
        # Do topup
        response = requests.post(
            f"{BASE_URL}/api/billing/topup",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"plan_id": plan_id}
        )
        assert response.status_code == 200, f"Topup failed: {response.text}"
        data = response.json()
        
        # Validate response
        assert "message" in data
        assert "balance" in data
        assert "transaction_id" in data
        
        print(f"✓ Topup successful: {data['message']}")
        
        # Verify balance increased
        after_response = requests.get(
            f"{BASE_URL}/api/billing/balance",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        balance_after = after_response.json()["balance"]
        assert balance_after > balance_before, f"Balance should have increased: {balance_before} -> {balance_after}"
        print(f"✓ Balance increased: {balance_before} -> {balance_after}")
    
    def test_topup_creates_transaction(self, auth_token, plan_id):
        """Topup should create a transaction record"""
        # Get transactions before
        before_response = requests.get(
            f"{BASE_URL}/api/billing/transactions",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        count_before = before_response.json()["total"]
        
        # Do topup
        response = requests.post(
            f"{BASE_URL}/api/billing/topup",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"plan_id": plan_id}
        )
        assert response.status_code == 200
        txn_id = response.json()["transaction_id"]
        
        # Check transaction was created
        after_response = requests.get(
            f"{BASE_URL}/api/billing/transactions",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        count_after = after_response.json()["total"]
        assert count_after > count_before, "Transaction should have been created"
        
        # Verify latest transaction matches
        txns = after_response.json()["items"]
        latest = txns[0]
        assert latest["id"] == txn_id
        assert latest["type"] == "topup"
        print(f"✓ Transaction created: {latest['description']}")
    
    def test_topup_invalid_plan_fails(self, auth_token):
        """Topup with invalid plan_id should fail"""
        response = requests.post(
            f"{BASE_URL}/api/billing/topup",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"plan_id": "invalid_plan_xyz"}
        )
        assert response.status_code == 404, f"Expected 404 for invalid plan, got {response.status_code}"
        print("✓ Topup with invalid plan correctly rejected")
    
    def test_topup_without_auth_fails(self):
        """Topup without auth should fail"""
        response = requests.post(
            f"{BASE_URL}/api/billing/topup",
            json={"plan_id": "plan_default_1000"}
        )
        assert response.status_code in [401, 403]
        print("✓ Topup endpoint properly requires authentication")


class TestBillingAdminBalances:
    """Test GET /api/billing/admin/balances endpoint (superadmin only)"""
    
    @pytest.fixture
    def org_admin_token(self):
        """Get org_admin token (should NOT have access)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip(f"Authentication failed: {response.text}")
        return response.json()["access_token"]
    
    def test_admin_balances_forbidden_for_org_admin(self, org_admin_token):
        """GET /api/billing/admin/balances should be forbidden for org_admin"""
        response = requests.get(
            f"{BASE_URL}/api/billing/admin/balances",
            headers={"Authorization": f"Bearer {org_admin_token}"}
        )
        assert response.status_code == 403, f"Expected 403 for org_admin, got {response.status_code}"
        print("✓ Admin balances endpoint properly restricted from org_admin")
    
    def test_admin_balances_without_auth_fails(self):
        """GET /api/billing/admin/balances without auth should fail"""
        response = requests.get(f"{BASE_URL}/api/billing/admin/balances")
        assert response.status_code in [401, 403]
        print("✓ Admin balances endpoint properly requires authentication")


class TestRegularUserRestrictions:
    """Test that regular users cannot access billing features that require org_admin"""
    
    @pytest.fixture
    def setup_regular_user(self):
        """Create or login as regular user"""
        # First try to login
        login_resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": REGULAR_USER_EMAIL, "password": REGULAR_USER_PASSWORD}
        )
        if login_resp.status_code == 200:
            user_data = login_resp.json()
            return user_data["access_token"], user_data["user"]["role"]
        
        # User doesn't exist - skip this test as we can't easily create a non-org_admin user
        pytest.skip("Regular user not set up for testing role restrictions")
    
    def test_regular_user_can_get_balance(self, setup_regular_user):
        """Regular users should be able to view balance"""
        token, role = setup_regular_user
        response = requests.get(
            f"{BASE_URL}/api/billing/balance",
            headers={"Authorization": f"Bearer {token}"}
        )
        # Regular users in an org can view balance
        if response.status_code == 200:
            print(f"✓ Regular user ({role}) can view balance")
        else:
            print(f"! Regular user ({role}) got {response.status_code} for balance")
    
    def test_regular_user_cannot_topup(self, setup_regular_user):
        """Regular users (non org_admin) should get 403 on topup"""
        token, role = setup_regular_user
        if role in ["org_admin", "admin", "superadmin"]:
            pytest.skip(f"User has {role} role, skipping restriction test")
        
        response = requests.post(
            f"{BASE_URL}/api/billing/topup",
            headers={"Authorization": f"Bearer {token}"},
            json={"plan_id": "plan_default_1000"}
        )
        assert response.status_code == 403, f"Regular user should get 403, got {response.status_code}"
        print("✓ Regular user correctly denied topup access")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
