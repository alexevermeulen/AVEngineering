import { useEffect, useMemo, useState } from 'react'
import type {
  Device,
  DeviceType,
  SignalTypeDefinition,
  Port,
  PortDirection,
  Signal,
} from './types'

type NewPort = {
  label: string
  direction: PortDirection
  signal: Signal
  connector: string
}



type DeviceLibraryProps = {
  types: DeviceType[]
  devices: Device[]

  activeSheetName: string
  activeSheetSignals: Signal[] | null
  placedDeviceIds: string[]

  onCreateType: (deviceType: DeviceType) => void
  onUpdateType: (
    originalTypeRef: string,
    deviceType: DeviceType,
  ) => void
  onDeleteType: (typeRef: string) => void
  onPlaceDevice: (device: Device) => void

  onImportJson: (
    importedTypes: DeviceType[],
    importedDevices: Device[],
  ) => void

  signalTypes: SignalTypeDefinition[]
  connectors: string[]
}

const EMPTY_PORT: NewPort = {
  label: '',
  direction: 'I',
  signal: 'DGV',
  connector: 'BNC',
}

function typeRef(deviceType: DeviceType) {
  return `${deviceType.mfg}/${deviceType.model}`
}

export function DeviceLibrary({
  types,
  devices,
  activeSheetName,
  activeSheetSignals,
  placedDeviceIds,
  onCreateType,
  onUpdateType,
  onDeleteType,
  onPlaceDevice,
  onImportJson,
  signalTypes,
  connectors,
}: DeviceLibraryProps) {
  const [showTypeForm, setShowTypeForm] = useState(false)
  const [editingTypeRef, setEditingTypeRef] = useState<string | null>(null)
  const [manufacturer, setManufacturer] = useState('')
  const [model, setModel] = useState('')
  const [description, setDescription] = useState('')
  const [productType, setProductType] = useState('GEN')
  const [rackUnits, setRackUnits] = useState(1)
  const [ports, setPorts] = useState<Port[]>([])
  const [newPort, setNewPort] = useState<NewPort>(EMPTY_PORT)
  const [bulkExpression, setBulkExpression] = useState('')
  const [selectedTypeRef, setSelectedTypeRef] = useState('')
  const [sysname, setSysname] = useState('')
  const [location, setLocation] = useState('')
  const [rack, setRack] = useState('FLOOR')
  const [message, setMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [manufacturerFilter, setManufacturerFilter] = useState('')
  const [importInput, setImportInput] = useState<HTMLInputElement | null>(null)

  const sortedTypes = useMemo(
    () =>
      [...types].sort((a, b) =>
        typeRef(a).localeCompare(typeRef(b)),
      ),
    [types],
  )

  const manufacturers = useMemo(
    () =>
      [...new Set(types.map((deviceType) => deviceType.mfg))]
        .sort((a, b) => a.localeCompare(b)),
    [types],
  )

  const filteredTypes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return sortedTypes.filter((deviceType) => {
      const matchesManufacturer =
        !manufacturerFilter ||
        deviceType.mfg === manufacturerFilter

      const haystack = [
        deviceType.mfg,
        deviceType.model,
        deviceType.prodtype,
        deviceType.short_desc,
        typeRef(deviceType),
        ...deviceType.ports.map((port) => port.label),
      ]
        .join(' ')
        .toLowerCase()

      return matchesManufacturer && (!query || haystack.includes(query))
    })
  }, [manufacturerFilter, searchQuery, sortedTypes])

  useEffect(() => {
    setNewPort((current) => ({
      ...current,
      signal:
        signalTypes.some((signal) => signal.id === current.signal)
          ? current.signal
          : signalTypes[0]?.id ?? '',
      connector:
        connectors.includes(current.connector)
          ? current.connector
          : connectors[0] ?? '',
    }))
  }, [connectors, signalTypes])

  function expandBulkPortExpression(expression: string): string[] {
    const input = expression.trim()

    if (!input) {
      throw new Error('Vul eerst een poortexpressie in.')
    }

    /*
     * Ondersteunt ieder aantal bereiken en accepteert zowel [] als {}.
     * De sluiting mag ] of } zijn, zodat ook invoer als {1..2] werkt.
     *
     * Voorbeelden:
     *   REFip{1..2]                  -> REFip1, REFip2
     *   AUDip[1..4]-[1..4][L..R}    -> cartesisch product
     */
    const rangePattern = /[\[{]([^{}\[\]]+?)[\]}]/g
    const parts: Array<
      | { kind: 'literal'; value: string }
      | { kind: 'range'; values: string[] }
    > = []

    let cursor = 0
    let match: RegExpExecArray | null

    while ((match = rangePattern.exec(input)) !== null) {
      if (match.index > cursor) {
        parts.push({
          kind: 'literal',
          value: input.slice(cursor, match.index),
        })
      }

      const rangeBody = match[1].trim()

      let values: string[]

      if (rangeBody.includes('..')) {
        // Twee punten = doorlopende reeks.
        // [1..4] -> 01,02,03,04
        // [L..R] -> L,M,N,O,P,Q,R
        const separatorIndex = rangeBody.indexOf('..')
        const startText = rangeBody.slice(0, separatorIndex).trim()
        const endText = rangeBody.slice(separatorIndex + 2).trim()

        if (!startText || !endText) {
          throw new Error(`Onvolledig bereik "${rangeBody}".`)
        }

        const numericStart = Number(startText)
        const numericEnd = Number(endText)
        const bothNumeric =
          Number.isInteger(numericStart) &&
          Number.isInteger(numericEnd)

        if (bothNumeric) {
          if (numericEnd < numericStart) {
            throw new Error(
              `Aflopend nummerbereik ${startText}..${endText} wordt nog niet ondersteund.`,
            )
          }

          const count = numericEnd - numericStart + 1
          const width = Math.max(
            2,
            startText.length,
            endText.length,
          )

          values = Array.from({ length: count }, (_, offset) =>
            String(numericStart + offset).padStart(width, '0'),
          )
        } else if (
          startText.length === 1 &&
          endText.length === 1
        ) {
          const startCode = startText.charCodeAt(0)
          const endCode = endText.charCodeAt(0)

          if (endCode < startCode) {
            throw new Error(
              `Aflopend tekstbereik ${startText}..${endText} wordt niet ondersteund.`,
            )
          }

          values = Array.from(
            { length: endCode - startCode + 1 },
            (_, offset) => String.fromCharCode(startCode + offset),
          )
        } else {
          throw new Error(
            `Doorlopende tekstreeks "${rangeBody}" moet uit één teken per grens bestaan, bijvoorbeeld L..R.`,
          )
        }
      } else if (rangeBody.includes('.')) {
        // Eén punt = expliciete keuzelijst.
        // [L.R] -> L,R
        // [A.C.F] -> A,C,F
        // [ip.op] -> ip,op
        values = rangeBody
          .split('.')
          .map((item) => item.trim())
          .filter(Boolean)

        if (values.length < 2) {
          throw new Error(
            `Keuzelijst "${rangeBody}" moet minimaal twee waarden bevatten.`,
          )
        }
      } else {
        throw new Error(
          `Ongeldige expressie "${rangeBody}". Gebruik bijvoorbeeld 1..32 voor een reeks of L.R voor losse waarden.`,
        )
      }

      parts.push({ kind: 'range', values })
      cursor = rangePattern.lastIndex
    }

    if (cursor < input.length) {
      parts.push({
        kind: 'literal',
        value: input.slice(cursor),
      })
    }

    if (!parts.some((part) => part.kind === 'range')) {
      throw new Error(
        'Geen bereik gevonden. Gebruik bijvoorbeeld REFip[1..2].',
      )
    }

    let results = ['']

    for (const part of parts) {
      if (part.kind === 'literal') {
        results = results.map((current) => current + part.value)
        continue
      }

      results = results.flatMap((current) =>
        part.values.map((value) => current + value),
      )

      if (results.length > 2048) {
        throw new Error(
          'Deze expressie maakt meer dan 2048 poorten. Verklein één of meer bereiken.',
        )
      }
    }

    return results
  }

  function directionForBulkVariant(
    label: string,
    fallback: PortDirection,
  ): PortDirection {
    const lower = label.toLowerCase()

    if (/(^|[-_])(?:ip|in)(?:\d|[-_]|$)/.test(lower) || lower.includes('ip')) {
      return 'I'
    }

    if (/(^|[-_])(?:op|out)(?:\d|[-_]|$)/.test(lower) || lower.includes('op')) {
      return 'O'
    }

    return fallback
  }

  function addBulkPorts() {
    try {
      const labels = expandBulkPortExpression(bulkExpression)

      const duplicates = labels.filter(
        (label) => ports.some((port) => port.label === label),
      )

      if (duplicates.length > 0) {
        setMessage(
          `Niet aangemaakt: ${duplicates[0]} bestaat al.`,
        )
        return
      }

      const firstPosition = ports.length

      const generated: Port[] = labels.map((label, index) => ({
        label,
        direction: directionForBulkVariant(
          label,
          newPort.direction,
        ),
        signal: newPort.signal,
        connector: newPort.connector.trim() || 'GEN',
        pos: firstPosition + index,
      }))

      setPorts((current) => [...current, ...generated])
      setBulkExpression('')
      setMessage(`${generated.length} poorten aangemaakt.`)
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Bulk-poorten konden niet worden aangemaakt.',
      )
    }
  }

  function downloadJson(
    filename: string,
    value: unknown,
  ) {
    const blob = new Blob(
      [JSON.stringify(value, null, 2)],
      { type: 'application/json' },
    )
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')

    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  function exportLibrary() {
    downloadJson(
      'av-device-library.json',
      { types },
    )
    setMessage(`${types.length} apparaattype(s) geëxporteerd.`)
  }

  function exportSingleType(deviceType: DeviceType) {
    const filename = `${deviceType.mfg}-${deviceType.model}`
      .replace(/[^a-zA-Z0-9-_]+/g, '-')

    downloadJson(
      `${filename}.json`,
      deviceType,
    )
    setMessage(`${typeRef(deviceType)} geëxporteerd.`)
  }

  function resetTypeForm() {
    setEditingTypeRef(null)
    setManufacturer('')
    setModel('')
    setDescription('')
    setProductType('GEN')
    setRackUnits(1)
    setPorts([])
    setBulkExpression('')
    setNewPort(EMPTY_PORT)
  }

  function startEditType(deviceType: DeviceType) {
    setEditingTypeRef(typeRef(deviceType))
    setManufacturer(deviceType.mfg)
    setModel(deviceType.model)
    setDescription(deviceType.short_desc)
    setProductType(deviceType.prodtype)
    setRackUnits(deviceType.rack_u)
    setPorts(
      [...deviceType.ports]
        .sort((a, b) => a.pos - b.pos)
        .map((port, index) => ({
          ...port,
          pos: index,
        })),
    )
    setShowTypeForm(true)
    setMessage(`Type ${typeRef(deviceType)} wordt bewerkt.`)
  }

  function isDeviceType(value: unknown): value is DeviceType {
    if (typeof value !== 'object' || value === null) return false

    const candidate = value as Partial<DeviceType>

    return (
      typeof candidate.mfg === 'string' &&
      typeof candidate.model === 'string' &&
      typeof candidate.prodtype === 'string' &&
      typeof candidate.revno === 'string' &&
      typeof candidate.rack_u === 'number' &&
      typeof candidate.short_desc === 'string' &&
      Array.isArray(candidate.ports) &&
      candidate.ports.every((port) => {
        if (typeof port !== 'object' || port === null) return false
        const item = port as Partial<Port>

        return (
          typeof item.label === 'string' &&
          (item.direction === 'I' ||
            item.direction === 'O' ||
            item.direction === 'L') &&
          typeof item.signal === 'string' &&
          typeof item.connector === 'string' &&
          typeof item.pos === 'number'
        )
      })
    )
  }

  function isDevice(value: unknown): value is Device {
    if (typeof value !== 'object' || value === null) return false

    const candidate = value as Partial<Device>

    return (
      typeof candidate.sysname === 'string' &&
      typeof candidate.type_ref === 'string' &&
      typeof candidate.rack === 'string' &&
      typeof candidate.location === 'string'
    )
  }

  async function importJsonFile(file: File) {
    try {
      const parsed: unknown = JSON.parse(await file.text())

      let importedTypes: DeviceType[] = []
      let importedDevices: Device[] = []

      if (Array.isArray(parsed)) {
        importedTypes = parsed.filter(isDeviceType)
      } else if (isDeviceType(parsed)) {
        importedTypes = [parsed]
      } else if (typeof parsed === 'object' && parsed !== null) {
        const object = parsed as {
          types?: unknown
          devices?: unknown
        }

        if (Array.isArray(object.types)) {
          importedTypes = object.types.filter(isDeviceType)
        }

        if (Array.isArray(object.devices)) {
          importedDevices = object.devices.filter(isDevice)
        }
      }

      if (importedTypes.length === 0) {
        throw new Error(
          'Geen geldige apparaattype-definities gevonden.',
        )
      }

      onImportJson(importedTypes, importedDevices)
      setMessage(
        `${importedTypes.length} type(s) en ` +
          `${importedDevices.length} device(s) geïmporteerd.`,
      )
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? `Importeren mislukt: ${error.message}`
          : 'Importeren mislukt.',
      )
    } finally {
      if (importInput) {
        importInput.value = ''
      }
    }
  }

  function addPort() {
    const label = newPort.label.trim()

    if (!label) {
      setMessage('Vul eerst een poortnaam in.')
      return
    }

    if (ports.some((port) => port.label === label)) {
      setMessage(`Poort ${label} bestaat al.`)
      return
    }

    setPorts((current) => [
      ...current,
      {
        label,
        direction: newPort.direction,
        signal: newPort.signal,
        connector: newPort.connector.trim() || 'GEN',
        pos: current.length,
      },
    ])
    setNewPort(EMPTY_PORT)
    setMessage('')
  }

  function createType() {
    const mfg = manufacturer.trim().toUpperCase()
    const cleanModel = model.trim()

    if (!mfg || !cleanModel) {
      setMessage('Fabrikant en model zijn verplicht.')
      return
    }

    if (ports.length === 0) {
      setMessage('Voeg minimaal één poort toe.')
      return
    }

    const reference = `${mfg}/${cleanModel}`

    const duplicate = types.some(
      (item) =>
        typeRef(item) === reference &&
        typeRef(item) !== editingTypeRef,
    )

    if (duplicate) {
      setMessage(`Type ${reference} bestaat al.`)
      return
    }

    const deviceType: DeviceType = {
      mfg,
      model: cleanModel,
      prodtype: productType.trim() || 'GEN',
      revno: editingTypeRef
        ? types.find((item) => typeRef(item) === editingTypeRef)?.revno ?? '0'
        : '0',
      rack_u: rackUnits,
      short_desc: description.trim() || cleanModel,
      ports: ports.map((port, index) => ({
        ...port,
        pos: index,
      })),
    }

    if (editingTypeRef) {
      onUpdateType(editingTypeRef, deviceType)
      setMessage(`Type ${reference} bijgewerkt.`)
    } else {
      onCreateType(deviceType)
      setMessage(`Type ${reference} aangemaakt.`)
    }

    resetTypeForm()
    setShowTypeForm(false)
    setSelectedTypeRef(reference)
  }

  function deviceTypeFor(device: Device) {
  return types.find(
    (deviceType) =>
      typeRef(deviceType) === device.type_ref,
  )
}

