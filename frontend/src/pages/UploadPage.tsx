import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { upload } from '@/api/client'
import type { ApiError } from '@/types'

interface UploadResponse {
  filename: string
  originalName: string
  url: string
  size: number
  mimetype: string
}

export function UploadPage() {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const token = localStorage.getItem('token')

  // Redirect if not authenticated
  if (!isAuthenticated && !token) {
    navigate(`/login?redirect=${encodeURIComponent('/upload')}`)
    return null
  }

  return <UploadPageContent />
}

function UploadPageContent() {
  const navigate = useNavigate()
  const [dragOver, setDragOver] = useState(false)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploadStep, setUploadStep] = useState<'select' | 'uploading' | 'success' | 'error'>('select')
  const videoInputRef = useRef<HTMLInputElement>(null)
  const thumbnailInputRef = useRef<HTMLInputElement>(null)

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
  }

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }, [])

  const handleVideoDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    setError(null)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      if (file.type.startsWith('video/')) {
        setVideoFile(file)
        setUploadResult(null)
      } else {
        setError('请上传视频文件 (MP4, WebM, MOV等)')
      }
    }
  }, [])

  const handleVideoSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const file = e.target.files?.[0]
    if (file) {
      if (file.type.startsWith('video/')) {
        setVideoFile(file)
        setUploadResult(null)
      } else {
        setError('请上传视频文件 (MP4, WebM, MOV等)')
      }
    }
  }, [])

  const handleThumbnailSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const file = e.target.files?.[0]
    if (file) {
      if (file.type.startsWith('image/')) {
        setThumbnailFile(file)
        const reader = new FileReader()
        reader.onload = (ev) => setThumbnailPreview(ev.target?.result as string)
        reader.readAsDataURL(file)
      } else {
        setError('请上传图片文件 (JPG, PNG, WebP等)')
      }
    }
  }, [])

  const clearVideo = useCallback(() => {
    setVideoFile(null)
    setUploadResult(null)
    setError(null)
    if (videoInputRef.current) videoInputRef.current.value = ''
  }, [])

  const clearThumbnail = useCallback(() => {
    setThumbnailFile(null)
    setThumbnailPreview(null)
    if (thumbnailInputRef.current) thumbnailInputRef.current.value = ''
  }, [])

  const handleUpload = useCallback(async () => {
    if (!videoFile) {
      setError('请先选择视频文件')
      return
    }

    setIsUploading(true)
    setUploadStep('uploading')
    setUploadProgress(0)
    setError(null)

    try {
      // Upload video
      const result = await upload<UploadResponse>('/upload/video', videoFile, (progress) => {
        setUploadProgress(progress)
      })

      setUploadResult(result)
      setUploadStep('success')
    } catch (err: unknown) {
      const apiErr = err as ApiError
      setError(apiErr.message || '上传失败，请重试')
      setUploadStep('error')
    } finally {
      setIsUploading(false)
    }
  }, [videoFile])

  // Upload thumbnail (optional, separate call)
  const handleUploadWithThumbnail = useCallback(async () => {
    if (!videoFile) {
      setError('请先选择视频文件')
      return
    }

    setIsUploading(true)
    setUploadStep('uploading')
    setUploadProgress(0)
    setError(null)

    try {
      // Upload thumbnail first if selected
      let thumbnailUrl = ''
      if (thumbnailFile) {
        const thumbResult = await upload<UploadResponse>('/upload/thumbnail', thumbnailFile, (progress) => {
          setUploadProgress(Math.round(progress * 0.2)) // Thumbnail is 20% of progress
        })
        thumbnailUrl = thumbResult.url
      }

      // Upload video
      const result = await upload<UploadResponse>('/upload/video', videoFile, (progress) => {
        setUploadProgress(thumbnailFile ? 20 + Math.round(progress * 0.8) : progress)
      })

      setUploadResult({ ...result, mimetype: result.mimetype })
      setUploadStep('success')
    } catch (err: unknown) {
      const apiErr = err as ApiError
      setError(apiErr.message || '上传失败，请重试')
      setUploadStep('error')
    } finally {
      setIsUploading(false)
    }
  }, [videoFile, thumbnailFile])

  return (
    <div className="max-w-3xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-bili-text-primary flex items-center gap-2">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FB7299" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          投稿视频
        </h1>
        <p className="text-sm text-bili-text-tertiary mt-1">支持 MP4, WebM, MOV, AVI, MKV 等格式，单个文件最大 2GB</p>
      </div>

      {/* Upload Steps */}
      <div className="mb-6 flex items-center gap-2">
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
          uploadStep === 'select' ? 'bg-[#FB7299] text-white' : uploadStep === 'uploading' || uploadStep === 'success' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">1</span>
          选择文件
        </div>
        <div className="flex-1 h-0.5 bg-gray-200 rounded">
          <div
            className="h-full bg-[#FB7299] rounded transition-all duration-500"
            style={{ width: uploadStep === 'select' ? '0%' : uploadStep === 'uploading' ? `${uploadProgress}%` : '100%' }}
          />
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
          uploadStep === 'uploading' ? 'bg-[#FB7299] text-white' : uploadStep === 'success' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">2</span>
          上传文件
        </div>
        <div className="flex-1 h-0.5 bg-gray-200 rounded">
          <div
            className="h-full bg-[#FB7299] rounded transition-all duration-500"
            style={{ width: uploadStep === 'success' ? '100%' : '0%' }}
          />
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
          uploadStep === 'success' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">3</span>
          完成
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <div>
            <p className="text-sm font-medium text-red-700">上传出错</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* Video Drop Zone */}
      {!videoFile && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleVideoDrop}
          onClick={() => videoInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 ${
            dragOver
              ? 'border-[#FB7299] bg-pink-50 scale-[1.01]'
              : 'border-gray-300 hover:border-[#FB7299] hover:bg-pink-50/50'
          }`}
        >
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            onChange={handleVideoSelect}
            className="hidden"
          />
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-pink-100 flex items-center justify-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FB7299" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <p className="text-lg font-medium text-bili-text-primary mb-1">
            {dragOver ? '释放以上传视频' : '拖拽视频到此处，或点击选择文件'}
          </p>
          <p className="text-sm text-bili-text-tertiary">
            支持 MP4, WebM, MOV, AVI, MKV 等格式
          </p>
        </div>
      )}

      {/* Selected Video File */}
      {videoFile && uploadStep !== 'success' && (
        <div className="bg-white rounded-2xl shadow-card p-6 mb-4">
          <div className="flex items-center gap-4">
            {/* Video Icon */}
            <div className="w-16 h-16 rounded-xl bg-pink-100 flex items-center justify-center flex-shrink-0">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FB7299" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
            {/* File Info */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-bili-text-primary truncate">{videoFile.name}</p>
              <p className="text-sm text-bili-text-tertiary">{formatFileSize(videoFile.size)} · {videoFile.type}</p>
            </div>
            {/* Remove button */}
            {!isUploading && (
              <button
                onClick={(e) => { e.stopPropagation(); clearVideo() }}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Thumbnail Upload (optional) */}
      {videoFile && uploadStep !== 'success' && (
        <div className="bg-white rounded-2xl shadow-card p-6 mb-4">
          <h3 className="text-sm font-medium text-bili-text-secondary mb-3">封面图（可选）</h3>
          {!thumbnailFile ? (
            <div
              onClick={() => thumbnailInputRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-[#FB7299] hover:bg-pink-50/30 transition-all"
            >
              <input
                ref={thumbnailInputRef}
                type="file"
                accept="image/*"
                onChange={handleThumbnailSelect}
                className="hidden"
              />
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5" className="mx-auto mb-2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              <p className="text-sm text-bili-text-tertiary">点击选择封面图 (JPG, PNG, WebP)</p>
            </div>
          ) : (
            <div className="relative">
              <img
                src={thumbnailPreview || ''}
                alt="Thumbnail preview"
                className="w-full h-40 object-cover rounded-xl"
              />
              <button
                onClick={clearThumbnail}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Upload Progress */}
      {uploadStep === 'uploading' && (
        <div className="bg-white rounded-2xl shadow-card p-6 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-bili-text-primary">正在上传...</span>
            <span className="text-sm font-bold text-[#FB7299]">{uploadProgress}%</span>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#FB7299] to-[#ff85a7] rounded-full transition-all duration-300 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-xs text-bili-text-tertiary mt-2">
            {videoFile?.name} · {formatFileSize(videoFile?.size || 0)}
          </p>
        </div>
      )}

      {/* Upload Success */}
      {uploadStep === 'success' && uploadResult && (
        <div className="bg-white rounded-2xl shadow-card p-6 mb-4">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-bili-text-primary mb-1">上传成功!</h3>
            <p className="text-sm text-bili-text-tertiary mb-4">{uploadResult.originalName}</p>
            <div className="bg-gray-50 rounded-xl p-4 text-left mb-4">
              <p className="text-xs text-bili-text-tertiary mb-1">文件地址</p>
              <p className="text-sm text-bili-text-primary font-mono break-all">{uploadResult.url}</p>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setUploadStep('select')
                  setVideoFile(null)
                  setUploadResult(null)
                  setThumbnailFile(null)
                  setThumbnailPreview(null)
                  setUploadProgress(0)
                }}
                className="px-6 py-2.5 bg-[#FB7299] text-white rounded-lg font-medium hover:bg-[#ff85a7] transition-colors"
              >
                继续上传
              </button>
              <button
                onClick={() => navigate('/')}
                className="px-6 py-2.5 bg-gray-100 text-bili-text-secondary rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                返回首页
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Actions */}
      {videoFile && uploadStep === 'select' && (
        <div className="flex gap-3">
          <button
            onClick={handleUploadWithThumbnail}
            disabled={isUploading}
            className="flex-1 py-3 bg-[#FB7299] text-white rounded-xl font-medium hover:bg-[#ff85a7] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            开始上传
          </button>
        </div>
      )}

      {/* Upload tips */}
      <div className="mt-8 bg-blue-50 rounded-2xl p-5">
        <h4 className="text-sm font-medium text-blue-800 mb-2 flex items-center gap-1.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          上传须知
        </h4>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>· 支持的视频格式：MP4, WebM, MOV, AVI, MKV, WMV, MPEG</li>
          <li>· 单个视频文件最大 2GB</li>
          <li>· 支持的封面格式：JPG, PNG, GIF, WebP，最大 10MB</li>
          <li>· 请确保您拥有上传内容的版权或合法使用权</li>
          <li>· 上传的视频将经过审核后显示在平台上</li>
        </ul>
      </div>
    </div>
  )
}

