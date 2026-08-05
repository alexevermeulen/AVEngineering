import { useEffect, useMemo, useState } from 'react'
import type { Device, DeviceType } from './types'

type DeviceInstanceEditorProps = {
  device: Device | null
  types: DeviceType[]
  devices: Device[]
  onCancel: () => void
  onSave: (
    originalSysname: string,
    updatedDevice: Device,
  ) => void
}

function typeRef(deviceType: DeviceType) {
  return `${deviceType.mfg}/${deviceType.model}`
}

export function DeviceInstanceEditor({
  device,
  types,
  devices,
  onCancel,
  onSave,
}: DeviceInstanceEditorProps) {
  const [sysname, setSysname] = useState('')
  const [selectedTypeRef, setSelectedTypeRef] = useState('')
  const [location, setLocation] = useState('')
  const [rack, setRack] = useState('')
  const [rackLevel, setRackLevel] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!device) return

    setSysname(currentDevice.sysname)
    setSelectedTypeRef(device.type_ref)
    setLocation(device.location)
    setRack(device.rack)
    setRackLevel(
      device.rack_level === undefined
        ? ''
        : String(device.rack_level),
    )
    setMessage('')
  }, [device])

  const sortedTypes = useMemo(
    () =>
      [...types].sort((a, b) =>
        typeRef(a).localeCompare(typeRef(b)),
      ),
    [types],
  )

  if (!device) return null

  const currentDevice = device

  function save() {
    const cleanSysname = sysname.trim()

    if (!cleanSysname) {
      setMessage('Systeemnaam is verplicht.')
      return
    }

    if (!selectedTypeRef) {
      setMessage('Selecteer een apparaattype.')
      return
    }

    const duplicate = devices.some(
      (item) =>
        item.sysname === cleanSysname &&
        item.sysname !== currentDevice.sysname,
    )

    if (duplicate) {
      setMessage(`Systeemnaam ${cleanSysname} bestaat al.`)
      return
    }

    const parsedRackLevel =
      rackLevel.trim() === ''
        ? undefined
        : Number(rackLevel)

    if (
      parsedRackLevel !== undefined &&
      !Number.isFinite(parsedRackLevel)
    ) {
      setMessage('Rackniveau moet een getal zijn.')
      return
    }

    onSave(currentDevice.sysname, {
      sysname: cleanSysname,
      type_ref: selectedTypeRef,
      location: location.trim() || 'Onbekend',
      rack: rack.trim() || 'FLOOR',
      rack_level: parsedRackLevel,
    })
  }

  return (
    <div
      className="instance-editor-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel()
        }
      }}
    >
      <section
        className="instance-editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="instance-editor-title"
      >
        <header>
          <h2 id="instance-editor-title">Apparaat bewerken</h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Sluiten"
          >
            ×
          </button>
        </header>

        <label>
          Systeemnaam
          <input
            value={sysname}
            onChange={(event) => setSysname(event.target.value)}
          />
        </label>

        <label>
          Apparaattype
          <select
            value={selectedTypeRef}
            onChange={(event) =>
              setSelectedTypeRef(event.target.value)
            }
          >
            {sortedTypes.map((deviceType) => {
              const reference = typeRef(deviceType)

              return (
                <option key={reference} value={reference}>
                  {reference}
                </option>
              )
            })}
          </select>
        </label>

        <label>
          Locatie
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
        </label>

        <div className="instance-editor-row">
          <label>
            Rack
            <input
              value={rack}
              onChange={(event) => setRack(event.target.value)}
            />
          </label>

          <label>
            Rackniveau
            <input
              type="number"
              value={rackLevel}
              onChange={(event) => setRackLevel(event.target.value)}
            />
          </label>
        </div>

        {message && (
          <div className="instance-editor-message">{message}</div>
        )}

        <footer>
          <button type="button" onClick={onCancel}>
            Annuleren
          </button>

          <button
            type="button"
            className="primary-instance-button"
            onClick={save}
          >
            Wijzigingen bewaren
          </button>
        </footer>
      </section>
    </div>
  )
}
