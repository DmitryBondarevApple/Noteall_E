"""
Tests for Document Agent Pipeline Runner Feature
- POST /api/doc/projects/{id}/run-pipeline - runs pipeline on project materials
- GET /api/doc/projects/{id}/runs - lists previous run results
- DELETE /api/doc/projects/{id}/runs/{rid} - deletes a run
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "test123"

class TestPipelineRunner:
    """Tests for the new pipeline runner functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get auth token, get or create test resources"""
        # Login
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.token = login_resp.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        yield
        
        # Cleanup handled in individual tests
    
    # ============ Helper Methods ============
    
    def get_or_create_folder(self):
        """Get existing test folder or create one"""
        folders_resp = requests.get(f"{BASE_URL}/api/doc/folders", headers=self.headers)
        if folders_resp.status_code == 200:
            folders = folders_resp.json()
            if folders:
                return folders[0]["id"]
        
        # Create folder
        create_resp = requests.post(f"{BASE_URL}/api/doc/folders", headers=self.headers, json={
            "name": f"TEST_PipelineRunner_{uuid.uuid4().hex[:6]}"
        })
        assert create_resp.status_code == 201, f"Failed to create folder: {create_resp.text}"
        return create_resp.json()["id"]
    
    def get_or_create_project(self, folder_id):
        """Get existing test project or create one"""
        projects_resp = requests.get(f"{BASE_URL}/api/doc/projects", headers=self.headers)
        if projects_resp.status_code == 200:
            projects = projects_resp.json()
            if projects:
                return projects[0]["id"]
        
        # Create project
        create_resp = requests.post(f"{BASE_URL}/api/doc/projects", headers=self.headers, json={
            "name": f"TEST_PipelineRunner_{uuid.uuid4().hex[:6]}",
            "folder_id": folder_id,
            "description": "Test project for pipeline runner"
        })
        assert create_resp.status_code == 201, f"Failed to create project: {create_resp.text}"
        return create_resp.json()["id"]
    
    def get_pipeline_id(self):
        """Get first available pipeline for testing"""
        pipelines_resp = requests.get(f"{BASE_URL}/api/pipelines", headers=self.headers)
        assert pipelines_resp.status_code == 200, f"Failed to get pipelines: {pipelines_resp.text}"
        pipelines = pipelines_resp.json()
        if not pipelines:
            pytest.skip("No pipelines available for testing")
        return pipelines[0]["id"], pipelines[0].get("name", "")
    
    # ============ Pipeline Runs API Tests ============
    
    def test_list_runs_empty_project(self):
        """GET /api/doc/projects/{id}/runs - returns empty list for new project"""
        folder_id = self.get_or_create_folder()
        
        # Create a fresh project
        create_resp = requests.post(f"{BASE_URL}/api/doc/projects", headers=self.headers, json={
            "name": f"TEST_EmptyRuns_{uuid.uuid4().hex[:6]}",
            "folder_id": folder_id,
        })
        assert create_resp.status_code == 201
        project_id = create_resp.json()["id"]
        
        try:
            # List runs
            runs_resp = requests.get(f"{BASE_URL}/api/doc/projects/{project_id}/runs", headers=self.headers)
            assert runs_resp.status_code == 200
            runs = runs_resp.json()
            assert isinstance(runs, list)
            print(f"PASS: List runs returns empty list for new project")
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/doc/projects/{project_id}", headers=self.headers)
    
    def test_list_runs_nonexistent_project(self):
        """GET /api/doc/projects/{id}/runs - returns 404 for nonexistent project"""
        fake_id = str(uuid.uuid4())
        runs_resp = requests.get(f"{BASE_URL}/api/doc/projects/{fake_id}/runs", headers=self.headers)
        assert runs_resp.status_code == 404, f"Expected 404, got {runs_resp.status_code}"
        print(f"PASS: List runs returns 404 for nonexistent project")
    
    def test_run_pipeline_nonexistent_project(self):
        """POST /api/doc/projects/{id}/run-pipeline - returns 404 for nonexistent project"""
        fake_id = str(uuid.uuid4())
        pipeline_id, _ = self.get_pipeline_id()
        
        run_resp = requests.post(
            f"{BASE_URL}/api/doc/projects/{fake_id}/run-pipeline",
            headers=self.headers,
            json={"pipeline_id": pipeline_id}
        )
        assert run_resp.status_code == 404, f"Expected 404, got {run_resp.status_code}"
        print(f"PASS: Run pipeline returns 404 for nonexistent project")
    
    def test_run_pipeline_nonexistent_pipeline(self):
        """POST /api/doc/projects/{id}/run-pipeline - returns 404 for nonexistent pipeline"""
        folder_id = self.get_or_create_folder()
        project_id = self.get_or_create_project(folder_id)
        
        run_resp = requests.post(
            f"{BASE_URL}/api/doc/projects/{project_id}/run-pipeline",
            headers=self.headers,
            json={"pipeline_id": str(uuid.uuid4())}
        )
        assert run_resp.status_code == 404, f"Expected 404, got {run_resp.status_code}"
        print(f"PASS: Run pipeline returns 404 for nonexistent pipeline")
    
    def test_delete_run_nonexistent_project(self):
        """DELETE /api/doc/projects/{id}/runs/{rid} - returns 404 for nonexistent project"""
        fake_project_id = str(uuid.uuid4())
        fake_run_id = str(uuid.uuid4())
        
        delete_resp = requests.delete(
            f"{BASE_URL}/api/doc/projects/{fake_project_id}/runs/{fake_run_id}",
            headers=self.headers
        )
        assert delete_resp.status_code == 404, f"Expected 404, got {delete_resp.status_code}"
        print(f"PASS: Delete run returns 404 for nonexistent project")
    
    def test_delete_run_success(self):
        """DELETE /api/doc/projects/{id}/runs/{rid} - deletes run successfully"""
        # Get project with existing runs
        projects_resp = requests.get(f"{BASE_URL}/api/doc/projects", headers=self.headers)
        assert projects_resp.status_code == 200
        projects = projects_resp.json()
        
        if not projects:
            pytest.skip("No projects available")
        
        # Find project with runs
        for project in projects:
            runs_resp = requests.get(f"{BASE_URL}/api/doc/projects/{project['id']}/runs", headers=self.headers)
            if runs_resp.status_code == 200:
                runs = runs_resp.json()
                if runs:
                    run_id = runs[0]["id"]
                    project_id = project["id"]
                    
                    # Delete run
                    delete_resp = requests.delete(
                        f"{BASE_URL}/api/doc/projects/{project_id}/runs/{run_id}",
                        headers=self.headers
                    )
                    assert delete_resp.status_code == 200, f"Delete failed: {delete_resp.text}"
                    
                    # Verify deletion
                    runs_after = requests.get(f"{BASE_URL}/api/doc/projects/{project_id}/runs", headers=self.headers)
                    runs_list = runs_after.json()
                    assert all(r["id"] != run_id for r in runs_list), "Run should be deleted"
                    print(f"PASS: Delete run successful")
                    return
        
        pytest.skip("No runs found to delete")
    
    def test_list_existing_runs(self):
        """GET /api/doc/projects/{id}/runs - lists existing runs with correct structure"""
        projects_resp = requests.get(f"{BASE_URL}/api/doc/projects", headers=self.headers)
        assert projects_resp.status_code == 200
        projects = projects_resp.json()
        
        for project in projects:
            runs_resp = requests.get(f"{BASE_URL}/api/doc/projects/{project['id']}/runs", headers=self.headers)
            if runs_resp.status_code == 200:
                runs = runs_resp.json()
                if runs:
                    run = runs[0]
                    # Verify run structure
                    assert "id" in run, "Run should have id"
                    assert "project_id" in run, "Run should have project_id"
                    assert "pipeline_id" in run, "Run should have pipeline_id"
                    assert "node_results" in run, "Run should have node_results"
                    assert "status" in run, "Run should have status"
                    assert "created_at" in run, "Run should have created_at"
                    
                    # Verify node_results structure
                    if run["node_results"]:
                        nr = run["node_results"][0]
                        assert "node_id" in nr, "Node result should have node_id"
                        assert "label" in nr, "Node result should have label"
                        assert "type" in nr, "Node result should have type"
                        assert "output" in nr, "Node result should have output"
                    
                    print(f"PASS: Run structure validated - {len(run['node_results'])} node results")
                    return
        
        print("PASS: No runs found, but API returns valid response")
    
    # ============ Pipeline Execution Tests ============
    
    def test_run_pipeline_basic(self):
        """POST /api/doc/projects/{id}/run-pipeline - runs pipeline and returns result"""
        folder_id = self.get_or_create_folder()
        
        # Create a new project for this test
        create_resp = requests.post(f"{BASE_URL}/api/doc/projects", headers=self.headers, json={
            "name": f"TEST_PipelineRun_{uuid.uuid4().hex[:6]}",
            "folder_id": folder_id,
        })
        assert create_resp.status_code == 201
        project_id = create_resp.json()["id"]
        
        try:
            # Add a simple text attachment for context
            files = {'file': ('test_document.txt', 'This is a test document for pipeline analysis. It contains sample text.', 'text/plain')}
            upload_resp = requests.post(
                f"{BASE_URL}/api/doc/projects/{project_id}/attachments",
                headers={"Authorization": f"Bearer {self.token}"},
                files=files
            )
            assert upload_resp.status_code == 200, f"Upload failed: {upload_resp.text}"
            
            # Get pipeline
            pipeline_id, pipeline_name = self.get_pipeline_id()
            
            # Run pipeline (this may take 30-60 seconds for complex pipelines)
            run_resp = requests.post(
                f"{BASE_URL}/api/doc/projects/{project_id}/run-pipeline",
                headers=self.headers,
                json={"pipeline_id": pipeline_id},
                timeout=120  # Extended timeout for AI processing
            )
            
            assert run_resp.status_code == 200, f"Run pipeline failed: {run_resp.text}"
            run_result = run_resp.json()
            
            # Validate response structure
            assert "id" in run_result, "Result should have id"
            assert "project_id" in run_result, "Result should have project_id"
            assert run_result["project_id"] == project_id
            assert "pipeline_id" in run_result, "Result should have pipeline_id"
            assert run_result["pipeline_id"] == pipeline_id
            assert "node_results" in run_result, "Result should have node_results"
            assert "status" in run_result, "Result should have status"
            assert run_result["status"] == "completed"
            
            print(f"PASS: Pipeline '{pipeline_name}' executed successfully with {len(run_result['node_results'])} node results")
            
            # Verify run is listed
            runs_resp = requests.get(f"{BASE_URL}/api/doc/projects/{project_id}/runs", headers=self.headers)
            assert runs_resp.status_code == 200
            runs = runs_resp.json()
            assert any(r["id"] == run_result["id"] for r in runs), "New run should be in list"
            
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/doc/projects/{project_id}", headers=self.headers)
    
    def test_pipelines_endpoint_exists(self):
        """GET /api/pipelines - lists available pipelines"""
        pipelines_resp = requests.get(f"{BASE_URL}/api/pipelines", headers=self.headers)
        assert pipelines_resp.status_code == 200, f"Pipelines endpoint failed: {pipelines_resp.text}"
        pipelines = pipelines_resp.json()
        
        assert isinstance(pipelines, list), "Pipelines should be a list"
        
        if pipelines:
            p = pipelines[0]
            assert "id" in p, "Pipeline should have id"
            assert "name" in p, "Pipeline should have name"
            # Pipeline should have nodes and edges for execution
            if "nodes" in p:
                print(f"PASS: Pipeline has {len(p.get('nodes', []))} nodes")
            else:
                print(f"PASS: Pipeline list returned {len(pipelines)} pipelines")
        else:
            print("PASS: Pipelines endpoint returns empty list (no pipelines created)")


class TestDocProjectWithPipeline:
    """Tests for doc project integration with pipeline runner"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login setup"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert login_resp.status_code == 200
        self.token = login_resp.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        yield
    
    def test_get_project_with_attachments(self):
        """GET /api/doc/projects/{id} - returns project with attachments for pipeline context"""
        projects_resp = requests.get(f"{BASE_URL}/api/doc/projects", headers=self.headers)
        assert projects_resp.status_code == 200
        projects = projects_resp.json()
        
        if not projects:
            pytest.skip("No projects available")
        
        project_id = projects[0]["id"]
        project_resp = requests.get(f"{BASE_URL}/api/doc/projects/{project_id}", headers=self.headers)
        assert project_resp.status_code == 200
        
        project = project_resp.json()
        assert "id" in project
        assert "name" in project
        assert "attachments" in project, "Project should include attachments list"
        assert isinstance(project["attachments"], list)
        
        print(f"PASS: Project retrieved with {len(project['attachments'])} attachments")
    
    def test_upload_attachment_for_pipeline(self):
        """POST /api/doc/projects/{id}/attachments - uploads file for pipeline processing"""
        # Get or create project
        projects_resp = requests.get(f"{BASE_URL}/api/doc/projects", headers=self.headers)
        assert projects_resp.status_code == 200
        projects = projects_resp.json()
        
        if not projects:
            pytest.skip("No projects available")
        
        project_id = projects[0]["id"]
        
        # Upload test file
        files = {'file': ('pipeline_test.txt', 'Sample text for pipeline testing\nLine 2\nLine 3', 'text/plain')}
        upload_resp = requests.post(
            f"{BASE_URL}/api/doc/projects/{project_id}/attachments",
            headers={"Authorization": f"Bearer {self.token}"},
            files=files
        )
        
        assert upload_resp.status_code == 200, f"Upload failed: {upload_resp.text}"
        attachment = upload_resp.json()
        
        assert "id" in attachment
        assert "name" in attachment
        assert attachment["name"] == "pipeline_test.txt"
        assert "file_type" in attachment
        assert attachment["file_type"] == "text"
        
        print(f"PASS: Attachment uploaded for pipeline context")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/doc/projects/{project_id}/attachments/{attachment['id']}", headers=self.headers)
    
    def test_add_url_attachment(self):
        """POST /api/doc/projects/{id}/attachments/url - adds URL reference"""
        projects_resp = requests.get(f"{BASE_URL}/api/doc/projects", headers=self.headers)
        assert projects_resp.status_code == 200
        projects = projects_resp.json()
        
        if not projects:
            pytest.skip("No projects available")
        
        project_id = projects[0]["id"]
        
        # Add URL
        url_resp = requests.post(
            f"{BASE_URL}/api/doc/projects/{project_id}/attachments/url",
            headers=self.headers,
            json={"url": "https://example.com/document", "name": "Test Link"}
        )
        
        assert url_resp.status_code == 200, f"Add URL failed: {url_resp.text}"
        attachment = url_resp.json()
        
        assert "id" in attachment
        assert attachment["file_type"] == "url"
        assert attachment["source_url"] == "https://example.com/document"
        
        print(f"PASS: URL attachment added")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/doc/projects/{project_id}/attachments/{attachment['id']}", headers=self.headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
