import { useCallback, useEffect, useRef } from 'react'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { useWinkDetection } from './useWinkDetection'
import { useTrackingStore } from '../store/tracking-store'
import type { GestureEvent, GazePoint, EyeState, DebugData } from '../../../shared/types'

const GAZE_BUFFER_SIZE = 5
const DEBUG_THROTTLE_MS = 100

interface TrackingRefs {
  stream: MediaStream | null
  video: HTMLVideoElement | null
  faceLandmarker: FaceLandmarker | null
  webgazerReady: boolean
  webgazerModule: any | null
  rafId: number | null
  fpsInterval: ReturnType<typeof setInterval> | null
  frameCount: number
  lastFpsTime: number
  gazeBuffer: GazePoint[]
  lastDebugSend: number
  running: boolean
  log: string
}

function createRefs(): TrackingRefs {
  return {
    stream: null,
    video: null,
    faceLandmarker: null,
    webgazerReady: false,
    webgazerModule: null,
    rafId: null,
    fpsInterval: null,
    frameCount: 0,
    lastFpsTime: Date.now(),
    gazeBuffer: [],
    lastDebugSend: 0,
    running: false,
    log: ''
  }
}

function smoothGaze(buffer: GazePoint[]): GazePoint {
  const len = buffer.length
  if (len === 0) return { x: 0, y: 0, confidence: 0 }
  let sx = 0,
    sy = 0,
    sc = 0
  for (const p of buffer) {
    sx += p.x
    sy += p.y
    sc += p.confidence
  }
  return { x: sx / len, y: sy / len, confidence: sc / len }
}

