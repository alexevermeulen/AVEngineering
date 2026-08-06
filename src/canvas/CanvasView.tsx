import type { ReactNode } from 'react'

type CanvasViewProps = {
  children: ReactNode
}

export function CanvasView({
  children,
}: CanvasViewProps) {
  return (
    <div className="canvas-view">
      {children}
    </div>
  )
}