import { useEffect, useState } from 'react'

export function OverlayWindow(): JSX.Element {
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const cleanup1 = window.api.onSetCursor((x: number, y: number) => {
      setPos({ x, y })
    })
    const cleanup2 = window.api.onSetVisible((v: boolean) => {
      setVisible(v)
    })
    return () => {
      cleanup1()
      cleanup2()
    }
  }, [])

  if (!visible) return <></>

  return (
    <div
      className="fixed pointer-events-none"
      style={{
        left: pos.x - 12,
        top: pos.y - 12,
        width: 24,
        height: 24
      }}
    >
      {/* Outer ring */}
      <div className="absolute inset-0 rounded-full border-2 border-red-400/80 animate-pulse" />
      {/* Inner dot */}
      <div className="absolute inset-[6px] rounded-full bg-red-500/70" />
    </div>
  )
}
