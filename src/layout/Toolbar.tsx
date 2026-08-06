type ToolbarAction =
  | 'new'
  | 'open'
  | 'save'
  | 'undo'
  | 'redo'
  | 'select'
  | 'cable'
  | 'bus'
  | 'delete'
  | 'zoom-in'
  | 'zoom-out'
  | 'fit'
  | 'pdf'

type ToolbarProps = {
  onAction?: (action: ToolbarAction) => void
}

const actions: Array<{
  id: ToolbarAction
  label: string
  shortcut?: string
}> = [
  { id: 'new', label: 'Nieuw', shortcut: 'Ctrl+N' },
  { id: 'open', label: 'Open', shortcut: 'Ctrl+O' },
  { id: 'save', label: 'Opslaan', shortcut: 'Ctrl+S' },
  { id: 'undo', label: 'Undo', shortcut: 'Ctrl+Z' },
  { id: 'redo', label: 'Redo', shortcut: 'Ctrl+Y' },
  { id: 'select', label: 'Selecteren' },
  { id: 'cable', label: 'Kabel' },
  { id: 'bus', label: 'U-bus' },
  { id: 'delete', label: 'Verwijderen', shortcut: 'Delete' },
  { id: 'zoom-in', label: 'Inzoomen' },
  { id: 'zoom-out', label: 'Uitzoomen' },
  { id: 'fit', label: 'Passend maken' },
  { id: 'pdf', label: 'PDF' },
]

export function Toolbar({ onAction }: ToolbarProps) {
  return (
    <div className="app-toolbar" role="toolbar" aria-label="Main toolbar">
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          className="app-toolbar-button"
          title={
            action.shortcut
              ? `${action.label} (${action.shortcut})`
              : action.label
          }
          onClick={() => onAction?.(action.id)}
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}