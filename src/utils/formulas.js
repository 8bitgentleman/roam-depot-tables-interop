// ─── Formula engine ────────────────────────────────────────────────────────────

export function isFormula(text) {
  return typeof text === 'string' && text.startsWith('=');
}

// "A" → 0, "B" → 1, "Z" → 25, "AA" → 26
export function letterToColIndex(letters) {
  let result = 0;
  for (let i = 0; i < letters.length; i++) {
    result = result * 26 + (letters.charCodeAt(i) - 64);
  }
  return result - 1;
}

// "B2" → { col: 1, row: 1 } (both 0-indexed; A1 notation row 1 = data row index 0)
function parseAddress(addr) {
  const m = addr.trim().match(/^([A-Z]+)(\d+)$/i);
  if (!m) return null;
  return { col: letterToColIndex(m[1].toUpperCase()), row: parseInt(m[2]) - 1 };
}

// "B2:D4" or "B2" → array of { col, row }
function expandRange(ref) {
  const parts = ref.split(':');
  if (parts.length === 1) {
    const addr = parseAddress(parts[0]);
    return addr ? [addr] : [];
  }
  const start = parseAddress(parts[0]);
  const end = parseAddress(parts[1]);
  if (!start || !end) return [];
  const cells = [];
  for (let r = Math.min(start.row, end.row); r <= Math.max(start.row, end.row); r++) {
    for (let c = Math.min(start.col, end.col); c <= Math.max(start.col, end.col); c++) {
      cells.push({ col: c, row: r });
    }
  }
  return cells;
}

// getCellValue(rowIndex, colIndex) → string (0-indexed, visual order)
// visited: Set of "row,col" strings to detect circular refs
export function evalFormula(text, getCellValue, visited = new Set()) {
  if (!isFormula(text)) return text;
  const expr = text.slice(1).trim();

  // Bare cell reference: =B2
  const bareAddr = parseAddress(expr);
  if (bareAddr) {
    return getCellValue(bareAddr.row, bareAddr.col, visited) ?? '';
  }

  // Function call: FUNC(arg1, arg2, ...)
  const m = expr.match(/^([A-Z]+)\((.+)\)$/i);
  if (!m) return '#SYNTAX';

  const fn = m[1].toUpperCase();
  const argsStr = m[2];

  // Args are comma-separated; ranges use : so commas only split at the top level
  const args = argsStr.split(',').map(s => s.trim());
  const cells = args.flatMap(expandRange);

  const rawValues = cells.map(({ row, col }) => getCellValue(row, col, visited) ?? '');
  const nums = rawValues.map(v => parseFloat(v)).filter(n => !isNaN(n));

  switch (fn) {
    case 'SUM':   return String(nums.reduce((a, b) => a + b, 0));
    case 'AVG':   return nums.length ? String(nums.reduce((a, b) => a + b, 0) / nums.length) : '#DIV/0!';
    case 'COUNT': return String(nums.length);
    case 'MIN':   return nums.length ? String(Math.min(...nums)) : '';
    case 'MAX':   return nums.length ? String(Math.max(...nums)) : '';
    default:      return `#NAME?`;
  }
}
