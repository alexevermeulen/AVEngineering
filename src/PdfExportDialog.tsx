import { useMemo, useState } from 'react'
import {
  getNodesBounds,
  getViewportForBounds,
  type Node,
} from '@xyflow/react'
import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'
import type { ProjectData } from './types'

type PaperSize = 'a4' | 'a3' | 'a2' | 'a1' | 'a0'
type Orientation = 'landscape' | 'portrait'
type PaginationMode = 'fit' | 'tile'

type PdfExportDialogProps = {
  isOpen: boolean
  project: ProjectData['project']
  nodes: Node[]
  onClose: () => void
  onStatus: (message: string) => void
}

const PAPER_LABELS: Record<PaperSize, string> = {
  a4: 'A4',
  a3: 'A3',
  a2: 'A2',
  a1: 'A1',
  a0: 'A0',
}

function safeFilename(value: string) {
  return (
    value
      .trim()
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'av-project'
  )
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => resolve(image)
    image.onerror = () =>
      reject(new Error('De canvasafbeelding kon niet worden geladen.'))
    image.src = dataUrl
  })
}

function addTitleBlock({
  pdf,
  project,
  drawingNumber,
  revision,
  preparedBy,
  pageNumber,
  pageCount,
  margin,
  titleBlockHeight,
}: {
  pdf: jsPDF
  project: ProjectData['project']
  drawingNumber: string
  revision: string
  preparedBy: string
  pageNumber: number
  pageCount: number
  margin: number
  titleBlockHeight: number
}) {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const top = pageHeight - margin - titleBlockHeight
  const left = margin
  const right = pageWidth - margin
  const width = right - left

  pdf.setDrawColor(20, 40, 212)
  pdf.setLineWidth(0.45)
  pdf.rect(left, top, width, titleBlockHeight)

  const projectWidth = width * 0.46
  const detailsWidth = width * 0.34

  const xProjectEnd = left + projectWidth
  const xDetailsEnd = xProjectEnd + detailsWidth

  pdf.line(xProjectEnd, top, xProjectEnd, top + titleBlockHeight)
  pdf.line(xDetailsEnd, top, xDetailsEnd, top + titleBlockHeight)

  const halfY = top + titleBlockHeight / 2
  pdf.line(xProjectEnd, halfY, xDetailsEnd, halfY)

  pdf.setTextColor(17, 24, 39)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.text(project.name, left + 3, top + 6)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7.5)
  pdf.text(`Locatie: ${project.location}`, left + 3, top + 11)
  pdf.text(
    `Aangemaakt door: ${preparedBy || project.created_by}`,
    left + 3,
    top + 16,
  )
  pdf.text(`Facility-ID: ${project.facility_id}`, left + 3, top + 21)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7)
  pdf.text('TEKENING', xProjectEnd + 3, top + 5)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.text(
    drawingNumber || 'Niet opgegeven',
    xProjectEnd + 3,
    top + 10,
  )

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7)
  pdf.text('REVISIE', xProjectEnd + 3, halfY + 5)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.text(revision || '-', xProjectEnd + 3, halfY + 10)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.text(
    `PAGINA ${pageNumber} / ${pageCount}`,
    xDetailsEnd + 3,
    top + 7,
  )

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.text(
    `Datum: ${new Date().toLocaleDateString('nl-NL')}`,
    xDetailsEnd + 3,
    top + 13,
  )
  pdf.text('Schaal: NTS', xDetailsEnd + 3, top + 18)
  pdf.text('AV Engineering Platform', xDetailsEnd + 3, top + 23)
}

