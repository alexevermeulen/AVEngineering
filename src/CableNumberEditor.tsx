import { useEffect, useState } from 'react'
import type {
  CableEdgeData,
  SignalTypeDefinition,
} from './types'

type CableNumberEditorProps = {
  isOpen: boolean
  edgeId: string | null
  edgeData: CableEdgeData | null
  existingCableNumbers: string[]
  signalTypes: SignalTypeDefinition[]
  onClose: () => void
  onSave: (
    edgeId: string,
    newCableNumber: string,
    prefix: string,
    numericValue: number,
  ) => void
}

export function CableNumberEditor({
  isOpen,
  edgeId,
  edgeData,
  existingCableNumbers,
  signalTypes,
  onClose,
  onSave,
}: CableNumberEditorProps) {
  const [cableNumber, setCableNumber] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!isOpen || !edgeData) return

    setCableNumber(currentEdgeData.cableNumber)
    setMessage('')
  }, [edgeData, isOpen])

  if (!isOpen || !edgeId || !edgeData) return null

  const currentEdgeId = edgeId
  const currentEdgeData = edgeData

  const signalDefinition = signalTypes.find(
    (signal) => signal.id === currentEdgeData.signal,
  )

  function save() {
    const cleanNumber = cableNumber.trim().toUpperCase()

    if (!cleanNumber) {
      setMessage('Vul een kabelnummer in.')
      return
    }

    const duplicate = existingCableNumbers.some(
      (number) =>
        number.toUpperCase() === cleanNumber &&
        number.toUpperCase() !== currentEdgeData.cableNumber.toUpperCase(),
    )

    if (duplicate) {
      setMessage(`Kabelnummer ${cleanNumber} bestaat al.`)
      return
    }

    /*
     * Een kabelnummer moet eindigen op cijfers.
     * Alles vóór de laatste cijferreeks wordt de nieuwe prefix.
     *
     * DV1205 -> prefix DV, start 1205, volgende 1206
     * SDI0042 -> prefix SDI, start 42, volgende 43
     */
    const match = cleanNumber.match(/^(.*?)(\d+)$/)

    if (!match) {
      setMessage(
        'Het kabelnummer moet eindigen op cijfers, bijvoorbeeld DV1205.',
      )
      return
    }

    const prefix = match[1]
    const numericValue = Number(match[2])

    if (!prefix) {
      setMessage('Het kabelnummer heeft een prefix nodig.')
      return
    }

    if (!Number.isSafeInteger(numericValue)) {
      setMessage('Het numerieke deel is ongeldig.')
      return
    }

    onSave(currentEdgeId, cleanNumber, prefix, numericValue)
    onClose()
  }

  return (
    <div
      className="cable-editor-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section className="cable-editor-dialog">
        <header>
          <div>
            <h2>Kabelnummer bewerken</h2>
            <p>
              {currentEdgeData.sourceDevice}/{currentEdgeData.sourcePort}
              {' → '}
              {currentEdgeData.targetDevice}/{currentEdgeData.targetPort}
            </p>
          </div>

          <button type="button" onClick={onClose}>
            ×
          </button>
        </header>

        <label>
          Kabelnummer
          <input
            autoFocus
            value={cableNumber}
            onChange={(event) =>
              setCableNumber(event.target.value)
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                save()
              }
            }}
            placeholder="DV1205"
          />
        </label>

        <div className="cable-editor-info">
          <span>
            Signaaltype: <strong>{currentEdgeData.signal}</strong>
          </span>
          <span>
            Huidige prefix:{' '}
            <strong>{signalDefinition?.prefix ?? 'onbekend'}</strong>
          </span>
        </div>

        <p className="cable-editor-explanation">
          Na opslaan wordt het numerieke deel het nieuwe startnummer.
          De volgende kabel gebruikt automatisch het daaropvolgende nummer.
        </p>

        {message && (
          <div className="cable-editor-message">{message}</div>
        )}

        <footer>
          <button type="button" onClick={onClose}>
            Annuleren
          </button>

          <button
            type="button"
            className="primary-cable-editor-button"
            onClick={save}
          >
            Kabelnummer bewaren
          </button>
        </footer>
      </section>
    </div>
  )
}
