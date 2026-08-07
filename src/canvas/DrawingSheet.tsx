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
        <div className="drawing-sheet-inner">
          <div className="drawing-sheet-content">
            {children}
          </div>

          <footer className="drawing-title-block">
            <div>
              <strong>AV Engineering Platform</strong>
              <span>Engineering Drawing</span>
            </div>

            <div>
              <span>Sheet</span>
              <strong>Main</strong>
            </div>

            <div>
              <span>Revision</span>
              <strong>01</strong>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}