import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {

  ReactFlow,
  useEdgesState,
  useNodesState,
  type ReactFlowInstance,
  type Viewport,
} from '@xyflow/react'

import '@xyflow/react/dist/style.css'
import './App.css'

import {
  DeviceNodeComponent,
  type DeviceNode,
} from './DeviceNode'
import {
  CableEdgeComponent,
  type CableEdge,
} from './CableEdge'
import {
  GraphicURouteNodeComponent,
  type GraphicURouteNode,
} from './GraphicURouteNode'
import {
  REACT_FLOW_CONFIG,
  REACT_FLOW_FIT_OPTIONS,
} from './canvas/ReactFlowConfig'

import { ReactFlowViewport } from './canvas/ReactFlowViewport'
import { CanvasView } from './canvas/CanvasView'
import { DeviceLibrary } from './DeviceLibrary'
import { DeviceInstanceEditor } from './DeviceInstanceEditor'
import { PdfExportDialog } from './PdfExportDialog'
import { SettingsDialog } from './SettingsDialog'
import { CableNumberEditor } from './CableNumberEditor'
import { LeftSidebar } from './layout/LeftSidebar'
import { RightSidebar } from './layout/RightSidebar'
import { Workspace } from './layout/Workspace'
import { Toolbar } from './layout/Toolbar'

import type {
  CableDisplayMode,
  CableNumberContext,
  Device,
  DeviceNodeData,
  DeviceType,
  Endpoint,
  EngineeringSettings,
  GraphicURouteNodeData,
  Port,
  ProjectData,
  Signal,
} from './types'

type AppNode = DeviceNode | GraphicURouteNode
type ToolMode = 'select' | 'place-graphic-route'

type MainView =
  | 'canvas'
  | 'device-library'
  | 'project'
  | 'reports'
  | 'settings'

type SavedDeviceNode = {
  id: string
  position: { x: number; y: number }
}

type SavedGraphicRouteNode = {
  id: string
  position: { x: number; y: number }
  data: {
    signal: Signal
    width: number
    leftHeight: number
    rightHeight: number
  }
}

type SavedProjectFile = {
  format: 'av-engineering-project'
  formatVersion: 1
  savedAt: string
  sourceProject: ProjectData['project']
  projectDevices: Device[]
  viewport: Viewport
  deviceNodes: SavedDeviceNode[]
  deletedDeviceIds: string[]
  graphicRoutes: SavedGraphicRouteNode[]
  edges: CableEdge[]
}

type RecentProjectRecord = {
  id: string
  name: string
  location: string
  updatedAt: string
  file: SavedProjectFile
}

type ProjectEditorValues = {
  name: string
  location: string
  created_by: string
  facility_id: number
}


type HistorySnapshot = {
  nodes: AppNode[]
  edges: CableEdge[]
}

const HISTORY_LIMIT = 100
const GLOBAL_LIBRARY_STORAGE_KEY = 'av-engineering-device-library-v1'
const RECENT_PROJECTS_STORAGE_KEY = 'av-engineering-recent-projects-v1'
const MAX_RECENT_PROJECTS = 10
const ENGINEERING_SETTINGS_STORAGE_KEY =
  'av-engineering-settings-v1'

const DEFAULT_ENGINEERING_SETTINGS: EngineeringSettings = {
  signalTypes: [
    {
      id: 'DGV',
      label: 'SDI',
      prefix: 'DV',
      startNumber: 1,
      nextNumber: 1,
    },
    {
      id: 'AUD',
      label: 'AES / Audio',
      prefix: 'A',
      startNumber: 1,
      nextNumber: 1,
    },
    {
      id: 'DAT',
      label: 'Ethernet',
      prefix: 'N',
      startNumber: 1,
      nextNumber: 1,
    },
    {
      id: 'CTRL',
      label: 'Control',
      prefix: 'C',
      startNumber: 1,
      nextNumber: 1,
    },
    {
      id: 'PWR',
      label: 'Power',
      prefix: 'P',
      startNumber: 1,
      nextNumber: 1,
    },
  ],
  connectors: [
    'BNC',
    'XLR3',
    'XLR5',
    'RJ45',
    'SFP',
    'SFP+',
    'LC',
    'SC',
    'HDMI',
    'DisplayPort',
    'USB-A',
    'USB-C',
    'IEC',
    'PowerCON',
  ],
  defaultCableDisplayMode: 'feather',
}

function cloneHistorySnapshot(
  nodes: AppNode[],
  edges: CableEdge[],
): HistorySnapshot {
  /*
   * structuredClone kan geen callbackfuncties kopiëren. Device- en
   * U-route-data bevatten callbacks, waardoor de vorige versie hier stopte.
   * React Flow werkt immutable, dus een gecontroleerde kopie is voldoende.
   */
  return {
    nodes: nodes.map((node) => ({
      ...node,
      position: { ...node.position },
      data: { ...node.data },
    })) as AppNode[],
    edges: edges.map((edge) => ({
      ...edge,
      data: edge.data ? { ...edge.data } : undefined,
      style: edge.style ? { ...edge.style } : undefined,
      labelStyle: edge.labelStyle
        ? { ...edge.labelStyle }
        : undefined,
      labelBgStyle: edge.labelBgStyle
        ? { ...edge.labelBgStyle }
        : undefined,
    })) as CableEdge[],
  }
}

function historySignature(
  nodes: AppNode[],
  edges: CableEdge[],
): string {
  return JSON.stringify({
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      selected: node.selected,
      data:
        node.type === 'graphic-u-route'
          ? {
              signal: node.data.signal,
              width: node.data.width,
              leftHeight: node.data.leftHeight,
              rightHeight: node.data.rightHeight,
            }
          : {
              sysname: node.data.sysname,
            },
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      sourceHandle: edge.sourceHandle,
      target: edge.target,
      targetHandle: edge.targetHandle,
      selected: edge.selected,
      data: edge.data,
    })),
  })
}

const nodeTypes = {
  device: DeviceNodeComponent,
  'graphic-u-route': GraphicURouteNodeComponent,
}

const edgeTypes = {
  cable: CableEdgeComponent,
}

function signalName(signal: Signal) {
  switch (signal) {
    case 'DGV': return 'DGV / SDI'
    case 'DAT': return 'DAT / Network'
    case 'AUD': return 'AUD / Audio'
    case 'CTRL': return 'CTRL / Control'
    case 'PWR': return '230VAC'
    default: return signal
  }
}

function generateCableNumber(
  context: CableNumberContext,
  settings: EngineeringSettings,
): {
  cableNumber: string
  signalId: string
  nextNumber: number
} {
  const signalDefinition = settings.signalTypes.find(
    (signal) => signal.id === context.sourcePort.signal,
  )

  const prefix = signalDefinition?.prefix || 'X'
  const configuredNext = signalDefinition?.nextNumber ?? 1

  const usedSequenceNumbers = context.existingNumbers
    .filter((number) => number.startsWith(prefix))
    .map((number) => Number(number.slice(prefix.length)))
    .filter(Number.isFinite)

  const nextSequence =
    usedSequenceNumbers.length === 0
      ? configuredNext
      : Math.max(
          configuredNext,
          Math.max(...usedSequenceNumbers) + 1,
        )

  return {
    cableNumber:
      `${prefix}${String(nextSequence).padStart(4, '0')}`,
    signalId: context.sourcePort.signal,
    nextNumber: nextSequence + 1,
  }
}

function portCanBeSource(port: Port) {
  return port.direction === 'O' || port.direction === 'L'
}

function portCanBeTarget(port: Port) {
  return port.direction === 'I' || port.direction === 'L'
}

function nextDisplayMode(mode: CableDisplayMode): CableDisplayMode {
  return mode === 'full' ? 'feather' : 'full'
}

function deviceTypeReference(deviceType: DeviceType) {
  return `${deviceType.mfg}/${deviceType.model}`
}

