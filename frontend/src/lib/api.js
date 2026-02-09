import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Projects
export const projectsApi = {
  list: () => axios.get(`${API}/projects`),
  get: (id) => axios.get(`${API}/projects/${id}`),
  create: (data) => axios.post(`${API}/projects`, data),
  update: (id, data) => axios.put(`${API}/projects/${id}`, data),
  delete: (id) => axios.delete(`${API}/projects/${id}`),
  upload: (id, file, language = 'ru', reasoningEffort = 'high') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('language', language);
    formData.append('reasoning_effort', reasoningEffort);
    return axios.post(`${API}/projects/${id}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};

// Transcripts
export const transcriptsApi = {
  list: (projectId) => axios.get(`${API}/projects/${projectId}/transcripts`),
  confirm: (projectId) => axios.post(`${API}/projects/${projectId}/transcripts/confirm`),
  process: (projectId) => axios.post(`${API}/projects/${projectId}/process`),
  updateContent: (projectId, versionType, content) =>
    axios.put(`${API}/projects/${projectId}/transcripts/${versionType}`, { content })
};

// Fragments
export const fragmentsApi = {
  list: (projectId) => axios.get(`${API}/projects/${projectId}/fragments`),
  update: (projectId, fragmentId, data) => 
    axios.put(`${API}/projects/${projectId}/fragments/${fragmentId}`, data),
  revert: (projectId, fragmentId) =>
    axios.post(`${API}/projects/${projectId}/fragments/${fragmentId}/revert`)
};

// Speakers (project-specific)
export const speakersApi = {
  list: (projectId) => axios.get(`${API}/projects/${projectId}/speakers`),
  update: (projectId, speakerId, data) => 
    axios.put(`${API}/projects/${projectId}/speakers/${speakerId}`, data)
};

// Speaker Directory (global contacts)
export const speakerDirectoryApi = {
  list: (query) => axios.get(`${API}/speaker-directory`, { params: query ? { q: query } : {} }),
  get: (id) => axios.get(`${API}/speaker-directory/${id}`),
  create: (data) => axios.post(`${API}/speaker-directory`, data),
  update: (id, data) => axios.put(`${API}/speaker-directory/${id}`, data),
  delete: (id) => axios.delete(`${API}/speaker-directory/${id}`),
  uploadPhoto: (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return axios.post(`${API}/speaker-directory/${id}/photo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};

// Prompts
export const promptsApi = {
  list: (params) => axios.get(`${API}/prompts`, { params }),
  get: (id) => axios.get(`${API}/prompts/${id}`),
  create: (data) => axios.post(`${API}/prompts`, data),
  update: (id, data) => axios.put(`${API}/prompts/${id}`, data),
  delete: (id) => axios.delete(`${API}/prompts/${id}`)
};

// Chat/Analysis
export const chatApi = {
  analyze: (projectId, data) => axios.post(`${API}/projects/${projectId}/analyze`, data),
  analyzeRaw: (projectId, data) => axios.post(`${API}/projects/${projectId}/analyze-raw`, data),
  saveFullAnalysis: (projectId, data) => axios.post(`${API}/projects/${projectId}/save-full-analysis`, data),
  history: (projectId) => axios.get(`${API}/projects/${projectId}/chat-history`),
  updateResponse: (projectId, chatId, responseText) =>
    axios.put(`${API}/projects/${projectId}/chat-history/${chatId}`, { response_text: responseText })
};

// Admin
export const adminApi = {
  listUsers: () => axios.get(`${API}/admin/users`),
  updateRole: (userId, role) => axios.put(`${API}/admin/users/${userId}/role?role=${role}`),
  listAllPrompts: () => axios.get(`${API}/admin/prompts`)
};

// Export
export const exportApi = {
  toWord: (content, filename) => axios.post(`${API}/export/word`, { content, filename }, { responseType: 'blob' }),
  toPdf: (content, filename) => axios.post(`${API}/export/pdf`, { content, filename }, { responseType: 'blob' })
};

// Pipelines (analysis scenarios)
export const pipelinesApi = {
  list: () => axios.get(`${API}/pipelines`),
  get: (id) => axios.get(`${API}/pipelines/${id}`),
  create: (data) => axios.post(`${API}/pipelines`, data),
  update: (id, data) => axios.put(`${API}/pipelines/${id}`, data),
  delete: (id) => axios.delete(`${API}/pipelines/${id}`),
  duplicate: (id) => axios.post(`${API}/pipelines/${id}/duplicate`)
};

// Seed
export const seedData = () => axios.post(`${API}/seed`);
