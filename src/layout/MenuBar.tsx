import { useEffect, useRef, useState } from 'react'

type MenuId =
  | 'file'
  | 'edit'
  | 'view'
  | 'project'
  | 'reports'
  | 'settings'
  | 'help'

export type MenuAction =
  | 'new-project'
  | 'open-project'
  | 'save-project'
  | 'recent-projects'
  | 'undo'
  | 'redo'
  | 'delete'
  | 'fit-view'
  | 'project-properties'
  | 'device-list'
  | 'cable-list'
  | 'io-list'
  | 'export-pdf'
  | 'open-settings'
  | 'about'

type MenuBarProps = {
  onAction?: (action: MenuAction) => void
  canUndo?: boolean
  canRedo?: boolean
  canDelete?: boolean
}

type MenuEntry =
  | {
      type: 'action'
      id: MenuAction
      label: string
      shortcut?: string
      disabled?: boolean
    }
  | {
      type: 'separator'
    }

const menuLabels: Array<{
  id: MenuId
  label: string
}> = [
  { id: 'file', label: 'File' },
  { id: 'edit', label: 'Edit' },
  { id: 'view', label: 'View' },
  { id: 'project', label: 'Project' },
  { id: 'reports', label: 'Reports' },
  { id: 'settings', label: 'Settings' },
  { id: 'help', label: 'Help' },
]

export function MenuBar({
  onAction,
  canUndo = false,
  canRedo = false,
  canDelete = false,
}: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null)
  const menuBarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (
        menuBarRef.current &&
        !menuBarRef.current.contains(event.target as Node)
      ) {
        setOpenMenu(null)
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenMenu(null)
      }
    }

    window.addEventListener('mousedown', closeOnOutsideClick)
    window.addEventListener('keydown', closeOnEscape)

    return () => {
      window.removeEventListener('mousedown', closeOnOutsideClick)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  function getEntries(menuId: MenuId): MenuEntry[] {
    switch (menuId) {
      case 'file':
        return [
          {
            type: 'action',
            id: 'new-project',
            label: 'New Project',
            shortcut: 'Ctrl+N',
          },
          {
            type: 'action',
            id: 'open-project',
            label: 'Open Project…',
            shortcut: 'Ctrl+O',
          },
          {
            type: 'action',
            id: 'save-project',
            label: 'Save Project',
            shortcut: 'Ctrl+S',
          },
          { type: 'separator' },
          {
            type: 'action',
            id: 'recent-projects',
            label: 'Recent Projects',
          },
        ]

      case 'edit':
        return [
          {
            type: 'action',
            id: 'undo',
            label: 'Undo',
            shortcut: 'Ctrl+Z',
            disabled: !canUndo,
          },
          {
            type: 'action',
            id: 'redo',
            label: 'Redo',
            shortcut: 'Ctrl+Y',
            disabled: !canRedo,
          },
          { type: 'separator' },
          {
            type: 'action',
            id: 'delete',
            label: 'Delete',
            shortcut: 'Delete',
            disabled: !canDelete,
          },
        ]

      case 'view':
        return [
          {
            type: 'action',
            id: 'fit-view',
            label: 'Fit Diagram to Window',
            shortcut: 'F',
          },
        ]

      case 'project':
        return [
          {
            type: 'action',
            id: 'project-properties',
            label: 'Project Properties…',
          },
        ]

      case 'reports':
        return [
          {
            type: 'action',
            id: 'device-list',
            label: 'Device List',
          },
          {
            type: 'action',
            id: 'cable-list',
            label: 'Cable List',
          },
          {
            type: 'action',
            id: 'io-list',
            label: 'I/O List',
          },
          { type: 'separator' },
          {
            type: 'action',
            id: 'export-pdf',
            label: 'Export Diagram to PDF…',
          },
        ]

      case 'settings':
        return [
          {
            type: 'action',
            id: 'open-settings',
            label: 'Engineering Settings…',
          },
        ]

      case 'help':
        return [
          {
            type: 'action',
            id: 'about',
            label: 'About AV Engineering Platform',
          },
        ]
    }
  }

  function runAction(action: MenuAction) {
    setOpenMenu(null)
    onAction?.(action)
  }

  return (
    <div
      ref={menuBarRef}
      className="desktop-menu"
      role="menubar"
      aria-label="Application menu"
    >
      {menuLabels.map((menu) => {
        const isOpen = openMenu === menu.id
        const entries = getEntries(menu.id)

        return (
          <div key={menu.id} className="desktop-menu-group">
            <button
              type="button"
              className={`desktop-menu-trigger ${
                isOpen ? 'desktop-menu-trigger-open' : ''
              }`}
              aria-haspopup="menu"
              aria-expanded={isOpen}
              onClick={() =>
                setOpenMenu((current) =>
                  current === menu.id ? null : menu.id,
                )
              }
              onMouseEnter={() => {
                if (openMenu) {
                  setOpenMenu(menu.id)
                }
              }}
            >
              {menu.label}
            </button>

            {isOpen && (
              <div className="desktop-menu-dropdown" role="menu">
                {entries.map((entry, index) => {
                  if (entry.type === 'separator') {
                    return (
                      <div
                        key={`separator-${index}`}
                        className="desktop-menu-separator"
                        role="separator"
                      />
                    )
                  }

                  return (
                    <button
                      key={entry.id}
                      type="button"
                      className="desktop-menu-command"
                      role="menuitem"
                      disabled={entry.disabled}
                      onClick={() => runAction(entry.id)}
                    >
                      <span>{entry.label}</span>

                      {entry.shortcut && (
                        <span className="desktop-menu-shortcut">
                          {entry.shortcut}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}