function mergeDeviceTypes(
  currentTypes: DeviceType[],
  incomingTypes: DeviceType[],
) {
  const map = new Map(
    currentTypes.map((deviceType) => [
      deviceTypeReference(deviceType),
      deviceType,
    ]),
  )

  incomingTypes.forEach((deviceType) => {
    map.set(deviceTypeReference(deviceType), deviceType)
  })

  return [...map.values()]
}

function loadGlobalDeviceLibrary(): DeviceType[] {
  try {
    const raw = window.localStorage.getItem(
      GLOBAL_LIBRARY_STORAGE_KEY,
    )

    if (!raw) return []

    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? (parsed as DeviceType[])
      : []
  } catch {
    return []
  }
}

function loadRecentProjects(): RecentProjectRecord[] {
  try {
    const raw = window.localStorage.getItem(
      RECENT_PROJECTS_STORAGE_KEY,
    )

    if (!raw) return []

    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? (parsed as RecentProjectRecord[])
      : []
  } catch {
    return []
  }
}

function createEmptyProjectData(
  values: ProjectEditorValues,
): ProjectData {
  return {
    project: {
      name: values.name,
      location: values.location,
      created_by: values.created_by,
      facility_id: values.facility_id,
    },
    types: [],
    devices: [],
  }
}

function loadEngineeringSettings(): EngineeringSettings {
  try {
    const raw = window.localStorage.getItem(
      ENGINEERING_SETTINGS_STORAGE_KEY,
    )

    if (!raw) return DEFAULT_ENGINEERING_SETTINGS

    const parsed = JSON.parse(raw) as Partial<EngineeringSettings>

    return {
      signalTypes:
        Array.isArray(parsed.signalTypes) &&
        parsed.signalTypes.length > 0
          ? parsed.signalTypes
          : DEFAULT_ENGINEERING_SETTINGS.signalTypes,
      connectors:
        Array.isArray(parsed.connectors) &&
        parsed.connectors.length > 0
          ? parsed.connectors
          : DEFAULT_ENGINEERING_SETTINGS.connectors,
      defaultCableDisplayMode:
        parsed.defaultCableDisplayMode === 'full'
          ? 'full'
          : 'feather',
    }
  } catch {
    return DEFAULT_ENGINEERING_SETTINGS
  }
}

