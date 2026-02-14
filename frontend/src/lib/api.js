import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Projects
export const projectsApi = {
  list: (params = {}) => axios.get(`${API}/projects`, { params }),
  get: (id) => axios.get(`${API}/projects/${id}`),
  create: (data) => axios.post(`${API}/projects`, data),
  update: (id, data) => axios.put(`${API}/projects/${id}`, data),
  delete: (id) => axios.delete(`${API}/projects/${id}`),
  restore: (id) => axios.post(`${API}/projects/${id}/restore`),
  permanentDelete: (id) => axios.delete(`${API}/projects/${id}/permanent`),
  move: (id, folderId) => axios.post(`${API}/projects/${id}/move`, { folder_id: folderId }),
  upload: (id, file, language = 'ru', reasoningEffort = 'high', fastTrack = null) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('language', language);
    formData.append('reasoning_effort', reasoningEffort);
    if (fastTrack?.enabled) {
      formData.append('fast_track', 'true');
      formData.append('fast_track_topic', fastTrack.topic || '');
      formData.append('fast_track_pipeline_id', fastTrack.pipelineId || '');
    }
    return axios.post(`${API}/projects/${id}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};

// Meeting Folders
export const meetingFoldersApi = {
  list: (params = {}) => axios.get(`${API}/meeting-folders`, { params }),
  get: (id) => axios.get(`${API}/meeting-folders/${id}`),
  create: (data) => axios.post(`${API}/meeting-folders`, data),
  update: (id, data) => axios.put(`${API}/meeting-folders/${id}`, data),
  delete: (id) => axios.delete(`${API}/meeting-folders/${id}`),
  share: (id, data) => axios.post(`${API}/meeting-folders/${id}/share`, data),
  unshare: (id) => axios.post(`${API}/meeting-folders/${id}/unshare`),
  move: (id, parentId) => axios.post(`${API}/meeting-folders/${id}/move`, { parent_id: parentId }),
  restore: (id) => axios.post(`${API}/meeting-folders/${id}/restore`),
  permanentDelete: (id) => axios.delete(`${API}/meeting-folders/${id}/permanent`),
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
    axios.post(`${API}/projects/${projectId}/fragments/${fragmentId}/revert`),
  bulkAccept: (projectId) =>
    axios.post(`${API}/projects/${projectId}/fragments/bulk-accept`),
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
  analysisResults: (projectId) => axios.get(`${API}/projects/${projectId}/analysis-results`),
  deleteChat: (projectId, chatId) => axios.delete(`${API}/projects/${projectId}/chat-history/${chatId}`),
  updateResponse: (projectId, chatId, responseText) =>
    axios.put(`${API}/projects/${projectId}/chat-history/${chatId}`, { response_text: responseText }),
  generateScript: (data) => axios.post(`${API}/ai/generate-script`, data)
};

// Admin
export const adminApi = {
  listUsers: () => axios.get(`${API}/admin/users`),
  updateRole: (userId, role) => axios.put(`${API}/admin/users/${userId}/role?role=${role}`),
  listAllPrompts: () => axios.get(`${API}/admin/prompts`),
  getModel: () => axios.get(`${API}/admin/model`),
  checkModels: () => axios.post(`${API}/admin/model/check`),
  switchModel: (model) => axios.post(`${API}/admin/model/switch?model=${encodeURIComponent(model)}`),
  getTrashSettings: () => axios.get(`${API}/admin/trash-settings`),
  updateTrashSettings: (days) => axios.put(`${API}/admin/trash-settings`, { retention_days: days }),
};

// Organizations
export const orgApi = {
  getMy: () => axios.get(`${API}/organizations/my`),
  updateMy: (name) => axios.put(`${API}/organizations/my`, { name }),
  getMyUsers: () => axios.get(`${API}/organizations/my/users`),
  getMembers: () => axios.get(`${API}/organizations/my/members`),
  inviteUser: (email) => axios.post(`${API}/organizations/my/invite`, { email }),
  removeUser: (userId) => axios.delete(`${API}/organizations/my/users/${userId}`),
  updateUserRole: (userId, role) => axios.put(`${API}/organizations/my/users/${userId}/role?role=${role}`),
  setUserLimit: (userId, limit) => axios.put(`${API}/organizations/my/users/${userId}/limit`, { monthly_token_limit: limit }),
  listAll: () => axios.get(`${API}/organizations/all`),
  getOrg: (orgId) => axios.get(`${API}/organizations/${orgId}`),
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
  duplicate: (id) => axios.post(`${API}/pipelines/${id}/duplicate`),
  export: (id) => axios.get(`${API}/pipelines/${id}/export`),
  import: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return axios.post(`${API}/pipelines/import/json`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  generate: (prompt, pipelineId) => axios.post(`${API}/pipelines/generate`, {
    prompt,
    pipeline_id: pipelineId || null
  }),
};

// AI Chat (assistant for pipelines)
export const aiChatApi = {
  createSession: (pipelineId) => axios.post(`${API}/ai-chat/sessions`, { pipeline_id: pipelineId || null }),
  listSessions: (pipelineId) => axios.get(`${API}/ai-chat/sessions`, { params: pipelineId ? { pipeline_id: pipelineId } : {} }),
  getSession: (sessionId) => axios.get(`${API}/ai-chat/sessions/${sessionId}`),
  deleteSession: (sessionId) => axios.delete(`${API}/ai-chat/sessions/${sessionId}`),
  sendMessage: (sessionId, content, imageFile, pipelineContext) => {
    const formData = new FormData();
    formData.append('content', content || '');
    if (imageFile) {
      formData.append('image', imageFile);
    }
    if (pipelineContext) {
      formData.append('pipeline_context', JSON.stringify(pipelineContext));
    }
    return axios.post(`${API}/ai-chat/sessions/${sessionId}/message`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
  },
};

// Attachments
export const attachmentsApi = {
  list: (projectId) => axios.get(`${API}/projects/${projectId}/attachments`),
  upload: (projectId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return axios.post(`${API}/projects/${projectId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      maxBodyLength: 100 * 1024 * 1024,
    });
  },
  addUrl: (projectId, url, name) => axios.post(`${API}/projects/${projectId}/attachments/url`, { url, name }),
  delete: (projectId, attachmentId) => axios.delete(`${API}/projects/${projectId}/attachments/${attachmentId}`),
};

