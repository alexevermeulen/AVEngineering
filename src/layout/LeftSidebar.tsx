type ExplorerSection = {
  id: string
  label: string
  items: string[]
}

const sections: ExplorerSection[] = [
  {
    id: 'project',
    label: 'Project',
    items: ['Projectgegevens', 'Settings'],
  },
  {
    id: 'library',
    label: 'Device Library',
    items: ['Video', 'Audio', 'Network', 'Custom'],
  },
  {
    id: 'devices',
    label: 'Project Devices',
    items: [],
  },
  {
    id: 'sheets',
    label: 'Sheets',
    items: ['Main'],
  },
  {
    id: 'reports',
    label: 'Reports',
    items: ['Cable List', 'Device List', 'I/O List'],
  },
]

type LeftSidebarProps = {
  onItemClick?: (
    sectionId: string,
    item: string,
  ) => void
}

export function LeftSidebar({
  onItemClick,
}: LeftSidebarProps) {
  return (
    <div className="explorer-panel">
      <header className="panel-header">
        <strong>Explorer</strong>
      </header>

      <div className="explorer-search">
        <input
          type="search"
          placeholder="Zoeken..."
          aria-label="Explorer doorzoeken"
        />
      </div>

      <div className="explorer-sections">
        {sections.map((section) => (
          <details
            key={section.id}
            className="explorer-section"
            open
          >
            <summary>{section.label}</summary>

            <div className="explorer-items">
              {section.items.length === 0 ? (
                <span className="explorer-empty">
                  Nog geen items
                </span>
              ) : (
                section.items.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="explorer-item"
                    onClick={() =>
                      onItemClick?.(section.id, item)
                    }
                  >
                    {item}
                  </button>
                ))
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}