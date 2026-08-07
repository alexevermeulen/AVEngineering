import type { ReactNode } from 'react'

type DrawingSheetProps = {
  children: ReactNode
}

export function DrawingSheet({
  children,
}: DrawingSheetProps) {
  return (
    <div className="drawing-workbench">
      <div className="drawing-sheet">
        {children}
      </div>
    </div>
  )
}