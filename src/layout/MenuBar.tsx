type MenuItem = {
  id: string
  label: string
}

const menuItems: MenuItem[] = [
  { id: 'file', label: 'File' },
  { id: 'edit', label: 'Edit' },
  { id: 'view', label: 'View' },
  { id: 'insert', label: 'Insert' },
  { id: 'project', label: 'Project' },
  { id: 'reports', label: 'Reports' },
  { id: 'settings', label: 'Settings' },
  { id: 'help', label: 'Help' },
]

type MenuBarProps = {
  onMenuClick?: (menuId: string) => void
}

export function MenuBar({ onMenuClick }: MenuBarProps) {
  return (
    <nav className="app-menu-bar" aria-label="Application menu">
      {menuItems.map((item) => (
        <button
          key={item.id}
          type="button"
          className="app-menu-item"
          onClick={() => onMenuClick?.(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  )
}