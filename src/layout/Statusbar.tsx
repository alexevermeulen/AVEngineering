type StatusBarProps = {
  status?: string
  zoom?: number
  deviceCount?: number
  cableCount?: number
  selectedLabel?: string | null
  nextCableNumber?: string | null
}

export function StatusBar({
  status = 'Ready',
  zoom = 100,
  deviceCount = 0,
  cableCount = 0,
  selectedLabel = null,
  nextCableNumber = null,
}: StatusBarProps) {
  return (
    <footer className="app-status-bar">
      <div className="status-primary">
        <span>{status}</span>

        {selectedLabel && (
          <span className="status-selected">
            Geselecteerd: {selectedLabel}
          </span>
        )}
      </div>

      <div className="status-details">
        <span>Zoom {Math.round(zoom)}%</span>
        <span>Devices {deviceCount}</span>
        <span>Kabels {cableCount}</span>

        {nextCableNumber && (
          <span>Volgende kabel {nextCableNumber}</span>
        )}
      </div>
    </footer>
  )
}