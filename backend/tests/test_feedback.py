"""
Test cases for Feedback feature - POST /api/feedback/suggest endpoint
Tests: Authentication, text-only feedback, screenshot feedback, validation
"""

import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "dmitry.bondarev@gmail.com"
TEST_PASSWORD = "Qq!11111"


class TestFeedbackEndpoint:
    """Test the feedback suggest endpoint"""

    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            timeout=30
        )
        if response.status_code != 200:
            pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
        
        data = response.json()
        token = data.get("token") or data.get("access_token")
        assert token, "No token in response"
        return token

    @pytest.fixture
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}"}

    def test_feedback_requires_authentication(self):
        """Test that feedback endpoint returns 403 without token"""
        form_data = {"text": "Test feedback without auth"}
        response = requests.post(
            f"{BASE_URL}/api/feedback/suggest",
            data=form_data,
            timeout=30
        )
        # Should be 403 Forbidden or 401 Unauthorized
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"

    def test_feedback_text_only_success(self, auth_headers):
        """Test sending text-only feedback (no screenshot)"""
        form_data = {
            "text": "TEST_This is a test feedback message from automated testing",
            "email": "test@example.com",
            "telegram": "@testuser"
        }
        response = requests.post(
            f"{BASE_URL}/api/feedback/suggest",
            data=form_data,
            headers=auth_headers,
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data, "Response should contain 'success' field"
        assert data["success"] == True, f"Expected success=True, got {data}"

    def test_feedback_with_screenshot_success(self, auth_headers):
        """Test sending feedback with screenshot attachment"""
        # Create a valid 10x10 white PNG using PIL/pillow
        try:
            from PIL import Image
            img = Image.new('RGB', (100, 100), color='blue')
            img_buffer = io.BytesIO()
            img.save(img_buffer, format='PNG')
            png_data = img_buffer.getvalue()
        except ImportError:
            # Fallback: use a pre-generated valid minimal PNG (8x8 white)
            import base64
            png_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAADklEQVQI12P4////GeMMAAPdAf8BWjcAAAAASUVORK5CYII="
            png_data = base64.b64decode(png_base64)
        
        files = {
            "screenshot": ("test_screenshot.png", io.BytesIO(png_data), "image/png")
        }
        form_data = {
            "text": "TEST_Feedback with screenshot from automated testing",
            "email": "test@example.com"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/feedback/suggest",
            data=form_data,
            files=files,
            headers=auth_headers,
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data, "Response should contain 'success' field"
        assert data["success"] == True, f"Expected success=True, got {data}"

    def test_feedback_empty_text_validation(self, auth_headers):
        """Test that empty text is handled (may be rejected by backend or return error)"""
        form_data = {
            "text": "",
            "email": "test@example.com"
        }
        response = requests.post(
            f"{BASE_URL}/api/feedback/suggest",
            data=form_data,
            headers=auth_headers,
            timeout=30
        )
        # Either 422 validation error or 400 bad request, or backend may handle it
        # Note: FastAPI Form(...) requires the field, so empty string should still work
        # but logically we may want to reject it
        assert response.status_code in [200, 400, 422], f"Unexpected status: {response.status_code}"

    def test_feedback_minimal_data(self, auth_headers):
        """Test feedback with only required text field"""
        form_data = {
            "text": "TEST_Minimal feedback - only text"
        }
        response = requests.post(
            f"{BASE_URL}/api/feedback/suggest",
            data=form_data,
            headers=auth_headers,
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"Expected success=True, got {data}"

    def test_feedback_telegram_only(self, auth_headers):
        """Test feedback with telegram contact but no email"""
        form_data = {
            "text": "TEST_Feedback with telegram only",
            "telegram": "@mytelegram"
        }
        response = requests.post(
            f"{BASE_URL}/api/feedback/suggest",
            data=form_data,
            headers=auth_headers,
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"Expected success=True, got {data}"


class TestAuthenticationFlow:
    """Test login flow used before feedback"""

    def test_login_success(self):
        """Verify login works with test credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            timeout=30
        )
        assert response.status_code == 200, f"Login failed: {response.status_code} - {response.text}"
        
        data = response.json()
        token = data.get("token") or data.get("access_token")
        assert token, "No token in login response"
        
        user = data.get("user")
        assert user, "No user in login response"
        assert user.get("email") == TEST_EMAIL, f"Email mismatch: expected {TEST_EMAIL}, got {user.get('email')}"

    def test_login_invalid_password(self):
        """Verify login fails with wrong password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": "wrongpassword"},
            timeout=30
        )
        assert response.status_code in [400, 401, 403], f"Expected auth error, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
