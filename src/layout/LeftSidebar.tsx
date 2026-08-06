import { useState, type ReactNode } from 'react'

type ExplorerSectionId =
  | 'project'
  | 'device-library'
  | 'project-devices'
  | 'sheets'
  | 'reports'

type ExplorerSectionProps = {
  id: ExplorerSectionId
  title: string
  children: ReactNode
  defaultOpen?: boolean
}

function ExplorerSection({
  id,
  title,
  children,
  defaultOpen = true,
}: ExplorerSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <section className="explorer-section" data-section-id={id}>
      <button
        type="button"
        className="explorer-section-header"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="explorer-chevron">
          {isOpen ? '▾' : '▸'}
        </span>

        <span>{title}</span>
      </button>

      {isOpen && (
        <div className="explorer-section-content">
          {children}
        </div>
      )}
    </section>
  )
}

type LeftSidebarProps = {
  deviceLibrary?: ReactNode
  projectDevices?: ReactNode
  sheets?: ReactNode
  reports?: ReactNode
  onProjectItemClick?: (
    item: 'project-properties' | 'settings',
  ) => void
}

export function LeftSidebar({
  deviceLibrary,
  projectDevices,
  sheets,
  reports,
  onProjectItemClick,
}: LeftSidebarProps) {
  return (
    <aside className="explorer-panel">
      <header className="panel-header">
        <strong>Explorer</strong>

        <button
          type="button"
          className="panel-header-action"
          title="Explorer-opties"
          aria-label="Explorer-opties"
        >
          ⋯
        </button>
      </header>

      <div className="explorer-search">
        <input
          type="search"
          placeholder="Zoeken..."
          aria-label="Explorer doorzoeken"
        />
      </div>

      <div className="explorer-sections">
        <ExplorerSection id="project" title="Project">
          <button
            type="button"
            className="explorer-item"
            onClick={() =>
              onProjectItemClick?.('project-properties')
            }
          >
            Projectgegevens
          </button>

          <button
            type="button"
            className="explorer-item"
            onClick={() => onProjectItemClick?.('settings')}
          >
            Settings
          </button>
        </ExplorerSection>

        <ExplorerSection
          id="device-library"
          title="Device Library"
        >
          {deviceLibrary ?? (
            <span className="explorer-empty">
              Device Library wordt hier gekoppeld
            </span>
          )}
        </ExplorerSection>

        <ExplorerSection
          id="project-devices"
          title="Project Devices"
        >
          {projectDevices ?? (
            <span className="explorer-empty">
              Nog geen projectapparaten gekoppeld
            </span>
          )}
        </ExplorerSection>

        <ExplorerSection id="sheets" title="Sheets">
          {sheets ?? (
            <button
              type="button"
              className="explorer-item explorer-item-selected"
            >
              Main
            </button>
          )}
        </ExplorerSection>

        <ExplorerSection id="reports" title="Reports">
          {reports ?? (
            <>
              <button type="button" className="explorer-item">
                Cable List
              </button>

              <button type="button" className="explorer-item">
                Device List
              </button>

              <button type="button" className="explorer-item">
                I/O List
              </button>
            </>
          )}
        </ExplorerSection>
      </div>
    </aside>
  )
}