function relevantPortCount(device: Device) {
  const deviceType = deviceTypeFor(device)

  if (!deviceType) return 0

  if (activeSheetSignals === null) {
    return deviceType.ports.length
  }

  return deviceType.ports.filter((port) =>
    activeSheetSignals.includes(port.signal),
  ).length
}



  function placeDevice() {
    const cleanSysname = sysname.trim()

    if (!selectedTypeRef) {
      setMessage('Selecteer eerst een apparaattype.')
      return
    }

    if (!cleanSysname) {
      setMessage('Vul een unieke systeemnaam in.')
      return
    }

    if (devices.some((device) => device.sysname === cleanSysname)) {
      setMessage(`Systeemnaam ${cleanSysname} bestaat al.`)
      return
    }

    onPlaceDevice({
      sysname: cleanSysname,
      type_ref: selectedTypeRef,
      rack: rack.trim() || 'FLOOR',
      location: location.trim() || 'Onbekend',
    })

    setSysname('')
    setMessage(`${cleanSysname} op het canvas geplaatst.`)
  }

  return (
    <aside className="device-library">
      <div className="library-header">
        <strong>Device library</strong>

        <div className="library-header-actions">
          <button
            type="button"
            onClick={exportLibrary}
          >
            JSON export
          </button>

          <button
            type="button"
            onClick={() => importInput?.click()}
          >
            JSON import
          </button>

          <input
            ref={(element) => setImportInput(element)}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                void importJsonFile(file)
              }
            }}
          />

          <button
            type="button"
            onClick={() => {
              if (showTypeForm) {
                resetTypeForm()
                setShowTypeForm(false)
              } else {
                resetTypeForm()
                setShowTypeForm(true)
              }
            }}
          >
            {showTypeForm ? 'Sluiten' : 'Nieuw type'}
          </button>
        </div>
      </div>

      {showTypeForm && (
        <section className="library-section type-editor">
          <h3>{editingTypeRef ? 'Apparaattype bewerken' : 'Nieuw apparaattype'}</h3>

          <label>
            Fabrikant
            <input
              value={manufacturer}
              onChange={(event) => setManufacturer(event.target.value)}
              placeholder="BMD"
            />
          </label>

          <label>
            Model
            <input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="ATEM-1ME-4K"
            />
          </label>

          <label>
            Omschrijving
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Productomschrijving"
            />
          </label>

          <div className="library-form-row">
            <label>
              Producttype
              <input
                value={productType}
                onChange={(event) => setProductType(event.target.value)}
              />
            </label>

            <label>
              Rack-U
              <input
                type="number"
                min={0}
                value={rackUnits}
                onChange={(event) =>
                  setRackUnits(Number(event.target.value))
                }
              />
            </label>
          </div>

          <h4>Poorten</h4>

          <div className="bulk-port-editor">
            <label>
              Meerdere poorten tegelijk
              <input
                value={bulkExpression}
                onChange={(event) =>
                  setBulkExpression(event.target.value)
                }
                placeholder="AUDip[1..4]-[1..4][L.R]"
              />
            </label>

            <div className="bulk-port-help">
              Ieder aantal bereiken is toegestaan.
              <code> [1..4]</code> is een doorlopende reeks;
              <code> [L..R]</code> geeft L t/m R.
              Eén punt is een keuzelijst:
              <code> [L.R]</code> geeft alleen L en R en
              <code> [A.C.F]</code> geeft A, C en F.
              Alle blokken worden gecombineerd.
            </div>

            <button
              type="button"
              onClick={addBulkPorts}
              disabled={!bulkExpression.trim()}
            >
              Reeks toevoegen
            </button>
          </div>

          <div className="port-editor">
            <input
              value={newPort.label}
              onChange={(event) =>
                setNewPort((current) => ({
                  ...current,
                  label: event.target.value,
                }))
              }
              placeholder="SDI-IN-1"
            />

            <select
              value={newPort.direction}
              onChange={(event) =>
                setNewPort((current) => ({
                  ...current,
                  direction: event.target.value as PortDirection,
                }))
              }
            >
              <option value="I">Input</option>
              <option value="O">Output</option>
              <option value="L">Bidirectioneel</option>
            </select>

            <select
              value={newPort.signal}
              onChange={(event) =>
                setNewPort((current) => ({
                  ...current,
                  signal: event.target.value,
                }))
              }
            >
              {signalTypes.map((signal) => (
                <option key={signal.id} value={signal.id}>
                  {signal.id} / {signal.label}
                </option>
              ))}
            </select>

            <select
              value={newPort.connector}
              onChange={(event) =>
                setNewPort((current) => ({
                  ...current,
                  connector: event.target.value,
                }))
              }
            >
              {connectors.map((connector) => (
                <option key={connector} value={connector}>
                  {connector}
                </option>
              ))}
            </select>

            <button type="button" onClick={addPort}>
              Poort toevoegen
            </button>
          </div>

          <div className="port-list">
            {ports.map((port) => (
              <div key={port.label} className="port-list-item">
                <span>
                  <strong>{port.label}</strong>
                  {' · '}
                  {port.direction}
                  {' · '}
                  {port.signal}
                  {' · '}
                  {port.connector}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setPorts((current) =>
                      current
                        .filter((item) => item.label !== port.label)
                        .map((item, index) => ({
                          ...item,
                          pos: index,
                        })),
                    )
                  }
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="primary-library-button"
            onClick={createType}
          >
            Type bewaren
          </button>
        </section>
      )}

      <section className="library-section library-search">
        <h3>Zoeken en filteren</h3>

        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Zoek fabrikant, model, type of poort…"
        />

        <select
          value={manufacturerFilter}
          onChange={(event) =>
            setManufacturerFilter(event.target.value)
          }
        >
          <option value="">Alle fabrikanten</option>
          {manufacturers.map((manufacturer) => (
            <option key={manufacturer} value={manufacturer}>
              {manufacturer}
            </option>
          ))}
        </select>

        <small>
          {filteredTypes.length} van {types.length} type(s) zichtbaar
        </small>
      </section>

      <section className="library-section">
        <h3>Nieuw projectapparaat</h3>

        <label>
          Type
          <select
            value={selectedTypeRef}
            onChange={(event) => setSelectedTypeRef(event.target.value)}
          >
            <option value="">Selecteer type…</option>
            {filteredTypes.map((deviceType) => (
              <option
                key={typeRef(deviceType)}
                value={typeRef(deviceType)}
              >
                {typeRef(deviceType)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Systeemnaam
          <input
            value={sysname}
            onChange={(event) => setSysname(event.target.value)}
            placeholder="R51-DEVICE-01"
          />
        </label>

        <label>
          Locatie
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Control Room"
          />
        </label>

        <label>
          Rack
          <input
            value={rack}
            onChange={(event) => setRack(event.target.value)}
            placeholder="RACK-01"
          />
        </label>

        <button
          type="button"
          className="primary-library-button"
          onClick={placeDevice}
        >
          Nieuw apparaat plaatsen
        </button>
      </section>

      <section className="library-section">
  <h3>
    Projectapparaten ({devices.length})
  </h3>

  <small>
    Bestaande apparaten plaatsen op sheet{' '}
    <strong>{activeSheetName}</strong>
  </small>

  <div className="type-list">
    {devices.length === 0 ? (
      <div className="type-list-item">
        <span>
          Nog geen apparaten in dit project.
        </span>
      </div>
    ) : (
      devices.map((device) => {
        const alreadyPlaced =
          placedDeviceIds.includes(device.sysname)

        const portCount =
          relevantPortCount(device)

        const hasRelevantPorts =
          activeSheetSignals === null ||
          portCount > 0

        return (
          <div
            key={device.sysname}
            className="type-list-item"
          >
            <div>
              <strong>{device.sysname}</strong>

              <small>
                {device.type_ref}
                {' · '}

                {activeSheetSignals === null
                  ? `${portCount} poorten`
                  : `${portCount} relevante poorten`}
              </small>

              <small>
                {device.location}
                {' · '}
                {device.rack}
              </small>
            </div>

            <div className="type-list-actions">
              <button
                type="button"
                disabled={
                  alreadyPlaced ||
                  !hasRelevantPorts
                }
                title={
                  alreadyPlaced
                    ? `Staat al op sheet ${activeSheetName}`
                    : !hasRelevantPorts
                      ? `Geen relevante poorten voor sheet ${activeSheetName}`
                      : `Plaats op sheet ${activeSheetName}`
                }
                onClick={() =>
                  onPlaceDevice(device)
                }
              >
                {alreadyPlaced
                  ? 'Geplaatst'
                  : !hasRelevantPorts
                    ? 'Niet relevant'
                    : 'Plaats'}
              </button>
            </div>
          </div>
        )
      })
    )}
  </div>
</section>

      <section className="library-section">
        <h3>Apparaattypes ({filteredTypes.length})</h3>

        <div className="type-list">
          {filteredTypes.map((deviceType) => {
            const reference = typeRef(deviceType)
            const instanceCount = devices.filter(
              (device) => device.type_ref === reference,
            ).length

            return (
              <div key={reference} className="type-list-item">
                <div>
                  <strong>{reference}</strong>
                  <small>
                    {deviceType.ports.length} poorten · {instanceCount} geplaatst
                  </small>
                </div>

                <div className="type-list-actions">
                  <button
                    type="button"
                    onClick={() => exportSingleType(deviceType)}
                  >
                    Export
                  </button>

                  <button
                    type="button"
                    onClick={() => startEditType(deviceType)}
                  >
                    Bewerk
                  </button>

                  <button
                    type="button"
                    disabled={instanceCount > 0}
                    title={
                      instanceCount > 0
                        ? 'Verwijder eerst de geplaatste apparaten.'
                        : 'Type verwijderen'
                    }
                    onClick={() => {
                      if (
                        window.confirm(
                          `Apparaattype ${reference} verwijderen?`,
                        )
                      ) {
                        onDeleteType(reference)
                      }
                    }}
                  >
                    Verwijder
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {message && <div className="library-message">{message}</div>}
    </aside>
  )
}
