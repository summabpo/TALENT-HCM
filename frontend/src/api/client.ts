import axios from 'axios'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-CSRFToken': getCsrfToken(),
  },
})

function getCsrfToken(): string {
  const match = document.cookie.match(/csrftoken=([^;]+)/)
  return match ? match[1] : ''
}

apiClient.interceptors.request.use((config) => {
  config.headers['X-CSRFToken'] = getCsrfToken()
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = 'https://nomiweb.co/login/?next=' + encodeURIComponent(window.location.href)
    }
    return Promise.reject(error)
  }
)

export default apiClient
