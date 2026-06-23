import axios from 'axios'

const API_URL = typeof window !== 'undefined'
  ? '/api-proxy'
  : (process.env.API_URL || 'http://localhost:4000')

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      const path = window.location.pathname
      if (path !== '/login' && path !== '/forgot-password' && path !== '/reset-password') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

let cachedUser: any = null

export async function fetchUser() {
  if (cachedUser) return cachedUser
  try {
    const { data } = await api.get('/auth/me')
    cachedUser = data.user
    return cachedUser
  } catch {
    cachedUser = null
    return null
  }
}

export function clearUserCache() {
  cachedUser = null
}

export async function logout() {
  try { await api.post('/auth/logout') } catch {}
  cachedUser = null
  window.location.href = '/login'
}

export function fmtMoney(n: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n)
}

export function fmtDate(d: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(d))
}
