const rawApiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "").trim();

export const API_BASE_URL = rawApiBaseUrl.replace(/\/+$/, "");

export function apiUrl(path) {
  const normalizedPath = String(path || "").trim();
  if (!normalizedPath) return API_BASE_URL || "";
  if (/^https?:\/\//i.test(normalizedPath)) return normalizedPath;
  return `${API_BASE_URL}${normalizedPath}`;
}

export function apiFetch(path, options) {
  return fetch(apiUrl(path), options);
}
