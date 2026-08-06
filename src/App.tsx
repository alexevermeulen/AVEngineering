import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  ConnectionLineType,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type IsValidConnection,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react'

import '@xyflow/react/dist/style.css'
import './App.css'

type PortDirection = 'I' | 'O' | 'L'
type Signal = 'DGV' | 'DAT' | 'AUD' | 'CTRL' | 'PWR' | string
type ToolMode = 'select' | 'source-feather' | 'destination-feather' | 'bus'

type Port = {
  label: string
  direction: PortDirection
  signal: Signal
  connector: string
  pos: number
  needs_review?: string
}

type DeviceType = {
  mfg: string
  model: string
  prodtype: string
  revno: string
  rack_u: number
  short_desc: string
  ports: Port[]
}

type Device = {
  sysname: string
  type_ref: string
  rack: string
  rack_level?: number
  location: string
}

type ProjectData = {
  project: {
    name: string
    facility_id: number
    created_by: string
    location: string
  }
  types: DeviceType[]
  devices: Device[]
}

type DeviceNodeData = {
  kind: 'device'
  sysname: string
  manufacturer: string
  model: string
  description: string
  location: string
  rack: string
  ports: Port[]
}

type FeatherNodeData = {
  kind: 'feather'
  featherKind: 'source' | 'destination'
  cableNumber: string
  remoteDevice: string
  remotePort: string
  signal: Signal
}

type BusNodeData = {
  kind: 'bus'
  label: string
  signal: Signal
  slots: number
}

type AppNodeData = DeviceNodeData | FeatherNodeData | BusNodeData
type AppNode = Node<AppNodeData>
type CableEdgeData = {
  cableNumber: string
  signal: Signal
}
type CableEdge = Edge<CableEdgeData>

const SIGNAL_OPTIONS: Signal[] = ['DGV', 'DAT', 'AUD', 'CTRL', 'PWR']

function signalColor(signal: Signal) {
  switch (signal) {
    case 'DGV':
      return '#b3ad00'
    case 'DAT':
      return '#00a6b2'
    case 'AUD':
      return '#c026d3'
    case 'CTRL':
      return '#16a34a'
    case 'PWR':
      return '#111827'
    default:
      return '#64748b'
  }
}

function signalName(signal: Signal) {
  switch (signal) {
    case 'DGV':
      return 'DGV (SDI)'
    case 'DAT':
      return 'DAT (Network)'
    case 'AUD':
      return 'AUD (Audio)'
    case 'CTRL':
      return 'CTRL (Control)'
    case 'PWR':
      return '230VAC'
    default:
      return signal
  }
}

function createPortHandleId(side: 'left' | 'right', portLabel: string) {
  return `port:${side}:${portLabel}`
}

function readPortLabel(handleId: string | null | undefined) {
  if (!handleId?.startsWith('port:')) return null
  return handleId.split(':').slice(2).join(':')
}

function PortRow({ port, side }: { port: Port; side: 'left' | 'right' }) {
  const isLeft = side === 'left'

  return (
    <div
      title={`${port.signal} · ${port.connector}`}
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: isLeft ? '42px 1fr' : '1fr 42px',
        alignItems: 'center',
        minHeight: 24,
        padding: isLeft ? '0 8px 0 12px' : '0 12px 0 8px',
        borderBottom: '1px solid #dbe4ef',
        fontSize: 10,
        lineHeight: 1.1,
      }}
    >
      {isLeft && (
        <span style={{ color: '#475569', fontSize: 8 }}>{port.connector}</span>
      )}

      <span
        style={{
          fontWeight: 700,
          textAlign: isLeft ? 'left' : 'right',
          whiteSpace: 'nowrap',
        }}
      >
        {port.label}
      </span>

      {!isLeft && (
        <span style={{ color: '#475569', fontSize: 8, textAlign: 'right' }}>
          {port.connector}
        </span>
      )}

      <Handle
        type={isLeft ? 'target' : 'source'}
        position={isLeft ? Position.Left : Position.Right}
        id={createPortHandleId(side, port.label)}
        style={{
          width: 9,
          height: 9,
          border: '1px solid white',
          background: signalColor(port.signal),
        }}
      />
    </div>
  )
}

