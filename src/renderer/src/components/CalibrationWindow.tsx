import { useEffect, useState, useRef, useCallback } from 'react'

const CALIBRATION_POINTS = [
  { x: 0.5, y: 0.5 }, // center
  { x: 0.1, y: 0.1 }, // top-left
  { x: 0.9, y: 0.1 }, // top-right
  { x: 0.1, y: 0.9 }, // bottom-left
  { x: 0.9, y: 0.9 } // bottom-right
]

const DWELL_MS = 2000

export function CalibrationWindow(): JSX.Element {
  const [active, setActive] = useState(false)
  const [complete, setComplete] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const startTimeRef = useRef<number>(0)
  const rafRef = useRef<number>(0)

  const advancePoint = useCallback(() => {
    const point = CALIBRATION_POINTS[currentIndex]
    const screenX = point.x * window.innerWidth
    const screenY = point.y * window.innerHeight
    window.api.recordCalibrationPoint(screenX, screenY)

    const nextIndex = currentIndex + 1
    if (nextIndex >= CALIBRATION_POINTS.length) {
      window.api.finishCalibration()
      setActive(false)
      setComplete(true)
      setCurrentIndex(0)
      setProgress(0)
      // Show completion message briefly before hiding
      setTimeout(() => setComplete(false), 1500)
    } else {
      setCurrentIndex(nextIndex)
      setProgress(0)
      startTimeRef.current = performance.now()
    }
  }, [currentIndex])

  // Animation loop for progress
  useEffect(() => {
    if (!active) return

    startTimeRef.current = performance.now()

    const tick = (): void => {
      const elapsed = performance.now() - startTimeRef.current
      const p = Math.min(elapsed / DWELL_MS, 1)
      setProgress(p)

      if (p >= 1) {
        advancePoint()
      } else {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [active, currentIndex, advancePoint])

  // Listen for calibration start from main
  useEffect(() => {
    const cleanup = window.api.onStartCalibration(() => {
      setCurrentIndex(0)
      setProgress(0)
      setActive(true)
    })
    return cleanup
  }, [])

  if (!active && !complete) return <></>

  if (complete) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center">
        <div className="text-green-400 text-2xl font-mono animate-pulse">
          Calibration Complete!
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center">
      {/* Instructions */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 text-white/70 text-sm font-mono">
        Stare at each dot for 2 seconds ({currentIndex + 1}/{CALIBRATION_POINTS.length})
      </div>

      {/* All calibration dots */}
      {CALIBRATION_POINTS.map((point, i) => {
        const isCurrent = i === currentIndex
        const isDone = i < currentIndex

        return (
          <div
            key={i}
            className="absolute"
            style={{
              left: point.x * 100 + '%',
              top: point.y * 100 + '%',
              transform: 'translate(-50%, -50%)'
            }}
          >
            {/* Progress ring for current dot */}
            {isCurrent && (
              <svg className="absolute -inset-3 w-10 h-10" viewBox="0 0 40 40">
                <circle
                  cx="20"
                  cy="20"
                  r="17"
                  fill="none"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="2"
                />
                <circle
                  cx="20"
                  cy="20"
                  r="17"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="2"
                  strokeDasharray={`${progress * 107} 107`}
                  strokeLinecap="round"
                  transform="rotate(-90 20 20)"
                />
              </svg>
            )}

            {/* Dot */}
            <div
              className={`w-4 h-4 rounded-full transition-colors duration-300 ${
                isDone
                  ? 'bg-green-500/60'
                  : isCurrent
                    ? 'bg-white animate-pulse'
                    : 'bg-white/30'
              }`}
            />
          </div>
        )
      })}
    </div>
  )
}
