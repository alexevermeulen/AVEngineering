import type { ReactNode } from 'react'

import { DrawingSheet } from './DrawingSheet'
import {
  MAIN_SHEET,
  type SheetDefinition,
} from './SheetDefinition'

type CanvasViewProps = {
  children: ReactNode
  sheet?: SheetDefinition
}

export function CanvasView({
  children,
  sheet = MAIN_SHEET,
}: CanvasViewProps) {
  return (
    <main className="canvas-view">
      <DrawingSheet
        sheetName={sheet.name}
        drawingTitle={sheet.title}
        revision={sheet.revision}
      >
        <div className="flow-area">
          {children}
        </div>
      </DrawingSheet>
    </main>
  )
}