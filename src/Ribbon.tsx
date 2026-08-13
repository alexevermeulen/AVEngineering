export function Ribbon() {
  return (
    <div className="app-ribbon">
      <div className="ribbon-group">
        <div className="ribbon-command ribbon-command-active">
          <span className="ribbon-icon">↖</span>
          <span>Select</span>
        </div>

        <div className="ribbon-group-title">
          Selectie
        </div>
      </div>

      <div className="ribbon-group">
        <div className="ribbon-command">
          <span className="ribbon-icon">↶</span>
          <span>Undo</span>
        </div>

        <div className="ribbon-command">
          <span className="ribbon-icon">↷</span>
          <span>Redo</span>
        </div>

        <div className="ribbon-command">
          <span className="ribbon-icon">⌫</span>
          <span>Delete</span>
        </div>

        <div className="ribbon-group-title">
          Bewerken
        </div>
      </div>

      <div className="ribbon-group">
        <div className="ribbon-command">
          <span className="ribbon-icon">▣</span>
          <span>Device</span>
        </div>

        <div className="ribbon-command">
          <span className="ribbon-icon">━</span>
          <span>Cable</span>
        </div>

        <div className="ribbon-command">
          <span className="ribbon-icon">∪</span>
          <span>U-Route</span>
        </div>

        <div className="ribbon-group-title">
          Plaatsen
        </div>
      </div>

      <div className="ribbon-group">
        <div className="ribbon-command">
          <span className="ribbon-icon">50</span>
          <span>50%</span>
        </div>

        <div className="ribbon-command">
          <span className="ribbon-icon">75</span>
          <span>75%</span>
        </div>

        <div className="ribbon-command">
          <span className="ribbon-icon">100</span>
          <span>100%</span>
        </div>

        <div className="ribbon-command">
          <span className="ribbon-icon">□</span>
          <span>Fit</span>
        </div>

        <div className="ribbon-group-title">
          Weergave
        </div>
      </div>
    </div>
  )
}