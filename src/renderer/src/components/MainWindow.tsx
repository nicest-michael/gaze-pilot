import { useEffect, useState } from 'react'

export function MainWindow(): JSX.Element {
  const [tracking, setTracking] = useState(false)
  const [debugOpen, setDebugOpen] = useState(false)
  const [fps, setFps] = useState(0)
  const [confidence, setConfidence] = useState(0)

  useEffect(() => {
    const cleanup = window.api.onTrackingState((state: { enabled: boolean; fps: number; confidence: number }) => {
      setTracking(state.enabled)
      setFps(state.fps)
      setConfidence(state.confidence)
    })
    return cleanup
  }, [])

  return (
    <div className="h-full flex flex-col bg-neutral-900 text-white p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Gaze Pilot</h1>
        <p className="text-neutral-400 text-sm mt-1">Eye tracking with gesture control</p>
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-4 mb-8">
        {/* Big tracking toggle */}
        <button
          onClick={() => window.api.toggleTracking()}
          className={`w-48 h-48 rounded-full text-lg font-semibold transition-all duration-300 ${
            tracking
              ? 'bg-red-500/20 border-2 border-red-500 text-red-400 hover:bg-red-500/30'
              : 'bg-green-500/20 border-2 border-green-500 text-green-400 hover:bg-green-500/30'
          }`}
        >
          {tracking ? (<>Stop<br/>Tracking</>) : (<>Start<br/>Tracking</>)}
        </button>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => window.api.startCalibration()}
            disabled={!tracking}
            className="px-4 py-2 rounded-lg bg-blue-500/20 border border-blue-500/50 text-blue-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-500/30"
          >
            Calibrate
          </button>
          <button
            onClick={() => { window.api.toggleDebug(); setDebugOpen(!debugOpen) }}
            className="px-4 py-2 rounded-lg bg-purple-500/20 border border-purple-500/50 text-purple-400 hover:bg-purple-500/30"
          >
            {debugOpen ? 'Close Debug' : 'Open Debug'}
          </button>
        </div>
      </div>

      {/* Status */}
      {tracking && (
        <div className="flex justify-center gap-8 mb-8 text-sm">
          <div className="text-center">
            <div className="text-neutral-400">FPS</div>
            <div className={fps >= 10 ? 'text-green-400' : 'text-red-400'}>{fps}</div>
          </div>
          <div className="text-center">
            <div className="text-neutral-400">Confidence</div>
            <div className="text-white">{Math.round(confidence * 100)}%</div>
          </div>
        </div>
      )}

      {/* Gesture reference */}
      <div className="mt-auto">
        <h3 className="text-neutral-400 text-xs uppercase tracking-wider mb-2">Gestures</h3>
        <div className="grid grid-cols-2 gap-1 text-xs">
          <div className="text-neutral-500">Left double-wink</div><div className="text-neutral-300">Toggle gaze cursor</div>
          <div className="text-neutral-500">Single left wink</div><div className="text-neutral-300">Click at gaze</div>
          <div className="text-neutral-500">Right double-wink</div><div className="text-neutral-300">Voice typing (Win+H)</div>
          <div className="text-neutral-500">Single right wink</div><div className="text-neutral-300">Stop voice typing</div>
          <div className="text-neutral-500">Long right hold</div><div className="text-neutral-300">Press Enter</div>
        </div>
        <div className="text-neutral-500 text-xs mt-3">
          Shortcut: <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300">Ctrl+Shift+G</kbd> toggle tracking
        </div>
      </div>
    </div>
  )
}
