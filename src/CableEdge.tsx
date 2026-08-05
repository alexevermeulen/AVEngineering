import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type Edge,
  type EdgeProps,
} from '@xyflow/react'
import type { CableEdgeData, Signal } from './types'

export type CableEdge = Edge<CableEdgeData, 'cable'>

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

function Arrow({
  x,
  y,
  color,
}: {
  x: number
  y: number
  color: string
}) {
  return (
    <polygon
      points={`${x - 14},${y - 7} ${x + 5},${y} ${x - 14},${y + 7}`}
      fill={color}
    />
  )
}

function EdgeText({
  x,
  y,
  children,
  align = 'center',
  className = '',
}: {
  x: number
  y: number
  children: React.ReactNode
  align?: 'left' | 'center' | 'right'
  className?: string
}) {
  const translate =
    align === 'left'
      ? 'translate(0, -50%)'
      : align === 'right'
        ? 'translate(-100%, -50%)'
        : 'translate(-50%, -50%)'

  return (
    <div
      className={`edge-text ${className}`}
      style={{
        transform: `translate(${x}px, ${y}px) ${translate}`,
        textAlign: align,
      }}
    >
      {children}
    </div>
  )
}

function LabelBox({
  x,
  y,
  children,
  align = 'center',
  className = '',
}: {
  x: number
  y: number
  children: React.ReactNode
  align?: 'left' | 'center' | 'right'
  className?: string
}) {
  return (
    <EdgeText x={x} y={y} align={align} className={`label-box ${className}`}>
      {children}
    </EdgeText>
  )
}

export function CableEdgeComponent(props: EdgeProps<CableEdge>) {
  const {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
  } = props

  if (!data) return null

  const color = signalColor(data.signal)
  const strokeWidth = selected ? 3 : 2

  if (data.displayMode === 'feather') {
    /*
     * Compacte feather:
     * - geen connectorlabels;
     * - ongeveer half zo lang;
     * - kabelnummer vlak boven de kabel;
     * - remote device/poort direct achter de pijl.
     */
    /*
     * De lijn blijft exact op de Y-positie van de connector.
     * De lane wordt alleen gebruikt om tekst horizontaal iets te spreiden.
     * Daardoor ontstaat nooit meer een verticale knik bij de tweede kabel.
     */
    // Alle kabelnummers staan op exact dezelfde positie t.o.v. hun connector.
    const sourceLineY = sourceY
    const sourceEndX = sourceX + 165
    const sourceArrowX = sourceEndX - 34
    const sourceNumberX = sourceX + 76

    const targetLineY = targetY
    const targetStartX = targetX - 175
    const targetArrowX = targetStartX + 40
    const targetNumberX = targetX - 82

    return (
      <>
        <path
          d={`M ${sourceX} ${sourceLineY} H ${sourceEndX}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
        />
        <Arrow x={sourceArrowX} y={sourceLineY} color={color} />

        <path
          d={`M ${targetStartX} ${targetLineY} H ${targetX}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
        />
        <Arrow x={targetArrowX} y={targetLineY} color={color} />

        <EdgeLabelRenderer>
          <LabelBox
            x={sourceNumberX}
            y={sourceLineY - 10}
            className="edge-number compact-edge-number"
          >
            {data.cableNumber}
          </LabelBox>

          <LabelBox
            x={sourceEndX + 8}
            y={sourceLineY - 1}
            align="left"
            className="remote-label compact-remote-label"
          >
            <strong>{data.targetDevice}</strong>
            <span>{data.targetPort}</span>
          </LabelBox>

          <LabelBox
            x={targetStartX - 8}
            y={targetLineY - 1}
            align="right"
            className="remote-label compact-remote-label"
          >
            <strong>{data.sourceDevice}</strong>
            <span>{data.sourcePort}</span>
          </LabelBox>

          <LabelBox
            x={targetNumberX}
            y={targetLineY - 10}
            className="edge-number compact-edge-number"
          >
            {data.cableNumber}
          </LabelBox>
        </EdgeLabelRenderer>
      </>
    )
  }

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 4,
  })

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth,
        }}
      />
      <EdgeLabelRenderer>
        <LabelBox x={labelX} y={labelY - 12} className="edge-number">
          {data.cableNumber}
        </LabelBox>
      </EdgeLabelRenderer>
    </>
  )
}
