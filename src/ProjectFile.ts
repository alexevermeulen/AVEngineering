import type { Viewport } from '@xyflow/react'

import type { CableEdge } from './CableEdge'
import type {
  CableDisplayMode,
  Device,
  ProjectData,
  Signal,
} from './types'

export type SavedDeviceNode = {
  id: string
  position: {
    x: number
    y: number
  }
}

export type SavedGraphicRouteNode = {
  id: string
  position: {
    x: number
    y: number
  }
  data: {
    signal: Signal
    width: number
    leftHeight: number
    rightHeight: number
  }
}

export type SavedProjectFileV1 = {
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

export type SavedConnectionV2 = {
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

export type SavedCableRepresentationV2 = {
  connectionId: string
  displayMode: CableDisplayMode
  featherLane: number
}

export type SavedSheetV2 = {
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

export type SupportedProjectFile =
  | SavedProjectFileV1
  | SavedProjectFileV2