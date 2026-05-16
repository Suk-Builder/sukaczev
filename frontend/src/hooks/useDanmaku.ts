import { useEffect, useRef, useCallback, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import type { Danmaku, DanmakuForm, DanmakuSetting } from '@/types'
import { useAuthStore } from '@/stores/authStore'

interface DanmakuMessage {
  id: string
  videoId: string
  userId: string
  user: {
    uid: string
    nickname: string
    avatar: string
  }
  content: string
  time: number
  color: string
  type: 'scroll' | 'top' | 'bottom'
  fontSize: number
  createdAt: string
}

interface UseDanmakuOptions {
  videoId: string
  settings?: Partial<DanmakuSetting>
}

/**
 * Danmaku management hook with WebSocket
 */
export function useDanmaku({ videoId, settings: customSettings }: UseDanmakuOptions) {
  const socketRef = useRef<Socket | null>(null)
  const user = useAuthStore((state) => state.user)
  const [isConnected, setIsConnected] = useState(false)
  const [danmakuList, setDanmakuList] = useState<Danmaku[]>([])
  const [liveDanmaku, setLiveDanmaku] = useState<Danmaku[]>([])
  const [settings, setSettings] = useState<DanmakuSetting>({
    opacity: 1,
    speed: 1,
    fontSize: 20,
    density: 'medium',
    blockTypes: [],
    show: true,
    ...customSettings,
  })

  // Initialize WebSocket connection
  useEffect(() => {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin
    const socket = io(socketUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: {
        token: localStorage.getItem('token'),
      },
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setIsConnected(true)
      socket.emit('join-video', videoId)
    })

    socket.on('disconnect', () => {
      setIsConnected(false)
    })

    socket.on('danmaku', (message: DanmakuMessage) => {
      const newDanmaku: Danmaku = {
        id: message.id,
        videoId: message.videoId,
        userId: message.userId,
        user: message.user,
        content: message.content,
        time: message.time,
        color: message.color,
        type: message.type,
        fontSize: message.fontSize,
        createdAt: message.createdAt,
      }
      setLiveDanmaku((prev) => [...prev, newDanmaku])
      setDanmakuList((prev) => [...prev, newDanmaku])
    })

    socket.on('error', (error: { message: string }) => {
      console.error('WebSocket error:', error.message)
    })

    return () => {
      socket.emit('leave-video', videoId)
      socket.disconnect()
      socketRef.current = null
    }
  }, [videoId])

  // Send danmaku
  const sendDanmaku = useCallback(
    async (form: Omit<DanmakuForm, 'time'> & { time: number }) => {
      if (!socketRef.current || !isConnected) {
        throw new Error('弹幕连接未建立')
      }

      if (!user) {
        throw new Error('请先登录再发送弹幕')
      }

      const message = {
        videoId,
        content: form.content,
        time: form.time,
        color: form.color,
        type: form.type,
        fontSize: form.fontSize,
        user: {
          uid: user.uid,
          nickname: user.nickname,
          avatar: user.avatar,
        },
      }

      return new Promise<void>((resolve, reject) => {
        socketRef.current?.emit('send-danmaku', message, (response: { success: boolean; id?: string; error?: string }) => {
          if (response.success) {
            resolve()
          } else {
            reject(new Error(response.error || '发送失败'))
          }
        })

        // Timeout fallback
        setTimeout(() => {
          reject(new Error('发送超时'))
        }, 5000)
      })
    },
    [videoId, isConnected, user]
  )

  // Get danmaku for current time
  const getDanmakuForTime = useCallback(
    (time: number, window: number = 0.5): Danmaku[] => {
      return danmakuList.filter(
        (d) => d.time >= time - window && d.time <= time + window && !settings.blockTypes.includes(d.type)
      )
    },
    [danmakuList, settings.blockTypes]
  )

  // Update settings
  const updateSettings = useCallback((newSettings: Partial<DanmakuSetting>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }))
  }, [])

  // Clear live danmaku
  const clearLiveDanmaku = useCallback(() => {
    setLiveDanmaku([])
  }, [])

  // Load historical danmaku
  const loadHistoricalDanmaku = useCallback(
    async (startTime: number, endTime: number) => {
      try {
        const response = await fetch(`/api/videos/${videoId}/danmaku?start=${startTime}&end=${endTime}`)
        const data = await response.json()
        if (data.code === 0) {
          const historical = data.data.list as Danmaku[]
          setDanmakuList((prev) => {
            const existingIds = new Set(prev.map((d) => d.id))
            const newDanmaku = historical.filter((d) => !existingIds.has(d.id))
            return [...prev, ...newDanmaku]
          })
        }
      } catch (error) {
        console.error('Failed to load historical danmaku:', error)
      }
    },
    [videoId]
  )

  // Toggle danmaku visibility
  const toggleDanmaku = useCallback(() => {
    setSettings((prev) => ({ ...prev, show: !prev.show }))
  }, [])

  return {
    // State
    isConnected,
    danmakuList,
    liveDanmaku,
    settings,

    // Actions
    sendDanmaku,
    getDanmakuForTime,
    updateSettings,
    clearLiveDanmaku,
    loadHistoricalDanmaku,
    toggleDanmaku,
    setLiveDanmaku,
  }
}

