import type { RefObject } from 'react'
import type { Signal } from '../types'

export type ToolbarToolMode =
  | 'select'
  | 'place-graphic-route'

type ToolbarProps = {
  projectName: string
  toolMode: ToolbarToolMode
  routeSignal: string
  routeSignals: Signal[]

  canUndo: boolean
  canRedo: boolean
  canEditDevice: boolean
  canDelete: boolean
  hasSelectedEdge: boolean

  openProjectInputRef: RefObject<HTMLInputElement | null>

  signalName: (signal: Signal) => string

  onNewProject: () => void
  onEditProject: () => void
  onToggleRecentProjects: () => void
  onOpenReports: () => void
  onOpenSettings: () => void
  onUndo: () => void
  onRedo: () => void
  onSaveProject: () => void
  onOpenProject: (file: File) => void

  onSelectTool: () => void
  onGraphicRouteTool: () => void
  onRouteSignalChange: (signal: string) => void

  onEditDevice: () => void
  onDelete: () => void
  onEditCableNumber: () => void
  onCableModeChange: (mode: 'full' | 'feather') => void
  
  onZoomFit: () => void
  onZoom50: () => void
  onZoom75: () => void
  onZoom100: () => void


}

export function Toolbar({
  projectName,
  toolMode,
  routeSignal,
  routeSignals,
  canUndo,
  canRedo,
  canEditDevice,
  canDelete,
  hasSelectedEdge,
  openProjectInputRef,
  signalName,
  onNewProject,
  onEditProject,
  onToggleRecentProjects,
  onOpenReports,
  onOpenSettings,
  onUndo,
  onRedo,
  onSaveProject,
  onOpenProject,
  onSelectTool,
  onGraphicRouteTool,
  onRouteSignalChange,
  onEditDevice,
  onDelete,
  onEditCableNumber,
  onCableModeChange,
  onZoomFit,
  onZoom50,
  onZoom75,
  onZoom100,
}: ToolbarProps) {
  return (
  <header className="toolbar toolbar-modern">
    <div className="toolbar-brand">
      <strong>AV Engineering Platform</strong>
      <span>{projectName}</span>
    </div>

    <div className="toolbar-group">
      <button type="button" onClick={onNewProject}>
        Nieuw
      </button>

      <button
        type="button"
        onClick={() => openProjectInputRef.current?.click()}
      >
        Openen
      </button>

      <button type="button" onClick={onSaveProject}>
        Opslaan
      </button>
      <button type="button" onClick={onEditProject}>
  Project
</button>

<button type="button" onClick={onToggleRecentProjects}>
  Recent
</button>
    </div>

    <div className="toolbar-separator" />

    <div className="toolbar-group">
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        title="Ongedaan maken (Ctrl+Z)"
      >
        Undo
      </button>

      <button
        type="button"
        onClick={onRedo}
        disabled={!canRedo}
        title="Opnieuw uitvoeren (Ctrl+Y of Ctrl+Shift+Z)"
      >
        Redo
      </button>
    </div>

    <div className="toolbar-separator" />

    <div className="toolbar-group">
      <button
        type="button"
        className={toolMode === 'select' ? 'active-tool' : ''}
        onClick={onSelectTool}
      >
        Select
      </button>

      <button
        type="button"
        className={
          toolMode === 'place-graphic-route'
            ? 'active-tool'
            : ''
        }
        onClick={onGraphicRouteTool}
      >
        U-lijn
      </button>

      <select
        value={routeSignal}
        onChange={(event) =>
          onRouteSignalChange(event.target.value)
        }
        aria-label="Signaaltype voor U-lijn"
      >
        {routeSignals.map((signal) => (
          <option key={signal} value={signal}>
            {signalName(signal)}
          </option>
        ))}
      </select>
    </div>

    <div className="toolbar-separator" />

    <div className="toolbar-group">
      <button
        type="button"
        disabled={!canEditDevice}
        onClick={onEditDevice}
      >
        Bewerken
      </button>

      <button
        type="button"
        className="delete-button"
        disabled={!canDelete}
        onClick={onDelete}
      >
        Verwijderen
      </button>

      <button
        type="button"
        disabled={!hasSelectedEdge}
        onClick={onEditCableNumber}
      >
        Kabelnummer
      </button>
     <button
  type="button"
  disabled={!hasSelectedEdge}
  onClick={() => onCableModeChange('full')}
>
  Volledige kabel
</button>

<button
  type="button"
  disabled={!hasSelectedEdge}
  onClick={() => onCableModeChange('feather')}
>
  Feather
</button> 
    </div>
<div className="toolbar-separator" />

<div className="toolbar-group">
  <button type="button" onClick={onZoomFit}>
    Fit
  </button>

  <button type="button" onClick={onZoom50}>
    50%
  </button>

  <button type="button" onClick={onZoom75}>
    75%
  </button>

  <button type="button" onClick={onZoom100}>
    100%
  </button>
</div>




    <div className="toolbar-spacer" />

    <div className="toolbar-group">
      <button
        type="button"
        onClick={onOpenReports}
      >
        Rapporten
      </button>

      <button
        type="button"
        onClick={onOpenSettings}
      >
        Settings
      </button>
    </div>

    <input
      ref={openProjectInputRef}
      type="file"
      accept=".avproject,application/json"
      hidden
      onChange={(event) => {
        const selectedFile = event.target.files?.[0]

        if (selectedFile) {
          onOpenProject(selectedFile)
        }

        event.target.value = ''
      }}
    />
  </header>
)
}