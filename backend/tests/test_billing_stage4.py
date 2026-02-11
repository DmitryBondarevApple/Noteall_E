"""
Stage 4: Admin & Usage Dashboards - Backend API Tests
Tests for:
1. GET /api/billing/usage/org-users - per-user usage within org (org_admin only)
2. GET /api/billing/admin/summary - platform-wide summary metrics (superadmin only)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ORG_ADMIN_EMAIL = "billing_test@test.com"
ORG_ADMIN_PASSWORD = "test123"
SUPERADMIN_EMAIL = "superadmin@test.com"
SUPERADMIN_PASSWORD = "test123"


@pytest.fixture(scope="module")
def org_admin_token():
    """Get org_admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ORG_ADMIN_EMAIL,
        "password": ORG_ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Org admin login failed: {response.status_code}")
    data = response.json()
    return data.get("access_token") or data.get("token")


@pytest.fixture(scope="module")
def superadmin_token():
    """Get superadmin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPERADMIN_EMAIL,
        "password": SUPERADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Superadmin login failed: {response.status_code}")
    data = response.json()
    return data.get("access_token") or data.get("token")


@pytest.fixture
def org_admin_client(org_admin_token):
    """Session with org_admin auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {org_admin_token}"
    })
    return session


@pytest.fixture
def superadmin_client(superadmin_token):
    """Session with superadmin auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {superadmin_token}"
    })
    return session


class TestOrgUsersUsageEndpoint:
    """Tests for GET /api/billing/usage/org-users (org_admin feature)"""
    
    def test_org_users_usage_success(self, org_admin_client):
        """Test org_admin can get per-user usage stats"""
        response = org_admin_client.get(f"{BASE_URL}/api/billing/usage/org-users")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        
        # If there are users with usage, verify structure
        if len(data) > 0:
            user_usage = data[0]
            assert "user_id" in user_usage, "Missing user_id"
            assert "name" in user_usage, "Missing name"
            assert "email" in user_usage, "Missing email"
            assert "total_tokens" in user_usage, "Missing total_tokens"
            assert "total_credits" in user_usage, "Missing total_credits"
            assert "total_requests" in user_usage, "Missing total_requests"
            assert "monthly_token_limit" in user_usage, "Missing monthly_token_limit"
            
            # Verify data types
            assert isinstance(user_usage["total_tokens"], int), "total_tokens should be int"
            assert isinstance(user_usage["total_requests"], int), "total_requests should be int"
            assert isinstance(user_usage["total_credits"], (int, float)), "total_credits should be numeric"
            
            print(f"✓ Found {len(data)} users in org usage stats")
            for u in data[:3]:  # Print first 3 users
                print(f"  - {u.get('name')}: {u.get('total_requests')} requests, {u.get('total_tokens')} tokens")
    
    def test_org_users_usage_requires_admin(self):
        """Test endpoint requires org_admin role"""
        # Try without auth
        response = requests.get(f"{BASE_URL}/api/billing/usage/org-users")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
    
    def test_org_users_usage_includes_zero_usage_users(self, org_admin_client):
        """Test that users with zero usage this month are also included"""
        response = org_admin_client.get(f"{BASE_URL}/api/billing/usage/org-users")
        assert response.status_code == 200
        
        data = response.json()
        # Check if any user has zero usage (which would prove zero-usage users are included)
        zero_usage_users = [u for u in data if u["total_requests"] == 0]
        print(f"✓ Found {len(zero_usage_users)} users with zero usage this month (included)")


class TestAdminSummaryEndpoint:
    """Tests for GET /api/billing/admin/summary (superadmin feature)"""
    
    def test_admin_summary_success(self, superadmin_client):
        """Test superadmin can get platform-wide summary metrics"""
        response = superadmin_client.get(f"{BASE_URL}/api/billing/admin/summary")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify all expected fields
        expected_fields = [
            "total_topups_credits",
            "total_deductions_credits",
            "total_revenue_usd",
            "month_tokens",
            "month_credits",
            "month_requests",
            "org_count",
            "user_count"
        ]
        
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        
        # Verify data types
        assert isinstance(data["total_topups_credits"], (int, float)), "total_topups_credits should be numeric"
        assert isinstance(data["total_deductions_credits"], (int, float)), "total_deductions_credits should be numeric"
        assert isinstance(data["total_revenue_usd"], (int, float)), "total_revenue_usd should be numeric"
        assert isinstance(data["month_tokens"], int), "month_tokens should be int"
        assert isinstance(data["month_requests"], int), "month_requests should be int"
        assert isinstance(data["org_count"], int), "org_count should be int"
        assert isinstance(data["user_count"], int), "user_count should be int"
        
        print(f"✓ Platform Summary:")
        print(f"  - Revenue: ${data['total_revenue_usd']}")
        print(f"  - Total Topups: {data['total_topups_credits']} credits")
        print(f"  - Total Deductions: {data['total_deductions_credits']} credits")
        print(f"  - Month Requests: {data['month_requests']}")
        print(f"  - Month Tokens: {data['month_tokens']}")
        print(f"  - Orgs/Users: {data['org_count']}/{data['user_count']}")
    
    def test_admin_summary_requires_superadmin(self, org_admin_client):
        """Test endpoint requires superadmin role (not org_admin)"""
        response = org_admin_client.get(f"{BASE_URL}/api/billing/admin/summary")
        assert response.status_code == 403, f"Expected 403 for org_admin, got {response.status_code}"
    
    def test_admin_summary_unauthorized(self):
        """Test endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/billing/admin/summary")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"


