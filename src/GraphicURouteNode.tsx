import {
  type Node,
  type NodeProps,
} from '@xyflow/react'
import type { GraphicURouteNodeData, Signal } from './types'

export type GraphicURouteNode =
  Node<GraphicURouteNodeData, 'graphic-u-route'>

function signalColor(signal: Signal) {
  switch (signal) {
    case 'DGV': return '#b7b500'
    case 'DAT': return '#00a6b2'
    case 'AUD': return '#d000d0'
    case 'CTRL': return '#16a34a'
    case 'PWR': return '#111827'
    default: return '#64748b'
  }
}

type DragKind =
  | 'left-top'
  | 'right-top'
  | 'left-bottom'
  | 'right-bottom'

export function GraphicURouteNodeComponent({
  id,
  data,
  selected,
}: NodeProps<GraphicURouteNode>) {
  const color = signalColor(data.signal)

  // Eén horizontale onderlijn, met twee onafhankelijke armlengtes.
  const bottomY = Math.max(data.leftHeight, data.rightHeight, 80) + 20
  const leftTopY = bottomY - data.leftHeight
  const rightTopY = bottomY - data.rightHeight
  const canvasHeight = bottomY + 18

  function startDrag(
    event: React.PointerEvent,
    kind: DragKind,
  ) {
    event.stopPropagation()
    event.preventDefault()

    const startX = event.clientX
    const startY = event.clientY
    const initialWidth = data.width
    const initialLeftHeight = data.leftHeight
    const initialRightHeight = data.rightHeight

    function onMove(moveEvent: PointerEvent) {
      const dx = moveEvent.clientX - startX
      const dy = moveEvent.clientY - startY

      if (kind === 'left-top') {
        data.onChangeGeometry(id, {
          leftHeight: Math.max(40, initialLeftHeight - dy),
        })
      }

      if (kind === 'right-top') {
        data.onChangeGeometry(id, {
          rightHeight: Math.max(40, initialRightHeight - dy),
        })
      }

      if (kind === 'left-bottom') {
        data.onChangeGeometry(id, {
          width: Math.max(100, initialWidth - dx),
          leftHeight: Math.max(40, initialLeftHeight + dy),
          rightHeight: Math.max(40, initialRightHeight + dy),
        })
      }

      if (kind === 'right-bottom') {
        data.onChangeGeometry(id, {
          width: Math.max(100, initialWidth + dx),
          leftHeight: Math.max(40, initialLeftHeight + dy),
          rightHeight: Math.max(40, initialRightHeight + dy),
        })
      }
    }

    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const handleStyle = {
    fill: '#ffffff',
    stroke: color,
    strokeWidth: selected ? 3 : 2,
  }

  return (
    <div
      className="graphic-u-route drag-handle"
      style={{
        width: data.width,
        height: canvasHeight,
        cursor: selected ? 'move' : 'default',
      }}
    >
      <svg
        width={data.width}
        height={canvasHeight}
        style={{ overflow: 'visible' }}
      >
        <path
          d={[
            `M 0 ${leftTopY}`,
            `V ${bottomY}`,
            `H ${data.width}`,
            `V ${rightTopY}`,
          ].join(' ')}
          fill="none"
          stroke={color}
          strokeWidth={selected ? 7 : 5}
          strokeLinecap="square"
          strokeLinejoin="miter"
          pointerEvents="stroke"
        />

        {selected && (
          <>
            <circle
              cx={0}
              cy={leftTopY}
              r={7}
              style={{ ...handleStyle, cursor: 'ns-resize' }}
              onPointerDown={(event) => startDrag(event, 'left-top')}
            />

            <circle
              cx={data.width}
              cy={rightTopY}
              r={7}
              style={{ ...handleStyle, cursor: 'ns-resize' }}
              onPointerDown={(event) => startDrag(event, 'right-top')}
            />

            <circle
              cx={0}
              cy={bottomY}
              r={7}
              style={{ ...handleStyle, cursor: 'nwse-resize' }}
              onPointerDown={(event) => startDrag(event, 'left-bottom')}
            />

            <circle
              cx={data.width}
              cy={bottomY}
              r={7}
              style={{ ...handleStyle, cursor: 'nesw-resize' }}
              onPointerDown={(event) => startDrag(event, 'right-bottom')}
            />
          </>
        )}
      </svg>
    </div>
  )
}
