import { useCallback, useRef } from 'react'
import type { GestureEvent, EyeState } from '../../../shared/types'

// MediaPipe face landmark indices for eye contours
const LEFT_EYE = [362, 385, 386, 263, 374, 380]
const RIGHT_EYE = [33, 159, 158, 133, 153, 145]

// Timing constants
const WINK_MIN_MS = 150
const DOUBLE_WINK_WINDOW_MS = 500
const SINGLE_WINK_DELAY_MS = 550
const LONG_WINK_MS = 1500

// Baseline calibration
const BASELINE_PERIOD_MS = 3000
const DEFAULT_BASELINE = 0.3
const THRESHOLD_RATIO = 0.6

interface WinkState {
  leftClosed: boolean
  rightClosed: boolean
  leftCloseTime: number
  rightCloseTime: number
  lastLeftWinkTime: number
  lastRightWinkTime: number
  leftWinkCount: number
  rightWinkCount: number
  leftBaseline: number
  rightBaseline: number
  baselineSamples: number
  baselineAccL: number
  baselineAccR: number
  leftSingleTimer: ReturnType<typeof setTimeout> | null
  rightSingleTimer: ReturnType<typeof setTimeout> | null
  longRightFired: boolean
}

function createInitialState(): WinkState {
  return {
    leftClosed: false,
    rightClosed: false,
    leftCloseTime: 0,
    rightCloseTime: 0,
    lastLeftWinkTime: 0,
    lastRightWinkTime: 0,
    leftWinkCount: 0,
    rightWinkCount: 0,
    leftBaseline: DEFAULT_BASELINE,
    rightBaseline: DEFAULT_BASELINE,
    baselineSamples: 0,
    baselineAccL: 0,
    baselineAccR: 0,
    leftSingleTimer: null,
    rightSingleTimer: null,
    longRightFired: false
  }
}

function computeEAR(landmarks: number[][], indices: number[]): number {
  const p1 = landmarks[indices[0]]
  const p2 = landmarks[indices[1]]
  const p3 = landmarks[indices[2]]
  const p4 = landmarks[indices[3]]
  const p5 = landmarks[indices[4]]
  const p6 = landmarks[indices[5]]

  const verticalA = Math.sqrt((p2[0] - p6[0]) ** 2 + (p2[1] - p6[1]) ** 2)
  const verticalB = Math.sqrt((p3[0] - p5[0]) ** 2 + (p3[1] - p5[1]) ** 2)
  const horizontal = Math.sqrt((p1[0] - p4[0]) ** 2 + (p1[1] - p4[1]) ** 2)

  if (horizontal === 0) return 0
  return (verticalA + verticalB) / (2.0 * horizontal)
}

export function useWinkDetection(onGesture: (gesture: GestureEvent) => void) {
  const stateRef = useRef<WinkState>(createInitialState())
  const calibrationStartRef = useRef<number>(Date.now())

  const resetBaseline = useCallback(() => {
    const s = stateRef.current
    s.leftBaseline = DEFAULT_BASELINE
    s.rightBaseline = DEFAULT_BASELINE
    s.baselineSamples = 0
    s.baselineAccL = 0
    s.baselineAccR = 0
    calibrationStartRef.current = Date.now()
  }, [])

  const processLandmarks = useCallback(
    (landmarks: number[][]): EyeState => {
      const s = stateRef.current
      const now = Date.now()

      const leftEAR = computeEAR(landmarks, LEFT_EYE)
      const rightEAR = computeEAR(landmarks, RIGHT_EYE)

      // Adaptive baseline calibration during the first 3 seconds
      if (now - calibrationStartRef.current < BASELINE_PERIOD_MS) {
        s.baselineSamples++
        s.baselineAccL += leftEAR
        s.baselineAccR += rightEAR
        s.leftBaseline = s.baselineAccL / s.baselineSamples
        s.rightBaseline = s.baselineAccR / s.baselineSamples
      }

      const leftThreshold = s.leftBaseline * THRESHOLD_RATIO
      const rightThreshold = s.rightBaseline * THRESHOLD_RATIO

      const leftOpen = leftEAR > leftThreshold
      const rightOpen = rightEAR > rightThreshold

      // --- Left eye wink detection ---
      if (!leftOpen && !s.leftClosed) {
        // Left eye just closed
        s.leftClosed = true
        s.leftCloseTime = now
      } else if (leftOpen && s.leftClosed) {
        // Left eye just opened
        s.leftClosed = false
        const closedDuration = now - s.leftCloseTime

        if (closedDuration >= WINK_MIN_MS) {
          // Valid left wink
          if (now - s.lastLeftWinkTime <= DOUBLE_WINK_WINDOW_MS) {
            // Double left wink
            if (s.leftSingleTimer !== null) {
              clearTimeout(s.leftSingleTimer)
              s.leftSingleTimer = null
            }
            s.leftWinkCount = 0
            s.lastLeftWinkTime = 0
            onGesture('left_double_wink')
          } else {
            // Potential single left wink - wait to confirm
            s.lastLeftWinkTime = now
            s.leftWinkCount = 1
            s.leftSingleTimer = setTimeout(() => {
              s.leftSingleTimer = null
              if (s.leftWinkCount === 1) {
                onGesture('single_left_wink')
              }
              s.leftWinkCount = 0
              s.lastLeftWinkTime = 0
            }, SINGLE_WINK_DELAY_MS)
          }
        }
      }

      // --- Right eye wink detection ---
      if (!rightOpen && !s.rightClosed) {
        // Right eye just closed
        s.rightClosed = true
        s.rightCloseTime = now
        s.longRightFired = false
      } else if (rightOpen && s.rightClosed) {
        // Right eye just opened
        s.rightClosed = false
        const closedDuration = now - s.rightCloseTime

        // Only process as a normal wink if long wink didn't already fire
        if (closedDuration >= WINK_MIN_MS && !s.longRightFired) {
          if (now - s.lastRightWinkTime <= DOUBLE_WINK_WINDOW_MS) {
            // Double right wink
            if (s.rightSingleTimer !== null) {
              clearTimeout(s.rightSingleTimer)
              s.rightSingleTimer = null
            }
            s.rightWinkCount = 0
            s.lastRightWinkTime = 0
            onGesture('right_double_wink')
          } else {
            // Potential single right wink - wait to confirm
            s.lastRightWinkTime = now
            s.rightWinkCount = 1
            s.rightSingleTimer = setTimeout(() => {
              s.rightSingleTimer = null
              if (s.rightWinkCount === 1) {
                onGesture('single_right_wink')
              }
              s.rightWinkCount = 0
              s.lastRightWinkTime = 0
            }, SINGLE_WINK_DELAY_MS)
          }
        }
      }

      // --- Long right wink detection ---
      if (s.rightClosed && !s.longRightFired && leftOpen) {
        const closedDuration = now - s.rightCloseTime
        if (closedDuration >= LONG_WINK_MS) {
          // Cancel any pending right single timer
          if (s.rightSingleTimer !== null) {
            clearTimeout(s.rightSingleTimer)
            s.rightSingleTimer = null
          }
          s.longRightFired = true
          s.rightWinkCount = 0
          s.lastRightWinkTime = 0
          onGesture('long_right_wink')
        }
      }

      return { leftOpen, rightOpen, leftEAR, rightEAR }
    },
    [onGesture]
  )

  return { processLandmarks, resetBaseline }
}
