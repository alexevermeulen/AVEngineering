import type { ReactNode } from 'react'

type DrawingSheetProps = {
  children: ReactNode
  sheetName?: string
  drawingTitle?: string
  revision?: string
}

export function DrawingSheet({
  children,
  sheetName = 'Main',
  drawingTitle = 'Engineering Drawing',
  revision = '01',
}: DrawingSheetProps) {
  return (
    <div className="drawing-workbench">
      <div className="drawing-sheet">
        <div className="drawing-sheet-inner">
          <div className="drawing-sheet-content">
            {children}
          </div>

          <footer className="drawing-title-block">
            <div>
              <strong>AV Engineering Platform</strong>
              <span>{drawingTitle}</span>
            </div>

            <div>
              <span>Sheet</span>
              <strong>{sheetName}</strong>
            </div>

            <div>
              <span>Revision</span>
              <strong>{revision}</strong>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}