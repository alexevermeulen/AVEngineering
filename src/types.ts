export type PortDirection = 'I' | 'O' | 'L'
export type Signal = 'DGV' | 'DAT' | 'AUD' | 'CTRL' | 'PWR' | string
export type CableDisplayMode = 'full' | 'feather'

export type Port = {
  label: string
  direction: PortDirection
  signal: Signal
  connector: string
  pos: number
  needs_review?: string
}

export type DeviceType = {
  mfg: string
  model: string
  prodtype: string
  revno: string
  rack_u: number
  short_desc: string
  ports: Port[]
}

export type Device = {
  sysname: string
  type_ref: string
  rack: string
  rack_level?: number
  location: string
}

export type ProjectData = {
  project: {
    name: string
    facility_id: number
    created_by: string
    location: string
  }
  types: DeviceType[]
  devices: Device[]
}

export type Endpoint = {
  deviceId: string
  port: Port
}

export type CableNumberContext = {
  sourceDevice: string
  sourcePort: Port
  targetDevice: string
  targetPort: Port
  existingNumbers: string[]
}

export type DeviceNodeData = {
  sysname: string
  manufacturer: string
  model: string
  description: string
  location: string
  rack: string
  ports: Port[]
  selectedSource?: Endpoint | null
  onPortClick: (endpoint: Endpoint) => void
}

export type CableEdgeData = {
  cableNumber: string
  signal: Signal
  displayMode: CableDisplayMode
  sourceDevice: string
  sourcePort: string
  sourceConnector: string
  targetDevice: string
  targetPort: string
  targetConnector: string
  featherLane: number
}


export type GraphicURouteNodeData = {
  signal: Signal
  width: number
  leftHeight: number
  rightHeight: number
  onChangeGeometry: (
    nodeId: string,
    geometry: {
      width?: number
      leftHeight?: number
      rightHeight?: number
    },
  ) => void
}


export type SignalTypeDefinition = {
  id: string
  label: string
  prefix: string
  startNumber: number
  nextNumber: number
}

export type EngineeringSettings = {
  signalTypes: SignalTypeDefinition[]
  connectors: string[]
  defaultCableDisplayMode: CableDisplayMode
}
