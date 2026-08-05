import { useEffect, useState } from 'react'
import type {
  CableDisplayMode,
  EngineeringSettings,
  SignalTypeDefinition,
} from './types'

type SettingsDialogProps = {
  isOpen: boolean
  settings: EngineeringSettings
  onClose: () => void
  onSave: (settings: EngineeringSettings) => void
}

function createSignal(): SignalTypeDefinition {
  return {
    id: '',
    label: '',
    prefix: '',
    startNumber: 1,
    nextNumber: 1,
  }
}

export function SettingsDialog({
  isOpen,
  settings,
  onClose,
  onSave,
}: SettingsDialogProps) {
  const [draft, setDraft] = useState<EngineeringSettings>(settings)
  const [newConnector, setNewConnector] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setDraft(structuredClone(settings))
    setNewConnector('')
    setMessage('')
  }, [isOpen, settings])

  if (!isOpen) return null

  function updateSignal(
    index: number,
    patch: Partial<SignalTypeDefinition>,
  ) {
    setDraft((current) => ({
      ...current,
      signalTypes: current.signalTypes.map((signal, itemIndex) =>
        itemIndex === index
          ? {
              ...signal,
              ...patch,
            }
          : signal,
      ),
    }))
  }

  function removeSignal(index: number) {
    setDraft((current) => ({
      ...current,
      signalTypes: current.signalTypes.filter(
        (_, itemIndex) => itemIndex !== index,
      ),
    }))
  }

  function addConnector() {
    const connector = newConnector.trim()

    if (!connector) return

    if (
      draft.connectors.some(
        (item) => item.toLowerCase() === connector.toLowerCase(),
      )
    ) {
      setMessage(`${connector} bestaat al.`)
      return
    }

    setDraft((current) => ({
      ...current,
      connectors: [...current.connectors, connector],
    }))
    setNewConnector('')
    setMessage('')
  }

  function save() {
    const cleanSignals = draft.signalTypes.map((signal) => ({
      ...signal,
      id: signal.id.trim().toUpperCase(),
      label: signal.label.trim() || signal.id.trim().toUpperCase(),
      prefix: signal.prefix.trim().toUpperCase(),
      startNumber: Math.max(0, Math.floor(signal.startNumber)),
      nextNumber: Math.max(
        Math.max(0, Math.floor(signal.startNumber)),
        Math.floor(signal.nextNumber),
      ),
    }))

    const invalid = cleanSignals.find(
      (signal) => !signal.id || !signal.prefix,
    )

    if (invalid) {
      setMessage('Iedere signaalsoort heeft een ID en prefix nodig.')
      return
    }

    const duplicate = cleanSignals.find(
      (signal, index) =>
        cleanSignals.findIndex((item) => item.id === signal.id) !== index,
    )

    if (duplicate) {
      setMessage(`Signaal-ID ${duplicate.id} komt meer dan één keer voor.`)
      return
    }

    onSave({
      ...draft,
      signalTypes: cleanSignals,
      connectors: [...draft.connectors]
        .map((item) => item.trim())
        .filter(Boolean),
    })
    onClose()
  }

  return (
    <div
      className="settings-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section className="settings-dialog">
        <header>
          <div>
            <h2>Engineering settings</h2>
            <p>Signaaltypes, connectors en kabelnummering</p>
          </div>

          <button type="button" onClick={onClose}>
            ×
          </button>
        </header>

        <section className="settings-section">
          <div className="settings-section-heading">
            <h3>Signaaltypes</h3>
            <button
              type="button"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  signalTypes: [
                    ...current.signalTypes,
                    createSignal(),
                  ],
                }))
              }
            >
              Signaaltype toevoegen
            </button>
          </div>

          <div className="signal-settings-table">
            <div className="signal-settings-header">
              <span>ID</span>
              <span>Naam</span>
              <span>Prefix</span>
              <span>Startnummer</span>
              <span>Volgend nummer</span>
              <span />
            </div>

            {draft.signalTypes.map((signal, index) => (
              <div
                key={`${signal.id}-${index}`}
                className="signal-settings-row"
              >
                <input
                  value={signal.id}
                  onChange={(event) =>
                    updateSignal(index, {
                      id: event.target.value,
                    })
                  }
                  placeholder="SDI"
                />

                <input
                  value={signal.label}
                  onChange={(event) =>
                    updateSignal(index, {
                      label: event.target.value,
                    })
                  }
                  placeholder="SDI Video"
                />

                <input
                  value={signal.prefix}
                  onChange={(event) =>
                    updateSignal(index, {
                      prefix: event.target.value,
                    })
                  }
                  placeholder="DV"
                />

                <input
                  type="number"
                  min={0}
                  value={signal.startNumber}
                  onChange={(event) =>
                    updateSignal(index, {
                      startNumber: Number(event.target.value),
                    })
                  }
                />

                <input
                  type="number"
                  min={0}
                  value={signal.nextNumber}
                  onChange={(event) =>
                    updateSignal(index, {
                      nextNumber: Number(event.target.value),
                    })
                  }
                />

                <button
                  type="button"
                  onClick={() => removeSignal(index)}
                >
                  Verwijder
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <h3>Connectors</h3>

          <div className="connector-chip-list">
            {draft.connectors.map((connector) => (
              <span key={connector} className="connector-chip">
                {connector}
                <button
                  type="button"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      connectors: current.connectors.filter(
                        (item) => item !== connector,
                      ),
                    }))
                  }
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          <div className="connector-add-row">
            <input
              value={newConnector}
              onChange={(event) =>
                setNewConnector(event.target.value)
              }
              placeholder="Bijvoorbeeld BNC, XLR, RJ45..."
            />
            <button type="button" onClick={addConnector}>
              Toevoegen
            </button>
          </div>
        </section>

        <section className="settings-section">
          <h3>Standaard kabelweergave</h3>

          <select
            value={draft.defaultCableDisplayMode}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                defaultCableDisplayMode:
                  event.target.value as CableDisplayMode,
              }))
            }
          >
            <option value="feather">Feather</option>
            <option value="full">Volledige kabel</option>
          </select>
        </section>

        {message && (
          <div className="settings-message">{message}</div>
        )}

        <footer>
          <button type="button" onClick={onClose}>
            Annuleren
          </button>

          <button
            type="button"
            className="primary-settings-button"
            onClick={save}
          >
            Settings bewaren
          </button>
        </footer>
      </section>
    </div>
  )
}
