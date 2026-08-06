import type { ReactNode } from 'react'

export type MainView =
  | 'canvas'
  | 'device-library'
  | 'project'
  | 'reports'
  | 'settings'

type WorkspaceProps = {
  activeView: MainView
  canvas: ReactNode
  deviceLibrary: ReactNode
  project: ReactNode
  reports: ReactNode
  settings: ReactNode
}

export function Workspace({
  activeView,
  canvas,
  deviceLibrary,
  project,
  reports,
  settings,
}: WorkspaceProps) {
  return (
    <main className="main-workspace">
      {activeView === 'canvas' && canvas}
      {activeView === 'device-library' && deviceLibrary}
      {activeView === 'project' && project}
      {activeView === 'reports' && reports}
      {activeView === 'settings' && settings}
    </main>
  )
}