export const REACT_FLOW_FIT_OPTIONS = {
  padding: 0.18,
  minZoom: 0.15,
  maxZoom: 1,
} as const

export const REACT_FLOW_CONFIG = {
  fitView: true,
  fitViewOptions: REACT_FLOW_FIT_OPTIONS,
  minZoom: 0.15,
  maxZoom: 2,
  deleteKeyCode: null,
} as const