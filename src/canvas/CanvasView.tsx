import type { ReactNode } from 'react'

type CanvasViewProps = {
  children: ReactNode
}

export function CanvasView({
  children,
}: CanvasViewProps) {
  return (
    <main className="canvas-view">
      <div className="flow-area">
        {children}
      </div>
    </main>
  )
}