type RightSidebarProps = {
  selectedType?: 'project' | 'device' | 'cable' | 'bus' | null
}

export function RightSidebar({
  selectedType = null,
}: RightSidebarProps) {
  return (
    <div className="properties-panel">
      <header className="panel-header">
        <strong>Properties</strong>
      </header>

      <div className="properties-content">
        {selectedType === null && (
          <section className="property-section">
            <h3>Project</h3>

            <label>
              Projectnaam
              <input type="text" value="" readOnly />
            </label>

            <label>
              Locatie
              <input type="text" value="" readOnly />
            </label>

            <label>
              Aangemaakt door
              <input type="text" value="" readOnly />
            </label>
          </section>
        )}

        {selectedType === 'device' && (
          <section className="property-section">
            <h3>Device</h3>

            <label>
              Systeemnaam
              <input type="text" value="" readOnly />
            </label>

            <label>
              Type
              <input type="text" value="" readOnly />
            </label>

            <label>
              Locatie
              <input type="text" value="" readOnly />
            </label>

            <label>
              Rack
              <input type="text" value="" readOnly />
            </label>
          </section>
        )}

        {selectedType === 'cable' && (
          <section className="property-section">
            <h3>Cable</h3>

            <label>
              Kabelnummer
              <input type="text" value="" readOnly />
            </label>

            <label>
              Signaaltype
              <input type="text" value="" readOnly />
            </label>

            <label>
              Weergave
              <select value="feather" disabled>
                <option value="feather">Feather</option>
                <option value="full">Volledige kabel</option>
              </select>
            </label>
          </section>
        )}

        {selectedType === 'bus' && (
          <section className="property-section">
            <h3>Graphic Bus</h3>

            <label>
              Breedte
              <input type="number" value={0} readOnly />
            </label>

            <label>
              Linker arm
              <input type="number" value={0} readOnly />
            </label>

            <label>
              Rechter arm
              <input type="number" value={0} readOnly />
            </label>
          </section>
        )}
      </div>
    </div>
  )
}