export function PdfExportDialog({
  isOpen,
  project,
  nodes,
  onClose,
  onStatus,
}: PdfExportDialogProps) {
  const [paperSize, setPaperSize] = useState<PaperSize>('a3')
  const [orientation, setOrientation] =
    useState<Orientation>('landscape')
  const [paginationMode, setPaginationMode] =
    useState<PaginationMode>('fit')
  const [drawingNumber, setDrawingNumber] = useState('')
  const [revision, setRevision] = useState('A')
  const [preparedBy, setPreparedBy] = useState(project.created_by)
  const [isExporting, setIsExporting] = useState(false)

  const summary = useMemo(() => {
    if (paginationMode === 'fit') {
      return 'Het volledige schema wordt passend op één pagina geplaatst.'
    }

    return (
      'Het schema wordt op vaste schaal over meerdere pagina’s verdeeld. ' +
      'Iedere pagina krijgt een eigen titelblok en paginanummer.'
    )
  }, [paginationMode])

  if (!isOpen) return null

  async function exportPdf() {
    if (nodes.length === 0) {
      onStatus('Er staat niets op het canvas om te exporteren.')
      return
    }

    const viewportElement = document.querySelector(
      '.react-flow__viewport',
    ) as HTMLElement | null

    if (!viewportElement) {
      onStatus('Het React Flow-canvas kon niet worden gevonden.')
      return
    }

    setIsExporting(true)
    onStatus('Professionele PDF wordt opgebouwd…')

    try {
      const bounds = getNodesBounds(nodes)
      const canvasPadding = 80
      const logicalWidth = Math.max(
        1000,
        Math.ceil(bounds.width + canvasPadding * 2),
      )
      const logicalHeight = Math.max(
        700,
        Math.ceil(bounds.height + canvasPadding * 2),
      )

      const exportViewport = getViewportForBounds(
        bounds,
        logicalWidth,
        logicalHeight,
        0.05,
        2,
        canvasPadding / logicalWidth,
      )

      const dataUrl = await toPng(viewportElement, {
        backgroundColor: '#ffffff',
        width: logicalWidth,
        height: logicalHeight,
        pixelRatio: 2,
        cacheBust: true,
        style: {
          width: `${logicalWidth}px`,
          height: `${logicalHeight}px`,
          transform:
            `translate(${exportViewport.x}px, ${exportViewport.y}px) ` +
            `scale(${exportViewport.zoom})`,
        },
        filter: (node) => {
          const element = node as HTMLElement

          return !(
            element.classList?.contains('react-flow__controls') ||
            element.classList?.contains('react-flow__minimap')
          )
        },
      })

      const image = await loadImage(dataUrl)
      const pdf = new jsPDF({
        orientation,
        unit: 'mm',
        format: paperSize,
        compress: true,
      })

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 8
      const titleBlockHeight = 27
      const contentWidthMm = pageWidth - margin * 2
      const contentHeightMm =
        pageHeight - margin * 2 - titleBlockHeight - 3

      if (contentWidthMm <= 0 || contentHeightMm <= 0) {
        throw new Error('Het gekozen papierformaat is te klein.')
      }

      if (paginationMode === 'fit') {
        const imageRatio = logicalWidth / logicalHeight
        const pageRatio = contentWidthMm / contentHeightMm

        let renderWidth: number
        let renderHeight: number

        if (imageRatio > pageRatio) {
          renderWidth = contentWidthMm
          renderHeight = renderWidth / imageRatio
        } else {
          renderHeight = contentHeightMm
          renderWidth = renderHeight * imageRatio
        }

        const imageX = margin + (contentWidthMm - renderWidth) / 2
        const imageY = margin + (contentHeightMm - renderHeight) / 2

        pdf.addImage(
          dataUrl,
          'PNG',
          imageX,
          imageY,
          renderWidth,
          renderHeight,
          undefined,
          'FAST',
        )

        addTitleBlock({
          pdf,
          project,
          drawingNumber,
          revision,
          preparedBy,
          pageNumber: 1,
          pageCount: 1,
          margin,
          titleBlockHeight,
        })
      } else {
        /*
         * 4 logische canvas-pixels per millimeter:
         * circa 1.500 px breed op A3 landscape.
         * De PNG heeft pixelRatio 2, daarom wordt bij het croppen
         * naar de werkelijke afbeeldingspixels omgerekend.
         */
        const logicalPixelsPerMm = 4
        const tileLogicalWidth =
          Math.max(1, Math.floor(contentWidthMm * logicalPixelsPerMm))
        const tileLogicalHeight =
          Math.max(1, Math.floor(contentHeightMm * logicalPixelsPerMm))

        const columns = Math.ceil(logicalWidth / tileLogicalWidth)
        const rows = Math.ceil(logicalHeight / tileLogicalHeight)
        const pageCount = columns * rows
        const pixelScaleX = image.naturalWidth / logicalWidth
        const pixelScaleY = image.naturalHeight / logicalHeight

        let pageNumber = 0

        for (let row = 0; row < rows; row += 1) {
          for (let column = 0; column < columns; column += 1) {
            pageNumber += 1

            if (pageNumber > 1) {
              pdf.addPage(paperSize, orientation)
            }

            const sourceLogicalX = column * tileLogicalWidth
            const sourceLogicalY = row * tileLogicalHeight
            const sourceLogicalWidth = Math.min(
              tileLogicalWidth,
              logicalWidth - sourceLogicalX,
            )
            const sourceLogicalHeight = Math.min(
              tileLogicalHeight,
              logicalHeight - sourceLogicalY,
            )

            const cropCanvas = document.createElement('canvas')
            cropCanvas.width = Math.ceil(
              sourceLogicalWidth * pixelScaleX,
            )
            cropCanvas.height = Math.ceil(
              sourceLogicalHeight * pixelScaleY,
            )

            const context = cropCanvas.getContext('2d')
            if (!context) {
              throw new Error('PDF-tegel kon niet worden opgebouwd.')
            }

            context.fillStyle = '#ffffff'
            context.fillRect(
              0,
              0,
              cropCanvas.width,
              cropCanvas.height,
            )

            context.drawImage(
              image,
              sourceLogicalX * pixelScaleX,
              sourceLogicalY * pixelScaleY,
              sourceLogicalWidth * pixelScaleX,
              sourceLogicalHeight * pixelScaleY,
              0,
              0,
              cropCanvas.width,
              cropCanvas.height,
            )

            const tileDataUrl = cropCanvas.toDataURL('image/png')
            const renderWidth =
              sourceLogicalWidth / logicalPixelsPerMm
            const renderHeight =
              sourceLogicalHeight / logicalPixelsPerMm

            pdf.addImage(
              tileDataUrl,
              'PNG',
              margin,
              margin,
              renderWidth,
              renderHeight,
              undefined,
              'FAST',
            )

            addTitleBlock({
              pdf,
              project,
              drawingNumber,
              revision,
              preparedBy,
              pageNumber,
              pageCount,
              margin,
              titleBlockHeight,
            })
          }
        }
      }

      const filename =
        `${safeFilename(project.name)}-schema-` +
        `${PAPER_LABELS[paperSize]}-${revision || 'rev'}.pdf`

      pdf.save(filename)
      onStatus('Professionele PDF geëxporteerd.')
      onClose()
    } catch (error: unknown) {
      onStatus(
        error instanceof Error
          ? `PDF-export mislukt: ${error.message}`
          : 'PDF-export mislukt.',
      )
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div
      className="pdf-export-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isExporting) {
          onClose()
        }
      }}
    >
      <section className="pdf-export-dialog">
        <header>
          <div>
            <h2>Professionele PDF-export</h2>
            <p>{project.name}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
          >
            ×
          </button>
        </header>

        <div className="pdf-export-form">
          <label>
            Papierformaat
            <select
              value={paperSize}
              onChange={(event) =>
                setPaperSize(event.target.value as PaperSize)
              }
            >
              {Object.entries(PAPER_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Oriëntatie
            <select
              value={orientation}
              onChange={(event) =>
                setOrientation(event.target.value as Orientation)
              }
            >
              <option value="landscape">Landscape</option>
              <option value="portrait">Portrait</option>
            </select>
          </label>

          <label>
            Pagina-indeling
            <select
              value={paginationMode}
              onChange={(event) =>
                setPaginationMode(
                  event.target.value as PaginationMode,
                )
              }
            >
              <option value="fit">Volledig schema op één pagina</option>
              <option value="tile">Verdelen over meerdere pagina’s</option>
            </select>
          </label>

          <label>
            Tekeningnummer
            <input
              value={drawingNumber}
              onChange={(event) =>
                setDrawingNumber(event.target.value)
              }
              placeholder="AV-001"
            />
          </label>

          <label>
            Revisie
            <input
              value={revision}
              onChange={(event) => setRevision(event.target.value)}
              placeholder="A"
            />
          </label>

          <label>
            Opgesteld door
            <input
              value={preparedBy}
              onChange={(event) => setPreparedBy(event.target.value)}
            />
          </label>
        </div>

        <div className="pdf-export-summary">{summary}</div>

        <footer>
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
          >
            Annuleren
          </button>

          <button
            type="button"
            className="primary-pdf-button"
            onClick={() => void exportPdf()}
            disabled={isExporting}
          >
            {isExporting ? 'PDF wordt gemaakt…' : 'PDF exporteren'}
          </button>
        </footer>
      </section>
    </div>
  )
}