export function useEyeTracking(): void {
  const refs = useRef<TrackingRefs>(createRefs())
  const store = useTrackingStore

  const onGesture = useCallback((gesture: GestureEvent) => {
    window.api.sendGesture(gesture)
  }, [])

  const { processLandmarks, resetBaseline } = useWinkDetection(onGesture)

  const stopTracking = useCallback(() => {
    const r = refs.current
    r.running = false

    if (r.rafId !== null) {
      cancelAnimationFrame(r.rafId)
      r.rafId = null
    }

    if (r.fpsInterval !== null) {
      clearInterval(r.fpsInterval)
      r.fpsInterval = null
    }

    if (r.faceLandmarker) {
      r.faceLandmarker.close()
      r.faceLandmarker = null
    }

    if (r.webgazerReady && r.webgazerModule) {
      try {
        r.webgazerModule.end()
      } catch {
        // ignore
      }
      r.webgazerReady = false
      r.webgazerModule = null
    }

    if (r.stream) {
      r.stream.getTracks().forEach((t) => t.stop())
      r.stream = null
    }

    if (r.video) {
      r.video.remove()
      r.video = null
    }

    r.gazeBuffer = []
    r.frameCount = 0
    store.getState().setEnabled(false)
    store.getState().setFps(0)
  }, [store])

  const startTracking = useCallback(async () => {
    const r = refs.current
    if (r.running) return
    r.running = true
    r.log = ''

    // Get camera
    try {
      r.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      })
      r.video = document.createElement('video')
      r.video.srcObject = r.stream
      r.video.style.display = 'none'
      document.body.appendChild(r.video)
      await r.video.play()
      r.log += 'Camera ready. '
    } catch (err) {
      r.log += `Camera failed: ${err}. `
      r.running = false
      return
    }

    // Init MediaPipe Face Landmarker
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      )
      r.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false
      })
      r.log += 'MediaPipe ready. '
    } catch (err) {
      r.log += `MediaPipe failed: ${err}. `
      // Continue without MediaPipe - WebGazer may still work
    }

    // Init WebGazer with dynamic import - let it manage its own camera
    try {
      const wg = (await import('webgazer')).default
      wg.setRegression('ridge')
        .showVideoPreview(false)
        .showPredictionPoints(false)
        .showFaceOverlay(false)
        .showFaceFeedbackBox(false)
      await wg.begin()
      r.webgazerReady = true
      r.webgazerModule = wg
      r.log += 'WebGazer ready. '

      // Hide any DOM elements WebGazer created
      const wgVideo = document.getElementById('webgazerVideoFeed')
      if (wgVideo) wgVideo.style.display = 'none'
      const wgCanvas = document.getElementById('webgazerVideoCanvas')
      if (wgCanvas) (wgCanvas as HTMLElement).style.display = 'none'
      const wgFace = document.getElementById('webgazerFaceOverlay')
      if (wgFace) wgFace.style.display = 'none'
      const wgFace2 = document.getElementById('webgazerFaceFeedbackBox')
      if (wgFace2) wgFace2.style.display = 'none'
    } catch (err) {
      r.log += `WebGazer failed: ${err}. `
      // Continue without WebGazer - wink detection may still work
    }

    // FPS counter (1Hz)
    r.lastFpsTime = Date.now()
    r.frameCount = 0
    r.fpsInterval = setInterval(() => {
      const now = Date.now()
      const elapsed = (now - r.lastFpsTime) / 1000
      const fps = elapsed > 0 ? Math.round(r.frameCount / elapsed) : 0
      r.frameCount = 0
      r.lastFpsTime = now
      store.getState().setFps(fps)
    }, 1000)

    // Reset wink baseline for fresh calibration
    resetBaseline()
    store.getState().setEnabled(true)

    // Start tracking loop
    const loop = (): void => {
      if (!r.running) return
      r.frameCount++
      const now = Date.now()

      let eyeState: EyeState = { leftOpen: true, rightOpen: true, leftEAR: 0.3, rightEAR: 0.3 }
      let landmarkArrays: number[][] | null = null

      // MediaPipe face detection
      if (r.faceLandmarker && r.video && r.video.readyState >= 2) {
        try {
          const results = r.faceLandmarker.detectForVideo(r.video, now)
          if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            const face = results.faceLandmarks[0]
            landmarkArrays = face.map((lm) => [lm.x, lm.y, lm.z])
            eyeState = processLandmarks(landmarkArrays)
            store.getState().setEyeState(eyeState)
          }
        } catch {
          // Skip frame on error
        }
      }

      // WebGazer gaze prediction
      let gazePoint: GazePoint | null = null
      if (r.webgazerReady && r.webgazerModule) {
        try {
          const prediction = r.webgazerModule.getCurrentPrediction()
          if (prediction && prediction.x != null && prediction.y != null) {
            const raw: GazePoint = { x: prediction.x, y: prediction.y, confidence: 0.8 }
            r.gazeBuffer.push(raw)
            if (r.gazeBuffer.length > GAZE_BUFFER_SIZE) {
              r.gazeBuffer.shift()
            }
            gazePoint = smoothGaze(r.gazeBuffer)
            store.getState().setGazePoint(gazePoint)
            store.getState().setConfidence(gazePoint.confidence)

            // Send gaze update to main process
            window.api.sendGazeUpdate(gazePoint)
          }
        } catch {
          // Skip frame on error
        }
      }

      // Send debug data throttled to 10Hz
      if (now - r.lastDebugSend >= DEBUG_THROTTLE_MS) {
        r.lastDebugSend = now
        const debugData: DebugData = {
          fps: store.getState().fps,
          confidence: gazePoint?.confidence ?? 0,
          gazePoint,
          eyeState,
          gestureState: store.getState().gestureState,
          landmarks: landmarkArrays,
          log: r.log
        }
        window.api.sendDebugData(debugData)
      }

      r.rafId = requestAnimationFrame(loop)
    }

    r.rafId = requestAnimationFrame(loop)
  }, [processLandmarks, resetBaseline, store])

  // Listen for start/stop commands from main process
  useEffect(() => {
    const cleanupStart = window.api.onStartTracking(() => {
      startTracking()
    })
    const cleanupStop = window.api.onStopTracking(() => {
      stopTracking()
    })

    // Ensure camera is released on app close
    window.addEventListener('beforeunload', stopTracking)

    return () => {
      cleanupStart()
      cleanupStop()
      window.removeEventListener('beforeunload', stopTracking)
      stopTracking()
    }
  }, [startTracking, stopTracking])

  // Listen for calibration points and feed them to WebGazer
  useEffect(() => {
    const cleanup = window.api.onCalibrationPoint((x: number, y: number) => {
      const r = refs.current
      if (r.webgazerReady && r.webgazerModule) {
        try {
          r.webgazerModule.recordScreenPosition(x, y, 'click')
          console.log(`[gaze-pilot] WebGazer calibration point: (${x}, ${y})`)
        } catch (err) {
          console.error('[gaze-pilot] Failed to record calibration point:', err)
        }
      }
    })
    return cleanup
  }, [])
}
