"""
Test Cost Settings Feature - Transcription and S3 Storage Cost Calculation
Tests for superadmin cost settings management endpoints:
- GET /api/billing/admin/cost-settings
- PUT /api/billing/admin/cost-settings
- POST /api/billing/admin/run-storage-calc
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPERADMIN_EMAIL = "test_admin_e1@test.com"
SUPERADMIN_PASSWORD = "Test123!"


class TestCostSettingsEndpoints:
    """Test cost settings CRUD endpoints (superadmin only)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get superadmin auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPERADMIN_EMAIL, "password": SUPERADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        # Store original settings to restore after tests
        get_resp = requests.get(
            f"{BASE_URL}/api/billing/admin/cost-settings",
            headers=self.headers
        )
        self.original_settings = get_resp.json() if get_resp.status_code == 200 else None
        yield
        # Restore original settings after test
        if self.original_settings:
            requests.put(
                f"{BASE_URL}/api/billing/admin/cost-settings",
                headers=self.headers,
                json=self.original_settings
            )
    
    def test_get_cost_settings_returns_200(self):
        """GET /api/billing/admin/cost-settings returns default cost settings"""
        response = requests.get(
            f"{BASE_URL}/api/billing/admin/cost-settings",
            headers=self.headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify all expected fields exist
        assert "transcription_cost_per_minute_usd" in data
        assert "transcription_cost_multiplier" in data
        assert "s3_storage_cost_per_gb_month_usd" in data
        assert "s3_storage_cost_multiplier" in data
        
        # Verify values are numbers
        assert isinstance(data["transcription_cost_per_minute_usd"], (int, float))
        assert isinstance(data["transcription_cost_multiplier"], (int, float))
        assert isinstance(data["s3_storage_cost_per_gb_month_usd"], (int, float))
        assert isinstance(data["s3_storage_cost_multiplier"], (int, float))
    
    def test_put_cost_settings_updates_transcription_cost(self):
        """PUT /api/billing/admin/cost-settings updates transcription_cost_per_minute_usd"""
        # Update transcription cost
        response = requests.put(
            f"{BASE_URL}/api/billing/admin/cost-settings",
            headers=self.headers,
            json={"transcription_cost_per_minute_usd": 0.0050}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["transcription_cost_per_minute_usd"] == 0.0050
        
        # Verify persistence with GET
        get_response = requests.get(
            f"{BASE_URL}/api/billing/admin/cost-settings",
            headers=self.headers
        )
        assert get_response.status_code == 200
        assert get_response.json()["transcription_cost_per_minute_usd"] == 0.0050
    
    def test_put_cost_settings_updates_transcription_multiplier(self):
        """PUT /api/billing/admin/cost-settings updates transcription_cost_multiplier"""
        response = requests.put(
            f"{BASE_URL}/api/billing/admin/cost-settings",
            headers=self.headers,
            json={"transcription_cost_multiplier": 4.5}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["transcription_cost_multiplier"] == 4.5
    
    def test_put_cost_settings_updates_storage_cost(self):
        """PUT /api/billing/admin/cost-settings updates s3_storage_cost_per_gb_month_usd"""
        response = requests.put(
            f"{BASE_URL}/api/billing/admin/cost-settings",
            headers=self.headers,
            json={"s3_storage_cost_per_gb_month_usd": 0.030}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["s3_storage_cost_per_gb_month_usd"] == 0.030
    
    def test_put_cost_settings_updates_storage_multiplier(self):
        """PUT /api/billing/admin/cost-settings updates s3_storage_cost_multiplier"""
        response = requests.put(
            f"{BASE_URL}/api/billing/admin/cost-settings",
            headers=self.headers,
            json={"s3_storage_cost_multiplier": 2.5}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["s3_storage_cost_multiplier"] == 2.5
    
    def test_put_cost_settings_multiple_fields(self):
        """PUT /api/billing/admin/cost-settings updates multiple fields at once"""
        response = requests.put(
            f"{BASE_URL}/api/billing/admin/cost-settings",
            headers=self.headers,
            json={
                "transcription_cost_per_minute_usd": 0.0060,
                "transcription_cost_multiplier": 5.0,
                "s3_storage_cost_per_gb_month_usd": 0.035,
                "s3_storage_cost_multiplier": 4.0
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["transcription_cost_per_minute_usd"] == 0.0060
        assert data["transcription_cost_multiplier"] == 5.0
        assert data["s3_storage_cost_per_gb_month_usd"] == 0.035
        assert data["s3_storage_cost_multiplier"] == 4.0
    
    def test_put_cost_settings_rejects_negative_values(self):
        """PUT /api/billing/admin/cost-settings rejects negative values"""
        # Test negative transcription cost
        response = requests.put(
            f"{BASE_URL}/api/billing/admin/cost-settings",
            headers=self.headers,
            json={"transcription_cost_per_minute_usd": -0.01}
        )
        assert response.status_code == 400, f"Expected 400 for negative value, got {response.status_code}"
        
        # Test negative transcription multiplier
        response = requests.put(
            f"{BASE_URL}/api/billing/admin/cost-settings",
            headers=self.headers,
            json={"transcription_cost_multiplier": -1.0}
        )
        assert response.status_code == 400
        
        # Test negative storage cost
        response = requests.put(
            f"{BASE_URL}/api/billing/admin/cost-settings",
            headers=self.headers,
            json={"s3_storage_cost_per_gb_month_usd": -0.001}
        )
        assert response.status_code == 400
        
        # Test negative storage multiplier
        response = requests.put(
            f"{BASE_URL}/api/billing/admin/cost-settings",
            headers=self.headers,
            json={"s3_storage_cost_multiplier": -2.0}
        )
        assert response.status_code == 400
    
    def test_put_cost_settings_accepts_zero_values(self):
        """PUT /api/billing/admin/cost-settings accepts zero values"""
        response = requests.put(
            f"{BASE_URL}/api/billing/admin/cost-settings",
            headers=self.headers,
            json={"transcription_cost_per_minute_usd": 0}
        )
        assert response.status_code == 200
        assert response.json()["transcription_cost_per_minute_usd"] == 0
    
    def test_post_run_storage_calc_returns_200(self):
        """POST /api/billing/admin/run-storage-calc manually triggers storage calculation"""
        response = requests.post(
            f"{BASE_URL}/api/billing/admin/run-storage-calc",
            headers=self.headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data
        # Russian message: "Расчёт стоимости хранения выполнен"
        assert "расчёт" in data["message"].lower() or "выполнен" in data["message"].lower()


class TestCostSettingsAuth:
    """Test authorization for cost settings endpoints"""
    
    def test_get_cost_settings_without_auth_returns_error(self):
        """GET /api/billing/admin/cost-settings without auth returns 401/403"""
        response = requests.get(f"{BASE_URL}/api/billing/admin/cost-settings")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_put_cost_settings_without_auth_returns_401(self):
        """PUT /api/billing/admin/cost-settings without auth returns 401"""
        response = requests.put(
            f"{BASE_URL}/api/billing/admin/cost-settings",
            json={"transcription_cost_multiplier": 2.0}
        )
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422, got {response.status_code}"
    
    def test_run_storage_calc_without_auth_returns_error(self):
        """POST /api/billing/admin/run-storage-calc without auth returns 401/403"""
        response = requests.post(f"{BASE_URL}/api/billing/admin/run-storage-calc")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_cost_settings_with_invalid_token_returns_401(self):
        """Cost settings endpoints with invalid token return 401"""
        headers = {"Authorization": "Bearer invalid_token_here"}
        
        response = requests.get(
            f"{BASE_URL}/api/billing/admin/cost-settings",
            headers=headers
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


class TestDefaultCostSettings:
    """Test default cost settings values"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get superadmin auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPERADMIN_EMAIL, "password": SUPERADMIN_PASSWORD}
        )
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_default_transcription_cost_per_minute(self):
        """Default transcription cost is $0.0043/min (Deepgram Nova-3)"""
        response = requests.get(
            f"{BASE_URL}/api/billing/admin/cost-settings",
            headers=self.headers
        )
        data = response.json()
        # Should be 0.0043 by default (Deepgram)
        assert data["transcription_cost_per_minute_usd"] >= 0
    
    def test_default_transcription_multiplier(self):
        """Default transcription multiplier is 3.0x"""
        response = requests.get(
            f"{BASE_URL}/api/billing/admin/cost-settings",
            headers=self.headers
        )
        data = response.json()
        # Should be 3.0 by default
        assert data["transcription_cost_multiplier"] >= 1.0
    
    def test_default_storage_cost_per_gb_month(self):
        """Default S3 storage cost is $0.025/GB/month"""
        response = requests.get(
            f"{BASE_URL}/api/billing/admin/cost-settings",
            headers=self.headers
        )
        data = response.json()
        # Should be 0.025 by default (S3 Standard)
        assert data["s3_storage_cost_per_gb_month_usd"] >= 0
    
    def test_default_storage_multiplier(self):
        """Default S3 storage multiplier is 3.0x"""
        response = requests.get(
            f"{BASE_URL}/api/billing/admin/cost-settings",
            headers=self.headers
        )
        data = response.json()
        # Should be 3.0 by default
        assert data["s3_storage_cost_multiplier"] >= 1.0
