function App(): JSX.Element {
  const hash = window.location.hash

  if (hash === '#/overlay') {
    return <div id="overlay-root" />
  }

  if (hash === '#/debug') {
    return <div>Debug Window (coming soon)</div>
  }

  if (hash === '#/calibration') {
    return <div>Calibration (coming soon)</div>
  }

  // Default: tracking window (hidden)
  return <div>Tracking Window (coming soon)</div>
}

export default App
