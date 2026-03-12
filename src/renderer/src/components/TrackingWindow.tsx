import { useEyeTracking } from '../hooks/useEyeTracking'

export function TrackingWindow(): JSX.Element {
  useEyeTracking()
  return <div />
}