function DeviceNodeComponent({ data }: NodeProps<Node<DeviceNodeData>>) {
  const leftPorts = [...data.ports]
    .filter((port) => port.direction === 'I' || port.direction === 'L')
    .sort((a, b) => a.pos - b.pos)

  const rightPorts = [...data.ports]
    .filter((port) => port.direction === 'O' || port.direction === 'L')
    .sort((a, b) => a.pos - b.pos)

  const rowCount = Math.max(leftPorts.length, rightPorts.length)

  return (
    <div
      style={{
        width: 360,
        background: '#fff',
        border: '3px solid #1428d4',
        color: '#111827',
      }}
    >
      <div
        className="drag-handle"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 12,
          padding: '8px 10px',
          borderBottom: '2px solid #1428d4',
          cursor: 'grab',
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 800 }}>{data.sysname}</div>
          <div style={{ marginTop: 2, fontSize: 8, color: '#475569' }}>
            {data.location}
          </div>
        </div>

        <div style={{ textAlign: 'right', fontSize: 9, fontWeight: 800 }}>
          <div>{data.manufacturer}</div>
          <div>{data.model}</div>
        </div>
      </div>

      <div
        style={{
          padding: '5px 10px',
          borderBottom: '1px solid #94a3b8',
          color: '#334155',
          fontSize: 8,
          textAlign: 'center',
        }}
      >
        {data.description}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          minHeight: Math.max(96, rowCount * 24),
        }}
      >
        <div style={{ borderRight: '1px solid #94a3b8' }}>
          <div
            style={{
              padding: '4px 8px',
              borderBottom: '1px solid #94a3b8',
              background: '#f8fafc',
              fontSize: 8,
              fontWeight: 800,
            }}
          >
            INPUTS
          </div>
          {leftPorts.map((port) => (
            <PortRow key={`${port.label}-left`} port={port} side="left" />
          ))}
        </div>

        <div>
          <div
            style={{
              padding: '4px 8px',
              borderBottom: '1px solid #94a3b8',
              background: '#f8fafc',
              fontSize: 8,
              fontWeight: 800,
              textAlign: 'right',
            }}
          >
            OUTPUTS
          </div>
          {rightPorts.map((port) => (
            <PortRow key={`${port.label}-right`} port={port} side="right" />
          ))}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '5px 10px',
          borderTop: '2px solid #1428d4',
          fontSize: 8,
          color: '#334155',
        }}
      >
        <span>{data.rack}</span>
        <span>{data.sysname}</span>
      </div>
    </div>
  )
}

function FeatherNodeComponent({ data, selected }: NodeProps<Node<FeatherNodeData>>) {
  const isSource = data.featherKind === 'source'
  const color = signalColor(data.signal)

  return (
    <div
      className="drag-handle"
      style={{
        position: 'relative',
        minWidth: 190,
        padding: '6px 22px',
        background: '#fff',
        border: selected ? `2px solid ${color}` : '1px solid transparent',
        cursor: 'grab',
        textAlign: isSource ? 'right' : 'left',
      }}
    >
      <Handle
        type={isSource ? 'source' : 'target'}
        position={isSource ? Position.Right : Position.Left}
        id="feather"
        style={{
          width: 10,
          height: 10,
          border: '1px solid white',
          background: color,
        }}
      />

      <div style={{ fontSize: 9, fontWeight: 800 }}>
        {data.remoteDevice || 'REMOTE DEVICE'}
      </div>
      <div style={{ fontSize: 8 }}>{data.remotePort || 'REMOTE PORT'}</div>

      <div
        style={{
          position: 'absolute',
          top: '50%',
          [isSource ? 'right' : 'left']: -18,
          width: 0,
          height: 0,
          transform: 'translateY(-50%)',
          borderTop: '7px solid transparent',
          borderBottom: '7px solid transparent',
          ...(isSource
            ? { borderLeft: `18px solid ${color}` }
            : { borderRight: `18px solid ${color}` }),
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: -12,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '1px 5px',
          background: '#fff',
          border: `1px solid ${color}`,
          fontSize: 9,
          fontWeight: 800,
          whiteSpace: 'nowrap',
        }}
      >
        {data.cableNumber}
      </div>
    </div>
  )
}

function BusNodeComponent({ data, selected }: NodeProps<Node<BusNodeData>>) {
  const color = signalColor(data.signal)
  const slots = Array.from({ length: data.slots }, (_, index) => index)

  return (
    <div
      className="drag-handle"
      style={{
        position: 'relative',
        width: 38,
        minHeight: Math.max(180, data.slots * 34),
        cursor: 'grab',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 22,
          bottom: 0,
          width: selected ? 4 : 3,
          transform: 'translateX(-50%)',
          background: color,
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '3px 7px',
          background: '#fff',
          border: `1px solid ${color}`,
          color: '#111827',
          fontSize: 9,
          fontWeight: 800,
          whiteSpace: 'nowrap',
        }}
      >
        {data.label}
      </div>

      {slots.map((slot) => {
        const top = 44 + slot * 34
        return (
          <div key={slot}>
            <div
              style={{
                position: 'absolute',
                top,
                left: '50%',
                width: 10,
                height: 10,
                borderRadius: '50%',
                transform: 'translate(-50%, -50%)',
                background: color,
              }}
            />
            <Handle
              type="target"
              position={Position.Left}
              id={`bus-left-${slot}`}
              style={{
                top,
                width: 10,
                height: 10,
                background: color,
                border: '1px solid white',
              }}
            />
            <Handle
              type="source"
              position={Position.Right}
              id={`bus-right-${slot}`}
              style={{
                top,
                width: 10,
                height: 10,
                background: color,
                border: '1px solid white',
              }}
            />
          </div>
        )
      })}
    </div>
  )
}

