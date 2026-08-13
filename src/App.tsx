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
  REACT_FLOW_SNAP_GRID,
} from './canvas/ReactFlowConfig'

import {
  DEFAULT_SHEETS,
  MAIN_SHEET,
  type SheetDefinition,
} from './canvas/SheetDefinition'

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
import { getPortsForSheet } from './canvas/SheetPorts'

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

type SavedProjectFileV1 = {
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

/*
 * Eén echte fysieke kabel in het project.
 *
 * Deze bestaat maar één keer, ongeacht op hoeveel
 * sheets hij grafisch wordt weergegeven.
 */
type SavedConnectionV2 = {
  id: string

  cableNumber: string
  signal: Signal

  sourceDevice: string
  sourcePort: string
  sourceConnector: string

  targetDevice: string
  targetPort: string
  targetConnector: string
}

/*
 * Grafische representatie van een fysieke kabel
 * op één specifieke sheet.
 */
type SavedCableRepresentationV2 = {
  connectionId: string
  displayMode: CableDisplayMode
  featherLane: number
}

/*
 * Alles wat specifiek bij één sheet hoort.
 */
type SavedSheetV2 = {
  id: string
  name: string
  title: string
  revision: string
  signals: Signal[] | null

  viewport: Viewport

  deviceNodes: SavedDeviceNode[]
  graphicRoutes: SavedGraphicRouteNode[]

  cableRepresentations: SavedCableRepresentationV2[]
}

/*
 * Nieuw multi-sheet projectformaat.
 */
export type SavedProjectFileV2 = {
  format: 'av-engineering-project'
  formatVersion: 2
  savedAt: string

  sourceProject: ProjectData['project']
  projectDevices: Device[]

  activeSheetId: string

  sheets: SavedSheetV2[]
  connections: SavedConnectionV2[]
}

/*
 * Voorlopig blijft de bestaande applicatie nog v1 gebruiken.
 *
 * Hierdoor verandert in deze stap functioneel helemaal niets.
 */
type SavedProjectFile = SavedProjectFileV1

type SupportedProjectFile =
  | SavedProjectFileV1
  | SavedProjectFileV2

type RecentProjectRecord = {
  id: string
  name: string
  location: string
  updatedAt: string
  file: SupportedProjectFile
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


export function buildSavedSheetV2(
  sheet: SheetDefinition,
  snapshot: HistorySnapshot,
  viewport: Viewport,
  ): SavedSheetV2 {
  const deviceNodes: SavedDeviceNode[] = snapshot.nodes
    .filter(
      (node): node is DeviceNode =>
        node.type === 'device',
    )
    .map((node) => ({
      id: node.id,
      position: node.position,
    }))

  const graphicRoutes: SavedGraphicRouteNode[] =
    snapshot.nodes
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

  const cableRepresentations: SavedCableRepresentationV2[] =
    snapshot.edges.flatMap((edge) => {
      if (!edge.data) {
        return []
      }

      return [{
        connectionId: edge.id,
        displayMode: edge.data.displayMode,
        featherLane: edge.data.featherLane ?? 0,
      }]
    })

  return {
    id: sheet.id,
    name: sheet.name,
    title: sheet.title,
    revision: sheet.revision,
    signals: sheet.signals,
    viewport,
    deviceNodes,
    graphicRoutes,
    cableRepresentations,
  }
}


export function buildSavedSheetsV2(
  sheets: SheetDefinition[],
  activeSheetId: string,
  currentSnapshot: HistorySnapshot,
  storedSnapshots: Record<string, HistorySnapshot>,
  currentViewport: Viewport,
  storedViewports: Record<string, Viewport>,
  ): SavedSheetV2[] {
  return sheets.map((sheet) => {
    const snapshot =
      sheet.id === activeSheetId
        ? currentSnapshot
        : storedSnapshots[sheet.id] ?? {
            nodes: [],
            edges: [],
          }

    const viewport =
      sheet.id === activeSheetId
        ? currentViewport
        : storedViewports[sheet.id] ?? {
            x: 0,
            y: 0,
            zoom: 1,
          }

    return buildSavedSheetV2(
      sheet,
      snapshot,
      viewport,
    )
  })
}

export function restoreCableEdgeV2(
  connection: SavedConnectionV2,
  representation: SavedCableRepresentationV2,
): CableEdge {
  return {
    id: connection.id,
    type: 'cable',

    source: connection.sourceDevice,
    sourceHandle: `port:${connection.sourcePort}`,

    target: connection.targetDevice,
    targetHandle: `port:${connection.targetPort}`,

    data: {
      cableNumber: connection.cableNumber,
      signal: connection.signal,

      displayMode: representation.displayMode,

      sourceDevice: connection.sourceDevice,
      sourcePort: connection.sourcePort,
      sourceConnector: connection.sourceConnector,

      targetDevice: connection.targetDevice,
      targetPort: connection.targetPort,
      targetConnector: connection.targetConnector,

      featherLane: representation.featherLane,
    },
  }
}

export function restoreSavedSheetV2(
  savedSheet: SavedSheetV2,
  connections: SavedConnectionV2[],
  projectDevices: Device[],
  deviceTypes: DeviceType[],
  onPortClick: (endpoint: Endpoint) => void,
  onChangeGeometry: (
    nodeId: string,
    geometry: {
      width?: number
      leftHeight?: number
      rightHeight?: number
    },
  ) => void,
): HistorySnapshot {
  
  const deviceById = new Map(
    projectDevices.map((device) => [
      device.sysname,
      device,
    ]),
  )

  const deviceTypeByRef = new Map(
    deviceTypes.map((deviceType) => [
      `${deviceType.mfg}/${deviceType.model}`,
      deviceType,
    ]),
  )

  const connectionById = new Map(
    connections.map((connection) => [
      connection.id,
      connection,
    ]),
  )

  const sheetDefinition: SheetDefinition = {
    id: savedSheet.id,
    name: savedSheet.name,
    title: savedSheet.title,
    revision: savedSheet.revision,
    signals: savedSheet.signals,
  }

  const deviceNodes: DeviceNode[] =
    savedSheet.deviceNodes.flatMap((savedNode) => {
      const device = deviceById.get(savedNode.id)

      if (!device) {
        return []
      }

      const deviceType =
        deviceTypeByRef.get(device.type_ref)

      if (!deviceType) {
        return []
      }

      const data: DeviceNodeData = {
        sysname: device.sysname,
        manufacturer: deviceType.mfg,
        model: deviceType.model,
        description: deviceType.short_desc,
        location: device.location,
        rack: device.rack,
        ports: getPortsForSheet(
          deviceType,
          sheetDefinition,
        ),
        selectedSource: null,
        onPortClick,
      }

      return [{
        id: device.sysname,
        type: 'device',
        dragHandle: '.drag-handle',
        position: savedNode.position,
        data,
      }]
    })

  const graphicRoutes: GraphicURouteNode[] =
    savedSheet.graphicRoutes.map((route) => ({
      id: route.id,
      type: 'graphic-u-route',
      dragHandle: '.drag-handle',
      position: route.position,
      data: {
        ...route.data,
        onChangeGeometry,
      },
    }))

  const restoredEdges: CableEdge[] =
    savedSheet.cableRepresentations.flatMap(
      (representation) => {
        const connection =
          connectionById.get(
            representation.connectionId,
          )

        if (!connection) {
          return []
        }

        return [
          restoreCableEdgeV2(
            connection,
            representation,
          ),
        ]
      },
    )

  return {
    nodes: [
      ...deviceNodes,
      ...graphicRoutes,
    ],
    edges: restoredEdges,
  }
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
  const [sheets] = useState<SheetDefinition[]>(
  () => DEFAULT_SHEETS.map((sheet) => ({ ...sheet })),
)

const [activeSheetId, setActiveSheetId] =
  useState(MAIN_SHEET.id)

const activeSheet = useMemo(
  () =>
    sheets.find((sheet) => sheet.id === activeSheetId) ??
    MAIN_SHEET,
  [activeSheetId, sheets],
)



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

const onPortClickRef = useRef<
  (endpoint: Endpoint) => void
>(() => undefined)

const handlePortClick = useCallback(
  (endpoint: Endpoint) => {
    onPortClickRef.current(endpoint)
  },
  [],
  )




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
        ports: getPortsForSheet(deviceType, activeSheet),
        selectedSource: null,
        onPortClick: handlePortClick,
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
 }, [
  activeSheet,
  handlePortClick,
  libraryTypes,
  projectData,
  projectDevices,
])

  const [nodes, setNodes, onNodesChange] =
    useNodesState<AppNode>([])
  const [edges, setEdges, onEdgesChange] =
    useEdgesState<CableEdge>([])

  const sheetContentsRef = useRef<
  Record<string, HistorySnapshot>
>({})  

const sheetViewportsRef = useRef<
  Record<string, Viewport>
>({})

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
  const switchSheet = useCallback(
  (
    nextSheetId: string,
    nextSheetName: string,
  ) => {
    if (nextSheetId === activeSheetId) {
      setMainView('canvas')
      return
    }

    if (historyTimerRef.current !== null) {
      window.clearTimeout(historyTimerRef.current)
      historyTimerRef.current = null
    }

// Viewport van de huidige sheet bewaren
if (flowInstance) {
  sheetViewportsRef.current[activeSheetId] =
    flowInstance.getViewport()
}


    // Huidige sheet bewaren
    sheetContentsRef.current[activeSheetId] =
      cloneHistorySnapshot(nodes, edges)

    // Nieuwe sheet ophalen
    const savedContent =
      sheetContentsRef.current[nextSheetId]

    const nextContent: HistorySnapshot =
  savedContent
    ? {
        ...cloneHistorySnapshot(
          savedContent.nodes,
          savedContent.edges,
        ),
        nodes: savedContent.nodes.map((node) => ({
          ...node,
          position: snapToEngineeringGrid(
            node.position,
          ),
        })) as AppNode[],
      }
    : {
        nodes: [],
        edges: [],
      }

    applyingHistoryRef.current = true

    setSelectedSource(null)
    setSelectedEdgeId(null)
    setSelectedNodeId(null)
    setEditingDeviceId(null)
    setToolMode('select')

    setNodes(nextContent.nodes)
    setEdges(nextContent.edges)

    setActiveSheetId(nextSheetId)
    setMainView('canvas')

    resetHistory(
      nextContent.nodes,
      nextContent.edges,
    )

    window.requestAnimationFrame(() => {
  const nextViewport =
    sheetViewportsRef.current[nextSheetId] ?? {
      x: 0,
      y: 0,
      zoom: 1,
    }

  flowInstance?.setViewport(nextViewport)
  setViewportZoom(nextViewport.zoom)

  applyingHistoryRef.current = false
})

    setStatus(`Sheet ${nextSheetName} geopend.`)
  },
  [
    activeSheetId,
    edges,
    flowInstance,
    nodes,
    resetHistory,
    setEdges,
    setNodes,
  ],
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
      
      if (activeSheetId === MAIN_SHEET.id) {
  setDeletedDeviceIds(
    baseNodes
      .filter(
        (baseNode) =>
          !snapshot.nodes.some(
            (node) => node.id === baseNode.id,
          ),
      )
      .map((node) => node.id),
  )
}
      
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
    [
       activeSheetId,
  baseNodes,
  setEdges,
  setNodes, 

    ],
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

  const getProjectEdges = useCallback(() => {
 
    const storedEdges = Object.entries(
    sheetContentsRef.current,
  )
    .filter(
      ([sheetId]) =>
        sheetId !== activeSheetId,
    )
    .flatMap(
      ([sheetId, snapshot]) =>
        snapshot.edges.map((edge) => ({
          sheetId,
          edge,
        })),
    )

    


  const currentEdges = edges.map((edge) => ({
    sheetId: activeSheetId,
    edge,
  }))

  return [
    ...currentEdges,
    ...storedEdges,
  
  ]
}, [
  activeSheetId,
  edges,
])

const buildProjectConnectionsV2 = useCallback(
  (): SavedConnectionV2[] => {
    const connections = new Map<string, SavedConnectionV2>()

    getProjectEdges().forEach(({ edge }) => {
      /*
       * Dezelfde fysieke kabel kan op meerdere sheets
       * voorkomen met dezelfde edge.id.
       */
      if (connections.has(edge.id)) {
        return
      }

      if (!edge.data) {
        return
      }

      connections.set(edge.id, {
        id: edge.id,
        cableNumber: edge.data.cableNumber,
        signal: edge.data.signal,

        sourceDevice:
          edge.data.sourceDevice ?? edge.source,
        sourcePort:
          edge.data.sourcePort ??
          edge.sourceHandle?.replace(/^port:/, '') ??
          '',
        sourceConnector:
          edge.data.sourceConnector ?? '',

        targetDevice:
          edge.data.targetDevice ?? edge.target,
        targetPort:
          edge.data.targetPort ??
          edge.targetHandle?.replace(/^port:/, '') ??
          '',
        targetConnector:
          edge.data.targetConnector ?? '',
      })
    })

    return [...connections.values()]
  },
  [getProjectEdges],
)



const projectCableNumbers = useMemo(() => {
  const numbers = buildProjectConnectionsV2()
    .filter(
      (connection) =>
        connection.id !== selectedEdgeId,
    )
    .map(
      (connection) =>
        connection.cableNumber,
    )

  return [...new Set(numbers)]
}, [
  buildProjectConnectionsV2,
  selectedEdgeId,
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

const projectEdges = getProjectEdges()

const existingConnection =
  projectEdges.find(({ edge }) => {
    const forwardMatch =
      edge.source === source.deviceId &&
      edge.sourceHandle === `port:${source.port.label}` &&
      edge.target === target.deviceId &&
      edge.targetHandle === `port:${target.port.label}`

    const reverseMatch =
      edge.source === target.deviceId &&
      edge.sourceHandle === `port:${target.port.label}` &&
      edge.target === source.deviceId &&
      edge.targetHandle === `port:${source.port.label}`

    return forwardMatch || reverseMatch
  })

if (existingConnection) {
  const cableNumber =
    existingConnection.edge.data?.cableNumber ??
    existingConnection.edge.id

  if (existingConnection.sheetId === activeSheetId) {
    setSelectedSource(null)

    setStatus(
      `${cableNumber} staat al op sheet ${activeSheet.name}.`,
    )

    return
  }

  const sourceSheetName =
    sheets.find(
      (sheet) =>
        sheet.id === existingConnection.sheetId,
    )?.name ??
    existingConnection.sheetId

  const representedEdge: CableEdge = {
    ...existingConnection.edge,
    data: existingConnection.edge.data
      ? { ...existingConnection.edge.data }
      : existingConnection.edge.data,
    style: existingConnection.edge.style
      ? { ...existingConnection.edge.style }
      : undefined,
    labelStyle: existingConnection.edge.labelStyle
      ? { ...existingConnection.edge.labelStyle }
      : undefined,
    labelBgStyle: existingConnection.edge.labelBgStyle
      ? { ...existingConnection.edge.labelBgStyle }
      : undefined,
  }

  setEdges((current) => [
    ...current,
    representedEdge,
  ])

  setSelectedSource(null)
  setSelectedEdgeId(representedEdge.id)

  setStatus(
    `${cableNumber} uit sheet ${sourceSheetName} ` +
      `ook op sheet ${activeSheet.name} weergegeven.`,
  )

  return
}


const sourceConnection = projectEdges.find(
  ({ edge }) =>
    (
      edge.source === source.deviceId &&
      edge.sourceHandle === `port:${source.port.label}`
    ) ||
    (
      edge.target === source.deviceId &&
      edge.targetHandle === `port:${source.port.label}`
    ),
)

if (sourceConnection) {
  setSelectedSource(null)

  setStatus(
    `${source.deviceId}/${source.port.label} is al aangesloten met kabel ${
      sourceConnection.edge.data?.cableNumber ??
      sourceConnection.edge.id
    }.`,
  )

  return
}

const targetConnection = projectEdges.find(
  ({ edge }) =>
    (
      edge.target === target.deviceId &&
      edge.targetHandle === `port:${target.port.label}`
    ) ||
    (
      edge.source === target.deviceId &&
      edge.sourceHandle === `port:${target.port.label}`
    ),
)

if (targetConnection) {
  setSelectedSource(null)

  setStatus(
    `${target.deviceId}/${target.port.label} is al aangesloten met kabel ${
      targetConnection.edge.data?.cableNumber ??
      targetConnection.edge.id
    }.`,
  )

  return
}

      const generatedCableNumber = generateCableNumber(
        {
          sourceDevice: source.deviceId,
          sourcePort: source.port,
          targetDevice: target.deviceId,
          targetPort: target.port,
          existingNumbers: projectEdges.flatMap(
  ({ edge }) =>
    edge.data?.cableNumber
      ? [edge.data.cableNumber]
      : [],
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
    [
      
  edges,
  engineeringSettings,
  getProjectEdges,
  setEdges,
  sheets,

    ],
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

  onPortClickRef.current = onPortClick
  

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
  if (activeSheetId !== MAIN_SHEET.id) {
    return
  }

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
  position: snapToEngineeringGrid(
    baseNode.position,
  ),
data: {
  ...baseNode.data,
  selectedSource,
  onPortClick: handlePortClick,
},
}
        }

        return {
  ...existingNode,
  type: baseNode.type,
  dragHandle: baseNode.dragHandle,
  position: snapToEngineeringGrid(
    existingNode.position,
  ),
data: {
  ...baseNode.data,
  selectedSource,
  onPortClick: handlePortClick,
},
}
      })

      return [...mergedDeviceNodes, ...routeNodes]
    })
}, [
  activeSheetId,
  baseNodes,
  changeRouteGeometry,
  deletedDeviceIds,
  handlePortClick,
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

const snapToEngineeringGrid = (
  position: { x: number; y: number },
) => ({
  x: Math.round(position.x / 20) * 20,
  y: Math.round(position.y / 20) * 20,
})



const placeLibraryDevice = useCallback(
  (
    device: Device,
    positionOverride?: { x: number; y: number },
  ) => {


    if (!flowInstance) {
      setStatus('Het canvas is nog niet gereed.')
      return
    }

    /*
     * Hetzelfde fysieke/projectapparaat mag op meerdere
     * sheets voorkomen, maar slechts één keer per sheet.
     */
    const alreadyPlacedOnSheet = nodes.some(
      (node) =>
        node.type === 'device' &&
        node.id === device.sysname,
    )

    if (alreadyPlacedOnSheet) {
      setStatus(
        `${device.sysname} staat al op sheet ${activeSheet.name}.`,
      )
      return
    }

    const deviceType = libraryTypes.find(
      (type) =>
        `${type.mfg}/${type.model}` === device.type_ref,
    )

    if (!deviceType) {
      setStatus(
        `Apparaattype ${device.type_ref} kon niet worden gevonden.`,
      )
      return
    }

    const ports = getPortsForSheet(
      deviceType,
      activeSheet,
    )

    /*
     * Op een gespecialiseerde sheet heeft plaatsing zonder
     * relevante poorten normaal gesproken geen nut.
     */
    if (
      activeSheet.signals !== null &&
      ports.length === 0
    ) {
      setStatus(
        `${device.sysname} heeft geen aansluitingen voor sheet ${activeSheet.name}.`,
      )
      return
    }

    const position =
  positionOverride ??
  flowInstance.screenToFlowPosition({
    x: window.innerWidth * 0.62,
    y: window.innerHeight * 0.5,
  })

    /*
     * Alleen toevoegen aan de projectdatabase als dit
     * apparaat daar nog niet bestaat.
     */
    const alreadyInProject = projectDevices.some(
      (projectDevice) =>
        projectDevice.sysname === device.sysname,
    )

    if (!alreadyInProject) {
      setProjectDevices((current) => [
        ...current,
        device,
      ])
    }

    const node: DeviceNode = {
      id: device.sysname,
      type: 'device',
      dragHandle: '.drag-handle',
      position,
      data: {
        sysname: device.sysname,
        manufacturer: deviceType.mfg,
        model: deviceType.model,
        description: deviceType.short_desc,
        location: device.location,
        rack: device.rack,
        ports,
        selectedSource,
        onPortClick: handlePortClick,
      },
    }

    setNodes((current) => [
      ...current,
      node,
    ])

    /*
     * Nog nodig voor compatibiliteit met het huidige
     * projectformaat. Dit bouwen we later om.
     */
    setDeletedDeviceIds((current) =>
      current.filter(
        (id) => id !== device.sysname,
      ),
    )

    setSelectedNodeId(device.sysname)
    setSelectedEdgeId(null)

    setStatus(
      alreadyInProject
        ? `${device.sysname} ook op sheet ${activeSheet.name} geplaatst.`
        : `${device.sysname} aan project toegevoegd en op sheet ${activeSheet.name} geplaatst.`,
    )
  },
  [
    activeSheet,
    flowInstance,
    libraryTypes,
    nodes,
    handlePortClick,
    projectDevices,
    selectedSource,
    setNodes,
  ],
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

        if (activeSheetId === MAIN_SHEET.id) {
  setDeletedDeviceIds((current) =>
    current.includes(selectedNodeId)
      ? current
      : [...current, selectedNodeId],
  )
}

setNodes((current) =>
  current.filter(
    (item) => item.id !== selectedNodeId,
  ),
)

setSelectedNodeId(null)

setStatus(
  `${node.id} van sheet ${activeSheet.name} verwijderd.`,
)

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
      activeSheet,
  activeSheetId,
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

      const numberAlreadyInUse = getProjectEdges().some(
  ({ edge: projectEdge }) =>
    projectEdge.id !== edgeId &&
    projectEdge.data?.cableNumber === newCableNumber,
)

if (numberAlreadyInUse) {
  setStatus(
    `Kabelnummer ${newCableNumber} is al in gebruik in dit project.`,
  )
  return
}


      const signalId = edge.data.signal

      /*
 * Actieve sheet bijwerken.
 */
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
 * Dezelfde fysieke kabel kan op meerdere sheets
 * grafisch worden weergegeven.
 *
 * Omdat alle representaties dezelfde edge.id hebben,
 * kunnen we het kabelnummer projectbreed synchroniseren.
 */
Object.entries(sheetContentsRef.current).forEach(
  ([sheetId, snapshot]) => {
    const containsCable = snapshot.edges.some(
      (item) => item.id === edgeId,
    )

    if (!containsCable) {
      return
    }

    sheetContentsRef.current[sheetId] = {
      ...snapshot,
      edges: snapshot.edges.map((item) =>
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
    }
  },
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
    [
      edges, 
      getProjectEdges,
      setEdges
    ],
  )

const buildProjectFile = useCallback(
  (): SavedProjectFileV2 | null => {
    if (!projectData || !flowInstance) {
      return null
    }

    const currentSnapshot =
      cloneHistorySnapshot(nodes, edges)

    const currentViewport =
      flowInstance.getViewport()

    const savedSheets = buildSavedSheetsV2(
      sheets,
      activeSheetId,
      currentSnapshot,
      sheetContentsRef.current,
      currentViewport,
      sheetViewportsRef.current,
    )

    const connections =
      buildProjectConnectionsV2()

    return {
      format: 'av-engineering-project',
      formatVersion: 2,
      savedAt: new Date().toISOString(),

      sourceProject: projectData.project,
      projectDevices,

      activeSheetId,

      sheets: savedSheets,
      connections,
    }
  },
  [
    activeSheetId,
    buildProjectConnectionsV2,
    edges,
    flowInstance,
    nodes,
    projectData,
    projectDevices,
    sheets,
  ],
)

const rememberCurrentProject = useCallback(
  (projectFile: SupportedProjectFile) => {
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
              onPortClick: handlePortClick,
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
      handlePortClick,
      rememberCurrentProject,
      resetHistory,
      setEdges,
      setNodes,
    ],
  )
  
  const restoreProjectFileV2 = useCallback(
  (
    projectFile: SavedProjectFileV2,
    sourceName: string,
  ) => {
    const restoredProjectDevices =
      Array.isArray(projectFile.projectDevices)
        ? projectFile.projectDevices
        : []

    const restoredSheets =
      Array.isArray(projectFile.sheets)
        ? projectFile.sheets
        : []

    const restoredConnections =
      Array.isArray(projectFile.connections)
        ? projectFile.connections
        : []

    /*
     * Alle sheets reconstrueren.
     */
    const restoredSnapshots:
      Record<string, HistorySnapshot> = {}

    restoredSheets.forEach((savedSheet) => {
      restoredSnapshots[savedSheet.id] =
        restoreSavedSheetV2(
          savedSheet,
          restoredConnections,
          restoredProjectDevices,
          libraryTypes,
          handlePortClick,
          changeRouteGeometry,
        )
    })

    /*
     * Alleen een sheet activeren die ook werkelijk
     * in de huidige sheetlijst bestaat.
     */
    const restoredActiveSheetId =
      sheets.some(
        (sheet) =>
          sheet.id === projectFile.activeSheetId,
      )
        ? projectFile.activeSheetId
        : MAIN_SHEET.id

    const activeSnapshot =
      restoredSnapshots[restoredActiveSheetId] ?? {
        nodes: [],
        edges: [],
      }

    /*
     * Viewports van alle sheets herstellen.
     */
    const restoredViewports =
      Object.fromEntries(
        restoredSheets.map((sheet) => [
          sheet.id,
          sheet.viewport,
        ]),
      ) as Record<string, Viewport>

    const activeViewport =
      restoredViewports[restoredActiveSheetId] ?? {
        x: 0,
        y: 0,
        zoom: 1,
      }

    /*
     * Main gebruikt voorlopig nog deletedDeviceIds
     * om te bepalen welke projectdevices daar NIET
     * geplaatst zijn.
     *
     * Daarom reconstrueren we deze lijst uit de
     * expliciet opgeslagen Main-placements.
     */
    const mainSavedSheet =
      restoredSheets.find(
        (sheet) =>
          sheet.id === MAIN_SHEET.id,
      )

    const mainPlacedDeviceIds =
      new Set(
        mainSavedSheet?.deviceNodes.map(
          (node) => node.id,
        ) ?? [],
      )

    const restoredDeletedDeviceIds =
      restoredProjectDevices
        .filter(
          (device) =>
            !mainPlacedDeviceIds.has(
              device.sysname,
            ),
        )
        .map((device) => device.sysname)

    applyingHistoryRef.current = true

    /*
     * Alle opgeslagen sheetinhoud terugzetten.
     */
    sheetContentsRef.current =
      restoredSnapshots

    sheetViewportsRef.current =
      restoredViewports

    setProjectData({
      project: projectFile.sourceProject,
      types: [],
      devices: restoredProjectDevices,
    })

    setProjectDevices(
      restoredProjectDevices,
    )

    setDeletedDeviceIds(
      restoredDeletedDeviceIds,
    )

    setNodes(activeSnapshot.nodes)
    setEdges(activeSnapshot.edges)

    setActiveSheetId(
      restoredActiveSheetId,
    )

    resetHistory(
      activeSnapshot.nodes,
      activeSnapshot.edges,
    )

    setSelectedSource(null)
    setSelectedEdgeId(null)
    setSelectedNodeId(null)
    setEditingDeviceId(null)
    setToolMode('select')
    setMainView('canvas')

    window.requestAnimationFrame(() => {
      flowInstance?.setViewport(
        activeViewport,
      )

      setViewportZoom(
        activeViewport.zoom,
      )

      applyingHistoryRef.current = false
    })

    rememberCurrentProject(projectFile)

    setShowRecentProjects(false)

    setStatus(
      `Project geopend: ${sourceName}`,
    )
  },
  [
    changeRouteGeometry,
    flowInstance,
    handlePortClick,
    libraryTypes,
    rememberCurrentProject,
    resetHistory,
    setEdges,
    setNodes,
    sheets,
  ],
)

const restoreSupportedProjectFile = useCallback(
  (
    projectFile: SupportedProjectFile,
    sourceName: string,
  ) => {
    if (projectFile.formatVersion === 2) {
      restoreProjectFileV2(
        projectFile,
        sourceName,
      )
      return
    }

    restoreProjectFile(
      projectFile,
      sourceName,
    )
  },
  [
    restoreProjectFile,
    restoreProjectFileV2,
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

       if (
  !('format' in parsed) ||
  parsed.format !== 'av-engineering-project'
) {
  throw new Error('Dit is geen geldig AV-projectbestand.')
}

if (
  !('formatVersion' in parsed) ||
  typeof parsed.formatVersion !== 'number'
) {
  throw new Error('Projectversie ontbreekt.')
}

if (parsed.formatVersion === 1) {
  const projectFile =
    parsed as SavedProjectFileV1

  if (
    !Array.isArray(projectFile.deviceNodes) ||
    !Array.isArray(projectFile.graphicRoutes) ||
    !Array.isArray(projectFile.edges)
  ) {
    throw new Error(
      'Het v1-projectbestand is onvolledig.',
    )
  }

restoreSupportedProjectFile(
  projectFile,
  selectedFile.name,
)

return
}

if (parsed.formatVersion === 2) {
  const projectFile =
    parsed as SavedProjectFileV2

  if (
    !Array.isArray(projectFile.projectDevices) ||
    !Array.isArray(projectFile.sheets) ||
    !Array.isArray(projectFile.connections)
  ) {
    throw new Error(
      'Het v2-projectbestand is onvolledig.',
    )
  }

restoreSupportedProjectFile(
  projectFile,
  selectedFile.name,
)

return
}

throw new Error(
  `Niet-ondersteunde projectversie: ${parsed.formatVersion}`,
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
            [
              restoreSupportedProjectFile,
            ],
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
          projectDevices={
  projectDevices.length === 0 ? (
    <span className="explorer-empty">
      Nog geen projectapparaten
    </span>
  ) : (
    <>
      {[...projectDevices]
        .sort((a, b) =>
          a.sysname.localeCompare(b.sysname),
        )
        .map((device) => (
<button
  key={device.sysname}
  type="button"
  className="explorer-item explorer-device-item"
  title={`${device.sysname} · ${device.type_ref}`}
  onPointerDown={(event) => {
    event.preventDefault()

    document.body.classList.add(
      'project-device-pointer-drag',
    )

    setStatus(
      `${device.sysname} wordt naar sheet ${activeSheet.name} gesleept.`,
    )

    const finishDrag = (pointerEvent: PointerEvent) => {
      const element = document.elementFromPoint(
        pointerEvent.clientX,
        pointerEvent.clientY,
      )

      const droppedOnCanvas =
        element instanceof Element &&
        element.closest('.flow-area') !== null

      if (droppedOnCanvas) {
  if (!flowInstance) {
    setStatus('Het canvas is nog niet gereed.')
  } else {
   const position =
  flowInstance.screenToFlowPosition(
    {
      x: pointerEvent.clientX,
      y: pointerEvent.clientY,
    },
    {
      snapToGrid: true,
      snapGrid: REACT_FLOW_SNAP_GRID,
    },
  )

    placeLibraryDevice(
      device,
      position,
    )
  }
} else {

        setStatus(
          `${device.sysname} niet op het canvas losgelaten.`,
        )
      }

      document.body.classList.remove(
        'project-device-pointer-drag',
      )

      window.removeEventListener(
        'pointerup',
        finishDrag,
        true,
      )

      window.removeEventListener(
        'pointercancel',
        finishDrag,
        true,
      )
    }

    window.addEventListener(
      'pointerup',
      finishDrag,
      true,
    )

    window.addEventListener(
      'pointercancel',
      finishDrag,
      true,
    )
  }}
>
  {device.sysname}
</button>
        ))}
    </>
  )
}





         sheets={
  <>
    {sheets.map((sheet) => (
      <button
        key={sheet.id}
        type="button"
        className={
          activeSheetId === sheet.id
            ? 'explorer-item explorer-item-selected'
            : 'explorer-item'
        }
        onClick={() =>
          switchSheet(sheet.id, sheet.name)
        }
      >
        {sheet.name}
      </button>
    ))}
  </>
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
<CanvasView sheet={activeSheet}>




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
        setStatus(
          `Apparaat ${node.id} wordt bewerkt.`,
        )
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

          activeSheetName={activeSheet.name}
  activeSheetSignals={activeSheet.signals}

  placedDeviceIds={nodes
    .filter((node) => node.type === 'device')
    .map((node) => node.id)}



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

        existingCableNumbers={projectCableNumbers}
        
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
                        restoreSupportedProjectFile(
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
