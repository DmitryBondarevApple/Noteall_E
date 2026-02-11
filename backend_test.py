import requests
import sys
import json
from datetime import datetime
import time

class VoiceWorkspaceAPITester:
    def __init__(self, base_url="https://transcript-analysis-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.admin_token = None
        self.test_user_id = None
        self.test_project_id = None
        self.test_prompt_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def log_result(self, test_name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name}")
        else:
            print(f"❌ {test_name} - {details}")
            self.failed_tests.append({"test": test_name, "error": details})

    def make_request(self, method, endpoint, data=None, files=None, use_admin=False):
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        token = self.admin_token if use_admin else self.token
        if token:
            headers['Authorization'] = f'Bearer {token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    # Remove Content-Type for file uploads
                    headers.pop('Content-Type', None)
                    response = requests.post(url, files=files, headers=headers)
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)
            
            return response
        except Exception as e:
            return None

    def test_seed_data(self):
        """Test seeding initial data"""
        response = self.make_request('POST', 'seed')
        success = response and response.status_code in [200, 400]  # 400 if already seeded
        self.log_result("Seed initial data", success, 
                       f"Status: {response.status_code if response else 'No response'}")
        return success

    def test_user_registration(self):
        """Test user registration"""
        timestamp = int(time.time())
        user_data = {
            "email": f"testuser{timestamp}@example.com",
            "password": "testpass123",
            "name": f"Test User {timestamp}"
        }
        
        response = self.make_request('POST', 'auth/register', user_data)
        success = response and response.status_code == 200
        
        if success:
            data = response.json()
            self.token = data.get('access_token')
            self.test_user_id = data.get('user', {}).get('id')
        
        self.log_result("User registration", success, 
                       f"Status: {response.status_code if response else 'No response'}")
        return success

    def test_admin_login(self):
        """Test admin login"""
        admin_data = {
            "email": "admin@voiceworkspace.com",
            "password": "admin123"
        }
        
        response = self.make_request('POST', 'auth/login', admin_data)
        success = response and response.status_code == 200
        
        if success:
            data = response.json()
            self.admin_token = data.get('access_token')
        
        self.log_result("Admin login", success, 
                       f"Status: {response.status_code if response else 'No response'}")
        return success

    def test_user_login(self):
        """Test user login with registered user"""
        # Try to login with the registered user
        if not self.test_user_id:
            return False
            
        # We'll use the token from registration
        response = self.make_request('GET', 'auth/me')
        success = response and response.status_code == 200
        
        self.log_result("User authentication check", success, 
                       f"Status: {response.status_code if response else 'No response'}")
        return success

    def test_create_project(self):
        """Test project creation"""
        project_data = {
            "name": "Test Meeting Project",
            "description": "Test project for API testing"
        }
        
        response = self.make_request('POST', 'projects', project_data)
        success = response and response.status_code == 200
        
        if success:
            data = response.json()
            self.test_project_id = data.get('id')
        
        self.log_result("Create project", success, 
                       f"Status: {response.status_code if response else 'No response'}")
        return success

    def test_list_projects(self):
        """Test listing projects"""
        response = self.make_request('GET', 'projects')
        success = response and response.status_code == 200
        
        self.log_result("List projects", success, 
                       f"Status: {response.status_code if response else 'No response'}")
        return success

    def test_get_project(self):
        """Test getting specific project"""
        if not self.test_project_id:
            return False
            
        response = self.make_request('GET', f'projects/{self.test_project_id}')
        success = response and response.status_code == 200
        
        self.log_result("Get project details", success, 
                       f"Status: {response.status_code if response else 'No response'}")
        return success

    def test_file_upload_mock(self):
        """Test mock file upload (simulated)"""
        if not self.test_project_id:
            return False
        
        # Create a mock file for testing
        mock_file_content = b"Mock audio file content for testing"
        files = {'file': ('test_audio.mp3', mock_file_content, 'audio/mpeg')}
        
        response = self.make_request('POST', f'projects/{self.test_project_id}/upload', files=files)
        success = response and response.status_code == 200
        
        self.log_result("File upload (mock)", success, 
                       f"Status: {response.status_code if response else 'No response'}")
        
        # Wait a bit for mock processing
        if success:
            time.sleep(2)
        
        return success

    def test_get_transcripts(self):
        """Test getting transcripts"""
        if not self.test_project_id:
            return False
            
        response = self.make_request('GET', f'projects/{self.test_project_id}/transcripts')
        success = response and response.status_code == 200
        
        self.log_result("Get transcripts", success, 
                       f"Status: {response.status_code if response else 'No response'}")
        return success

    def test_get_fragments(self):
        """Test getting uncertain fragments"""
        if not self.test_project_id:
            return False
            
        response = self.make_request('GET', f'projects/{self.test_project_id}/fragments')
        success = response and response.status_code == 200
        
        self.log_result("Get uncertain fragments", success, 
                       f"Status: {response.status_code if response else 'No response'}")
        return success

    def test_get_speakers(self):
        """Test getting speakers"""
        if not self.test_project_id:
            return False
            
        response = self.make_request('GET', f'projects/{self.test_project_id}/speakers')
        success = response and response.status_code == 200
        
        self.log_result("Get speakers", success, 
                       f"Status: {response.status_code if response else 'No response'}")
        return success

    def test_create_prompt(self):
        """Test creating a personal prompt"""
        prompt_data = {
            "name": "Test Analysis Prompt",
            "content": "Analyze this meeting transcript and provide key insights.",
            "prompt_type": "personal",
            "is_public": False
        }
        
        response = self.make_request('POST', 'prompts', prompt_data)
        success = response and response.status_code == 200
        
        if success:
            data = response.json()
            self.test_prompt_id = data.get('id')
        
        self.log_result("Create personal prompt", success, 
                       f"Status: {response.status_code if response else 'No response'}")
        return success

    def test_list_prompts(self):
        """Test listing prompts"""
        response = self.make_request('GET', 'prompts')
        success = response and response.status_code == 200
        
        self.log_result("List prompts", success, 
                       f"Status: {response.status_code if response else 'No response'}")
        return success

    def test_gpt_analysis(self):
        """Test GPT-4o analysis"""
        if not self.test_project_id or not self.test_prompt_id:
            return False
        
        # First check if project has transcript
        transcript_response = self.make_request('GET', f'projects/{self.test_project_id}/transcripts')
        if not transcript_response or transcript_response.status_code != 200:
            self.log_result("GPT Analysis (no transcript)", False, "No transcript available")
            return False
        
        analysis_data = {
            "prompt_id": self.test_prompt_id,
            "additional_text": "Focus on key decisions made in the meeting."
        }
        
        response = self.make_request('POST', f'projects/{self.test_project_id}/analyze', analysis_data)
        success = response and response.status_code == 200
        
        if success:
            data = response.json()
            # Check if we got a response
            response_text = data.get('response_text', '')
            if 'Ошибка' in response_text:
                success = False
        
        self.log_result("GPT-4o Analysis", success, 
                       f"Status: {response.status_code if response else 'No response'}")
        return success

    def test_admin_list_users(self):
        """Test admin functionality - list users"""
        response = self.make_request('GET', 'admin/users', use_admin=True)
        success = response and response.status_code == 200
        
        self.log_result("Admin - List users", success, 
                       f"Status: {response.status_code if response else 'No response'}")
        return success

    def test_admin_list_prompts(self):
        """Test admin functionality - list all prompts"""
        response = self.make_request('GET', 'admin/prompts', use_admin=True)
        success = response and response.status_code == 200
        
        self.log_result("Admin - List all prompts", success, 
                       f"Status: {response.status_code if response else 'No response'}")
        return success

    def test_delete_project(self):
        """Test project deletion"""
        if not self.test_project_id:
            return False
            
        response = self.make_request('DELETE', f'projects/{self.test_project_id}')
        success = response and response.status_code == 200
        
        self.log_result("Delete project", success, 
                       f"Status: {response.status_code if response else 'No response'}")
        return success

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Voice Workspace API Tests")
        print("=" * 50)
        
        # Basic setup
        self.test_seed_data()
        
        # Authentication tests
        self.test_user_registration()
        self.test_admin_login()
        self.test_user_login()
        
        # Project management tests
        self.test_create_project()
        self.test_list_projects()
        self.test_get_project()
        
        # File upload and transcription tests
        self.test_file_upload_mock()
        
        # Wait for mock processing to complete
        print("⏳ Waiting for mock transcription to complete...")
        time.sleep(3)
        
        # Transcript-related tests
        self.test_get_transcripts()
        self.test_get_fragments()
        self.test_get_speakers()
        
        # Prompt and analysis tests
        self.test_create_prompt()
        self.test_list_prompts()
        self.test_gpt_analysis()
        
        # Admin tests
        self.test_admin_list_users()
        self.test_admin_list_prompts()
        
        # Cleanup
        self.test_delete_project()
        
        # Print results
        print("\n" + "=" * 50)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.failed_tests:
            print("\n❌ Failed Tests:")
            for test in self.failed_tests:
                print(f"  - {test['test']}: {test['error']}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = VoiceWorkspaceAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())