/**
 * Hook for danmaku display on canvas
 */
export function useDanmakuCanvas(settings: DanmakuSetting) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationRef = useRef<number | null>(null)
  const danmakuItemsRef = useRef<DanmakuItem[]>([])

  interface DanmakuItem {
    id: string
    text: string
    x: number
    y: number
    speed: number
    color: string
    fontSize: number
    opacity: number
    type: 'scroll' | 'top' | 'bottom'
    width: number
  }

  // Initialize canvas
  const initCanvas = useCallback((canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const resizeCanvas = () => {
      const parent = canvas.parentElement
      if (parent) {
        canvas.width = parent.clientWidth
        canvas.height = parent.clientHeight
      }
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    return () => {
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [])

  // Add danmaku to canvas
  const addDanmaku = useCallback(
    (danmaku: Danmaku) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const fontSize = danmaku.fontSize * settings.fontSize
      ctx.font = `bold ${fontSize}px -apple-system, sans-serif`
      const textWidth = ctx.measureText(danmaku.content).width

      let y: number
      if (danmaku.type === 'top') {
        y = fontSize + Math.random() * (canvas.height * 0.3 - fontSize)
      } else if (danmaku.type === 'bottom') {
        y = canvas.height * 0.7 + Math.random() * (canvas.height * 0.3 - fontSize)
      } else {
        y = fontSize + Math.random() * (canvas.height - fontSize * 2)
      }

      const speedMap = { low: 1, medium: 2, high: 3, full: 4 }
      const baseSpeed = (speedMap[settings.density] || 2) * 1.5

      danmakuItemsRef.current.push({
        id: danmaku.id,
        text: danmaku.content,
        x: danmaku.type === 'scroll' ? canvas.width : (canvas.width - textWidth) / 2,
        y,
        speed: danmaku.type === 'scroll' ? baseSpeed + Math.random() * 0.5 : 0,
        color: danmaku.color,
        fontSize,
        opacity: settings.opacity,
        type: danmaku.type,
        width: textWidth,
      })
    },
    [settings]
  )

  // Start animation loop
  const startAnimation = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      danmakuItemsRef.current = danmakuItemsRef.current.filter((item) => {
        // Draw danmaku
        ctx.save()
        ctx.globalAlpha = item.opacity
        ctx.fillStyle = item.color
        ctx.font = `bold ${item.fontSize}px -apple-system, sans-serif`

        // Add shadow for better readability
        ctx.shadowColor = 'rgba(0,0,0,0.5)'
        ctx.shadowBlur = 4

        ctx.fillText(item.text, item.x, item.y)
        ctx.restore()

        // Update position
        if (item.type === 'scroll') {
          item.x -= item.speed
          return item.x + item.width > 0
        }
        return true
      })

      // Remove old top/bottom danmaku after 3 seconds
      const now = Date.now()
      danmakuItemsRef.current = danmakuItemsRef.current.filter((item) => {
        if (item.type === 'top' || item.type === 'bottom') {
          return true // Keep for now, could add timestamp to remove
        }
        return true
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()
  }, [])

  // Stop animation
  const stopAnimation = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
  }, [])

  // Clear all danmaku
  const clearDanmaku = useCallback(() => {
    danmakuItemsRef.current = []
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx?.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [])

  useEffect(() => {
    return () => {
      stopAnimation()
    }
  }, [stopAnimation])

  return {
    initCanvas,
    addDanmaku,
    startAnimation,
    stopAnimation,
    clearDanmaku,
    canvasRef,
  }
}
