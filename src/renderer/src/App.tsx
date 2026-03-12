import { OverlayWindow } from './components/OverlayWindow'
import { CalibrationWindow } from './components/CalibrationWindow'
import { DebugWindow } from './components/DebugWindow'
import { TrackingWindow } from './components/TrackingWindow'

function App(): JSX.Element {
  const hash = window.location.hash

  if (hash === '#/overlay') {
    document.body.classList.add('overlay-mode')
    return <OverlayWindow />
  }

  if (hash === '#/debug') {
    return <DebugWindow />
  }

  if (hash === '#/calibration') {
    return <CalibrationWindow />
  }

  // Default: tracking window (hidden)
  return <TrackingWindow />
}

export default App
