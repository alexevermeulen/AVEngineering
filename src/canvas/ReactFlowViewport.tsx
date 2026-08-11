import {
  Background,
  Controls,
  MiniMap,
} from '@xyflow/react'

export function ReactFlowViewport() {
  return (
    <>
      <Background 
      gap={20} 
      size={1} 
      offset={20}
      />
      <Controls />
      <MiniMap pannable zoomable />
    </>
  )
}