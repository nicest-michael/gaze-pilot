declare module 'webgazer' {
  const webgazer: {
    setRegression(type: string): typeof webgazer
    showVideoPreview(show: boolean): typeof webgazer
    showPredictionPoints(show: boolean): typeof webgazer
    showFaceOverlay(show: boolean): typeof webgazer
    showFaceFeedbackBox(show: boolean): typeof webgazer
    begin(): Promise<typeof webgazer>
    pause(): typeof webgazer
    end(): typeof webgazer
    recordScreenPosition(x: number, y: number, type: string): typeof webgazer
    getCurrentPrediction(): { x: number; y: number } | null
  }
  export default webgazer
}
