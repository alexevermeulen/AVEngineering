import {
  Background,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
} from '@xyflow/react'

export function ReactFlowViewport() {
  const {
    fitView,
    zoomTo,
  } = useReactFlow()

  return (
    <>
      <Background gap={20} size={1} />

      <Controls />

      <MiniMap pannable zoomable />

      <Panel
        position="top-left"
        className="viewport-zoom-panel"
      >
        <div className="viewport-zoom-toolbar">
          <button
            type="button"
            onClick={() =>
              fitView({
                padding: 0.1,
                duration: 250,
              })
            }
          >
            Fit
          </button>

          <button
            type="button"
            onClick={() =>
              zoomTo(0.5, {
                duration: 200,
              })
            }
          >
            50%
          </button>

          <button
            type="button"
            onClick={() =>
              zoomTo(0.75, {
                duration: 200,
              })
            }
          >
            75%
          </button>

          <button
            type="button"
            onClick={() =>
              zoomTo(1, {
                duration: 200,
              })
            }
          >
            100%
          </button>
        </div>
      </Panel>
    </>
  )
}