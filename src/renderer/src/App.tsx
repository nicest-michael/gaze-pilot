import { OverlayWindow } from './components/OverlayWindow'
import { CalibrationWindow } from './components/CalibrationWindow'
import { DebugWindow } from './components/DebugWindow'
import { TrackingWindow } from './components/TrackingWindow'
import { MainWindow } from './components/MainWindow'

function App(): JSX.Element {
  const hash = window.location.hash

  if (hash === '#/main' || hash === '' || hash === '#/') {
    return <MainWindow />
  }

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

  // Tracking window (hidden)
  return <TrackingWindow />
}

export default App
