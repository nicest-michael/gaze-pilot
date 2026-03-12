import { create } from 'zustand'
import type { GestureState, GazePoint, EyeState, CalibrationData } from '../../../shared/types'

interface TrackingStore {
  enabled: boolean
  calibrated: boolean
  calibrating: boolean
  cursorVisible: boolean
  gestureState: GestureState
  gazePoint: GazePoint | null
  eyeState: EyeState
  fps: number
  confidence: number
  calibrationData: CalibrationData | null
  calibrationProgress: number
  currentCalibrationPoint: number

  setEnabled: (enabled: boolean) => void
  setCalibrating: (calibrating: boolean) => void
  setCalibrated: (calibrated: boolean) => void
  setCursorVisible: (visible: boolean) => void
  setGestureState: (state: GestureState) => void
  setGazePoint: (point: GazePoint | null) => void
  setEyeState: (state: EyeState) => void
  setFps: (fps: number) => void
  setConfidence: (confidence: number) => void
  setCalibrationData: (data: CalibrationData | null) => void
  setCalibrationProgress: (progress: number) => void
  setCurrentCalibrationPoint: (point: number) => void
  reset: () => void
}

const DEFAULT_EYE_STATE: EyeState = { leftOpen: true, rightOpen: true, leftEAR: 0.3, rightEAR: 0.3 }

export const useTrackingStore = create<TrackingStore>((set) => ({
  enabled: false,
  calibrated: false,
  calibrating: false,
  cursorVisible: false,
  gestureState: 'idle',
  gazePoint: null,
  eyeState: DEFAULT_EYE_STATE,
  fps: 0,
  confidence: 0,
  calibrationData: null,
  calibrationProgress: 0,
  currentCalibrationPoint: 0,

  setEnabled: (enabled) => set({ enabled }),
  setCalibrating: (calibrating) => set({ calibrating }),
  setCalibrated: (calibrated) => set({ calibrated }),
  setCursorVisible: (cursorVisible) => set({ cursorVisible }),
  setGestureState: (gestureState) => set({ gestureState }),
  setGazePoint: (gazePoint) => set({ gazePoint }),
  setEyeState: (eyeState) => set({ eyeState }),
  setFps: (fps) => set({ fps }),
  setConfidence: (confidence) => set({ confidence }),
  setCalibrationData: (calibrationData) => set({ calibrationData }),
  setCalibrationProgress: (calibrationProgress) => set({ calibrationProgress }),
  setCurrentCalibrationPoint: (currentCalibrationPoint) => set({ currentCalibrationPoint }),
  reset: () =>
    set({
      enabled: false,
      calibrated: false,
      calibrating: false,
      cursorVisible: false,
      gestureState: 'idle',
      gazePoint: null,
      eyeState: DEFAULT_EYE_STATE,
      fps: 0,
      confidence: 0,
      calibrationData: null,
      calibrationProgress: 0,
      currentCalibrationPoint: 0
    })
}))
