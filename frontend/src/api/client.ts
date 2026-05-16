import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from 'axios'
import type { ApiResponse, ApiError } from '@/types'

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// Request interceptor - add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    // Add request timestamp
    config.headers['X-Request-Time'] = Date.now().toString()
    return config
  },
  (error: AxiosError) => {
    return Promise.reject(error)
  }
)

// Response interceptor - handle errors
apiClient.interceptors.response.use(
  (response: AxiosResponse<ApiResponse<unknown>>) => {
    // Check business code
    if (response.data && response.data.code !== 0) {
      const error: ApiError = {
        code: response.data.code,
        message: response.data.message || '请求失败',
      }
      return Promise.reject(error)
    }
    return response
  },
  (error: AxiosError<ApiError>) => {
    if (error.response) {
      const status = error.response.status
      const data = error.response.data

      // Handle 401 - Unauthorized
      if (status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
        window.location.href = '/login'
        return Promise.reject({
          code: 401,
          message: '登录已过期，请重新登录',
        })
      }

      // Handle 403 - Forbidden
      if (status === 403) {
        return Promise.reject({
          code: 403,
          message: data?.message || '没有权限执行此操作',
        })
      }

      // Handle 404
      if (status === 404) {
        return Promise.reject({
          code: 404,
          message: data?.message || '请求的资源不存在',
        })
      }

      // Handle 500
      if (status >= 500) {
        return Promise.reject({
          code: status,
          message: '服务器内部错误，请稍后重试',
        })
      }

      return Promise.reject({
        code: status,
        message: data?.message || `请求失败 (${status})`,
      })
    }

    if (error.request) {
      return Promise.reject({
        code: 0,
        message: '网络连接失败，请检查网络设置',
      })
    }

    return Promise.reject({
      code: 0,
      message: error.message || '请求发生错误',
    })
  }
)

// Helper functions for common HTTP methods
export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const response = await apiClient.get<ApiResponse<T>>(url, { params })
  return response.data.data
}

export async function post<T>(url: string, data?: unknown): Promise<T> {
  const response = await apiClient.post<ApiResponse<T>>(url, data)
  return response.data.data
}

export async function put<T>(url: string, data?: unknown): Promise<T> {
  const response = await apiClient.put<ApiResponse<T>>(url, data)
  return response.data.data
}

export async function patch<T>(url: string, data?: unknown): Promise<T> {
  const response = await apiClient.patch<ApiResponse<T>>(url, data)
  return response.data.data
}

export async function del<T>(url: string): Promise<T> {
  const response = await apiClient.delete<ApiResponse<T>>(url)
  return response.data.data
}

// Upload file with progress
export async function upload<T>(
  url: string,
  file: File,
  onProgress?: (progress: number) => void,
  additionalData?: Record<string, unknown>
): Promise<T> {
  const formData = new FormData()
  formData.append('file', file)

  if (additionalData) {
    Object.entries(additionalData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value))
      }
    })
  }

  const response = await apiClient.post<ApiResponse<T>>(url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        onProgress(progress)
      }
    },
  })
  return response.data.data
}

// Chunk upload for large files
export async function uploadChunk(
  uploadId: string,
  chunk: Blob,
  chunkIndex: number,
  totalChunks: number,
  onProgress?: (progress: number) => void
): Promise<{ uploaded: boolean; uploadId: string }> {
  const formData = new FormData()
  formData.append('uploadId', uploadId)
  formData.append('chunk', chunk)
  formData.append('chunkIndex', chunkIndex.toString())
  formData.append('totalChunks', totalChunks.toString())

  const response = await apiClient.post<ApiResponse<{ uploaded: boolean; uploadId: string }>>(
    '/upload/chunk',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const chunkProgress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          const totalProgress = Math.round(((chunkIndex + chunkProgress / 100) / totalChunks) * 100)
          onProgress(totalProgress)
        }
      },
    }
  )
  return response.data.data
}

// Request cancel token factory
export function createCancelToken() {
  const controller = new AbortController()
  return {
    signal: controller.signal,
    cancel: () => controller.abort(),
  }
}

// Refresh token
export async function refreshToken(): Promise<string> {
  const refreshToken = localStorage.getItem('refreshToken')
  if (!refreshToken) {
    throw new Error('No refresh token')
  }

  const response = await apiClient.post<ApiResponse<{ token: string; expiresIn: number }>>(
    '/auth/refresh',
    { refreshToken }
  )
  const { token, expiresIn } = response.data.data
  localStorage.setItem('token', token)
  localStorage.setItem('tokenExpires', (Date.now() + expiresIn * 1000).toString())
  return token
}

export default apiClient
