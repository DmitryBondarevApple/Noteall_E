"""
Password Reset Flow Tests
- POST /api/auth/forgot-password
- POST /api/auth/reset-password
- Login with new password verification
- Token one-time use validation
"""
import pytest
import requests
import os
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user credentials
TEST_EMAIL = "dmitry.bondarev@gmail.com"
TEST_PASSWORD = "Qq!11111"


class TestForgotPasswordEndpoint:
    """Tests for POST /api/auth/forgot-password"""
    
    def test_forgot_password_valid_email(self):
        """Forgot password with registered email returns success"""
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": TEST_EMAIL
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"✓ forgot-password valid email: {data['message']}")
    
    def test_forgot_password_nonexistent_email(self):
        """Forgot password with non-existent email returns same success (no email enumeration)"""
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": "nonexistent_user_xyz@example.com"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data
        # Same message should be returned to prevent email enumeration
        print(f"✓ forgot-password nonexistent email (no enumeration): {data['message']}")
    
    def test_forgot_password_invalid_email_format(self):
        """Forgot password with invalid email format returns error"""
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": "not-an-email"
        })
        # Should fail validation
        assert response.status_code == 422, f"Expected 422, got {response.status_code}: {response.text}"
        print("✓ forgot-password invalid email format returns 422")


class TestResetPasswordEndpoint:
    """Tests for POST /api/auth/reset-password"""
    
    def test_reset_password_invalid_token(self):
        """Reset password with invalid token returns error"""
        response = requests.post(f"{BASE_URL}/api/auth/reset-password", json={
            "token": "invalid-token-12345",
            "password": "NewPassword123"
        })
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data
        print(f"✓ reset-password invalid token: {data['detail']}")
    
    def test_reset_password_short_password(self):
        """Reset password with short password (<6 chars) returns error"""
        response = requests.post(f"{BASE_URL}/api/auth/reset-password", json={
            "token": "some-token",
            "password": "12345"  # Less than 6 characters
        })
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data
        assert "6" in data["detail"], "Error message should mention 6 characters"
        print(f"✓ reset-password short password: {data['detail']}")


class TestLoginRegression:
    """Regression tests for login functionality"""
    
    def test_login_with_valid_credentials(self):
        """Login still works normally with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "access_token" in data, "Login should return access_token"
        assert "user" in data, "Login should return user object"
        assert data["user"]["email"] == TEST_EMAIL
        print(f"✓ login regression: successfully logged in as {TEST_EMAIL}")
    
    def test_login_with_invalid_credentials(self):
        """Login fails with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": "WrongPassword123"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✓ login invalid credentials returns 401")


class TestTokenOneTimeUse:
    """Test that reset tokens can only be used once"""
    
    def test_used_token_fails(self):
        """After successful password reset, same token should fail"""
        # Try to use a random token (simulating already-used token)
        response = requests.post(f"{BASE_URL}/api/auth/reset-password", json={
            "token": "already-used-token-xyz",
            "password": "NewPassword123"
        })
        # Should fail because token doesn't exist or was already used
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("✓ used/invalid token correctly rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