function App() {
  const [projectData, setProjectData] = useState<ProjectData | null>(null)
  const [recentProjects, setRecentProjects] = useState<RecentProjectRecord[]>(
    () => loadRecentProjects(),
  )
  const [showProjectEditor, setShowProjectEditor] = useState(false)
  const [projectEditorMode, setProjectEditorMode] =
    useState<'new' | 'edit'>('edit')
  const [projectEditorValues, setProjectEditorValues] =
    useState<ProjectEditorValues>({
      name: '',
      location: '',
      created_by: '',
      facility_id: 0,
    })
  const [showRecentProjects, setShowRecentProjects] = useState(false)
  const [showReports, setShowReports] = useState(false)
  const [showPdfExport, setShowPdfExport] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showCableEditor, setShowCableEditor] = useState(false)
  const [engineeringSettings, setEngineeringSettings] =
    useState<EngineeringSettings>(() => loadEngineeringSettings())

  const [mainView, setMainView] = useState<MainView>('canvas')




  const [libraryTypes, setLibraryTypes] = useState<DeviceType[]>(
    () => loadGlobalDeviceLibrary(),
  )
  const [projectDevices, setProjectDevices] = useState<Device[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selectedSource, setSelectedSource] = useState<Endpoint | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null)
  const [deletedDeviceIds, setDeletedDeviceIds] = useState<string[]>([])
  const [toolMode, setToolMode] = useState<ToolMode>('select')
  const [routeSignal, setRouteSignal] = useState<Signal>('DGV')
  const [flowInstance, setFlowInstance] =
    useState<ReactFlowInstance<AppNode, CableEdge> | null>(null)
  const [viewportZoom, setViewportZoom] = useState(1)


  const openProjectInputRef = useRef<HTMLInputElement | null>(null)

  const undoStackRef = useRef<HistorySnapshot[]>([])
  const redoStackRef = useRef<HistorySnapshot[]>([])
  const lastStableSnapshotRef = useRef<HistorySnapshot | null>(null)
  const lastSignatureRef = useRef<string>('')
  const historyTimerRef = useRef<number | null>(null)
  const applyingHistoryRef = useRef(false)

  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const [status, setStatus] = useState(
    'Klik eerst op een uitgang en daarna op een ingang.',
  )

  useEffect(() => {
    window.localStorage.setItem(
      GLOBAL_LIBRARY_STORAGE_KEY,
      JSON.stringify(libraryTypes),
    )
  }, [libraryTypes])

  useEffect(() => {
    window.localStorage.setItem(
      RECENT_PROJECTS_STORAGE_KEY,
      JSON.stringify(recentProjects),
    )
  }, [recentProjects])

  useEffect(() => {
    window.localStorage.setItem(
      ENGINEERING_SETTINGS_STORAGE_KEY,
      JSON.stringify(engineeringSettings),
    )
  }, [engineeringSettings])

  useEffect(() => {
    fetch('/data/project.json')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`JSON kon niet worden geladen: ${response.status}`)
        }

        return response.json()
      })
      .then((data: ProjectData) => {
        setProjectData(data)
        setLibraryTypes((current) =>
          mergeDeviceTypes(current, data.types),
        )
        setProjectDevices(data.devices)
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Onbekende fout tijdens laden.',
        )
      })
  }, [])

  const baseNodes = useMemo<DeviceNode[]>(() => {
    if (!projectData) return []

    const typeMap = new Map(
      libraryTypes.map((deviceType) => [
        `${deviceType.mfg}/${deviceType.model}`,
        deviceType,
      ]),
    )

    return projectDevices.flatMap((device, index) => {
      const deviceType = typeMap.get(device.type_ref)
      if (!deviceType) return []

      const data: DeviceNodeData = {
        sysname: device.sysname,
        manufacturer: deviceType.mfg,
        model: deviceType.model,
        description: deviceType.short_desc,
        location: device.location,
        rack: device.rack,
        ports: deviceType.ports,
        selectedSource: null,
        onPortClick: () => undefined,
      }

      return [{
        id: device.sysname,
        type: 'device',
        dragHandle: '.drag-handle',
        position: {
          x: (index % 2) * 620,
          y: Math.floor(index / 2) * 480,
        },
        data,
      }]
    })
  }, [libraryTypes, projectData, projectDevices])

  const [nodes, setNodes, onNodesChange] =
    useNodesState<AppNode>([])
  const [edges, setEdges, onEdgesChange] =
    useEdgesState<CableEdge>([])


  const updateHistoryButtons = useCallback(() => {
    setCanUndo(undoStackRef.current.length > 0)
    setCanRedo(redoStackRef.current.length > 0)
  }, [])

  const resetHistory = useCallback(
    (currentNodes: AppNode[], currentEdges: CableEdge[]) => {
      undoStackRef.current = []
      redoStackRef.current = []
      lastStableSnapshotRef.current =
        cloneHistorySnapshot(currentNodes, currentEdges)
      lastSignatureRef.current =
        historySignature(currentNodes, currentEdges)
      updateHistoryButtons()
    },
    [updateHistoryButtons],
  )

  /*
   * Wijzigingen worden pas na een korte rustige periode als één handeling
   * opgeslagen. Daardoor telt een complete sleepbeweging of het verstellen
   * van een U-lijn als één Undo-stap, niet als tientallen muisbewegingen.
   */
  useEffect(() => {
    if (applyingHistoryRef.current) return

    const signature = historySignature(nodes, edges)

    if (!lastStableSnapshotRef.current) {
      lastStableSnapshotRef.current =
        cloneHistorySnapshot(nodes, edges)
      lastSignatureRef.current = signature
      return
    }

    if (signature === lastSignatureRef.current) return

    if (historyTimerRef.current !== null) {
      window.clearTimeout(historyTimerRef.current)
    }

    historyTimerRef.current = window.setTimeout(() => {
      const previous = lastStableSnapshotRef.current

      if (previous) {
        undoStackRef.current = [
          ...undoStackRef.current,
          previous,
        ].slice(-HISTORY_LIMIT)
      }

      redoStackRef.current = []
      lastStableSnapshotRef.current =
        cloneHistorySnapshot(nodes, edges)
      lastSignatureRef.current =
        historySignature(nodes, edges)
      updateHistoryButtons()
      historyTimerRef.current = null
    }, 350)

    return () => {
      if (historyTimerRef.current !== null) {
        window.clearTimeout(historyTimerRef.current)
        historyTimerRef.current = null
      }
    }
  }, [edges, nodes, updateHistoryButtons])

  const applyHistorySnapshot = useCallback(
    (snapshot: HistorySnapshot) => {
      applyingHistoryRef.current = true

      setNodes(snapshot.nodes)
      setEdges(snapshot.edges)
      setDeletedDeviceIds(
        baseNodes
          .filter(
            (baseNode) =>
              !snapshot.nodes.some((node) => node.id === baseNode.id),
          )
          .map((node) => node.id),
      )
      setSelectedSource(null)
      setSelectedEdgeId(null)
      setSelectedNodeId(null)
      setToolMode('select')

      lastStableSnapshotRef.current =
        cloneHistorySnapshot(snapshot.nodes, snapshot.edges)
      lastSignatureRef.current =
        historySignature(snapshot.nodes, snapshot.edges)

      window.requestAnimationFrame(() => {
        applyingHistoryRef.current = false
      })
    },
    [baseNodes, setEdges, setNodes],
  )

  const undo = useCallback(() => {
    const previous = undoStackRef.current.at(-1)
    if (!previous) return

    const current =
      lastStableSnapshotRef.current ??
      cloneHistorySnapshot(nodes, edges)

    undoStackRef.current = undoStackRef.current.slice(0, -1)
    redoStackRef.current = [
      ...redoStackRef.current,
      current,
    ].slice(-HISTORY_LIMIT)

    applyHistorySnapshot(previous)
    updateHistoryButtons()
    setStatus('Laatste wijziging ongedaan gemaakt.')
  }, [
    applyHistorySnapshot,
    edges,
    nodes,
    updateHistoryButtons,
  ])

  const redo = useCallback(() => {
    const next = redoStackRef.current.at(-1)
    if (!next) return

    const current =
      lastStableSnapshotRef.current ??
      cloneHistorySnapshot(nodes, edges)

    redoStackRef.current = redoStackRef.current.slice(0, -1)
    undoStackRef.current = [
      ...undoStackRef.current,
      current,
    ].slice(-HISTORY_LIMIT)

    applyHistorySnapshot(next)
    updateHistoryButtons()
    setStatus('Wijziging opnieuw uitgevoerd.')
  }, [
    applyHistorySnapshot,
    edges,
    nodes,
    updateHistoryButtons,
  ])

  const createCable = useCallback(
    (source: Endpoint, target: Endpoint) => {
      if (!portCanBeSource(source.port)) {
        setStatus(`${source.deviceId}/${source.port.label} is geen uitgang.`)
        return
      }

      if (!portCanBeTarget(target.port)) {
        setStatus(`${target.deviceId}/${target.port.label} is geen ingang.`)
        return
      }

      if (source.deviceId === target.deviceId) {
        setStatus('Bron en bestemming mogen niet hetzelfde apparaat zijn.')
        return
      }

      if (source.port.signal !== target.port.signal) {
        setStatus(
          `Verbinding geweigerd: ${source.port.signal} past niet op ${target.port.signal}.`,
        )
        return
      }

      const inputOccupied = edges.some(
        (edge) =>
          edge.target === target.deviceId &&
          edge.targetHandle === `port:${target.port.label}`,
      )

      if (inputOccupied) {
        setStatus(`${target.deviceId}/${target.port.label} is al aangesloten.`)
        return
      }

      const generatedCableNumber = generateCableNumber(
        {
          sourceDevice: source.deviceId,
          sourcePort: source.port,
          targetDevice: target.deviceId,
          targetPort: target.port,
          existingNumbers: edges.flatMap((edge) =>
            edge.data?.cableNumber ? [edge.data.cableNumber] : [],
          ),
        },
        engineeringSettings,
      )

      const cableNumber = generatedCableNumber.cableNumber

      setEngineeringSettings((current) => ({
        ...current,
        signalTypes: current.signalTypes.map((signal) =>
          signal.id === generatedCableNumber.signalId
            ? {
                ...signal,
                nextNumber: generatedCableNumber.nextNumber,
              }
            : signal,
        ),
      }))

      const edge: CableEdge = {
        id: `cable-${crypto.randomUUID()}`,
        type: 'cable',
        source: source.deviceId,
        sourceHandle: `port:${source.port.label}`,
        target: target.deviceId,
        targetHandle: `port:${target.port.label}`,
        data: {
          cableNumber,
          signal: source.port.signal,
          displayMode: engineeringSettings.defaultCableDisplayMode,
          sourceDevice: source.deviceId,
          sourcePort: source.port.label,
          sourceConnector: source.port.connector,
          targetDevice: target.deviceId,
          targetPort: target.port.label,
          targetConnector: target.port.connector,
          featherLane: 0,
        },
      }

      setEdges((current) => [...current, edge])
      setSelectedSource(null)
      setSelectedEdgeId(edge.id)
      setStatus(
        `${cableNumber}: ${source.deviceId}/${source.port.label} → ` +
          `${target.deviceId}/${target.port.label}`,
      )
    },
    [edges, engineeringSettings, setEdges],
  )

  const onPortClick = useCallback(
    (endpoint: Endpoint) => {
      if (toolMode !== 'select') {
        setStatus('Kies eerst Select om een kabel te maken.')
        return
      }

      if (!selectedSource) {
        if (!portCanBeSource(endpoint.port)) {
          setStatus('Klik eerst op een uitgang.')
          return
        }

        setSelectedSource(endpoint)
        setStatus(
          `Bron gekozen: ${endpoint.deviceId}/${endpoint.port.label}. ` +
            'Klik nu op een ingang.',
        )
        return
      }

      if (
        selectedSource.deviceId === endpoint.deviceId &&
        selectedSource.port.label === endpoint.port.label
      ) {
        setSelectedSource(null)
        setStatus('Bronselectie geannuleerd.')
        return
      }

      if (portCanBeSource(endpoint.port) && !portCanBeTarget(endpoint.port)) {
        setSelectedSource(endpoint)
        setStatus(
          `Nieuwe bron gekozen: ${endpoint.deviceId}/${endpoint.port.label}.`,
        )
        return
      }

      createCable(selectedSource, endpoint)
    },
    [createCable, selectedSource, toolMode],
  )

  const changeRouteGeometry = useCallback(
    (
      nodeId: string,
      geometry: {
        width?: number
        leftHeight?: number
        rightHeight?: number
      },
    ) => {
      setNodes((current) =>
        current.map((node) => {
          if (node.id !== nodeId || node.type !== 'graphic-u-route') {
            return node
          }

          const data = node.data as GraphicURouteNodeData

          return {
            ...node,
            data: {
              ...data,
              width: geometry.width ?? data.width,
              leftHeight: geometry.leftHeight ?? data.leftHeight,
              rightHeight: geometry.rightHeight ?? data.rightHeight,
            },
          }
        }),
      )
    },
    [setNodes],
  )

  useEffect(() => {
    setNodes((currentNodes) => {
      const routeNodes = currentNodes
        .filter((node) => node.type === 'graphic-u-route')
        .map((node) => ({
          ...node,
          data: {
            ...(node.data as GraphicURouteNodeData),
            onChangeGeometry: changeRouteGeometry,
          },
        }))

      const mergedDeviceNodes = baseNodes
        .filter((baseNode) => !deletedDeviceIds.includes(baseNode.id))
        .map((baseNode) => {
        const existingNode = currentNodes.find(
          (node) => node.id === baseNode.id,
        )

        if (!existingNode) {
          return {
            ...baseNode,
            data: {
              ...baseNode.data,
              selectedSource,
              onPortClick,
            },
          }
        }

        return {
          ...existingNode,
          type: baseNode.type,
          dragHandle: baseNode.dragHandle,
          data: {
            ...baseNode.data,
            selectedSource,
            onPortClick,
          },
        }
      })

      return [...mergedDeviceNodes, ...routeNodes]
    })
  }, [
    baseNodes,
    changeRouteGeometry,
    deletedDeviceIds,
    onPortClick,
    selectedSource,
    setNodes,
  ])

  const setSelectedCableMode = useCallback(
    (displayMode: CableDisplayMode) => {
      if (!selectedEdgeId) {
        setStatus('Selecteer eerst een kabel.')
        return
      }

      setEdges((current) =>
        current.map((edge) =>
          edge.id === selectedEdgeId && edge.data
            ? {
                ...edge,
                data: {
                  ...edge.data,
                  displayMode,
                },
              }
            : edge,
        ),
      )
    },
    [selectedEdgeId, setEdges],
  )

  const placeGraphicRoute = useCallback(
    (event: React.MouseEvent) => {
      if (toolMode !== 'place-graphic-route' || !flowInstance) return

      const position = flowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const routeNode: GraphicURouteNode = {
        id: `graphic-route-${crypto.randomUUID()}`,
        type: 'graphic-u-route',
        dragHandle: '.drag-handle',
        position,
        data: {
          signal: routeSignal,
          width: 420,
          leftHeight: 240,
          rightHeight: 170,
          onChangeGeometry: changeRouteGeometry,
        },
      }

      setNodes((current) => [...current, routeNode])
      setToolMode('select')
      setStatus(
        'Grafische U-route geplaatst. Selecteer hem om de vier punten te zien.',
      )
    },
    [
      changeRouteGeometry,
      flowInstance,
      routeSignal,
      setNodes,
      toolMode,
    ],
  )

  const updateDeviceInstance = useCallback(
    (
      originalSysname: string,
      updatedDevice: Device,
    ) => {
      const originalNode = nodes.find(
        (node) => node.id === originalSysname,
      )

      setProjectDevices((current) =>
        current.map((device) =>
          device.sysname === originalSysname
            ? updatedDevice
            : device,
        ),
      )

      setDeletedDeviceIds((current) =>
        current.filter(
          (id) =>
            id !== originalSysname &&
            id !== updatedDevice.sysname,
        ),
      )

      setEdges((current) =>
        current.map((edge) => {
          const sourceChanged = edge.source === originalSysname
          const targetChanged = edge.target === originalSysname

          if (!sourceChanged && !targetChanged) return edge

          return {
            ...edge,
            source: sourceChanged
              ? updatedDevice.sysname
              : edge.source,
            target: targetChanged
              ? updatedDevice.sysname
              : edge.target,
            data: edge.data
              ? {
                  ...edge.data,
                  sourceDevice: sourceChanged
                    ? updatedDevice.sysname
                    : edge.data.sourceDevice,
                  targetDevice: targetChanged
                    ? updatedDevice.sysname
                    : edge.data.targetDevice,
                }
              : edge.data,
          }
        }),
      )

      if (originalSysname !== updatedDevice.sysname) {
        setNodes((current) =>
          current.map((node) =>
            node.id === originalSysname
              ? {
                  ...node,
                  id: updatedDevice.sysname,
                  position:
                    originalNode?.position ?? node.position,
                }
              : node,
          ),
        )
      }

      setSelectedNodeId(updatedDevice.sysname)
      setEditingDeviceId(null)
      setStatus(
        `Apparaat ${updatedDevice.sysname} bijgewerkt.`,
      )
    },
    [nodes, setEdges, setNodes],
  )

  const createDeviceType = useCallback(
    (deviceType: DeviceType) => {
      setLibraryTypes((current) => [...current, deviceType])
      setStatus(
        `Apparaattype ${deviceType.mfg}/${deviceType.model} aangemaakt.`,
      )
    },
    [],
  )

  const updateDeviceType = useCallback(
    (
      originalTypeRef: string,
      updatedType: DeviceType,
    ) => {
      const updatedReference =
        `${updatedType.mfg}/${updatedType.model}`

      setLibraryTypes((current) =>
        current.map((deviceType) =>
          `${deviceType.mfg}/${deviceType.model}` === originalTypeRef
            ? updatedType
            : deviceType,
        ),
      )

      if (updatedReference !== originalTypeRef) {
        setProjectDevices((current) =>
          current.map((device) =>
            device.type_ref === originalTypeRef
              ? {
                  ...device,
                  type_ref: updatedReference,
                }
              : device,
          ),
        )
      }

      setStatus(`Apparaattype ${updatedReference} bijgewerkt.`)
    },
    [],
  )

  const importLibraryJson = useCallback(
    (
      importedTypes: DeviceType[],
      importedDevices: Device[],
    ) => {
      setLibraryTypes((current) => {
        const map = new Map(
          current.map((deviceType) => [
            `${deviceType.mfg}/${deviceType.model}`,
            deviceType,
          ]),
        )

        importedTypes.forEach((deviceType) => {
          map.set(
            `${deviceType.mfg}/${deviceType.model}`,
            deviceType,
          )
        })

        return [...map.values()]
      })

      setProjectDevices((current) => {
        const map = new Map(
          current.map((device) => [device.sysname, device]),
        )

        importedDevices.forEach((device) => {
          map.set(device.sysname, device)
        })

        return [...map.values()]
      })

      setDeletedDeviceIds((current) =>
        current.filter(
          (deletedId) =>
            !importedDevices.some(
              (device) => device.sysname === deletedId,
            ),
        ),
      )

      setStatus(
        `${importedTypes.length} type(s) en ` +
          `${importedDevices.length} device(s) geïmporteerd.`,
      )
    },
    [],
  )

  const deleteDeviceType = useCallback(
    (reference: string) => {
      const inUse = projectDevices.some(
        (device) => device.type_ref === reference,
      )

      if (inUse) {
        setStatus(
          `Type ${reference} kan niet worden verwijderd: het wordt gebruikt.`,
        )
        return
      }

      setLibraryTypes((current) =>
        current.filter(
          (deviceType) =>
            `${deviceType.mfg}/${deviceType.model}` !== reference,
        ),
      )
      setStatus(`Apparaattype ${reference} verwijderd.`)
    },
    [projectDevices],
  )

  const placeLibraryDevice = useCallback(
    (device: Device) => {
      if (!flowInstance) {
        setStatus('Het canvas is nog niet gereed.')
        return
      }

      const position = flowInstance.screenToFlowPosition({
        x: window.innerWidth * 0.62,
        y: window.innerHeight * 0.5,
      })

      setProjectDevices((current) => [...current, device])
      setDeletedDeviceIds((current) =>
        current.filter((id) => id !== device.sysname),
      )

      // De baseNodes-effect maakt het device aan; daarna corrigeren we de
      // positie naar het midden van het zichtbare canvas.
      window.setTimeout(() => {
        setNodes((current) =>
          current.map((node) =>
            node.id === device.sysname
              ? { ...node, position }
              : node,
          ),
        )
      }, 0)

      setStatus(`${device.sysname} op het canvas geplaatst.`)
    },
    [flowInstance, setNodes],
  )

  const deleteSelected = useCallback(() => {
    if (selectedEdgeId) {
      const edge = edges.find((item) => item.id === selectedEdgeId)

      setEdges((current) =>
        current.filter((item) => item.id !== selectedEdgeId),
      )
      setSelectedEdgeId(null)
      setStatus(
        `Kabel ${edge?.data?.cableNumber ?? selectedEdgeId} verwijderd.`,
      )
      return
    }

    if (selectedNodeId) {
      const node = nodes.find((item) => item.id === selectedNodeId)

      if (!node) {
        setSelectedNodeId(null)
        return
      }

      if (node.type === 'device') {
        const connectedEdges = edges.filter(
          (edge) =>
            edge.source === selectedNodeId ||
            edge.target === selectedNodeId,
        )

        const confirmed = window.confirm(
          connectedEdges.length > 0
            ? `Apparaat ${node.id} verwijderen? Ook ${connectedEdges.length} aangesloten kabel(s) worden verwijderd.`
            : `Apparaat ${node.id} verwijderen?`,
        )

        if (!confirmed) return

        setEdges((current) =>
          current.filter(
            (edge) =>
              edge.source !== selectedNodeId &&
              edge.target !== selectedNodeId,
          ),
        )
        setDeletedDeviceIds((current) =>
          current.includes(selectedNodeId)
            ? current
            : [...current, selectedNodeId],
        )
        setProjectDevices((current) =>
          current.filter((device) => device.sysname !== selectedNodeId),
        )
        setNodes((current) =>
          current.filter((item) => item.id !== selectedNodeId),
        )
        setSelectedNodeId(null)
        setStatus(`Apparaat ${node.id} verwijderd.`)
        return
      }

      if (node.type === 'graphic-u-route') {
        setNodes((current) =>
          current.filter((item) => item.id !== selectedNodeId),
        )
        setSelectedNodeId(null)
        setStatus('U-lijn verwijderd.')
      }
    }
  }, [
    edges,
    nodes,
    selectedEdgeId,
    selectedNodeId,
    setEdges,
    setNodes,
  ])

  /*
   * Dit effect staat bewust ná deleteSelected.
   * In de vorige versie werd deleteSelected eerder in App uitgelezen dan
   * de const was geïnitialiseerd. Dat veroorzaakte de witte pagina.
   */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable

      if (isTyping) return

      if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        (selectedEdgeId || selectedNodeId)
      ) {
        event.preventDefault()
        deleteSelected()
        return
      }

      const modifier = event.ctrlKey || event.metaKey
      if (!modifier) return

      if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault()
        undo()
        return
      }

      if (
        event.key.toLowerCase() === 'y' ||
        (event.key.toLowerCase() === 'z' && event.shiftKey)
      ) {
        event.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [
    deleteSelected,
    redo,
    selectedEdgeId,
    selectedNodeId,
    undo,
  ])

  const downloadTextFile = useCallback(
    (
      filename: string,
      content: string,
      mimeType = 'text/plain;charset=utf-8',
    ) => {
      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')

      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    },
    [],
  )

  const csvValue = useCallback((value: unknown) => {
    const text = value === undefined || value === null
      ? ''
      : String(value)

    return `"${text.replaceAll('"', '""')}"`
  }, [])

  const safeProjectFilename = useCallback(() => {
    const projectName = projectData?.project.name ?? 'av-project'

    return projectName
      .trim()
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'av-project'
  }, [projectData])

  const exportDeviceList = useCallback(() => {
    if (!projectData) return

    const typeMap = new Map(
      libraryTypes.map((deviceType) => [
        `${deviceType.mfg}/${deviceType.model}`,
        deviceType,
      ]),
    )

    const header = [
      'System name',
      'Manufacturer',
      'Model',
      'Description',
      'Location',
      'Rack',
      'Rack level',
      'Type reference',
    ]

    const rows = projectDevices.map((device) => {
      const deviceType = typeMap.get(device.type_ref)

      return [
        device.sysname,
        deviceType?.mfg ?? '',
        deviceType?.model ?? '',
        deviceType?.short_desc ?? '',
        device.location,
        device.rack,
        device.rack_level ?? '',
        device.type_ref,
      ]
    })

    const csv = [header, ...rows]
      .map((row) => row.map(csvValue).join(','))
      .join('\r\n')

    downloadTextFile(
      `${safeProjectFilename()}-device-list.csv`,
      csv,
      'text/csv;charset=utf-8',
    )
    setStatus(`${rows.length} apparaten geëxporteerd.`)
  }, [
    csvValue,
    downloadTextFile,
    libraryTypes,
    projectData,
    projectDevices,
    safeProjectFilename,
  ])

  const exportCableList = useCallback(() => {
    const header = [
      'Cable number',
      'Signal',
      'Source device',
      'Source port',
      'Target device',
      'Target port',
      'Display mode',
    ]

    const rows = edges.map((edge) => [
      edge.data?.cableNumber ?? edge.id,
      edge.data?.signal ?? '',
      edge.data?.sourceDevice ?? edge.source,
      edge.data?.sourcePort ?? edge.sourceHandle ?? '',
      edge.data?.targetDevice ?? edge.target,
      edge.data?.targetPort ?? edge.targetHandle ?? '',
      edge.data?.displayMode ?? '',
    ])

    const csv = [header, ...rows]
      .map((row) => row.map(csvValue).join(','))
      .join('\r\n')

    downloadTextFile(
      `${safeProjectFilename()}-cable-list.csv`,
      csv,
      'text/csv;charset=utf-8',
    )
    setStatus(`${rows.length} kabels geëxporteerd.`)
  }, [
    csvValue,
    downloadTextFile,
    edges,
    safeProjectFilename,
  ])

  const exportIoList = useCallback(() => {
    const typeMap = new Map(
      libraryTypes.map((deviceType) => [
        `${deviceType.mfg}/${deviceType.model}`,
        deviceType,
      ]),
    )

    const connectionMap = new Map<string, CableEdge>()

    edges.forEach((edge) => {
      if (edge.data?.sourcePort) {
        connectionMap.set(
          `${edge.source}::${edge.data.sourcePort}`,
          edge,
        )
      }

      if (edge.data?.targetPort) {
        connectionMap.set(
          `${edge.target}::${edge.data.targetPort}`,
          edge,
        )
      }
    })

    const header = [
      'Device',
      'Type',
      'Port',
      'Direction',
      'Signal',
      'Connector',
      'Position',
      'Connected',
      'Cable number',
      'Remote device',
      'Remote port',
    ]

    const rows: Array<Array<string | number>> = []

    projectDevices.forEach((device) => {
      const deviceType = typeMap.get(device.type_ref)
      if (!deviceType) return

      ;[...deviceType.ports]
        .sort((a, b) => a.pos - b.pos)
        .forEach((port) => {
          const edge = connectionMap.get(
            `${device.sysname}::${port.label}`,
          )

          const isSource =
            edge?.source === device.sysname &&
            edge.data?.sourcePort === port.label

          rows.push([
            device.sysname,
            device.type_ref,
            port.label,
            port.direction,
            port.signal,
            port.connector,
            port.pos,
            edge ? 'Yes' : 'No',
            edge?.data?.cableNumber ?? '',
            edge
              ? isSource
                ? edge.data?.targetDevice ?? edge.target
                : edge.data?.sourceDevice ?? edge.source
              : '',
            edge
              ? isSource
                ? edge.data?.targetPort ?? ''
                : edge.data?.sourcePort ?? ''
              : '',
          ])
        })
    })

    const csv = [header, ...rows]
      .map((row) => row.map(csvValue).join(','))
      .join('\r\n')

    downloadTextFile(
      `${safeProjectFilename()}-io-list.csv`,
      csv,
      'text/csv;charset=utf-8',
    )
    setStatus(`${rows.length} I/O-regels geëxporteerd.`)
  }, [
    csvValue,
    downloadTextFile,
    edges,
    libraryTypes,
    projectDevices,
    safeProjectFilename,
  ])

  const saveEditedCableNumber = useCallback(
    (
      edgeId: string,
      newCableNumber: string,
      prefix: string,
      numericValue: number,
    ) => {
      const edge = edges.find((item) => item.id === edgeId)

      if (!edge?.data) {
        setStatus('De geselecteerde kabel kon niet worden gevonden.')
        return
      }

      const signalId = edge.data.signal

      setEdges((current) =>
        current.map((item) =>
          item.id === edgeId && item.data
            ? {
                ...item,
                data: {
                  ...item.data,
                  cableNumber: newCableNumber,
                },
              }
            : item,
        ),
      )

      /*
       * Het handmatig ingevoerde nummer wordt het nieuwe startpunt.
       * De eerstvolgende automatisch gegenereerde kabel wordt +1.
       * Als de gebruiker ook een andere prefix invoert, wordt die prefix
       * voortaan voor dit signaaltype gebruikt.
       */
      setEngineeringSettings((current) => ({
        ...current,
        signalTypes: current.signalTypes.map((signal) =>
          signal.id === signalId
            ? {
                ...signal,
                prefix,
                startNumber: numericValue,
                nextNumber: numericValue + 1,
              }
            : signal,
        ),
      }))

      setStatus(
        `${newCableNumber} opgeslagen. ` +
          `De volgende ${signalId}-kabel krijgt nummer ${prefix}${String(
            numericValue + 1,
          ).padStart(4, '0')}.`,
      )
    },
    [edges, setEdges],
  )

  const buildProjectFile = useCallback((): SavedProjectFile | null => {
    if (!projectData || !flowInstance) return null

    const deviceNodes: SavedDeviceNode[] = nodes
      .filter((node): node is DeviceNode => node.type === 'device')
      .map((node) => ({
        id: node.id,
        position: node.position,
      }))

    const graphicRoutes: SavedGraphicRouteNode[] = nodes
      .filter(
        (node): node is GraphicURouteNode =>
          node.type === 'graphic-u-route',
      )
      .map((node) => ({
        id: node.id,
        position: node.position,
        data: {
          signal: node.data.signal,
          width: node.data.width,
          leftHeight: node.data.leftHeight,
          rightHeight: node.data.rightHeight,
        },
      }))

    return {
      format: 'av-engineering-project',
      formatVersion: 1,
      savedAt: new Date().toISOString(),
      sourceProject: projectData.project,
      projectDevices,
      viewport: flowInstance.getViewport(),
      deviceNodes,
      deletedDeviceIds,
      graphicRoutes,
      edges,
    }
  }, [
    deletedDeviceIds,
    edges,
    flowInstance,
    nodes,
    projectData,
    projectDevices,
  ])

  const rememberCurrentProject = useCallback(
    (projectFile: SavedProjectFile) => {
      const id = [
        projectFile.sourceProject.name,
        projectFile.sourceProject.location,
      ]
        .join('::')
        .toLowerCase()

      const record: RecentProjectRecord = {
        id,
        name: projectFile.sourceProject.name,
        location: projectFile.sourceProject.location,
        updatedAt: projectFile.savedAt,
        file: projectFile,
      }

      setRecentProjects((current) => [
        record,
        ...current.filter((item) => item.id !== id),
      ].slice(0, MAX_RECENT_PROJECTS))
    },
    [],
  )

  const startNewProject = useCallback(() => {
    setProjectEditorMode('new')
    setProjectEditorValues({
      name: 'Nieuw project',
      location: '',
      created_by: projectData?.project.created_by ?? '',
      facility_id: 0,
    })
    setShowProjectEditor(true)
  }, [projectData])

  const editProjectDetails = useCallback(() => {
    if (!projectData) return

    setProjectEditorMode('edit')
    setProjectEditorValues({
      name: projectData.project.name,
      location: projectData.project.location,
      created_by: projectData.project.created_by,
      facility_id: projectData.project.facility_id,
    })
    setShowProjectEditor(true)
  }, [projectData])

  const applyProjectEditor = useCallback(() => {
    const cleanName = projectEditorValues.name.trim()

    if (!cleanName) {
      setStatus('Projectnaam is verplicht.')
      return
    }

    const values: ProjectEditorValues = {
      ...projectEditorValues,
      name: cleanName,
      location:
        projectEditorValues.location.trim() || 'Onbekend',
      created_by:
        projectEditorValues.created_by.trim() || 'Onbekend',
      facility_id: Number.isFinite(projectEditorValues.facility_id)
        ? projectEditorValues.facility_id
        : 0,
    }

    if (projectEditorMode === 'new') {
      const newProject = createEmptyProjectData(values)

      applyingHistoryRef.current = true
      setProjectData(newProject)
      setProjectDevices([])
      setDeletedDeviceIds([])
      setNodes([])
      setEdges([])
      setSelectedSource(null)
      setSelectedEdgeId(null)
      setSelectedNodeId(null)
      setEditingDeviceId(null)
      setToolMode('select')
      resetHistory([], [])

      window.requestAnimationFrame(() => {
        flowInstance?.setViewport({
          x: 0,
          y: 0,
          zoom: 1,
        })
        applyingHistoryRef.current = false
      })

      setStatus(`Nieuw project "${values.name}" aangemaakt.`)
    } else {
      setProjectData((current) =>
        current
          ? {
              ...current,
              project: {
                ...current.project,
                ...values,
              },
            }
          : current,
      )
      setStatus('Projectgegevens bijgewerkt.')
    }

    setShowProjectEditor(false)
  }, [
    flowInstance,
    projectEditorMode,
    projectEditorValues,
    resetHistory,
    setEdges,
    setNodes,
  ])

  const saveProject = useCallback(() => {
    const file = buildProjectFile()

    if (!file || !projectData) {
      setStatus('Het project kan nog niet worden opgeslagen.')
      return
    }

    rememberCurrentProject(file)

    const safeProjectName = projectData.project.name
      .trim()
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'av-project'

    const blob = new Blob(
      [JSON.stringify(file, null, 2)],
      { type: 'application/json' },
    )
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')

    anchor.href = url
    anchor.download = `${safeProjectName}.avproject`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)

    setStatus('Projectbestand opgeslagen.')
  }, [
    buildProjectFile,
    projectData,
    rememberCurrentProject,
  ])

  const restoreProjectFile = useCallback(
    (
      projectFile: SavedProjectFile,
      sourceName: string,
    ) => {
      const restoredProjectDevices =
        Array.isArray(projectFile.projectDevices)
          ? projectFile.projectDevices
          : []

      const legacyLibraryTypes =
        'libraryTypes' in projectFile &&
        Array.isArray(
          (projectFile as SavedProjectFile & {
            libraryTypes?: DeviceType[]
          }).libraryTypes,
        )
          ? (
              projectFile as SavedProjectFile & {
                libraryTypes: DeviceType[]
              }
            ).libraryTypes
          : []

      if (legacyLibraryTypes.length > 0) {
        setLibraryTypes((current) =>
          mergeDeviceTypes(current, legacyLibraryTypes),
        )
      }

      const restoredDeletedDeviceIds =
        Array.isArray(projectFile.deletedDeviceIds)
          ? projectFile.deletedDeviceIds
          : []

      const savedDevicePositions = new Map(
        projectFile.deviceNodes.map((node) => [
          node.id,
          node.position,
        ]),
      )

      const restoredTypeMap = new Map(
        mergeDeviceTypes(
          libraryTypes,
          legacyLibraryTypes,
        ).map((deviceType) => [
          `${deviceType.mfg}/${deviceType.model}`,
          deviceType,
        ]),
      )

      const restoredDeviceNodes: DeviceNode[] =
        restoredProjectDevices.flatMap((device, index) => {
          if (restoredDeletedDeviceIds.includes(device.sysname)) {
            return []
          }

          const deviceType = restoredTypeMap.get(device.type_ref)
          if (!deviceType) return []

          return [{
            id: device.sysname,
            type: 'device',
            dragHandle: '.drag-handle',
            position:
              savedDevicePositions.get(device.sysname) ?? {
                x: (index % 2) * 620,
                y: Math.floor(index / 2) * 480,
              },
            data: {
              sysname: device.sysname,
              manufacturer: deviceType.mfg,
              model: deviceType.model,
              description: deviceType.short_desc,
              location: device.location,
              rack: device.rack,
              ports: deviceType.ports,
              selectedSource: null,
              onPortClick,
            },
          }]
        })

      const restoredRoutes: GraphicURouteNode[] =
        projectFile.graphicRoutes.map((route) => ({
          id: route.id,
          type: 'graphic-u-route',
          dragHandle: '.drag-handle',
          position: route.position,
          data: {
            ...route.data,
            onChangeGeometry: changeRouteGeometry,
          },
        }))

      const restoredNodes: AppNode[] = [
        ...restoredDeviceNodes,
        ...restoredRoutes,
      ]

      applyingHistoryRef.current = true
      setProjectData({
        project: projectFile.sourceProject,
        types: [],
        devices: restoredProjectDevices,
      })
      setProjectDevices(restoredProjectDevices)
      setDeletedDeviceIds(restoredDeletedDeviceIds)
      setNodes(restoredNodes)
      setEdges(projectFile.edges)
      resetHistory(restoredNodes, projectFile.edges)
      setSelectedSource(null)
      setSelectedEdgeId(null)
      setSelectedNodeId(null)
      setEditingDeviceId(null)
      setToolMode('select')

      window.requestAnimationFrame(() => {
        flowInstance?.setViewport(projectFile.viewport)
        applyingHistoryRef.current = false
      })

      rememberCurrentProject(projectFile)
      setShowRecentProjects(false)
      setStatus(`Project geopend: ${sourceName}`)
    },
    [
      changeRouteGeometry,
      flowInstance,
      libraryTypes,
      onPortClick,
      rememberCurrentProject,
      resetHistory,
      setEdges,
      setNodes,
    ],
  )
  
  const updateProjectProperty = useCallback(
  (
    field:
      | 'projectName'
      | 'location'
      | 'createdBy'
      | 'facilityId',
    value: string | number,
  ) => {
    setProjectData((current) => {
      if (!current) return current

      const project = { ...current.project }

      switch (field) {
        case 'projectName':
          project.name = String(value)
          break

        case 'location':
          project.location = String(value)
          break

        case 'createdBy':
          project.created_by = String(value)
          break

        case 'facilityId':
          project.facility_id = Number(value)
          break
      }

      return {
        ...current,
        project,
      }
    })
  },
  [],
)





  const openProject = useCallback(
    async (selectedFile: File) => {
      try {
        const rawText = await selectedFile.text()
        const parsed: unknown = JSON.parse(rawText)

        if (
          typeof parsed !== 'object' ||
          parsed === null ||
          !('format' in parsed) ||
          !('formatVersion' in parsed)
        ) {
          throw new Error('Dit is geen geldig AV-projectbestand.')
        }

        const projectFile = parsed as SavedProjectFile

        if (
          projectFile.format !== 'av-engineering-project' ||
          projectFile.formatVersion !== 1
        ) {
          throw new Error(
            `Niet-ondersteunde projectversie: ${projectFile.formatVersion}`,
          )
        }

        if (
          !Array.isArray(projectFile.deviceNodes) ||
          !Array.isArray(projectFile.graphicRoutes) ||
          !Array.isArray(projectFile.edges)
        ) {
          throw new Error('Het projectbestand is onvolledig.')
        }

        restoreProjectFile(
          projectFile,
          selectedFile.name,
        )
      } catch (openError: unknown) {
        setStatus(
          openError instanceof Error
            ? `Openen mislukt: ${openError.message}`
            : 'Openen mislukt door een onbekende fout.',
        )
      } finally {
        if (openProjectInputRef.current) {
          openProjectInputRef.current.value = ''
        }
      }
    },
    [restoreProjectFile],
  )

  if (error) {
    return <main><h1>AV Engineering Platform</h1><p>Fout: {error}</p></main>
  }

  if (!projectData) {
    return <main><h1>AV Engineering Platform</h1><p>Project wordt geladen...</p></main>
  }

  return (
    <div className="app-shell">

<Toolbar
  projectName={projectData.project.name}
  toolMode={toolMode}
  routeSignal={routeSignal}
  routeSignals={['DGV', 'DAT', 'AUD', 'CTRL', 'PWR']}
  currentZoom={viewportZoom}
  canUndo={canUndo}
  canRedo={canRedo}
  canEditDevice={Boolean(
    selectedNodeId &&
      nodes.some(
        (node) =>
          node.id === selectedNodeId &&
          node.type === 'device',
      ),
  )}
  canDelete={Boolean(selectedEdgeId || selectedNodeId)}
  hasSelectedEdge={Boolean(selectedEdgeId)}
  openProjectInputRef={openProjectInputRef}
  signalName={signalName}
  onNewProject={startNewProject}
  onEditProject={editProjectDetails}
  onToggleRecentProjects={() =>
    setShowRecentProjects((current) => !current)
  }
  onOpenReports={() => setShowReports(true)}
  onOpenSettings={() => setShowSettings(true)}
  onUndo={undo}
  onRedo={redo}
  onSaveProject={saveProject}
  onOpenProject={(file) => {
    void openProject(file)
  }}
  onSelectTool={() => {
    setToolMode('select')
    setStatus('Selecteren, verslepen en kabels maken.')
  }}
  onGraphicRouteTool={() => {
    setToolMode('place-graphic-route')
    setStatus(
      'Klik op het canvas om de grafische U-route te plaatsen.',
    )
  }}
  onRouteSignalChange={setRouteSignal}
  onEditDevice={() => {
    if (selectedNodeId) {
      setEditingDeviceId(selectedNodeId)
    }
  }}
  onDelete={deleteSelected}
  onEditCableNumber={() => setShowCableEditor(true)}
  onCableModeChange={setSelectedCableMode}

onZoomFit={() => {
  if (!flowInstance) return

  void flowInstance.fitView({
    ...REACT_FLOW_FIT_OPTIONS,
    duration: 250,
  })
}}

onZoom50={() => {
  if (!flowInstance) return

  void flowInstance.zoomTo(0.5, {
    duration: 200,
  })
}}

onZoom75={() => {
  if (!flowInstance) return

  void flowInstance.zoomTo(0.75, {
    duration: 200,
  })
}}

onZoom100={() => {
  if (!flowInstance) return

  void flowInstance.zoomTo(1, {
    duration: 200,
  })
}}





/>


      <div className="status-bar">
        <span>{status}</span>
        <span className="history-status">
          Undo: {undoStackRef.current.length} · Redo: {redoStackRef.current.length}
        </span>
      </div>

      <div className="editor-workspace">
        <LeftSidebar
          onProjectItemClick={(item) => {
            if (item === 'project-properties') {
            setMainView('project')
            }

            if (item === 'settings') {
            setMainView('settings')
            }
          }}
          deviceLibrary={
            <button
              type="button"
              className="explorer-item"
              onClick={() => setMainView('device-library')}
            >
              Open Device Library
            </button>
          }
          sheets={
            <button
              type="button"
              className="explorer-item"
              onClick={() => setMainView('canvas')}
            >
              Main
            </button>
          }
          reports={
            <>
              <button
                type="button"
                className="explorer-item"
                onClick={() => setMainView('reports')}
              >
                Cable List
              </button>

              <button
                type="button"
                className="explorer-item"
                onClick={() => setMainView('reports')}
              >
                Device List
              </button>

              <button
                type="button"
                className="explorer-item"
                onClick={() => setMainView('reports')}
              >
                I/O List
              </button>
            </>
          }
/>
        
<Workspace
  activeView={mainView}
  canvas={
    <CanvasView>
      <ReactFlow<AppNode, CableEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={setFlowInstance}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onViewportChange={(viewport) => {
          setViewportZoom(viewport.zoom)
      }}


        onPaneClick={(event) => {
          setSelectedEdgeId(null)
          setSelectedNodeId(null)
          placeGraphicRoute(event)
        }}
        onNodeClick={(_, node) => {
          setSelectedNodeId(node.id)
          setSelectedEdgeId(null)
          setStatus(
            node.type === 'device'
              ? `Apparaat ${node.id} geselecteerd.`
              : 'U-lijn geselecteerd.',
          )
        }}
        onNodeDoubleClick={(_, node) => {
          if (node.type !== 'device') return

          setEditingDeviceId(node.id)
          setSelectedNodeId(node.id)
          setSelectedEdgeId(null)
          setStatus(`Apparaat ${node.id} wordt bewerkt.`)
        }}
        onEdgeClick={(_, edge) => {
          setSelectedEdgeId(edge.id)
          setSelectedNodeId(null)
          setStatus(
            `Kabel ${
              edge.data?.cableNumber ?? edge.id
            } geselecteerd.`,
          )
        }}
        onEdgeDoubleClick={(_, edge) => {
          setSelectedEdgeId(edge.id)
          setEdges((current) =>
            current.map((item) =>
              item.id === edge.id && item.data
                ? {
                    ...item,
                    data: {
                      ...item.data,
                      displayMode: nextDisplayMode(
                        item.data.displayMode,
                      ),
                    },
                  }
                : item,
            ),
          )
        }}
        {...REACT_FLOW_CONFIG}
      >
        <ReactFlowViewport />
      </ReactFlow>
  
    </CanvasView>
  }
  deviceLibrary={
    <div className="workspace-view workspace-library-view">
      <DeviceLibrary
        types={libraryTypes}
        devices={projectDevices}
        onCreateType={createDeviceType}
        onUpdateType={updateDeviceType}
        onDeleteType={deleteDeviceType}
        onPlaceDevice={placeLibraryDevice}
        onImportJson={importLibraryJson}
        signalTypes={engineeringSettings.signalTypes}
        connectors={engineeringSettings.connectors}
      />
    </div>
  }
  project={
    <div className="workspace-placeholder">
      <div>
        <h2>Project</h2>
        <p>
          Projectgegevens worden voorlopig in het
          Properties-paneel bewerkt.
        </p>
        <button
          type="button"
          onClick={editProjectDetails}
        >
          Uitgebreide projectgegevens openen
        </button>
      </div>
    </div>
  }
  reports={
    <div className="workspace-placeholder">
      <div>
        <h2>Reports</h2>
        <p>
          Exporteer de actuele projectgegevens en tekening.
        </p>
        <button
          type="button"
          onClick={() => setShowReports(true)}
        >
          Rapporten en PDF openen
        </button>
      </div>
    </div>
  }
  settings={
    <div className="workspace-placeholder">
      <div>
        <h2>Settings</h2>
        <p>
          Beheer signal types, connectors en kabelnummering.
        </p>
        <button
          type="button"
          onClick={() => setShowSettings(true)}
        >
          Engineering Settings openen
        </button>
      </div>
    </div>
  }
/>
      
      
      <RightSidebar
        selection={{
          type: 'project',
          projectName: projectData.project.name,
          location: projectData.project.location,
          createdBy: projectData.project.created_by,
          facilityId: projectData.project.facility_id,
        }}
        onProjectChange={updateProjectProperty}
      />


      </div>

      <CableNumberEditor
        isOpen={showCableEditor}
        edgeId={selectedEdgeId}
        edgeData={
          selectedEdgeId
            ? edges.find((edge) => edge.id === selectedEdgeId)?.data ?? null
            : null
        }
        existingCableNumbers={edges.flatMap((edge) =>
          edge.data?.cableNumber ? [edge.data.cableNumber] : [],
        )}
        signalTypes={engineeringSettings.signalTypes}
        onClose={() => setShowCableEditor(false)}
        onSave={saveEditedCableNumber}
      />

      <SettingsDialog
        isOpen={showSettings}
        settings={engineeringSettings}
        onClose={() => setShowSettings(false)}
        onSave={setEngineeringSettings}
      />

      <PdfExportDialog
        isOpen={showPdfExport}
        project={projectData.project}
        nodes={nodes}
        onClose={() => setShowPdfExport(false)}
        onStatus={setStatus}
      />

      {showReports && (
        <div
          className="reports-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowReports(false)
            }
          }}
        >
          <section className="reports-dialog">
            <header>
              <div>
                <h2>Rapporten en export</h2>
                <p>{projectData.project.name}</p>
              </div>

              <button
                type="button"
                onClick={() => setShowReports(false)}
              >
                ×
              </button>
            </header>

            <div className="report-export-grid">
              <button type="button" onClick={exportDeviceList}>
                <strong>Device list</strong>
                <span>Alle geplaatste apparaten als CSV</span>
              </button>

              <button type="button" onClick={exportCableList}>
                <strong>Cable list</strong>
                <span>Kabelnummers, bronnen en bestemmingen als CSV</span>
              </button>

              <button type="button" onClick={exportIoList}>
                <strong>I/O list</strong>
                <span>Alle poorten en aansluitstatus als CSV</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowReports(false)
                  setShowPdfExport(true)
                }}
              >
                <strong>Professionele PDF</strong>
                <span>
                  Titelblok, revisie, papierformaat en meerdere pagina’s
                </span>
              </button>
            </div>

            <footer>
              <span>
                Devices: {projectDevices.length} · Kabels: {edges.length}
              </span>

              <button
                type="button"
                onClick={() => setShowReports(false)}
              >
                Sluiten
              </button>
            </footer>
          </section>
        </div>
      )}

      {showProjectEditor && (
        <div
          className="project-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowProjectEditor(false)
            }
          }}
        >
          <section className="project-dialog">
            <header>
              <h2>
                {projectEditorMode === 'new'
                  ? 'Nieuw project'
                  : 'Projectgegevens'}
              </h2>
              <button
                type="button"
                onClick={() => setShowProjectEditor(false)}
              >
                ×
              </button>
            </header>

            <label>
              Projectnaam
              <input
                value={projectEditorValues.name}
                onChange={(event) =>
                  setProjectEditorValues((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Locatie
              <input
                value={projectEditorValues.location}
                onChange={(event) =>
                  setProjectEditorValues((current) => ({
                    ...current,
                    location: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Aangemaakt door
              <input
                value={projectEditorValues.created_by}
                onChange={(event) =>
                  setProjectEditorValues((current) => ({
                    ...current,
                    created_by: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Facility-ID
              <input
                type="number"
                value={projectEditorValues.facility_id}
                onChange={(event) =>
                  setProjectEditorValues((current) => ({
                    ...current,
                    facility_id: Number(event.target.value),
                  }))
                }
              />
            </label>

            <footer>
              <button
                type="button"
                onClick={() => setShowProjectEditor(false)}
              >
                Annuleren
              </button>
              <button
                type="button"
                className="primary-project-button"
                onClick={applyProjectEditor}
              >
                {projectEditorMode === 'new'
                  ? 'Project aanmaken'
                  : 'Wijzigingen bewaren'}
              </button>
            </footer>
          </section>
        </div>
      )}

      {showRecentProjects && (
        <aside className="recent-projects-panel">
          <header>
            <strong>Recente projecten</strong>
            <button
              type="button"
              onClick={() => setShowRecentProjects(false)}
            >
              ×
            </button>
          </header>

          {recentProjects.length === 0 ? (
            <p>Nog geen lokaal bewaarde projecten.</p>
          ) : (
            <div className="recent-project-list">
              {recentProjects.map((recent) => (
                <article key={recent.id}>
                  <div>
                    <strong>{recent.name}</strong>
                    <span>{recent.location}</span>
                    <small>
                      {new Date(recent.updatedAt).toLocaleString()}
                    </small>
                  </div>

                  <div className="recent-project-actions">
                    <button
                      type="button"
                      onClick={() =>
                        restoreProjectFile(
                          recent.file,
                          recent.name,
                        )
                      }
                    >
                      Open
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setRecentProjects((current) =>
                          current.filter(
                            (item) => item.id !== recent.id,
                          ),
                        )
                      }
                    >
                      Verwijder
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </aside>
      )}

      <DeviceInstanceEditor
        device={
          editingDeviceId
            ? projectDevices.find(
                (device) => device.sysname === editingDeviceId,
              ) ?? null
            : null
        }
        types={libraryTypes}
        devices={projectDevices}
        onCancel={() => setEditingDeviceId(null)}
        onSave={updateDeviceInstance}
      />
    </div>
  )
}

export default App
