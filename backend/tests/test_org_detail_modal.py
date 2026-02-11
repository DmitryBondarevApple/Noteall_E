"""
Org Detail Modal - Backend API Tests
Tests for:
1. GET /api/billing/admin/org/{org_id} - returns full org detail with users, transactions, balance, monthly chart, top users, stats
2. POST /api/billing/admin/topup - superadmin manual topup with org_id, amount, description
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPERADMIN_EMAIL = "superadmin@test.com"
SUPERADMIN_PASSWORD = "test123"
ORG_ADMIN_EMAIL = "billing_test@test.com"
ORG_ADMIN_PASSWORD = "test123"
TEST_ORG_ID = "29d490b6-74f3-478a-9f98-8c570e50b6ce"  # Test Billing Org


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


@pytest.fixture
def superadmin_client(superadmin_token):
    """Session with superadmin auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {superadmin_token}"
    })
    return session


@pytest.fixture
def org_admin_client(org_admin_token):
    """Session with org_admin auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {org_admin_token}"
    })
    return session


class TestAdminOrgDetailEndpoint:
    """Tests for GET /api/billing/admin/org/{org_id}"""
    
    def test_get_org_detail_success(self, superadmin_client):
        """Test superadmin can get full org details"""
        response = superadmin_client.get(f"{BASE_URL}/api/billing/admin/org/{TEST_ORG_ID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify org info present
        assert "org" in data, "Missing org info"
        assert data["org"] is not None, "Org should not be null"
        assert "id" in data["org"], "Missing org.id"
        assert "name" in data["org"], "Missing org.name"
        
        # Verify users array
        assert "users" in data, "Missing users array"
        assert isinstance(data["users"], list), "users should be array"
        
        # Verify balance
        assert "balance" in data, "Missing balance"
        assert isinstance(data["balance"], (int, float)), "balance should be numeric"
        
        # Verify transactions
        assert "transactions" in data, "Missing transactions"
        assert isinstance(data["transactions"], list), "transactions should be array"
        
        # Verify totals
        assert "total_topups" in data, "Missing total_topups"
        assert "total_deductions" in data, "Missing total_deductions"
        
        # Verify monthly chart
        assert "monthly_chart" in data, "Missing monthly_chart"
        assert isinstance(data["monthly_chart"], list), "monthly_chart should be array"
        
        # Verify avg monthly spend
        assert "avg_monthly_spend" in data, "Missing avg_monthly_spend"
        
        # Verify top users
        assert "top_users" in data, "Missing top_users"
        assert isinstance(data["top_users"], list), "top_users should be array"
        
        # Verify AI stats
        assert "total_requests" in data, "Missing total_requests"
        assert "total_tokens" in data, "Missing total_tokens"
        assert "total_credits_spent" in data, "Missing total_credits_spent"
        assert "avg_request_cost" in data, "Missing avg_request_cost"
        
        print(f"✓ Org Detail for {data['org']['name']}:")
        print(f"  - Balance: {data['balance']} credits")
        print(f"  - Users: {len(data['users'])}")
        print(f"  - Transactions: {len(data['transactions'])}")
        print(f"  - Total topups: {data['total_topups']}")
        print(f"  - Total deductions: {data['total_deductions']}")
        print(f"  - AI requests: {data['total_requests']}")
        print(f"  - Total tokens: {data['total_tokens']}")
        print(f"  - Total credits spent: {data['total_credits_spent']}")
        print(f"  - Avg request cost: {data['avg_request_cost']}")
        print(f"  - Avg monthly spend: {data['avg_monthly_spend']}")
        print(f"  - Monthly chart entries: {len(data['monthly_chart'])}")
        print(f"  - Top users: {len(data['top_users'])}")
    
    def test_get_org_detail_user_fields(self, superadmin_client):
        """Test user data includes required fields"""
        response = superadmin_client.get(f"{BASE_URL}/api/billing/admin/org/{TEST_ORG_ID}")
        assert response.status_code == 200
        
        data = response.json()
        if len(data["users"]) > 0:
            user = data["users"][0]
            assert "id" in user, "Missing user.id"
            assert "name" in user, "Missing user.name"
            assert "email" in user, "Missing user.email"
            assert "role" in user, "Missing user.role"
            assert "created_at" in user, "Missing user.created_at (registration date)"
            assert "monthly_token_limit" in user, "Missing user.monthly_token_limit"
            
            print(f"✓ User data verified:")
            print(f"  - Name: {user.get('name')}")
            print(f"  - Email: {user.get('email')}")
            print(f"  - Role: {user.get('role')}")
            print(f"  - Registered: {user.get('created_at')}")
            print(f"  - Token limit: {user.get('monthly_token_limit')}")
    
    def test_get_org_detail_top_users_fields(self, superadmin_client):
        """Test top users data includes required fields"""
        response = superadmin_client.get(f"{BASE_URL}/api/billing/admin/org/{TEST_ORG_ID}")
        assert response.status_code == 200
        
        data = response.json()
        if len(data["top_users"]) > 0:
            top_user = data["top_users"][0]
            assert "user_id" in top_user, "Missing top_user.user_id"
            assert "name" in top_user, "Missing top_user.name"
            assert "credits" in top_user, "Missing top_user.credits"
            assert "tokens" in top_user, "Missing top_user.tokens"
            assert "requests" in top_user, "Missing top_user.requests"
            
            print(f"✓ Top user verified:")
            print(f"  - Name: {top_user.get('name')}")
            print(f"  - Credits: {top_user.get('credits')}")
            print(f"  - Tokens: {top_user.get('tokens')}")
            print(f"  - Requests: {top_user.get('requests')}")
    
    def test_get_org_detail_monthly_chart_fields(self, superadmin_client):
        """Test monthly chart data includes required fields"""
        response = superadmin_client.get(f"{BASE_URL}/api/billing/admin/org/{TEST_ORG_ID}")
        assert response.status_code == 200
        
        data = response.json()
        if len(data["monthly_chart"]) > 0:
            month_entry = data["monthly_chart"][0]
            assert "month" in month_entry, "Missing monthly_chart.month"
            assert "credits" in month_entry, "Missing monthly_chart.credits"
            assert "tokens" in month_entry, "Missing monthly_chart.tokens"
            assert "requests" in month_entry, "Missing monthly_chart.requests"
            
            print(f"✓ Monthly chart verified: {len(data['monthly_chart'])} months")
            for m in data["monthly_chart"]:
                print(f"  - {m['month']}: {m['credits']} credits, {m['tokens']} tokens")
    
    def test_get_org_detail_not_found(self, superadmin_client):
        """Test 404 for non-existent org"""
        response = superadmin_client.get(f"{BASE_URL}/api/billing/admin/org/00000000-0000-0000-0000-000000000000")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent org returns 404")
    
    def test_get_org_detail_requires_superadmin(self, org_admin_client):
        """Test endpoint requires superadmin role (not org_admin)"""
        response = org_admin_client.get(f"{BASE_URL}/api/billing/admin/org/{TEST_ORG_ID}")
        assert response.status_code == 403, f"Expected 403 for org_admin, got {response.status_code}"
        print("✓ org_admin cannot access admin/org endpoint (403)")
    
    def test_get_org_detail_unauthorized(self):
        """Test endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/billing/admin/org/{TEST_ORG_ID}")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ Unauthenticated request rejected")


