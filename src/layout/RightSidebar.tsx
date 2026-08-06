import type { CableDisplayMode } from '../types'

export type PropertiesSelection =
  | {
      type: 'project'
      projectName: string
      location: string
      createdBy: string
      facilityId: number
    }
  | {
      type: 'device'
      systemName: string
      deviceType: string
      location: string
      rack: string
      rackLevel?: string
    }
  | {
      type: 'cable'
      cableNumber: string
      signal: string
      source: string
      destination: string
      displayMode: CableDisplayMode
    }
  | {
      type: 'bus'
      signal: string
      width: number
      leftHeight: number
      rightHeight: number
    }

type RightSidebarProps = {
  selection: PropertiesSelection
  onProjectChange?: (
    field:
      | 'projectName'
      | 'location'
      | 'createdBy'
      | 'facilityId',
    value: string | number,
  ) => void
  onDeviceChange?: (
    field:
      | 'systemName'
      | 'location'
      | 'rack'
      | 'rackLevel',
    value: string,
  ) => void
  onCableNumberChange?: (value: string) => void
  onCableDisplayModeChange?: (
    mode: CableDisplayMode,
  ) => void
  onBusGeometryChange?: (
    field: 'width' | 'leftHeight' | 'rightHeight',
    value: number,
  ) => void
}

export function RightSidebar({
  selection,
  onProjectChange,
  onDeviceChange,
  onCableNumberChange,
  onCableDisplayModeChange,
  onBusGeometryChange,
}: RightSidebarProps) {
  return (
    <aside className="properties-panel">
      <header className="panel-header">
        <strong>Properties</strong>

        <button
          type="button"
          className="panel-header-action"
          title="Properties-opties"
          aria-label="Properties-opties"
        >
          ⋯
        </button>
      </header>

      <div className="properties-content">
        {selection.type === 'project' && (
          <section className="property-section">
            <h3>Project</h3>

            <label>
              Projectnaam
              <input
                value={selection.projectName}
                onChange={(event) =>
                  onProjectChange?.(
                    'projectName',
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              Locatie
              <input
                value={selection.location}
                onChange={(event) =>
                  onProjectChange?.(
                    'location',
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              Aangemaakt door
              <input
                value={selection.createdBy}
                onChange={(event) =>
                  onProjectChange?.(
                    'createdBy',
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              Facility-ID
              <input
                type="number"
                value={selection.facilityId}
                onChange={(event) =>
                  onProjectChange?.(
                    'facilityId',
                    Number(event.target.value),
                  )
                }
              />
            </label>
          </section>
        )}

        {selection.type === 'device' && (
          <section className="property-section">
            <h3>Device</h3>

            <label>
              Systeemnaam
              <input
                value={selection.systemName}
                onChange={(event) =>
                  onDeviceChange?.(
                    'systemName',
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              Type
              <input
                value={selection.deviceType}
                readOnly
              />
            </label>

            <label>
              Locatie
              <input
                value={selection.location}
                onChange={(event) =>
                  onDeviceChange?.(
                    'location',
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              Rack
              <input
                value={selection.rack}
                onChange={(event) =>
                  onDeviceChange?.(
                    'rack',
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              Rack level
              <input
                value={selection.rackLevel ?? ''}
                onChange={(event) =>
                  onDeviceChange?.(
                    'rackLevel',
                    event.target.value,
                  )
                }
              />
            </label>
          </section>
        )}

        {selection.type === 'cable' && (
          <section className="property-section">
            <h3>Cable</h3>

            <label>
              Kabelnummer
              <input
                value={selection.cableNumber}
                onChange={(event) =>
                  onCableNumberChange?.(
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              Signaaltype
              <input value={selection.signal} readOnly />
            </label>

            <label>
              Bron
              <textarea
                value={selection.source}
                readOnly
                rows={2}
              />
            </label>

            <label>
              Bestemming
              <textarea
                value={selection.destination}
                readOnly
                rows={2}
              />
            </label>

            <label>
              Weergave
              <select
                value={selection.displayMode}
                onChange={(event) =>
                  onCableDisplayModeChange?.(
                    event.target
                      .value as CableDisplayMode,
                  )
                }
              >
                <option value="feather">
                  Feather
                </option>
                <option value="full">
                  Volledige kabel
                </option>
              </select>
            </label>
          </section>
        )}

        {selection.type === 'bus' && (
          <section className="property-section">
            <h3>Graphic Bus</h3>

            <label>
              Signaaltype
              <input value={selection.signal} readOnly />
            </label>

            <label>
              Breedte
              <input
                type="number"
                min={40}
                value={selection.width}
                onChange={(event) =>
                  onBusGeometryChange?.(
                    'width',
                    Number(event.target.value),
                  )
                }
              />
            </label>

            <label>
              Linker arm
              <input
                type="number"
                min={20}
                value={selection.leftHeight}
                onChange={(event) =>
                  onBusGeometryChange?.(
                    'leftHeight',
                    Number(event.target.value),
                  )
                }
              />
            </label>

            <label>
              Rechter arm
              <input
                type="number"
                min={20}
                value={selection.rightHeight}
                onChange={(event) =>
                  onBusGeometryChange?.(
                    'rightHeight',
                    Number(event.target.value),
                  )
                }
              />
            </label>
          </section>
        )}
      </div>
    </aside>
  )
}