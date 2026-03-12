export type GestureState = 'idle' | 'cursor_visible' | 'voice_active' | 'voice_closing' | 'sending'

export type GestureEvent =
  | 'left_double_wink'
  | 'single_left_wink'
  | 'right_double_wink'
  | 'single_right_wink'
  | 'long_right_wink'

export interface EyeState {
  leftOpen: boolean
  rightOpen: boolean
  leftEAR: number
  rightEAR: number
}

export interface GazePoint {
  x: number
  y: number
  confidence: number
}

export interface CalibrationPoint {
  screenX: number
  screenY: number
  normalizedX: number
  normalizedY: number
}

export interface CalibrationData {
  timestamp: number
  points: CalibrationPoint[]
}

export interface DebugData {
  fps: number
  confidence: number
  gazePoint: GazePoint | null
  eyeState: EyeState
  gestureState: GestureState
  landmarks: number[][] | null
  log: string
}
