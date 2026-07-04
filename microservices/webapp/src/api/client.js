const API_BASE = '/v1';

function getToken() {
  return localStorage.getItem('token');
}

export function formatAPIError(error) {
  if (typeof error === 'string' && error.trim() !== '') {
    return error;
  }

  if (error && typeof error === 'object') {
    const entries = Object.entries(error);
    if (entries.length > 0) {
      return entries.map(([field, message]) => `${field}: ${message}`).join('\n');
    }
    return JSON.stringify(error);
  }

  return 'Request failed';
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && token) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(formatAPIError(data.error));
  }
  return data;
}

export const api = {
  // Auth
  register: (body) => request('/users/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/users/login', { method: 'POST', body: JSON.stringify(body) }),
  resetPassword: (body) => request('/users/password', { method: 'PUT', body: JSON.stringify(body) }),
  changePassword: (body) => request('/me/password', { method: 'POST', body: JSON.stringify(body) }),

  // Templates
  getTemplates: () => request('/templates'),
  getTemplate: (id) => request(`/templates/${id}`),
  startTemplate: (id) => request(`/templates/${id}/start`, { method: 'POST' }),
  createTemplate: (body) => request('/templates', { method: 'POST', body: JSON.stringify(body) }),
  updateTemplate: (id, body) => request(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteTemplate: (id) => request(`/templates/${id}`, { method: 'DELETE' }),

  // Admin
  getAdminUsers: () => request('/admin/users'),
  createResetToken: (userId) => request(`/admin/users/${userId}/reset-token`, { method: 'POST' }),
  getInviteCode: () => request('/admin/invite-code'),

  // Exercises
  getExercises: () => request('/exercises'),
  getExercise: (id) => request(`/exercises/${id}`),

  // Mesocycles
  createMesocycle: (body) => request('/mesocycles', { method: 'POST', body: JSON.stringify(body) }),
  getMesocycles: () => request('/mesocycles'),
  getActiveMesocycle: () => request('/me/mesocycle'),
  getMesocycle: (id) => request(`/mesocycles/${id}`),
  endMesocycle: (id) => request(`/mesocycles/${id}/end`, { method: 'POST' }),
  exportMesocycle: (id) => request(`/mesocycles/${id}/export`),
  deleteMesocycle: (id) => request(`/mesocycles/${id}`, { method: 'DELETE' }),

  // Training day exercises
  updateDayExercises: (dayId, body) => request(`/training-days/${dayId}/exercises`, { method: 'PUT', body: JSON.stringify(body) }),
  getSuggestions: (dayId) => request(`/training-days/${dayId}/suggestions`),

  // Sessions
  createSession: (body) => request('/sessions', { method: 'POST', body: JSON.stringify(body) }),
  getSession: (id) => request(`/sessions/${id}`),
  updateSession: (id, body) => request(`/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteSession: (id) => request(`/sessions/${id}`, { method: 'DELETE' }),
  getMesocycleSessions: (mesoId) => request(`/mesocycles/${mesoId}/sessions`),

  // Web push (rest-timer notifications)
  getPushPublicKey: () => request('/push/public-key'),
  savePushSubscription: (body) => request('/me/push-subscription', { method: 'PUT', body: JSON.stringify(body) }),
  deletePushSubscription: (body) => request('/me/push-subscription', { method: 'DELETE', body: JSON.stringify(body) }),
  scheduleRestAlarm: (body) => request('/me/rest-alarm', { method: 'POST', body: JSON.stringify(body) }),
  cancelRestAlarm: () => request('/me/rest-alarm', { method: 'DELETE' }),

  // Sets
  logSet: (body) => request('/sets', { method: 'POST', body: JSON.stringify(body) }),
  updateSet: (id, body) => request(`/sets/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteSet: (id) => request(`/sets/${id}`, { method: 'DELETE' }),

  // Volume preview
  previewVolume: (body) => request('/volume/preview', { method: 'POST', body: JSON.stringify(body) }),

  // User exercises (exercises with recorded sets)
  getUserExercises: () => request('/me/exercises'),

  // Analytics
  getE1RMProgress: (exerciseId) => request(`/progress/e1rm?exercise_id=${exerciseId}`),
  getMesocycleVolume: (mesoId) => request(`/mesocycles/${mesoId}/volume`),
  getWeeklyVolume: (mesoId) => request(`/mesocycles/${mesoId}/weekly-volume`),
};
