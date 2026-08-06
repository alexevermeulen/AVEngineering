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
}: ToolbarProps) {
  return (
    <header className="toolbar">
      <strong>AV Engineering Platform</strong>
      <span>{projectName}</span>

      <button type="button" onClick={onNewProject}>
        Nieuw project
      </button>

      <button type="button" onClick={onEditProject}>
        Projectgegevens
      </button>

      <button
        type="button"
        onClick={onToggleRecentProjects}
      >
        Recente projecten
      </button>

      <button type="button" onClick={onOpenReports}>
        Rapporten / PDF
      </button>

      <button type="button" onClick={onOpenSettings}>
        Settings
      </button>

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

      <button type="button" onClick={onSaveProject}>
        Project opslaan
      </button>

      <button
        type="button"
        onClick={() => openProjectInputRef.current?.click()}
      >
        Project openen
      </button>

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

      <button
        type="button"
        className={
          toolMode === 'select' ? 'active-tool' : ''
        }
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
        U-lijn tekenen
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

      <button
        type="button"
        disabled={!canEditDevice}
        onClick={onEditDevice}
        title="Geselecteerd apparaat bewerken"
      >
        Apparaat bewerken
      </button>

      <button
        type="button"
        className="delete-button"
        disabled={!canDelete}
        onClick={onDelete}
        title="Geselecteerd object verwijderen (Delete)"
      >
        Verwijderen
      </button>

      <div className="toolbar-spacer" />

      <button
        type="button"
        disabled={!hasSelectedEdge}
        onClick={onEditCableNumber}
        title="Nummer van de geselecteerde kabel wijzigen"
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
    </header>
  )
}