// Document Agent - Folders
export const docFoldersApi = {
  list: (params = {}) => axios.get(`${API}/doc/folders`, { params }),
  get: (id) => axios.get(`${API}/doc/folders/${id}`),
  create: (data) => axios.post(`${API}/doc/folders`, data),
  update: (id, data) => axios.put(`${API}/doc/folders/${id}`, data),
  delete: (id) => axios.delete(`${API}/doc/folders/${id}`),
  share: (id, data) => axios.post(`${API}/doc/folders/${id}/share`, data),
  unshare: (id) => axios.post(`${API}/doc/folders/${id}/unshare`),
  move: (id, parentId) => axios.post(`${API}/doc/folders/${id}/move`, { parent_id: parentId }),
  restore: (id) => axios.post(`${API}/doc/folders/${id}/restore`),
  permanentDelete: (id) => axios.delete(`${API}/doc/folders/${id}/permanent`),
};

// Document Agent - Projects
export const docProjectsApi = {
  list: (params = {}) => axios.get(`${API}/doc/projects`, { params }),
  get: (id) => axios.get(`${API}/doc/projects/${id}`),
  create: (data) => axios.post(`${API}/doc/projects`, data),
  update: (id, data) => axios.put(`${API}/doc/projects/${id}`, data),
  delete: (id) => axios.delete(`${API}/doc/projects/${id}`),
  restore: (id) => axios.post(`${API}/doc/projects/${id}/restore`),
  permanentDelete: (id) => axios.delete(`${API}/doc/projects/${id}/permanent`),
  move: (id, folderId) => axios.post(`${API}/doc/projects/${id}/move`, { folder_id: folderId }),
};

