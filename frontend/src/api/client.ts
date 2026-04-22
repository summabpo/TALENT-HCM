import axios from 'axios'

const TOKEN_KEY = 'talent_access'
const REFRESH_KEY = 'talent_refresh'

/**
 * Resolves the axios baseURL so it always points at Django’s `/api/v1` root.
 * - Omitted: use relative `/api/v1` (Vite `server.proxy` in dev, same host in many prod setups).
 * - `http://127.0.0.1:8001` (common local mistake) → `http://127.0.0.1:8001/api/v1`
 * - `https://…/api` (Docker) → `https://…/api/v1`
 */
export function resolveApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL
  if (raw == null || String(raw).trim() === '') {
    return '/api/v1'
  }
  const t = String(raw).trim().replace(/\/+$/, '')
  if (t.startsWith('http://') || t.startsWith('https://')) {
    if (/\/api\/v1$/i.test(t)) {
      return t
    }
    if (t.endsWith('/api')) {
      return `${t}/v1`
    }
    return `${t}/api/v1`
  }
  if (t.startsWith('/')) {
    if (t === '/api' || t === '/api/') {
      return '/api/v1'
    }
    if (t.includes('/api/v1') || /\/v1$/i.test(t)) {
      return t
    }
    if (t.endsWith('/api')) {
      return `${t}/v1`
    }
    return `${t}/api/v1`
  }
  return `${t}/api/v1`
}

export const tokenStorage = {
  getAccess: () => localStorage.getItem(TOKEN_KEY) ?? '',
  getRefresh: () => localStorage.getItem(REFRESH_KEY) ?? '',
  set: (access: string, refresh: string) => {
    localStorage.setItem(TOKEN_KEY, access)
    localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getAccess()
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  if (config.data instanceof FormData) {
    delete (config.headers as Record<string, unknown>)['Content-Type']
  }
  return config
})

let refreshing: Promise<string> | null = null

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = tokenStorage.getRefresh()
      if (!refresh) {
        tokenStorage.clear()
        window.location.href = '/login'
        return Promise.reject(error)
      }
      try {
        if (!refreshing) {
          refreshing = axios
            .post('/api/v1/auth/token/refresh/', { refresh })
            .then((r) => {
              tokenStorage.set(r.data.access, r.data.refresh ?? refresh)
              return r.data.access
            })
            .finally(() => { refreshing = null })
        }
        const newAccess = await refreshing
        original.headers['Authorization'] = `Bearer ${newAccess}`
        return apiClient(original)
      } catch {
        tokenStorage.clear()
        window.location.href = '/login'
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  }
)

export default apiClient
