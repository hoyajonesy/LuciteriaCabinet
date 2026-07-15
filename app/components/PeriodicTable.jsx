/**
 * Interactive Periodic Table Component — Collection-First
 * 
 * Displays all 118 elements in standard periodic table layout.
 * Click to cycle state: Missing → Owned → Wanted → Watchlist → Missing
 * Color-coded by collection state with group colors as subtle background.
 * Filter controls for state and group.
 */
import { useState, useCallback, useMemo } from "react";

const TABLE_ROWS = 10;
const TABLE_COLS = 18;

// ─── Collection state visual config ─────────────────────────────
const STATE_CONFIG = {
  OWNED:     { bg: "#c8e6c9", border: "#388E3C", badge: "✓", badgeColor: "#1b5e20", label: "Owned" },
  WANTED:    { bg: "#fff9c4", border: "#F9A825", badge: "♡", badgeColor: "#f57f17", label: "Wanted" },
  WATCHLIST: { bg: "#bbdefb", border: "#1976D2", badge: "👁", badgeColor: "#0d47a1", label: "Watchlist" },
  MISSING:   { bg: "#ffffff", border: "#e0e0e0", badge: "",  badgeColor: "#9e9e9e", label: "Missing" },
};

// State cycle order for click toggling
const STATE_CYCLE = ["MISSING", "OWNED", "WANTED", "WATCHLIST"];

const GROUP_COLORS = {
  "Alkali Metal":          { bg: "#fce4ec", border: "#e8425c", text: "#b71c1c" },
  "Alkaline Earth":        { bg: "#fff3e0", border: "#f58442", text: "#e65100" },
  "Transition Metal":      { bg: "#e3f2fd", border: "#4a90e2", text: "#1565c0" },
  "Post-Transition Metal": { bg: "#e0f7fa", border: "#45b7d1", text: "#00838f" },
  "Metalloid":             { bg: "#ede7f6", border: "#6c5ce7", text: "#4527a0" },
  "Nonmetal":              { bg: "#e8f5e9", border: "#00b894", text: "#2e7d32" },
  "Halogen":               { bg: "#fffde7", border: "#f9a825", text: "#f57f17" },
  "Noble Gas":             { bg: "#f3e5f5", border: "#a29bfe", text: "#6a1b9a" },
  "Lanthanide":            { bg: "#fce4ec", border: "#fd79a8", text: "#ad1457" },
  "Actinide":              { bg: "#fbe9e7", border: "#fab1a0", text: "#bf360c" },
};

