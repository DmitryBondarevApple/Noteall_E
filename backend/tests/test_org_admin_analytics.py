"""
Test Suite for Org Admin Analytics Dashboard
Tests:
- GET /api/billing/org/my-analytics endpoint (new org_admin analytics)
- Period filtering (day/week/month/all)
- Access control (requires admin role, 403 for regular user)
- Regression: GET /api/billing/admin/org/{org_id} still works for superadmin
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://landing-modal-update.preview.emergentagent.com"

# Test credentials
SUPERADMIN_EMAIL = "dmitry.bondarev@gmail.com"
SUPERADMIN_PASSWORD = "Qq!11111"
TEST_ORG_ID = "78a09472-fa21-4e0c-aebc-07cbd0e1272e"


@pytest.fixture(scope="module")
def superadmin_token():
    """Get authentication token for superadmin user (who is also org_admin)."""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": SUPERADMIN_EMAIL, "password": SUPERADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "access_token" in data
    assert data["user"]["role"] == "superadmin"
    return data["access_token"]


@pytest.fixture(scope="module")
def auth_headers(superadmin_token):
    """Return headers with auth token."""
    return {
        "Authorization": f"Bearer {superadmin_token}",
        "Content-Type": "application/json"
    }


class TestOrgMyAnalyticsEndpoint:
    """Tests for GET /api/billing/org/my-analytics"""

    def test_org_my_analytics_returns_200(self, auth_headers):
        """Basic test: endpoint returns 200 with valid auth."""
        response = requests.get(
            f"{BASE_URL}/api/billing/org/my-analytics",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_org_my_analytics_response_structure(self, auth_headers):
        """Verify response has all required fields for analytics dashboard."""
        response = requests.get(
            f"{BASE_URL}/api/billing/org/my-analytics",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check all required fields
        required_fields = [
            "org", "users", "balance", "balance_updated_at", "transactions",
            "total_topups", "expenses_by_category", "daily_chart", "monthly_chart",
            "avg_monthly_spend", "top_users", "total_requests", "total_tokens",
            "total_credits_spent", "avg_request_cost", "period"
        ]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        # Verify org object
        assert "id" in data["org"], "org should have id"
        assert "name" in data["org"], "org should have name"
        
        # Verify expenses_by_category structure
        expenses = data["expenses_by_category"]
        assert "transcription" in expenses, "expenses_by_category missing transcription"
        assert "analysis" in expenses, "expenses_by_category missing analysis"
        assert "storage" in expenses, "expenses_by_category missing storage"
        
        # Verify numeric types
        assert isinstance(data["balance"], (int, float)), "balance should be numeric"
        assert isinstance(data["total_topups"], (int, float)), "total_topups should be numeric"
        assert isinstance(data["total_requests"], int), "total_requests should be int"

    def test_org_my_analytics_default_period_all(self, auth_headers):
        """Verify default period is 'all' when not specified."""
        response = requests.get(
            f"{BASE_URL}/api/billing/org/my-analytics",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "all", f"Expected default period 'all', got '{data['period']}'"


class TestOrgMyAnalyticsPeriodFilter:
    """Tests for period filtering: day/week/month/all"""

    @pytest.mark.parametrize("period", ["day", "week", "month", "all"])
    def test_period_filter_valid_values(self, auth_headers, period):
        """Test all valid period values return 200."""
        response = requests.get(
            f"{BASE_URL}/api/billing/org/my-analytics",
            params={"period": period},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Period '{period}' failed: {response.text}"
        data = response.json()
        assert data["period"] == period, f"Expected period '{period}', got '{data['period']}'"

    def test_period_day_filters_data(self, auth_headers):
        """Day period should filter to today's data only."""
        response = requests.get(
            f"{BASE_URL}/api/billing/org/my-analytics",
            params={"period": "day"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        # Day period should return filtered expenses
        assert "expenses_by_category" in data
        # Daily chart should have at most 1 day of data
        assert len(data.get("daily_chart", [])) <= 1

    def test_period_week_filters_data(self, auth_headers):
        """Week period should filter to last 7 days."""
        response = requests.get(
            f"{BASE_URL}/api/billing/org/my-analytics",
            params={"period": "week"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        # Week should have at most 7 days of data
        assert len(data.get("daily_chart", [])) <= 7

    def test_period_month_filters_data(self, auth_headers):
        """Month period should filter to current month."""
        response = requests.get(
            f"{BASE_URL}/api/billing/org/my-analytics",
            params={"period": "month"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        # Month should have at most ~31 days
        assert len(data.get("daily_chart", [])) <= 31


class TestOrgMyAnalyticsAccessControl:
    """Tests for access control - requires admin role"""

    def test_unauthenticated_returns_401(self):
        """Unauthenticated request should return 401."""
        response = requests.get(f"{BASE_URL}/api/billing/org/my-analytics")
        assert response.status_code in [401, 403], f"Expected 401/403 for unauthenticated, got {response.status_code}"

    def test_invalid_token_returns_401(self):
        """Invalid token should return 401."""
        response = requests.get(
            f"{BASE_URL}/api/billing/org/my-analytics",
            headers={"Authorization": "Bearer invalid_token_12345"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403 for invalid token, got {response.status_code}"


class TestSuperadminOrgDetailRegression:
    """Regression tests: GET /api/billing/admin/org/{org_id} should still work for superadmin"""

    def test_admin_org_detail_returns_200(self, auth_headers):
        """Superadmin should still be able to access admin/org/{org_id}."""
        response = requests.get(
            f"{BASE_URL}/api/billing/admin/org/{TEST_ORG_ID}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_admin_org_detail_response_structure(self, auth_headers):
        """Verify superadmin endpoint has same structure as org_my_analytics."""
        response = requests.get(
            f"{BASE_URL}/api/billing/admin/org/{TEST_ORG_ID}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should have same required fields
        required_fields = [
            "org", "users", "balance", "transactions", "total_topups",
            "expenses_by_category", "daily_chart", "monthly_chart", "top_users"
        ]
        for field in required_fields:
            assert field in data, f"Admin endpoint missing field: {field}"

    def test_admin_org_detail_period_filter(self, auth_headers):
        """Superadmin endpoint should also support period filter."""
        for period in ["day", "week", "month", "all"]:
            response = requests.get(
                f"{BASE_URL}/api/billing/admin/org/{TEST_ORG_ID}",
                params={"period": period},
                headers=auth_headers
            )
            assert response.status_code == 200, f"Admin endpoint period={period} failed"
            assert response.json()["period"] == period

    def test_admin_org_detail_nonexistent_org_returns_404(self, auth_headers):
        """Superadmin endpoint should return 404 for non-existent org."""
        response = requests.get(
            f"{BASE_URL}/api/billing/admin/org/non-existent-org-id-12345",
            headers=auth_headers
        )
        assert response.status_code == 404, f"Expected 404 for non-existent org, got {response.status_code}"


class TestDataConsistencyBetweenEndpoints:
    """Verify org_my_analytics and admin/org/{org_id} return consistent data"""

    def test_data_consistency_for_same_org(self, auth_headers):
        """Data from org/my-analytics should match admin/org/{org_id} for same org."""
        # Get data from org/my-analytics
        my_response = requests.get(
            f"{BASE_URL}/api/billing/org/my-analytics",
            headers=auth_headers
        )
        assert my_response.status_code == 200
        my_data = my_response.json()
        
        # Get data from admin/org/{org_id}
        admin_response = requests.get(
            f"{BASE_URL}/api/billing/admin/org/{my_data['org']['id']}",
            headers=auth_headers
        )
        assert admin_response.status_code == 200
        admin_data = admin_response.json()
        
        # Verify key metrics match
        assert my_data["balance"] == admin_data["balance"], "Balance mismatch"
        assert my_data["total_topups"] == admin_data["total_topups"], "Total topups mismatch"
        assert my_data["org"]["id"] == admin_data["org"]["id"], "Org ID mismatch"
        assert my_data["org"]["name"] == admin_data["org"]["name"], "Org name mismatch"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
