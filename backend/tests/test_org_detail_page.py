"""
Backend tests for Org Detail Page feature
- Tests the enhanced /api/billing/admin/org/:orgId endpoint
- Tests period filter (day/week/month/all)
- Tests expense breakdown by category
- Tests admin topup functionality
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "dmitry.bondarev@gmail.com"
TEST_PASSWORD = "Qq!11111"

# Test organizations
ORG_WITH_DATA = "57c50105-e72a-4cfd-870f-c91f8906ae7f"  # Noteall Superadmin
ORG_WITHOUT_DATA = "46bc7a21-f4ba-47ad-98ba-58fcf426b8d5"  # My Corp


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for superadmin user."""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "access_token" in data
    assert data["user"]["role"] == "superadmin"
    return data["access_token"]


@pytest.fixture
def api_client(auth_token):
    """Requests session with auth header."""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    })
    return session


class TestOrgDetailEndpoint:
    """Tests for GET /api/billing/admin/org/:orgId endpoint."""

    def test_org_detail_default_period_all(self, api_client):
        """Test org detail endpoint with default period=all."""
        response = api_client.get(f"{BASE_URL}/api/billing/admin/org/{ORG_WITH_DATA}")
        assert response.status_code == 200
        
        data = response.json()
        # Verify required fields in response
        assert "org" in data
        assert "users" in data
        assert "balance" in data
        assert "transactions" in data
        assert "expenses_by_category" in data
        assert "daily_chart" in data
        assert "total_topups" in data
        assert "total_requests" in data
        assert "total_tokens" in data
        assert "avg_monthly_spend" in data
        assert "top_users" in data
        
        # Verify expenses_by_category structure
        expenses = data["expenses_by_category"]
        assert "transcription" in expenses
        assert "analysis" in expenses
        assert "storage" in expenses
        
        # Verify org details
        assert data["org"]["id"] == ORG_WITH_DATA
        assert "name" in data["org"]
        assert "created_at" in data["org"]

    def test_org_detail_period_day(self, api_client):
        """Test org detail endpoint with period=day."""
        response = api_client.get(f"{BASE_URL}/api/billing/admin/org/{ORG_WITH_DATA}?period=day")
        assert response.status_code == 200
        
        data = response.json()
        assert data["period"] == "day"
        assert "expenses_by_category" in data
        assert "daily_chart" in data

    def test_org_detail_period_week(self, api_client):
        """Test org detail endpoint with period=week."""
        response = api_client.get(f"{BASE_URL}/api/billing/admin/org/{ORG_WITH_DATA}?period=week")
        assert response.status_code == 200
        
        data = response.json()
        assert data["period"] == "week"
        assert "expenses_by_category" in data

    def test_org_detail_period_month(self, api_client):
        """Test org detail endpoint with period=month."""
        response = api_client.get(f"{BASE_URL}/api/billing/admin/org/{ORG_WITH_DATA}?period=month")
        assert response.status_code == 200
        
        data = response.json()
        assert data["period"] == "month"
        assert "expenses_by_category" in data

    def test_org_detail_period_all_explicit(self, api_client):
        """Test org detail endpoint with period=all explicitly."""
        response = api_client.get(f"{BASE_URL}/api/billing/admin/org/{ORG_WITH_DATA}?period=all")
        assert response.status_code == 200
        
        data = response.json()
        assert data["period"] == "all"
        assert "expenses_by_category" in data

    def test_org_detail_different_periods_return_different_data(self, api_client):
        """Verify that different periods may return different data."""
        response_day = api_client.get(f"{BASE_URL}/api/billing/admin/org/{ORG_WITH_DATA}?period=day")
        response_all = api_client.get(f"{BASE_URL}/api/billing/admin/org/{ORG_WITH_DATA}?period=all")
        
        assert response_day.status_code == 200
        assert response_all.status_code == 200
        
        data_day = response_day.json()
        data_all = response_all.json()
        
        # Period should be different
        assert data_day["period"] == "day"
        assert data_all["period"] == "all"
        
        # Both should have valid expenses structure
        assert isinstance(data_day["expenses_by_category"], dict)
        assert isinstance(data_all["expenses_by_category"], dict)

    def test_org_detail_returns_users(self, api_client):
        """Verify users list is returned with correct structure."""
        response = api_client.get(f"{BASE_URL}/api/billing/admin/org/{ORG_WITH_DATA}?period=all")
        assert response.status_code == 200
        
        data = response.json()
        users = data["users"]
        assert isinstance(users, list)
        
        if len(users) > 0:
            user = users[0]
            assert "id" in user
            assert "email" in user
            assert "name" in user
            assert "role" in user

    def test_org_detail_returns_transactions(self, api_client):
        """Verify transactions list is returned with correct structure."""
        response = api_client.get(f"{BASE_URL}/api/billing/admin/org/{ORG_WITH_DATA}?period=all")
        assert response.status_code == 200
        
        data = response.json()
        transactions = data["transactions"]
        assert isinstance(transactions, list)
        
        if len(transactions) > 0:
            txn = transactions[0]
            assert "id" in txn
            assert "type" in txn
            assert "amount" in txn
            assert "description" in txn
            assert "created_at" in txn

    def test_org_detail_returns_daily_chart(self, api_client):
        """Verify daily_chart is returned with correct structure."""
        response = api_client.get(f"{BASE_URL}/api/billing/admin/org/{ORG_WITH_DATA}?period=all")
        assert response.status_code == 200
        
        data = response.json()
        daily_chart = data["daily_chart"]
        assert isinstance(daily_chart, list)
        
        if len(daily_chart) > 0:
            day = daily_chart[0]
            assert "date" in day
            assert "transcription" in day
            assert "analysis" in day
            assert "storage" in day

    def test_org_detail_returns_top_users(self, api_client):
        """Verify top_users is returned with correct structure."""
        response = api_client.get(f"{BASE_URL}/api/billing/admin/org/{ORG_WITH_DATA}?period=all")
        assert response.status_code == 200
        
        data = response.json()
        top_users = data["top_users"]
        assert isinstance(top_users, list)
        
        if len(top_users) > 0:
            user = top_users[0]
            assert "user_id" in user
            assert "name" in user
            assert "credits" in user
            assert "requests" in user

    def test_org_detail_nonexistent_org_returns_404(self, api_client):
        """Test that nonexistent org returns 404."""
        response = api_client.get(f"{BASE_URL}/api/billing/admin/org/nonexistent-org-id?period=all")
        assert response.status_code == 404

    def test_org_detail_requires_auth(self):
        """Test that endpoint requires authentication."""
        response = requests.get(f"{BASE_URL}/api/billing/admin/org/{ORG_WITH_DATA}")
        assert response.status_code in [401, 403]


