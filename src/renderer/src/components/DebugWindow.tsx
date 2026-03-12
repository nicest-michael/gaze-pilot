import { useEffect, useRef, useState, useCallback } from 'react'
import type { DebugData, GestureState } from '../../../shared/types'

const GESTURE_COLORS: Record<GestureState, string> = {
  idle: '#6b7280',
  cursor_visible: '#3b82f6',
  voice_active: '#a855f7',
  voice_closing: '#eab308',
  sending: '#f97316'
}

const MAX_LOGS = 100

function isDebugData(raw: unknown): raw is DebugData {
  if (typeof raw !== 'object' || raw === null) return false
  const obj = raw as Record<string, unknown>
  return typeof obj.fps === 'number' && typeof obj.confidence === 'number'
}

export function DebugWindow(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const debugDataRef = useRef<DebugData | null>(null)
  const rafRef = useRef<number>(0)
  const logContainerRef = useRef<HTMLDivElement>(null)

  const [stats, setStats] = useState<DebugData | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [cameraReady, setCameraReady] = useState(false)

  // Start camera immediately
  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 }
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        const video = document.createElement('video')
        video.srcObject = stream
        video.playsInline = true
        await video.play()
        videoRef.current = video
        setCameraReady(true)
      } catch (err) {
        console.error('Debug camera failed:', err)
      }
    })()

    return () => {
      cancelled = true
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  // rAF draw loop — video + landmarks in same frame
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) {
      rafRef.current = requestAnimationFrame(draw)
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      rafRef.current = requestAnimationFrame(draw)
      return
    }

    const w = canvas.width
    const h = canvas.height

    // Draw mirrored video
    ctx.save()
    ctx.translate(w, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, w, h)
    ctx.restore()

    // Draw landmarks from ref (same rAF frame as video)
    const d = debugDataRef.current
    if (d?.landmarks) {
      ctx.fillStyle = '#22c55e'
      for (const [x, y] of d.landmarks) {
        ctx.beginPath()
        ctx.arc((1 - x) * w, y * h, 1.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    if (d?.gazePoint) {
      ctx.fillStyle = '#ef4444'
      ctx.beginPath()
      ctx.arc(
        (d.gazePoint.x / window.screen.width) * w,
        (d.gazePoint.y / window.screen.height) * h,
        6,
        0,
        Math.PI * 2
      )
      ctx.fill()
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 2
      ctx.stroke()
    }

    rafRef.current = requestAnimationFrame(draw)
  }, [])

  useEffect(() => {
    if (cameraReady) {
      rafRef.current = requestAnimationFrame(draw)
    }
    return () => cancelAnimationFrame(rafRef.current)
  }, [cameraReady, draw])

  // Listen for debug data from main
  useEffect(() => {
    const cleanup = window.api.onDebugData((raw: unknown) => {
      if (!isDebugData(raw)) return
      const data = raw
      debugDataRef.current = data
      setStats(data)
      if (data.log) {
        setLogs((prev) => {
          const next = [...prev, data.log]
          return next.length > MAX_LOGS ? next.slice(-MAX_LOGS) : next
        })
      }
    })
    return cleanup
  }, [])

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs])

  return (
    <div className="fixed inset-0 flex font-mono text-xs" style={{ background: '#0d0d1a' }}>
      {/* Left panel: camera + mesh (60%) */}
      <div className="w-[60%] flex flex-col p-2 gap-2">
        <div className="text-white/50 text-[10px] uppercase tracking-wider">
          Camera + Face Mesh
        </div>
        <div className="flex-1 relative bg-black/40 rounded overflow-hidden">
          <canvas
            ref={canvasRef}
            width={640}
            height={480}
            className="w-full h-full object-contain"
          />
          {!cameraReady && (
            <div className="absolute inset-0 flex items-center justify-center text-white/40">
              Starting camera...
            </div>
          )}
        </div>
      </div>

      {/* Right panel: stats + logs (40%) */}
      <div className="w-[40%] flex flex-col p-2 gap-2 border-l border-white/10">
        {/* Stats */}
        <div className="text-white/50 text-[10px] uppercase tracking-wider">Stats</div>
        <div className="space-y-1 text-white/90 bg-white/5 rounded p-2">
          <StatRow
            label="FPS"
            value={stats?.fps?.toFixed(0) ?? '--'}
            color={stats && stats.fps >= 10 ? '#22c55e' : '#ef4444'}
          />
          <StatRow
            label="Confidence"
            value={stats?.confidence != null ? (stats.confidence * 100).toFixed(0) + '%' : '--'}
          />
          <StatRow
            label="Gaze X"
            value={stats?.gazePoint ? Math.round(stats.gazePoint.x).toString() : '--'}
          />
          <StatRow
            label="Gaze Y"
            value={stats?.gazePoint ? Math.round(stats.gazePoint.y).toString() : '--'}
          />
          <StatRow
            label="Gesture"
            value={stats?.gestureState ?? 'idle'}
            color={GESTURE_COLORS[stats?.gestureState ?? 'idle']}
          />
          <StatRow
            label="Left Eye"
            value={
              stats?.eyeState
                ? `${stats.eyeState.leftOpen ? 'OPEN' : 'CLOSED'} (${stats.eyeState.leftEAR.toFixed(3)})`
                : '--'
            }
            color={stats?.eyeState?.leftOpen ? '#22c55e' : '#ef4444'}
          />
          <StatRow
            label="Right Eye"
            value={
              stats?.eyeState
                ? `${stats.eyeState.rightOpen ? 'OPEN' : 'CLOSED'} (${stats.eyeState.rightEAR.toFixed(3)})`
                : '--'
            }
            color={stats?.eyeState?.rightOpen ? '#22c55e' : '#ef4444'}
          />
        </div>

        {/* Logs */}
        <div className="flex items-center justify-between">
          <div className="text-white/50 text-[10px] uppercase tracking-wider">Logs</div>
          {logs.length > 0 && (
            <button
              onClick={() => setLogs([])}
              className="text-[10px] text-white/40 hover:text-white/70 transition-colors px-1"
            >
              Clear
            </button>
          )}
        </div>
        <div
          ref={logContainerRef}
          className="flex-1 overflow-y-auto bg-white/5 rounded p-2 space-y-0.5"
        >
          {logs.length === 0 && <div className="text-white/30">No logs yet...</div>}
          {logs.map((msg, i) => (
            <div key={i} className="text-white/70 leading-tight break-all">
              {msg}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatRow({
  label,
  value,
  color
}: {
  label: string
  value: string
  color?: string
}): JSX.Element {
  return (
    <div className="flex justify-between">
      <span className="text-white/50">{label}</span>
      <span style={color ? { color } : undefined}>{value}</span>
    </div>
  )
}
