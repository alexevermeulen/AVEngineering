import type { ReactNode } from 'react'

type MainWindowProps = {
  menuBar: ReactNode
  toolbar: ReactNode
  leftSidebar: ReactNode
  canvas: ReactNode
  rightSidebar: ReactNode
  statusBar: ReactNode
}

export function MainWindow({
  menuBar,
  toolbar,
  leftSidebar,
  canvas,
  rightSidebar,
  statusBar,
}: MainWindowProps) {
  return (
    <div className="desktop-window">
      <div className="desktop-menu-bar">{menuBar}</div>

      <div className="desktop-toolbar">{toolbar}</div>

      <div className="desktop-workspace">
        <aside className="desktop-left-sidebar">
          {leftSidebar}
        </aside>

        <main className="desktop-canvas">
          {canvas}
        </main>

        <aside className="desktop-right-sidebar">
          {rightSidebar}
        </aside>
      </div>

      <div className="desktop-status-bar">{statusBar}</div>
    </div>
  )
}