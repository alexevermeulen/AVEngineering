import type { ReactNode } from 'react'
import { DrawingSheet } from './DrawingSheet'

type CanvasViewProps = {
  children: ReactNode
}

export function CanvasView({
  children,
}: CanvasViewProps) {
  return (
    <main className="canvas-view">
      <DrawingSheet>
        <div className="flow-area">
          {children}
        </div>
      </DrawingSheet>
    </main>
  )
}