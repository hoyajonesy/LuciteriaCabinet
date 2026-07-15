/**
 * CompletionProgress — Phase 2 completion progress rings per format
 * Only renders if phase2_completion_display flag is enabled.
 * Shows "X/118 elements owned" counters per format.
 */
import React from "react";

const FORMAT_LABELS = {
  "10mm": "10mm Cubes",
  "25.4mm": "25.4mm Cubes",
  "50mm": "50mm Cubes",
  "lucite": "Lucite Cubes",
  "ampoules": "Ampoules",
};

function ProgressRing({ owned, total, format, size = 90 }) {
  const pct = total > 0 ? Math.round((owned / total) * 100) : 0;
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  const color = pct >= 75 ? "#059669" : pct >= 40 ? "#F59E0B" : "#6366F1";

  return (
    <div style={{ textAlign: "center" }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#E5E7EB" strokeWidth="6"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
        <text
          x={size / 2} y={size / 2 - 4}
          textAnchor="middle" fontSize="16" fontWeight="700" fill="#111827"
        >
          {pct}%
        </text>
        <text
          x={size / 2} y={size / 2 + 12}
          textAnchor="middle" fontSize="10" fill="#6B7280"
        >
          {owned}/{total}
        </text>
      </svg>
      <div style={{ fontSize: "12px", fontWeight: 600, color: "#374151", marginTop: "4px" }}>
        {FORMAT_LABELS[format] || format}
      </div>
    </div>
  );
}

export default function CompletionProgress({ progressData = [] }) {
  if (!progressData || progressData.length === 0) {
    return (
      <div style={styles.empty}>
        <span style={{ fontSize: "24px" }}>📊</span>
        <p>No completion data available yet.</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h4 style={styles.heading}>Collection Completion</h4>
      <div style={styles.grid}>
        {progressData.map((p) => (
          <ProgressRing
            key={p.format}
            owned={p.owned}
            total={p.total}
            format={p.format}
          />
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: "20px", backgroundColor: "#fff", borderRadius: "12px",
    border: "1px solid #E5E7EB",
  },
  heading: { margin: "0 0 16px", fontSize: "16px", fontWeight: 700, color: "#111827" },
  grid: { display: "flex", gap: "24px", flexWrap: "wrap", justifyContent: "center" },
  empty: {
    textAlign: "center", padding: "24px", color: "#6B7280",
    backgroundColor: "#F9FAFB", borderRadius: "12px",
  },
};