class TestAdminTopupEndpoint:
    """Tests for POST /api/billing/admin/topup"""
    
    def test_admin_topup_success(self, superadmin_client):
        """Test superadmin can manually topup any org"""
        # Get balance before
        org_detail_before = superadmin_client.get(f"{BASE_URL}/api/billing/admin/org/{TEST_ORG_ID}").json()
        balance_before = org_detail_before["balance"]
        
        # Topup
        topup_amount = 100.0
        topup_desc = "Test manual topup via pytest"
        response = superadmin_client.post(f"{BASE_URL}/api/billing/admin/topup", json={
            "org_id": TEST_ORG_ID,
            "amount": topup_amount,
            "description": topup_desc
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Missing message in response"
        assert "balance" in data, "Missing balance in response"
        
        # Verify balance updated
        expected_balance = balance_before + topup_amount
        assert abs(data["balance"] - expected_balance) < 0.01, \
            f"Balance mismatch: expected {expected_balance}, got {data['balance']}"
        
        # Verify via GET
        org_detail_after = superadmin_client.get(f"{BASE_URL}/api/billing/admin/org/{TEST_ORG_ID}").json()
        assert abs(org_detail_after["balance"] - expected_balance) < 0.01, \
            f"GET balance mismatch: expected {expected_balance}, got {org_detail_after['balance']}"
        
        print(f"✓ Admin topup: +{topup_amount} credits")
        print(f"  - Balance before: {balance_before}")
        print(f"  - Balance after: {data['balance']}")
        print(f"  - Description: {topup_desc}")
    
    def test_admin_topup_creates_transaction(self, superadmin_client):
        """Test admin topup creates a transaction record"""
        # Get transactions before
        org_detail_before = superadmin_client.get(f"{BASE_URL}/api/billing/admin/org/{TEST_ORG_ID}").json()
        txn_count_before = len(org_detail_before["transactions"])
        
        # Topup
        topup_amount = 50.0
        topup_desc = "Transaction test via pytest"
        response = superadmin_client.post(f"{BASE_URL}/api/billing/admin/topup", json={
            "org_id": TEST_ORG_ID,
            "amount": topup_amount,
            "description": topup_desc
        })
        assert response.status_code == 200
        
        # Verify transaction created
        org_detail_after = superadmin_client.get(f"{BASE_URL}/api/billing/admin/org/{TEST_ORG_ID}").json()
        txn_count_after = len(org_detail_after["transactions"])
        
        assert txn_count_after > txn_count_before, "Transaction should be created"
        
        # Verify latest transaction
        latest_txn = org_detail_after["transactions"][0]  # sorted by created_at desc
        assert latest_txn["type"] == "topup", f"Expected topup type, got {latest_txn['type']}"
        assert latest_txn["amount"] == topup_amount, f"Expected amount {topup_amount}, got {latest_txn['amount']}"
        assert topup_desc in latest_txn["description"] or latest_txn["description"] == topup_desc, \
            f"Description mismatch: {latest_txn['description']}"
        
        print(f"✓ Transaction created:")
        print(f"  - Type: {latest_txn['type']}")
        print(f"  - Amount: {latest_txn['amount']}")
        print(f"  - Description: {latest_txn['description']}")
    
    def test_admin_topup_without_description(self, superadmin_client):
        """Test admin topup works without description (uses default)"""
        response = superadmin_client.post(f"{BASE_URL}/api/billing/admin/topup", json={
            "org_id": TEST_ORG_ID,
            "amount": 25.0
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Admin topup works without description")
    
    def test_admin_topup_invalid_amount(self, superadmin_client):
        """Test admin topup rejects invalid amounts"""
        # Zero amount
        response = superadmin_client.post(f"{BASE_URL}/api/billing/admin/topup", json={
            "org_id": TEST_ORG_ID,
            "amount": 0
        })
        assert response.status_code == 400, f"Expected 400 for zero amount, got {response.status_code}"
        
        # Negative amount
        response = superadmin_client.post(f"{BASE_URL}/api/billing/admin/topup", json={
            "org_id": TEST_ORG_ID,
            "amount": -100
        })
        assert response.status_code == 400, f"Expected 400 for negative amount, got {response.status_code}"
        
        print("✓ Invalid amounts rejected (0 and negative)")
    
    def test_admin_topup_invalid_org(self, superadmin_client):
        """Test admin topup rejects non-existent org"""
        response = superadmin_client.post(f"{BASE_URL}/api/billing/admin/topup", json={
            "org_id": "00000000-0000-0000-0000-000000000000",
            "amount": 100
        })
        assert response.status_code == 404, f"Expected 404 for invalid org, got {response.status_code}"
        print("✓ Non-existent org rejected (404)")
    
    def test_admin_topup_requires_superadmin(self, org_admin_client):
        """Test admin topup requires superadmin role"""
        response = org_admin_client.post(f"{BASE_URL}/api/billing/admin/topup", json={
            "org_id": TEST_ORG_ID,
            "amount": 100
        })
        assert response.status_code == 403, f"Expected 403 for org_admin, got {response.status_code}"
        print("✓ org_admin cannot use admin/topup (403)")
    
    def test_admin_topup_unauthorized(self):
        """Test admin topup requires authentication"""
        response = requests.post(f"{BASE_URL}/api/billing/admin/topup", json={
            "org_id": TEST_ORG_ID,
            "amount": 100
        })
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ Unauthenticated request rejected")


class TestAdminBalancesClickable:
    """Test admin balances table returns org_id for clickable rows"""
    
    def test_admin_balances_includes_org_id(self, superadmin_client):
        """Test admin balances returns org_id for each org (for clickable rows)"""
        response = superadmin_client.get(f"{BASE_URL}/api/billing/admin/balances")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list), "Expected list"
        assert len(data) > 0, "Should have at least one org"
        
        org_entry = data[0]
        assert "org_id" in org_entry, "Missing org_id (needed for clickable row)"
        assert "org_name" in org_entry, "Missing org_name"
        assert "balance" in org_entry, "Missing balance"
        
        print(f"✓ Admin balances returns org_id for clickable rows")
        for org in data[:3]:
            print(f"  - {org.get('org_name')}: {org.get('balance')} credits (id: {org.get('org_id')[:8]}...)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
