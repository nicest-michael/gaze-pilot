import { useEffect, useState, useRef, useCallback } from 'react'
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

interface DisplayInfo {
  id: number
  label: string
  width: number
  height: number
  x: number
  y: number
  primary: boolean
}

export function MainWindow(): JSX.Element {
  const [tracking, setTracking] = useState(false)
  const [fps, setFps] = useState(0)
  const [confidence, setConfidence] = useState(0)
  const [debugData, setDebugData] = useState<DebugData | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [cameraReady, setCameraReady] = useState(false)
  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const [showDisplayPicker, setShowDisplayPicker] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const debugDataRef = useRef<DebugData | null>(null)
  const rafRef = useRef<number>(0)
  const logContainerRef = useRef<HTMLDivElement>(null)

  // Track tracking state
  useEffect(() => {
    const cleanup = window.api.onTrackingState((state) => {
      setTracking(state.enabled)
      setFps(state.fps)
      setConfidence(state.confidence)
    })
    return cleanup
  }, [])

  // Receive debug data from tracking window via main process
  useEffect(() => {
    const cleanup = window.api.onDebugData((raw: unknown) => {
      if (!isDebugData(raw)) return
      debugDataRef.current = raw
      setDebugData(raw)
      if (raw.log) {
        setLogs((prev) => {
          const next = [...prev, raw.log]
          return next.length > MAX_LOGS ? next.slice(-MAX_LOGS) : next
        })
      }
    })
    return cleanup
  }, [])

  // Start camera for debug preview
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
        console.error('Camera failed:', err)
      }
    })()

    const stopCamera = (): void => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach((t) => t.stop())
        videoRef.current.srcObject = null
      }
      videoRef.current = null
    }

    // Stop camera on page unload (app close)
    window.addEventListener('beforeunload', stopCamera)

    return () => {
      cancelled = true
      window.removeEventListener('beforeunload', stopCamera)
      stopCamera()
    }
  }, [])

  // Canvas draw loop — video + face mesh + gaze point
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

    // Draw landmarks
    const d = debugDataRef.current
    if (d?.landmarks) {
      ctx.fillStyle = '#22c55e'
      for (const [x, y] of d.landmarks) {
        ctx.beginPath()
        ctx.arc((1 - x) * w, y * h, 1.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Draw gaze point
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

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs])

  return (
    <div className="h-full flex bg-neutral-900 text-white">
      {/* Left panel: Controls */}
      <div className="w-[280px] flex flex-col p-5 border-r border-white/10 shrink-0">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Gaze Pilot</h1>
          <p className="text-neutral-500 text-xs mt-1">Eye tracking with gesture control</p>
        </div>

        {/* Big tracking toggle */}
        <div className="flex justify-center mb-5">
          <button
            onClick={() => window.api.toggleTracking()}
            className={`w-36 h-36 rounded-full text-sm font-semibold transition-all duration-300 ${
              tracking
                ? 'bg-red-500/20 border-2 border-red-500 text-red-400 hover:bg-red-500/30'
                : 'bg-green-500/20 border-2 border-green-500 text-green-400 hover:bg-green-500/30'
            }`}
          >
            {tracking ? (<>Stop<br/>Tracking</>) : (<>Start<br/>Tracking</>)}
          </button>
        </div>

        {/* Calibrate button */}
        <button
          onClick={async () => {
            const d = await window.api.getDisplays()
            setDisplays(d)
            if (d.length === 1) {
              // Single display — calibrate immediately
              window.api.startCalibration(d[0].id)
            } else {
              setShowDisplayPicker(true)
            }
          }}
          disabled={!tracking}
          className="w-full px-4 py-2.5 rounded-lg bg-blue-500/20 border border-blue-500/50 text-blue-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-500/30 mb-3 text-sm font-medium"
        >
          Calibrate
        </button>

        {/* Display picker */}
        {showDisplayPicker && (
          <div className="bg-white/5 rounded-lg p-3 mb-5 space-y-2">
            <div className="text-white/50 text-[10px] uppercase tracking-wider">Select Display</div>
            {displays.map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  setShowDisplayPicker(false)
                  window.api.startCalibration(d.id)
                }}
                className="w-full px-3 py-2 rounded bg-blue-500/10 border border-blue-500/30 text-blue-300 hover:bg-blue-500/20 text-xs text-left transition-colors"
              >
                <div className="font-medium">{d.label}</div>
                <div className="text-white/40">{d.width} x {d.height}</div>
              </button>
            ))}
            <button
              onClick={() => setShowDisplayPicker(false)}
              className="w-full text-[10px] text-white/30 hover:text-white/50 pt-1"
            >
              Cancel
            </button>
          </div>
        )}

        {!showDisplayPicker && <div className="mb-2" />}

        {/* Live stats */}
        {tracking && (
          <div className="bg-white/5 rounded-lg p-3 mb-5 space-y-1.5 text-xs font-mono">
            <StatRow label="FPS" value={fps.toString()} color={fps >= 10 ? '#22c55e' : '#ef4444'} />
            <StatRow label="Confidence" value={`${Math.round(confidence * 100)}%`} color={confidence > 0.5 ? '#22c55e' : '#ef4444'} />
            <StatRow
              label="Gaze"
              value={debugData?.gazePoint ? `${Math.round(debugData.gazePoint.x)}, ${Math.round(debugData.gazePoint.y)}` : '--'}
            />
            <StatRow
              label="Gesture"
              value={debugData?.gestureState ?? 'idle'}
              color={GESTURE_COLORS[debugData?.gestureState ?? 'idle']}
            />
            <StatRow
              label="Left Eye"
              value={debugData?.eyeState ? `${debugData.eyeState.leftOpen ? 'OPEN' : 'CLOSED'} (${debugData.eyeState.leftEAR.toFixed(3)})` : '--'}
              color={debugData?.eyeState?.leftOpen ? '#22c55e' : '#ef4444'}
            />
            <StatRow
              label="Right Eye"
              value={debugData?.eyeState ? `${debugData.eyeState.rightOpen ? 'OPEN' : 'CLOSED'} (${debugData.eyeState.rightEAR.toFixed(3)})` : '--'}
              color={debugData?.eyeState?.rightOpen ? '#22c55e' : '#ef4444'}
            />
          </div>
        )}

        {/* Gesture reference — pushed to bottom */}
        <div className="mt-auto">
          <h3 className="text-neutral-500 text-[10px] uppercase tracking-wider mb-2">Gestures</h3>
          <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-[11px]">
            <span className="text-neutral-500">L double-wink</span><span className="text-neutral-300">Toggle cursor</span>
            <span className="text-neutral-500">L single wink</span><span className="text-neutral-300">Click</span>
            <span className="text-neutral-500">R double-wink</span><span className="text-neutral-300">Voice typing</span>
            <span className="text-neutral-500">R single wink</span><span className="text-neutral-300">Stop voice</span>
            <span className="text-neutral-500">R long hold</span><span className="text-neutral-300">Enter</span>
          </div>
          <div className="text-neutral-600 text-[10px] mt-2">
            <kbd className="px-1 py-0.5 rounded bg-neutral-800 text-neutral-400">Ctrl+Shift+G</kbd> toggle tracking
          </div>
        </div>
      </div>

      {/* Right panel: Camera + Mesh + Logs */}
      <div className="flex-1 flex flex-col p-3 gap-2 min-w-0 font-mono text-xs">
        {/* Camera + Face Mesh */}
        <div className="text-white/40 text-[10px] uppercase tracking-wider">Camera + Face Mesh</div>
        <div className="flex-[3] relative bg-black/40 rounded overflow-hidden min-h-0">
          <canvas
            ref={canvasRef}
            width={640}
            height={480}
            className="w-full h-full object-contain"
          />
          {!cameraReady && (
            <div className="absolute inset-0 flex items-center justify-center text-white/30 text-sm">
              Starting camera...
            </div>
          )}
        </div>

        {/* Logs */}
        <div className="flex items-center justify-between">
          <div className="text-white/40 text-[10px] uppercase tracking-wider">Logs</div>
          {logs.length > 0 && (
            <button
              onClick={() => setLogs([])}
              className="text-[10px] text-white/30 hover:text-white/60 transition-colors px-1"
            >
              Clear
            </button>
          )}
        </div>
        <div
          ref={logContainerRef}
          className="flex-1 overflow-y-auto bg-white/5 rounded p-2 space-y-0.5 min-h-[80px] max-h-[120px]"
        >
          {logs.length === 0 && <div className="text-white/20">No logs yet...</div>}
          {logs.map((msg, i) => (
            <div key={i} className="text-white/60 leading-tight break-all">
              {msg}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatRow({ label, value, color }: { label: string; value: string; color?: string }): JSX.Element {
  return (
    <div className="flex justify-between">
      <span className="text-white/40">{label}</span>
      <span style={color ? { color } : undefined}>{value}</span>
    </div>
  )
}