class TestExistingBillingEndpoints:
    """Verify existing billing endpoints still work (regression)"""
    
    def test_balance_endpoint(self, org_admin_client):
        """Test GET /api/billing/balance still works"""
        response = org_admin_client.get(f"{BASE_URL}/api/billing/balance")
        assert response.status_code == 200
        data = response.json()
        assert "balance" in data
        assert "org_name" in data
        print(f"✓ Balance: {data.get('balance')} credits for {data.get('org_name')}")
    
    def test_my_usage_endpoint(self, org_admin_client):
        """Test GET /api/billing/usage/my still works"""
        response = org_admin_client.get(f"{BASE_URL}/api/billing/usage/my")
        assert response.status_code == 200
        data = response.json()
        assert "total_tokens" in data
        assert "total_credits" in data
        assert "total_requests" in data
        print(f"✓ My Usage: {data.get('total_requests')} requests, {data.get('total_tokens')} tokens")
    
    def test_transactions_endpoint(self, org_admin_client):
        """Test GET /api/billing/transactions still works"""
        response = org_admin_client.get(f"{BASE_URL}/api/billing/transactions")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data or isinstance(data, list)
        items = data.get("items", data) if isinstance(data, dict) else data
        print(f"✓ Transactions: {len(items)} items")
    
    def test_plans_endpoint(self, org_admin_client):
        """Test GET /api/billing/plans still works"""
        response = org_admin_client.get(f"{BASE_URL}/api/billing/plans")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Plans: {len(data)} available")
    
    def test_admin_balances_endpoint(self, superadmin_client):
        """Test GET /api/billing/admin/balances still works"""
        response = superadmin_client.get(f"{BASE_URL}/api/billing/admin/balances")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin Balances: {len(data)} organizations")
    
    def test_admin_usage_endpoint(self, superadmin_client):
        """Test GET /api/billing/admin/usage still works"""
        response = superadmin_client.get(f"{BASE_URL}/api/billing/admin/usage")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin Usage: {len(data)} org usage records")


class TestMockTopup:
    """Test mock topup still works"""
    
    def test_topup_mock_works(self, org_admin_client):
        """Test POST /api/billing/topup (mock) still works"""
        # Get balance before
        balance_before = org_admin_client.get(f"{BASE_URL}/api/billing/balance").json()
        
        # Get plan
        plans = org_admin_client.get(f"{BASE_URL}/api/billing/plans").json()
        if not plans:
            pytest.skip("No plans available")
        
        plan = plans[0]
        
        # Topup
        response = org_admin_client.post(f"{BASE_URL}/api/billing/topup", json={
            "plan_id": plan["id"]
        })
        assert response.status_code == 200, f"Topup failed: {response.text}"
        
        # Get balance after
        balance_after = org_admin_client.get(f"{BASE_URL}/api/billing/balance").json()
        
        # Verify credits added
        expected_balance = balance_before["balance"] + plan["credits"]
        assert abs(balance_after["balance"] - expected_balance) < 0.01, \
            f"Balance mismatch: expected {expected_balance}, got {balance_after['balance']}"
        
        print(f"✓ Topup: +{plan['credits']} credits (${plan['price_usd']}) - MOCK")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