export default function PeriodicTable({
  elements = [],
  collectionStates = {},    // { "Fe": "OWNED", "He": "WANTED", ... }
  collectionType = "lucite",
  isAvailableForCollection,
  isPreciousMetal,
  onStateChange,            // (elementSymbol, newState) => void
  onElementClick,           // (element) => void — for detail view
  compact = false,
  readOnly = false,         // Disable click toggling
  showFilters = true,       // Show filter controls
}) {
  const [hoveredElement, setHoveredElement] = useState(null);
  const [selectedElement, setSelectedElement] = useState(null);
  const [filterState, setFilterState] = useState("ALL");
  const [filterGroup, setFilterGroup] = useState("ALL");

  // Normalize collectionStates from various input formats
  const stateMap = useMemo(() => {
    if (collectionStates instanceof Map) {
      return Object.fromEntries(collectionStates);
    }
    return collectionStates || {};
  }, [collectionStates]);

  // Get unique groups from elements
  const groups = useMemo(() => {
    const g = [...new Set(elements.map(el => el.group))];
    return g.sort();
  }, [elements]);

  // Build grid lookup
  const grid = useMemo(() => {
    const g = {};
    elements.forEach(el => {
      const key = `${el.row}-${el.col}`;
      const isAvailable = el.available !== undefined ? el.available : (isAvailableForCollection?.(el.z, collectionType) ?? true);
      const isPrecious = el.precious !== undefined ? el.precious : (isPreciousMetal?.(el.sym) ?? false);
      const state = stateMap[el.sym] || "MISSING";

      // Apply filters
      let visible = true;
      if (filterState !== "ALL" && state !== filterState) visible = false;
      if (filterGroup !== "ALL" && el.group !== filterGroup) visible = false;

      g[key] = { ...el, state, isAvailable, isPrecious, visible };
    });
    return g;
  }, [elements, stateMap, collectionType, isAvailableForCollection, isPreciousMetal, filterState, filterGroup]);

  // Stats
  const stats = useMemo(() => {
    const counts = { OWNED: 0, WANTED: 0, WATCHLIST: 0, MISSING: 0 };
    elements.forEach(el => {
      const state = stateMap[el.sym] || "MISSING";
      counts[state] = (counts[state] || 0) + 1;
    });
    return counts;
  }, [elements, stateMap]);

  const handleCellClick = useCallback((el) => {
    if (readOnly || !el.isAvailable) {
      // In readOnly mode or unavailable elements, just show detail
      setSelectedElement(el);
      onElementClick?.(el);
      return;
    }

    // Cycle through states
    const currentState = el.state || "MISSING";
    const currentIdx = STATE_CYCLE.indexOf(currentState);
    const nextState = STATE_CYCLE[(currentIdx + 1) % STATE_CYCLE.length];

    onStateChange?.(el.sym, nextState);
    onElementClick?.(el);
  }, [readOnly, onStateChange, onElementClick]);

  const cellSize = compact ? 36 : 48;
  const gap = compact ? 2 : 3;

  return (
    <div style={styles.wrapper}>
      {/* Filter controls */}
      {showFilters && (
        <div style={styles.filters}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>State:</label>
            <select
              style={styles.filterSelect}
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
            >
              <option value="ALL">All States</option>
              {STATE_CYCLE.map(s => (
                <option key={s} value={s}>{STATE_CONFIG[s].label} ({stats[s] || 0})</option>
              ))}
            </select>
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Group:</label>
            <select
              style={styles.filterSelect}
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
            >
              <option value="ALL">All Groups</option>
              {groups.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={styles.legend}>
        {Object.entries(STATE_CONFIG).map(([key, cfg]) => (
          <LegendItem key={key} color={cfg.border} label={`${cfg.label} (${stats[key] || 0})`} icon={cfg.badge} />
        ))}
        <span style={styles.legendStat}>
          {stats.OWNED} / {elements.length} collected ({Math.round((stats.OWNED / Math.max(elements.length, 1)) * 100)}%)
        </span>
      </div>

      {/* Click hint */}
      {!readOnly && !compact && (
        <div style={styles.clickHint}>
          💡 Click an element to cycle: Missing → Owned → Wanted → Watchlist
        </div>
      )}

      {/* Table grid */}
      <div style={styles.tableScroll}>
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${TABLE_COLS}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${TABLE_ROWS}, ${cellSize}px)`,
          gap: `${gap}px`,
          width: "fit-content",
          margin: "0 auto",
        }}>
          {Array.from({ length: TABLE_ROWS }, (_, r) =>
            Array.from({ length: TABLE_COLS }, (_, c) => {
              const row = r + 1;
              const col = c + 1;
              const key = `${row}-${col}`;
              const el = grid[key];

              if (row === 8) {
                if (col === 3) {
                  return <div key={key} style={{ ...styles.labelCell, gridRow: row, gridColumn: col }}>
                    <span style={styles.seriesLabel}>La</span>
                  </div>;
                }
                return <div key={key} style={{ gridRow: row, gridColumn: col }} />;
              }

              if (!el) {
                return <div key={key} style={{ gridRow: row, gridColumn: col }} />;
              }

              const stateCfg = STATE_CONFIG[el.state] || STATE_CONFIG.MISSING;
              const groupColor = GROUP_COLORS[el.group] || { bg: "#fff", border: "#ccc", text: "#333" };
              const isDisabled = !el.isAvailable;
              const isFiltered = !el.visible;
              const isActive = selectedElement?.z === el.z;

              return (
                <div
                  key={key}
                  style={{
                    gridRow: row,
                    gridColumn: col,
                    width: cellSize,
                    height: cellSize,
                    background: isDisabled ? "#f5f5f5" : isFiltered ? "#fafafa" : stateCfg.bg,
                    border: `2px solid ${isActive ? "#1565c0" : isDisabled ? "#e0e0e0" : isFiltered ? "#eee" : stateCfg.border}`,
                    borderRadius: compact ? 4 : 6,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: isDisabled ? "default" : "pointer",
                    opacity: isDisabled ? 0.3 : isFiltered ? 0.2 : 1,
                    position: "relative",
                    transition: "transform 0.1s, box-shadow 0.1s, opacity 0.2s",
                    transform: isActive ? "scale(1.1)" : "scale(1)",
                    boxShadow: isActive ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
                    zIndex: isActive ? 10 : 1,
                  }}
                  onClick={() => handleCellClick(el)}
                  onMouseEnter={() => setHoveredElement(el)}
                  onMouseLeave={() => setHoveredElement(null)}
                  title={`${el.z}. ${el.name} (${el.sym}) — ${stateCfg.label}${!readOnly ? " · Click to change" : ""}`}
                >
                  <span style={{
                    fontSize: compact ? 7 : 9,
                    color: isDisabled ? "#bdbdbd" : groupColor.text,
                    fontWeight: 600,
                    lineHeight: 1,
                  }}>{el.z}</span>
                  <span style={{
                    fontSize: compact ? 12 : 16,
                    fontWeight: 800,
                    color: isDisabled ? "#bdbdbd" : groupColor.text,
                    lineHeight: 1.1,
                  }}>{el.sym}</span>
                  {!compact && (
                    <span style={{
                      fontSize: 6,
                      color: isDisabled ? "#bdbdbd" : "#666",
                      lineHeight: 1,
                      maxWidth: cellSize - 4,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>{el.name}</span>
                  )}
                  {stateCfg.badge && !isFiltered && (
                    <span style={{
                      position: "absolute",
                      top: -3,
                      right: -3,
                      fontSize: compact ? 8 : 10,
                      color: stateCfg.badgeColor,
                      background: "#fff",
                      borderRadius: "50%",
                      width: compact ? 12 : 14,
                      height: compact ? 12 : 14,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                    }}>{stateCfg.badge}</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Element Detail Popover */}
      {selectedElement && (
        <div style={styles.popover}>
          <div style={styles.popoverHeader}>
            <div>
              <span style={styles.popoverZ}>{selectedElement.z}</span>
              <span style={styles.popoverSym}>{selectedElement.sym}</span>
            </div>
            <button style={styles.popoverClose} onClick={() => setSelectedElement(null)}>✕</button>
          </div>
          <h4 style={styles.popoverName}>{selectedElement.name}</h4>
          <div style={styles.popoverMeta}>
            <span>Group: {selectedElement.group}</span>
            <span>Phase: {selectedElement.phase}</span>
          </div>
          <div style={{
            ...styles.popoverStatus,
            color: STATE_CONFIG[selectedElement.state]?.badgeColor || "#333",
            background: STATE_CONFIG[selectedElement.state]?.bg || "#f8f8f8",
          }}>
            {STATE_CONFIG[selectedElement.state]?.badge} {STATE_CONFIG[selectedElement.state]?.label || "Unknown"}
          </div>
          {!readOnly && (
            <div style={styles.popoverActions}>
              {STATE_CYCLE.map(state => (
                <button
                  key={state}
                  style={{
                    ...styles.popoverBtn,
                    ...(selectedElement.state === state ? { background: STATE_CONFIG[state].bg, borderColor: STATE_CONFIG[state].border, fontWeight: 700 } : {}),
                  }}
                  onClick={() => {
                    onStateChange?.(selectedElement.sym, state);
                    setSelectedElement(null);
                  }}
                >
                  {STATE_CONFIG[state].badge} {STATE_CONFIG[state].label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Hover tooltip */}
      {hoveredElement && !selectedElement && (
        <div style={styles.tooltip}>
          <strong>{hoveredElement.z}. {hoveredElement.name}</strong> ({hoveredElement.sym})
          <br />
          <span style={{ fontSize: 11, color: "#aaa" }}>
            {hoveredElement.group} · {STATE_CONFIG[hoveredElement.state]?.label || "Missing"}
            {!readOnly && " · Click to change"}
          </span>
        </div>
      )}
    </div>
  );
}

function LegendItem({ color, label, icon }) {
  return (
    <span style={styles.legendItem}>
      <span style={{
        width: 14, height: 14, borderRadius: 3,
        border: `2px solid ${color}`,
        background: color === "#e0e0e0" ? "#f5f5f5" : color + "22",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 8, color: color,
      }}>{icon}</span>
      <span>{label}</span>
    </span>
  );
}

const styles = {
  wrapper: { position: "relative" },
  filters: {
    display: "flex",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 12,
    padding: "8px 12px",
    background: "#f8f9fa",
    borderRadius: 8,
    border: "1px solid #e9ecef",
  },
  filterGroup: { display: "flex", alignItems: "center", gap: 6 },
  filterLabel: { fontSize: 12, fontWeight: 600, color: "#555" },
  filterSelect: {
    fontSize: 12, padding: "4px 8px", borderRadius: 6,
    border: "1px solid #dee2e6", background: "#fff", cursor: "pointer",
  },
  legend: {
    display: "flex", flexWrap: "wrap", gap: 12,
    marginBottom: 12, fontSize: 12, color: "#555", alignItems: "center",
  },
  legendItem: { display: "flex", alignItems: "center", gap: 4 },
  legendStat: { marginLeft: "auto", fontWeight: 700, color: "#388E3C", fontSize: 13 },
  clickHint: {
    fontSize: 11, color: "#888", textAlign: "center",
    marginBottom: 8, fontStyle: "italic",
  },
  tableScroll: { overflowX: "auto", paddingBottom: 8, WebkitOverflowScrolling: "touch" },
  labelCell: { display: "flex", alignItems: "center", justifyContent: "center" },
  seriesLabel: { fontSize: 9, color: "#999", fontWeight: 600 },
  popover: {
    position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
    background: "#fff", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
    padding: 24, minWidth: 300, zIndex: 1000, border: "1px solid #e0e0e0",
  },
  popoverHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  popoverZ: { fontSize: 13, color: "#888", fontWeight: 600, display: "block" },
  popoverSym: { fontSize: 40, fontWeight: 800, color: "#333", lineHeight: 1 },
  popoverClose: { background: "none", border: "none", fontSize: 20, color: "#999", cursor: "pointer", padding: 4 },
  popoverName: { fontSize: 18, fontWeight: 700, color: "#333", margin: "0 0 8px" },
  popoverMeta: { display: "flex", gap: 12, fontSize: 12, color: "#888", marginBottom: 12 },
  popoverStatus: { fontSize: 14, fontWeight: 600, padding: "8px 12px", borderRadius: 8, marginBottom: 16 },
  popoverActions: { display: "flex", gap: 8, flexWrap: "wrap" },
  popoverBtn: {
    padding: "6px 12px", borderRadius: 8, border: "1px solid #e0e0e0",
    background: "#fff", color: "#333", fontSize: 12, fontWeight: 600, cursor: "pointer",
    transition: "all 0.15s",
  },
  tooltip: {
    position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
    background: "#333", color: "#fff", padding: "8px 16px", borderRadius: 8,
    fontSize: 13, zIndex: 999, pointerEvents: "none", whiteSpace: "nowrap",
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
  },
};