const nodeTypes = {
  device: DeviceNodeComponent,
  feather: FeatherNodeComponent,
  bus: BusNodeComponent,
}

function getNodeSignal(node: AppNode | undefined, handleId: string | null | undefined) {
  if (!node) return undefined

  if (node.data.kind === 'device') {
    const label = readPortLabel(handleId)
    return node.data.ports.find((port) => port.label === label)?.signal
  }

  return node.data.signal
}

function signalPrefix(signal: Signal) {
  switch (signal) {
    case 'DGV':
      return 'DV'
    case 'DAT':
      return 'N'
    case 'AUD':
      return 'A'
    case 'CTRL':
      return 'C'
    case 'PWR':
      return 'P'
    default:
      return 'X'
  }
}

function App() {
  const [projectData, setProjectData] = useState<ProjectData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toolMode, setToolMode] = useState<ToolMode>('select')
  const [selectedSignal, setSelectedSignal] = useState<Signal>('DGV')
  const [status, setStatus] = useState('Selecteer een gereedschap.')
  const [flowInstance, setFlowInstance] =
    useState<ReactFlowInstance<AppNode, CableEdge> | null>(null)

  const counters = useRef<Record<string, number>>({
    DGV: 4100,
    DAT: 100,
    AUD: 100,
    CTRL: 100,
    PWR: 100,
  })

  useEffect(() => {
    fetch('/data/project.json')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`JSON kon niet worden geladen: ${response.status}`)
        }
        return response.json()
      })
      .then((data: ProjectData) => setProjectData(data))
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Onbekende fout tijdens laden.',
        )
      })
  }, [])

  const initialNodes = useMemo<AppNode[]>(() => {
    if (!projectData) return []

    const typeMap = new Map(
      projectData.types.map((deviceType) => [
        `${deviceType.mfg}/${deviceType.model}`,
        deviceType,
      ]),
    )

    return projectData.devices.flatMap((device, index) => {
      const deviceType = typeMap.get(device.type_ref)
      if (!deviceType) return []

      const node: AppNode = {
        id: device.sysname,
        type: 'device',
        dragHandle: '.drag-handle',
        position: {
          x: (index % 2) * 560,
          y: Math.floor(index / 2) * 460,
        },
        data: {
          kind: 'device',
          sysname: device.sysname,
          manufacturer: deviceType.mfg,
          model: deviceType.model,
          description: deviceType.short_desc,
          location: device.location,
          rack: device.rack,
          ports: deviceType.ports,
        },
      }

      return [node]
    })
  }, [projectData])

  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<CableEdge>([])

  useEffect(() => {
    setNodes(initialNodes)
  }, [initialNodes, setNodes])

  const isValidConnection: IsValidConnection<CableEdge> = useCallback(
    (connection) => {
      if (
        !connection.source ||
        !connection.target ||
        connection.source === connection.target
      ) {
        return false
      }

      const sourceNode = nodes.find((node) => node.id === connection.source)
      const targetNode = nodes.find((node) => node.id === connection.target)
      const sourceSignal = getNodeSignal(sourceNode, connection.sourceHandle)
      const targetSignal = getNodeSignal(targetNode, connection.targetHandle)

      if (!sourceSignal || !targetSignal || sourceSignal !== targetSignal) {
        return false
      }

      return !edges.some(
        (edge) =>
          edge.target === connection.target &&
          edge.targetHandle === connection.targetHandle &&
          targetNode?.data.kind !== 'bus',
      )
    },
    [edges, nodes],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      const sourceNode = nodes.find((node) => node.id === connection.source)
      const targetNode = nodes.find((node) => node.id === connection.target)
      const signal = getNodeSignal(sourceNode, connection.sourceHandle)

      if (!signal || signal !== getNodeSignal(targetNode, connection.targetHandle)) {
        setStatus('Verbinding geweigerd: signalen zijn niet gelijk.')
        return
      }

      counters.current[signal] = (counters.current[signal] ?? 0) + 1
      const cableNumber = `${signalPrefix(signal)}${String(
        counters.current[signal],
      ).padStart(4, '0')}`

      const newEdge: CableEdge = {
        ...connection,
        id: `edge-${crypto.randomUUID()}`,
        type: 'smoothstep',
        label: cableNumber,
        data: { cableNumber, signal },
        style: {
          stroke: signalColor(signal),
          strokeWidth: 1.8,
        },
        labelStyle: {
          fill: '#111827',
          fontSize: 9,
          fontWeight: 800,
        },
        labelShowBg: true,
        labelBgPadding: [5, 3],
        labelBgBorderRadius: 1,
        labelBgStyle: {
          fill: '#fff',
          stroke: signalColor(signal),
        },
      }

      setEdges((currentEdges) => addEdge(newEdge, currentEdges))
      setStatus(`${cableNumber} aangemaakt.`)
    },
    [nodes, setEdges],
  )

  const placeNode = useCallback(
    (event: React.MouseEvent) => {
      if (!flowInstance || toolMode === 'select') return

      const position = flowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      if (toolMode === 'bus') {
        const label = window.prompt('Naam van de bus:', `${signalName(selectedSignal)} BUS`)
        if (!label) return

        setNodes((current) => [
          ...current,
          {
            id: `bus-${crypto.randomUUID()}`,
            type: 'bus',
            dragHandle: '.drag-handle',
            position,
            data: {
              kind: 'bus',
              label,
              signal: selectedSignal,
              slots: 12,
            },
          },
        ])
        setStatus(`${label} geplaatst. Verbind kabels met de buspunten.`)
      } else {
        const featherKind =
          toolMode === 'source-feather' ? 'source' : 'destination'
        const defaultNumber = `${signalPrefix(selectedSignal)}????`
        const cableNumber =
          window.prompt('Kabelnummer:', defaultNumber) || defaultNumber
        const remoteDevice =
          window.prompt('Apparaat aan de andere zijde:', 'REMOTE') || 'REMOTE'
        const remotePort =
          window.prompt('Poort aan de andere zijde:', 'PORT') || 'PORT'

        setNodes((current) => [
          ...current,
          {
            id: `feather-${crypto.randomUUID()}`,
            type: 'feather',
            dragHandle: '.drag-handle',
            position,
            data: {
              kind: 'feather',
              featherKind,
              cableNumber,
              remoteDevice,
              remotePort,
              signal: selectedSignal,
            },
          },
        ])
        setStatus(
          `${featherKind === 'source' ? 'Bron' : 'Doel'}-feather geplaatst.`,
        )
      }

      setToolMode('select')
    },
    [flowInstance, selectedSignal, setNodes, toolMode],
  )

  if (error) {
    return (
      <main>
        <h1>AV Engineering Platform</h1>
        <p>Fout: {error}</p>
      </main>
    )
  }

  if (!projectData) {
    return (
      <main>
        <h1>AV Engineering Platform</h1>
        <p>Project wordt geladen...</p>
      </main>
    )
  }

  const toolbarButton = (mode: ToolMode, label: string) => (
    <button
      type="button"
      onClick={() => {
        setToolMode(mode)
        setStatus(
          mode === 'select'
            ? 'Selecteren en verslepen.'
            : 'Klik op het canvas om het object te plaatsen.',
        )
      }}
      style={{
        padding: '7px 10px',
        border: toolMode === mode ? '2px solid #2563eb' : '1px solid #cbd5e1',
        borderRadius: 4,
        background: toolMode === mode ? '#eff6ff' : '#fff',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 12px',
          borderBottom: '1px solid #cbd5e1',
          background: '#fff',
        }}
      >
        <strong style={{ marginRight: 12 }}>AV Engineering Platform</strong>
        {toolbarButton('select', 'Select')}
        {toolbarButton('source-feather', 'Bron-feather')}
        {toolbarButton('destination-feather', 'Doel-feather')}
        {toolbarButton('bus', 'Bus')}

        <select
          value={selectedSignal}
          onChange={(event) => setSelectedSignal(event.target.value)}
          style={{ marginLeft: 8, padding: '7px 9px' }}
        >
          {SIGNAL_OPTIONS.map((signal) => (
            <option key={signal} value={signal}>
              {signalName(signal)}
            </option>
          ))}
        </select>

        <span style={{ marginLeft: 'auto', color: '#475569', fontSize: 12 }}>
          Devices: {nodes.filter((node) => node.data.kind === 'device').length} ·
          Kabels: {edges.length} · Bussen:{' '}
          {nodes.filter((node) => node.data.kind === 'bus').length}
        </span>
      </header>

      <div
        style={{
          padding: '6px 12px',
          borderBottom: '1px solid #cbd5e1',
          background: '#f8fafc',
          color: '#334155',
          fontSize: 11,
        }}
      >
        {status}
      </div>

      <div style={{ flex: 1 }}>
        <ReactFlow<AppNode, CableEdge>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onInit={setFlowInstance}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          onPaneClick={placeNode}
          connectionLineType={ConnectionLineType.SmoothStep}
          defaultEdgeOptions={{ type: 'smoothstep' }}
          fitView
          minZoom={0.15}
          maxZoom={2}
          deleteKeyCode={['Backspace', 'Delete']}
        >
          <Background gap={20} size={1} />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>
    </div>
  )
}

export default App
