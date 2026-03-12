declare module 'webgazer' {
  interface WebGazer {
    setRegression(type: string): WebGazer
    showVideoPreview(show: boolean): WebGazer
    showPredictionPoints(show: boolean): WebGazer
    showFaceOverlay(show: boolean): WebGazer
    showFaceFeedbackBox(show: boolean): WebGazer
    begin(): Promise<WebGazer>
    pause(): WebGazer
    end(): WebGazer
    recordScreenPosition(x: number, y: number, type: string): WebGazer
    getCurrentPrediction(): { x: number; y: number } | null
  }

  /** Default export — works with both `import webgazer` and `(await import('webgazer')).default` */
  const webgazer: WebGazer
  export default webgazer
}
