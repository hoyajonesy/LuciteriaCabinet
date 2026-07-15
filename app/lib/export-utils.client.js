/**
 * Client-side export utilities for CSV and XLSX generation.
 * Triggers browser download.
 */

/**
 * Generate and download a CSV file.
 */
export function exportCSV(data, columns, filename) {
  const header = columns.map(c => c.label).join(",");
  const rows = data.map(row =>
    columns.map(c => {
      let val = typeof c.accessor === "function" ? c.accessor(row) : row[c.key];
      if (val == null) val = "";
      val = String(val).replace(/"/g, '""');
      return `"${val}"`;
    }).join(",")
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${filename}.csv`);
}

/**
 * Generate and download a JSON file.
 */
export function exportJSON(data, filename) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  downloadBlob(blob, `${filename}.json`);
}

/**
 * Download a Blob as a file.
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Get today's date string for filenames.
 */
export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