class TestAdminTopup:
    """Tests for POST /api/billing/admin/topup endpoint."""

    def test_admin_topup_success(self, api_client):
        """Test successful admin topup."""
        # Get current balance
        response = api_client.get(f"{BASE_URL}/api/billing/admin/org/{ORG_WITHOUT_DATA}?period=all")
        assert response.status_code == 200
        initial_balance = response.json()["balance"]
        
        # Topup
        response = api_client.post(f"{BASE_URL}/api/billing/admin/topup", json={
            "org_id": ORG_WITHOUT_DATA,
            "amount": 50,
            "description": "Test topup from pytest"
        })
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["balance"] == initial_balance + 50

    def test_admin_topup_without_description(self, api_client):
        """Test admin topup without description uses default."""
        response = api_client.post(f"{BASE_URL}/api/billing/admin/topup", json={
            "org_id": ORG_WITHOUT_DATA,
            "amount": 10
        })
        assert response.status_code == 200
        assert "message" in response.json()

    def test_admin_topup_invalid_org_returns_404(self, api_client):
        """Test topup to nonexistent org returns 404."""
        response = api_client.post(f"{BASE_URL}/api/billing/admin/topup", json={
            "org_id": "nonexistent-org-id",
            "amount": 100
        })
        assert response.status_code == 404

    def test_admin_topup_negative_amount_returns_error(self, api_client):
        """Test topup with negative amount returns error."""
        response = api_client.post(f"{BASE_URL}/api/billing/admin/topup", json={
            "org_id": ORG_WITHOUT_DATA,
            "amount": -100
        })
        assert response.status_code == 400

    def test_admin_topup_zero_amount_returns_error(self, api_client):
        """Test topup with zero amount returns error."""
        response = api_client.post(f"{BASE_URL}/api/billing/admin/topup", json={
            "org_id": ORG_WITHOUT_DATA,
            "amount": 0
        })
        assert response.status_code == 400

    def test_admin_topup_requires_auth(self):
        """Test that admin topup requires authentication."""
        response = requests.post(f"{BASE_URL}/api/billing/admin/topup", json={
            "org_id": ORG_WITHOUT_DATA,
            "amount": 100
        })
        assert response.status_code in [401, 403]


class TestAllOrganizations:
    """Tests for GET /api/organizations/all endpoint (used in Admin > All Organizations tab)."""

    def test_list_all_organizations(self, api_client):
        """Test listing all organizations."""
        response = api_client.get(f"{BASE_URL}/api/organizations/all")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        if len(data) > 0:
            org = data[0]
            assert "id" in org
            assert "name" in org
            assert "created_at" in org