// Document Agent - Attachments
export const docAttachmentsApi = {
  upload: (projectId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return axios.post(`${API}/doc/projects/${projectId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      maxBodyLength: 100 * 1024 * 1024,
    });
  },
  addUrl: (projectId, url, name) => axios.post(`${API}/doc/projects/${projectId}/attachments/url`, { url, name }),
  delete: (projectId, attachmentId) => axios.delete(`${API}/doc/projects/${projectId}/attachments/${attachmentId}`),
};

// Document Agent - Streams
export const docStreamsApi = {
  list: (projectId) => axios.get(`${API}/doc/projects/${projectId}/streams`),
  create: (projectId, data) => axios.post(`${API}/doc/projects/${projectId}/streams`, data),
  update: (projectId, streamId, data) => axios.put(`${API}/doc/projects/${projectId}/streams/${streamId}`, data),
  delete: (projectId, streamId) => axios.delete(`${API}/doc/projects/${projectId}/streams/${streamId}`),
  sendMessage: (projectId, streamId, content) => axios.post(`${API}/doc/projects/${projectId}/streams/${streamId}/messages`, { content }),
};

// Document Agent - Pins (Final Document)
export const docPinsApi = {
  list: (projectId) => axios.get(`${API}/doc/projects/${projectId}/pins`),
  create: (projectId, data) => axios.post(`${API}/doc/projects/${projectId}/pins`, data),
  update: (projectId, pinId, data) => axios.put(`${API}/doc/projects/${projectId}/pins/${pinId}`, data),
  delete: (projectId, pinId) => axios.delete(`${API}/doc/projects/${projectId}/pins/${pinId}`),
  reorder: (projectId, pinIds) => axios.post(`${API}/doc/projects/${projectId}/pins/reorder`, { pin_ids: pinIds }),
};

// Document Agent - Pipeline Runs
export const docRunsApi = {
  list: (projectId) => axios.get(`${API}/doc/projects/${projectId}/runs`),
  run: (projectId, pipelineId) => axios.post(`${API}/doc/projects/${projectId}/run-pipeline`, { pipeline_id: pipelineId }),
  delete: (projectId, runId) => axios.delete(`${API}/doc/projects/${projectId}/runs/${runId}`),
};

// Document Agent - Templates
export const docTemplatesApi = {
  list: () => axios.get(`${API}/doc/templates`),
  create: (data) => axios.post(`${API}/doc/templates`, data),
  update: (id, data) => axios.put(`${API}/doc/templates/${id}`, data),
  delete: (id) => axios.delete(`${API}/doc/templates/${id}`),
  seed: () => axios.post(`${API}/doc/seed-templates`),
};

// Invitations (magic links)
export const invitationsApi = {
  create: (note) => axios.post(`${API}/invitations/create`, { note: note || null }),
  list: () => axios.get(`${API}/invitations/list`),
  revoke: (id) => axios.post(`${API}/invitations/${id}/revoke`),
  validate: (token) => axios.get(`${API}/invitations/validate/${token}`),
};

// Billing
export const billingApi = {
  getBalance: () => axios.get(`${API}/billing/balance`),
  getPlans: () => axios.get(`${API}/billing/plans`),
  getTransactions: (limit = 50, skip = 0) =>
    axios.get(`${API}/billing/transactions`, { params: { limit, skip } }),
  topup: (planId, customCredits) => axios.post(`${API}/billing/topup`, { plan_id: planId || null, custom_credits: customCredits || null }),
  getExchangeRate: () => axios.get(`${API}/billing/exchange-rate`),
  calculateCustom: (credits) => axios.post(`${API}/billing/calculate-custom`, { credits }),
  adminBalances: () => axios.get(`${API}/billing/admin/balances`),
  getMarkupTiers: () => axios.get(`${API}/billing/admin/markup-tiers`),
  updateMarkupTiers: (tiers) => axios.put(`${API}/billing/admin/markup-tiers`, { tiers }),
  getCostSettings: () => axios.get(`${API}/billing/admin/cost-settings`),
  updateCostSettings: (data) => axios.put(`${API}/billing/admin/cost-settings`, data),
  runStorageCalc: () => axios.post(`${API}/billing/admin/run-storage-calc`),
  getMyUsage: () => axios.get(`${API}/billing/usage/my`),
  getOrgUsersUsage: () => axios.get(`${API}/billing/usage/org-users`),
  adminUsage: (orgId) => axios.get(`${API}/billing/admin/usage`, { params: orgId ? { org_id: orgId } : {} }),
  adminSummary: () => axios.get(`${API}/billing/admin/summary`),
  adminOrgDetail: (orgId, period = 'all') => axios.get(`${API}/billing/admin/org/${orgId}`, { params: { period } }),
  orgMyAnalytics: (period = 'all') => axios.get(`${API}/billing/org/my-analytics`, { params: { period } }),
  adminTopup: (orgId, amount, description) =>
    axios.post(`${API}/billing/admin/topup`, { org_id: orgId, amount, description }),
};

// Seed
export const seedData = () => axios.post(`${API}/seed`);
