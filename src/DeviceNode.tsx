import {
  Handle,
  Position,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import type { DeviceNodeData, Endpoint, Port, Signal } from './types'

export type DeviceNode = Node<DeviceNodeData, 'device'>

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

function PortRow({
  deviceId,
  port,
  side,
  selectedSource,
  onPortClick,
}: {
  deviceId: string
  port: Port
  side: 'left' | 'right'
  selectedSource?: Endpoint | null
  onPortClick: (endpoint: Endpoint) => void
}) {
  const isLeft = side === 'left'
  const isOutput = port.direction === 'O' || port.direction === 'L'
  const isSelected =
    selectedSource?.deviceId === deviceId &&
    selectedSource.port.label === port.label

  return (
    <button
      type="button"
      className={`port-row ${isLeft ? 'port-row-left' : 'port-row-right'} ${
        isSelected ? 'port-row-selected' : ''
      }`}
      title={`${port.signal} · ${port.connector}`}
      onClick={(event) => {
        event.stopPropagation()
        onPortClick({ deviceId, port })
      }}
    >
      {isLeft && <span className="connector-label">{port.connector}</span>}
      <span className="port-label">{port.label}</span>
      {!isLeft && <span className="connector-label">{port.connector}</span>}

      <Handle
        type={isOutput ? 'source' : 'target'}
        position={isLeft ? Position.Left : Position.Right}
        id={`port:${port.label}`}
        isConnectable={false}
        style={{
          width: 9,
          height: 9,
          border: '1px solid white',
          background: signalColor(port.signal),
          pointerEvents: 'none',
        }}
      />
    </button>
  )
}

export function DeviceNodeComponent({
  id,
  data,
}: NodeProps<DeviceNode>) {
  const inputs = [...data.ports]
    .filter((port) => port.direction === 'I')
    .sort((a, b) => a.pos - b.pos)

  const outputs = [...data.ports]
    .filter((port) => port.direction === 'O')
    .sort((a, b) => a.pos - b.pos)

  const bidirectional = [...data.ports]
    .filter((port) => port.direction === 'L')
    .sort((a, b) => a.pos - b.pos)

  const leftPorts = [...inputs, ...bidirectional]
  const rightPorts = [...outputs]

  return (
    <div className="device-node">
      <div className="device-title drag-handle">
        <div>
          <strong>{data.sysname}</strong>
          <small>{data.location}</small>
        </div>
        <div className="device-model">
          <strong>{data.manufacturer}</strong>
          <span>{data.model}</span>
        </div>
      </div>

      <div className="device-description">{data.description}</div>

      <div className="device-port-grid">
        <div className="port-column">
          <div className="port-heading">INPUTS</div>
          {leftPorts.map((port) => (
            <PortRow
              key={`left-${port.label}`}
              deviceId={id}
              port={port}
              side="left"
              selectedSource={data.selectedSource}
              onPortClick={data.onPortClick}
            />
          ))}
        </div>

        <div className="port-column port-column-right">
          <div className="port-heading">OUTPUTS</div>
          {rightPorts.map((port) => (
            <PortRow
              key={`right-${port.label}`}
              deviceId={id}
              port={port}
              side="right"
              selectedSource={data.selectedSource}
              onPortClick={data.onPortClick}
            />
          ))}
        </div>
      </div>

      <div className="device-footer">
        <span>{data.rack}</span>
        <span>{data.sysname}</span>
      </div>
    </div>
  )
}
