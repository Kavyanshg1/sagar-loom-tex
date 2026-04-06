const TOKEN_STORAGE_KEY = "textile-flow-auth-token";

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, "");
const API_BASE_URL =
  configuredBaseUrl ||
  (window.location.port === "5173" ? "http://127.0.0.1:8000" : window.location.origin);

function getStoredToken() {
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

function setStoredToken(token) {
  if (!token) {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

function createApiError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function parseResponse(response) {
  const contentType = response.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return null;
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getStoredToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
  const data = await parseResponse(response);

  if (!response.ok) {
    throw createApiError(data?.error || "Request failed", response.status);
  }

  return data;
}

async function downloadRequest(path) {
  const headers = new Headers();
  const token = getStoredToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { headers });
  if (!response.ok) {
    const data = await parseResponse(response);
    throw createApiError(data?.error || "Download failed", response.status);
  }

  return response.blob();
}

export const api = {
  getAuthToken() {
    return getStoredToken();
  },
  setAuthToken(token) {
    setStoredToken(token);
  },
  clearAuthToken() {
    setStoredToken("");
  },
  getAuthStatus() {
    return request("/auth/status");
  },
  signup(payload) {
    return request("/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },
  login(payload) {
    return request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },
  getCurrentUser() {
    return request("/auth/me");
  },
  getRecords() {
    return request("/records");
  },
  exportPdf(queryString) {
    return downloadRequest(`/export-pdf?${queryString}`);
  },
  updateRecord(path, id, payload) {
    return request(`${path}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },
  deleteRecord(path, id) {
    return request(`${path}/${id}`, {
      method: "DELETE",
    });
  },
  createYarnPurchase(payload) {
    return request("/yarn-purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },
  createProcessingRecord(payload) {
    return request("/processing-records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },
  createDirectProcessingRecord(payload) {
    return request("/direct-processing-records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },
  createDyeingRecord(payload) {
    return request("/dyeing-records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },
  uploadDocument(formData) {
    return request("/upload", {
      method: "POST",
      body: formData,
    });
  },
  setPassword(payload) {
    return request("/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },
  setInitialStock(payload) {
    return request("/set-initial-stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },
  clearAllData(payload) {
    return request("/clear-all-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },
};
