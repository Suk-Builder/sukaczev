import { useEffect, useRef, useCallback, useState } from 'react'
import type { Danmaku, DanmakuSetting } from '@/types'

interface DanmakuLayerProps {
  danmakuList: Danmaku[]
  currentTime: number
  settings: DanmakuSetting
  isPlaying: boolean
  containerWidth: number
  containerHeight: number
}

interface ActiveDanmaku extends Danmaku {
  x: number
  y: number
  speed: number
  width: number
  opacity: number
  isVisible: boolean
}

export function DanmakuLayer({
  danmakuList,
  currentTime,
  settings,
  isPlaying,
  containerWidth,
  containerHeight,
}: DanmakuLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const activeDanmakuRef = useRef<ActiveDanmaku[]>([])
  const animationRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(currentTime)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

  // Measure text width
  const measureTextWidth = useCallback(
    (text: string, fontSize: number, ctx: CanvasRenderingContext2D) => {
      ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`
      return ctx.measureText(text).width
    },
    []
  )

  // Initialize danmaku from list at current time
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Find danmaku that should be visible now
    const timeWindow = 0.3 // seconds
    const currentActive = activeDanmakuRef.current

    // Add new danmaku that just appeared
    danmakuList.forEach((d) => {
      if (
        d.time >= currentTime - timeWindow &&
        d.time <= currentTime &&
        !currentActive.find((ad) => ad.id === d.id) &&
        !settings.blockTypes.includes(d.type)
      ) {
        const fontSize = d.fontSize * settings.fontSize
        const width = measureTextWidth(d.content, fontSize, ctx)

        let y: number
        if (d.type === 'top') {
          y = fontSize + Math.random() * (containerHeight * 0.3 - fontSize)
        } else if (d.type === 'bottom') {
          y = containerHeight * 0.7 + Math.random() * (containerHeight * 0.3 - fontSize)
        } else {
          y = fontSize + Math.random() * (containerHeight - fontSize * 2)
        }

        const densitySpeedMap = { low: 80, medium: 120, high: 160, full: 200 }
        const baseSpeed = densitySpeedMap[settings.density] || 120

        activeDanmakuRef.current.push({
          ...d,
          x: d.type === 'scroll' ? containerWidth : (containerWidth - width) / 2,
          y,
          speed: d.type === 'scroll' ? baseSpeed + Math.random() * 40 : 0,
          width,
          opacity: settings.opacity,
          isVisible: true,
        })
      }
    })
  }, [currentTime, danmakuList, settings, containerWidth, containerHeight, measureTextWidth])

  // Remove danmaku that are too old
  useEffect(() => {
    activeDanmakuRef.current = activeDanmakuRef.current.filter((d) => {
      // Keep danmaku within 30 seconds of current time
      return d.time >= currentTime - 30 && d.time <= currentTime + 5
    })
  }, [currentTime])

  // Canvas resize
  useEffect(() => {
    if (containerWidth > 0 && containerHeight > 0) {
      setCanvasSize({ width: containerWidth, height: containerHeight })
    }
  }, [containerWidth, containerHeight])

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let lastFrameTime = performance.now()

    const animate = () => {
      const now = performance.now()
      const delta = (now - lastFrameTime) / 1000
      lastFrameTime = now

      // Clear canvas
      ctx.clearRect(0, 0, canvasSize.width, canvasSize.height)

      if (settings.show) {
        // Update and draw danmaku
        activeDanmakuRef.current = activeDanmakuRef.current.filter((d) => {
          if (!d.isVisible) return false

          if (isPlaying && d.type === 'scroll') {
            d.x -= d.speed * delta
          }

          // Remove if scrolled off screen
          if (d.type === 'scroll' && d.x + d.width < 0) return false

          // Draw danmaku text
          ctx.save()
          ctx.globalAlpha = d.opacity * settings.opacity
          const fontSize = d.fontSize * settings.fontSize
          ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`

          // Draw text shadow/outline for readability
          ctx.shadowColor = 'rgba(0,0,0,0.8)'
          ctx.shadowBlur = 4
          ctx.shadowOffsetX = 1
          ctx.shadowOffsetY = 1
          ctx.fillStyle = d.color
          ctx.fillText(d.content, d.x, d.y)

          // Reset shadow
          ctx.shadowColor = 'transparent'
          ctx.shadowBlur = 0
          ctx.shadowOffsetX = 0
          ctx.shadowOffsetY = 0

          ctx.restore()

          return true
        })
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [canvasSize, isPlaying, settings])

  if (!settings.show) return null

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none overflow-hidden z-10"
    >
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="w-full h-full"
      />
    </div>
  )
}

/**
 * Simplified DOM-based danmaku layer for fallback
 */
export function DanmakuLayerDOM({
  danmakuList,
  currentTime,
  settings,
}: {
  danmakuList: Danmaku[]
  currentTime: number
  settings: DanmakuSetting
}) {
  const [visibleDanmaku, setVisibleDanmaku] = useState<Danmaku[]>([])

  useEffect(() => {
    const timeWindow = 0.5
    const filtered = danmakuList.filter(
      (d) =>
        d.time >= currentTime - timeWindow &&
        d.time <= currentTime + 0.1 &&
        !settings.blockTypes.includes(d.type)
    )
    setVisibleDanmaku(filtered)
  }, [currentTime, danmakuList, settings])

  if (!settings.show) return null

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
      {visibleDanmaku.map((d, i) => {
        const topOffset = Math.abs(hashCode(d.id) % 80)
        return (
          <div
            key={`${d.id}-${i}`}
            className="danmaku-text"
            style={{
              color: d.color,
              fontSize: `${d.fontSize * settings.fontSize}px`,
              opacity: settings.opacity,
              top: `${topOffset}%`,
              animationDuration: `${8 / settings.speed}s`,
            }}
          >
            {d.content}
          </div>
        )
      })}
    </div>
  )
}

function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return Math.abs(hash)
}
