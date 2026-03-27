import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  HTMLTable,
  Button,
  MenuItem,
  Popover,
  Menu,
  MenuDivider,
  Icon,
} from '@blueprintjs/core';
import createBlock from 'roamjs-components/writes/createBlock';
import updateBlock from 'roamjs-components/writes/updateBlock';
import {
  getRowCells,
  buildRowNode,
  getChainTail,
  getChainNodeAtDepth,
  getTableState,
  colIndexToLetter,
} from '../utils/blockHelpers';
import { STYLE_CONFIG, getBlockSettings, saveBlockSettings } from '../utils/settings';
import { isFormula, evalFormula } from '../utils/formulas';

const dragImage = document.createElement('img');
dragImage.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

// ─── Status colors (fixed set, keyed by lowercase label) ──────────────────────
const STATUS_COLORS = {
  'todo':        { bg: 'rgba(255, 201, 64, 0.25)',  row: 'rgba(255, 201, 64, 0.08)'  },
  'doing':       { bg: 'rgba(45, 114, 210, 0.25)',  row: 'rgba(45, 114, 210, 0.07)'  },
  'in progress': { bg: 'rgba(45, 114, 210, 0.25)',  row: 'rgba(45, 114, 210, 0.07)'  },
  'done':        { bg: 'rgba(61, 204, 145, 0.25)',  row: 'rgba(61, 204, 145, 0.08)'  },
  'complete':    { bg: 'rgba(61, 204, 145, 0.25)',  row: 'rgba(61, 204, 145, 0.08)'  },
  'cancelled':   { bg: 'rgba(191, 204, 214, 0.55)', row: 'rgba(191, 204, 214, 0.22)' },
  'blocked':     { bg: 'rgba(219, 55, 55, 0.22)',   row: 'rgba(219, 55, 55, 0.07)'   },
  'waiting':     { bg: 'rgba(206, 132, 0, 0.22)',   row: 'rgba(206, 132, 0, 0.07)'   },
};

function getStatusColor(value) {
  return STATUS_COLORS[value?.toLowerCase()] ?? null;
}

// ─── Roam string renderer ─────────────────────────────────────────────────────
const getRoamString = () => window.roamAlphaAPI?.ui?.react?.BlockString;

// ─── Roam block renderer ──────────────────────────────────────────────────────
const RoamBlock = ({ uid }) => {
  const elRef = useRef(null);
  useEffect(() => {
    const el = elRef.current;
    if (!el || !uid || !window.roamAlphaAPI?.ui?.components?.renderBlock) return;
    window.roamAlphaAPI.ui.components.renderBlock({ uid, el, 'open?': false });
    return () => { if (el) el.innerHTML = ''; };
  }, [uid]);
  return <div ref={elRef} onClick={(e) => e.stopPropagation()} />;
};

// ─── Auto-resizing textarea ───────────────────────────────────────────────────
const AutoTextarea = React.forwardRef(({ value, onChange, onBlur, onKeyDown, className, autoFocus, minWidth }, ref) => {
  const inner = useRef(null);
  React.useImperativeHandle(ref, () => inner.current);
  const resize = useCallback(() => {
    const el = inner.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);
  useEffect(() => {
    resize();
    if (autoFocus) inner.current?.focus();
  }, [value, autoFocus, resize]);
  return (
    <textarea
      ref={inner}
      className={className}
      style={minWidth ? { minWidth } : undefined}
      value={value}
      rows={1}
      onChange={(e) => { onChange(e); resize(); }}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    />
  );
});

// ─── Sort icon ────────────────────────────────────────────────────────────────
const SortIcon = ({ active, dir, onClick }) => (
  <span
    className={`rdt-sort-icon${active ? ' rdt-sort-active' : ''}`}
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    title="Sort"
  >
    <Icon icon={active ? (dir === 'asc' ? 'sort-asc' : 'sort-desc') : 'sort'} iconSize={12} />
  </span>
);

// ─── Column options editor ────────────────────────────────────────────────────
const ColumnOptionsEditor = ({ colSettings, isStatus, onSave, onClose }) => {
  const [options, setOptions] = useState(() =>
    (colSettings.options || []).map(o =>
      typeof o === 'string' ? { label: o, hidden: false } : { ...o }
    )
  );
  const [newLabel, setNewLabel] = useState('');

  function addOption() {
    const label = newLabel.trim();
    if (!label) return;
    setOptions(prev => [...prev, { label, hidden: false }]);
    setNewLabel('');
  }

  return (
    <div className="rdt-col-config" onClick={e => e.stopPropagation()}>
      <div className="rdt-col-config-header">
        {isStatus ? 'Status options' : 'Dropdown options'}
      </div>
      <div className="rdt-col-config-list">
        {options.map((opt, i) => (
          <div key={i} className="rdt-col-config-row">
            {isStatus && (
              <span
                className="rdt-status-pill"
                style={{ backgroundColor: getStatusColor(opt.label)?.bg ?? 'rgba(0,0,0,0.08)', flexShrink: 0 }}
              >
                &nbsp;
              </span>
            )}
            <input
              className="rdt-col-config-input"
              value={opt.label}
              onChange={e => setOptions(prev => prev.map((o, idx) => idx === i ? { ...o, label: e.target.value } : o))}
              placeholder="Option label"
            />
            {isStatus && (
              <label className="rdt-col-config-hidden-label" title="Hide rows with this status by default">
                <input
                  type="checkbox"
                  checked={!!opt.hidden}
                  onChange={() => setOptions(prev => prev.map((o, idx) => idx === i ? { ...o, hidden: !o.hidden } : o))}
                />
                hide
              </label>
            )}
            <button
              className="rdt-col-config-delete"
              onClick={() => setOptions(prev => prev.filter((_, idx) => idx !== i))}
              title="Remove option"
            >×</button>
          </div>
        ))}
      </div>
      <div className="rdt-col-config-add">
        <input
          className="rdt-col-config-input"
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
          placeholder="New option…"
        />
        <Button minimal small icon="plus" onClick={addOption} />
      </div>
      <div className="rdt-col-config-footer">
        <Button small text="Save" intent="primary" onClick={() => onSave(options)} />
        <Button small minimal text="Cancel" onClick={onClose} />
      </div>
    </div>
  );
};

// ─── DisplayTable ─────────────────────────────────────────────────────────────
const DisplayTable = ({ blockUid }) => {
  const [state, setState] = useState(() => getTableState(blockUid));
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const containerRef = useRef(null);
  const { headerNode, rows, styles, widths } = state;
  const columns = state.columns || {};

  // ── Sort ──────────────────────────────────────────────────────────────────
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState(null);

  const sortedRows = useMemo(() => {
    if (sortCol === null) return rows;
    return [...rows].sort((a, b) => {
      const aText = getRowCells(a)[sortCol]?.text ?? '';
      const bText = getRowCells(b)[sortCol]?.text ?? '';
      const aNum = parseFloat(aText);
      const bNum = parseFloat(bText);
      const cmp = (!isNaN(aNum) && !isNaN(bNum))
        ? aNum - bNum
        : aText.localeCompare(bText);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortCol, sortDir]);

  function cycleSort(colIndex) {
    if (sortCol !== colIndex) { setSortCol(colIndex); setSortDir('asc'); }
    else if (sortDir === 'asc') setSortDir('desc');
    else { setSortCol(null); setSortDir(null); }
  }

  // ── Filter ────────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState({});
  const [openFilters, setOpenFilters] = useState(new Set());

  function toggleFilter(colIndex) {
    setOpenFilters(prev => {
      const next = new Set(prev);
      if (next.has(colIndex)) {
        next.delete(colIndex);
        setFilters(f => { const n = { ...f }; delete n[colIndex]; return n; });
      } else {
        next.add(colIndex);
      }
      return next;
    });
  }

  const showFilterRow = openFilters.size > 0;

  const filteredRows = useMemo(() => {
    const active = Object.entries(filters).filter(([, v]) => v);
    if (!active.length) return sortedRows;
    return sortedRows.filter(row => {
      const cells = getRowCells(row);
      return active.every(([i, text]) =>
        (cells[parseInt(i)]?.text ?? '').toLowerCase().includes(text.toLowerCase())
      );
    });
  }, [sortedRows, filters]);

  const hasActiveFilter = Object.values(filters).some(Boolean);

  // ── Status column + hidden rows ───────────────────────────────────────────
  const statusColIndex = useMemo(() => {
    const entry = Object.entries(columns).find(([, col]) => col.type === 'status');
    return entry ? parseInt(entry[0]) : null;
  }, [columns]);

  const hiddenStatusLabels = useMemo(() => {
    if (statusColIndex === null) return new Set();
    const opts = columns[statusColIndex]?.options ?? [];
    return new Set(opts.filter(o => o.hidden).map(o => o.label.toLowerCase()));
  }, [columns, statusColIndex]);

  const { visibleRows, hiddenRows } = useMemo(() => {
    if (statusColIndex === null || hiddenStatusLabels.size === 0) {
      return { visibleRows: filteredRows, hiddenRows: [] };
    }
    const visible = [], hidden = [];
    for (const row of filteredRows) {
      const val = (getRowCells(row)[statusColIndex]?.text ?? '').toLowerCase();
      if (hiddenStatusLabels.has(val)) hidden.push(row);
      else visible.push(row);
    }
    return { visibleRows: visible, hiddenRows: hidden };
  }, [filteredRows, statusColIndex, hiddenStatusLabels]);

  // Combined display order: visible first, hidden second
  const displayRows = useMemo(() => [...visibleRows, ...hiddenRows], [visibleRows, hiddenRows]);

  const [showHidden, setShowHidden] = useState(false);

  function getRowBgStyle(row) {
    if (statusColIndex === null) return {};
    const val = getRowCells(row)[statusColIndex]?.text;
    const color = getStatusColor(val);
    return color ? { backgroundColor: color.row } : {};
  }

  // ── Cell editing ──────────────────────────────────────────────────────────
  const [editingCell, setEditingCell] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [editingCellWidth, setEditingCellWidth] = useState(null);
  const editInputRef = useRef(null);
  const cancelEditRef = useRef(false);
  const [localOverrides, setLocalOverrides] = useState({});

  // ── Dropdown cell ──────────────────────────────────────────────────────────
  // { rowIndex, colIndex } — rowIndex is in displayRows space
  const [dropdownCell, setDropdownCell] = useState(null);

  // ── Formula selection ──────────────────────────────────────────────────────
  const [formulaAnchor, setFormulaAnchor] = useState(null);
  const [formulaDragCurrent, setFormulaDragCurrent] = useState(null);
  const isFormulaEditing = editingCell !== null && editingText.startsWith('=');

  function cellAddress(rowIndex, colIndex) {
    return `${colIndexToLetter(colIndex)}${rowIndex + 1}`;
  }

  function insertAtCursor(text) {
    const el = editInputRef.current;
    if (!el) return;
    const start = el.selectionStart ?? editingText.length;
    const end = el.selectionEnd ?? editingText.length;
    const newText = editingText.slice(0, start) + text + editingText.slice(end);
    setEditingText(newText);
    requestAnimationFrame(() => {
      if (!editInputRef.current) return;
      editInputRef.current.focus();
      editInputRef.current.setSelectionRange(start + text.length, start + text.length);
    });
  }

  function resolveFormulaMouseUp(toRow, toCol) {
    if (!formulaAnchor) return;
    const { rowIndex: aRow, colIndex: aCol } = formulaAnchor;
    setFormulaAnchor(null);
    setFormulaDragCurrent(null);
    const minRow = Math.min(aRow, toRow), maxRow = Math.max(aRow, toRow);
    const minCol = Math.min(aCol, toCol), maxCol = Math.max(aCol, toCol);
    const addr = (minRow === maxRow && minCol === maxCol)
      ? cellAddress(minRow, minCol)
      : `${cellAddress(minRow, minCol)}:${cellAddress(maxRow, maxCol)}`;
    insertAtCursor(addr);
  }

  function isInFormulaSelection(rowIndex, colIndex) {
    if (!formulaAnchor || !formulaDragCurrent) return false;
    const minRow = Math.min(formulaAnchor.rowIndex, formulaDragCurrent.rowIndex);
    const maxRow = Math.max(formulaAnchor.rowIndex, formulaDragCurrent.rowIndex);
    const minCol = Math.min(formulaAnchor.colIndex, formulaDragCurrent.colIndex);
    const maxCol = Math.max(formulaAnchor.colIndex, formulaDragCurrent.colIndex);
    return rowIndex >= minRow && rowIndex <= maxRow && colIndex >= minCol && colIndex <= maxCol;
  }

  useEffect(() => {
    if (!formulaAnchor) return;
    const cancel = () => { setFormulaAnchor(null); setFormulaDragCurrent(null); };
    document.addEventListener('mouseup', cancel);
    return () => document.removeEventListener('mouseup', cancel);
  }, [formulaAnchor]);

  // Formula evaluation uses displayRows (visible + hidden) for consistent addressing
  const getCellValue = useCallback((rowIdx, colIdx, visited = new Set()) => {
    const row = displayRows[rowIdx];
    if (!row) return '';
    const cells = getRowCells(row);
    const cell = cells[colIdx];
    if (!cell) return '';
    const text = localOverrides[cell.uid] ?? cell.text ?? '';
    if (isFormula(text)) {
      const key = `${rowIdx},${colIdx}`;
      if (visited.has(key)) return '#CIRC!';
      const next = new Set(visited);
      next.add(key);
      return evalFormula(text, getCellValue, next);
    }
    return text;
  }, [displayRows, localOverrides]);

  function startEdit(rowIndex, colIndex, text) {
    setEditingCell({ rowIndex, colIndex });
    setEditingText(text ?? '');
    const w = thRefs[colIndex]?.current?.getBoundingClientRect().width;
    setEditingCellWidth(w || null);
  }

  function commitEdit(uid) {
    cancelEditRef.current = true;
    setLocalOverrides(prev => ({ ...prev, [uid]: editingText }));
    updateBlock({ uid, text: editingText });
    setEditingCell(null);
    setEditingText('');
    setEditingCellWidth(null);
    setTimeout(() => { cancelEditRef.current = false; }, 0);
  }

  function discardEdit() {
    cancelEditRef.current = true;
    setEditingCell(null);
    setEditingText('');
    setEditingCellWidth(null);
    setTimeout(() => { cancelEditRef.current = false; }, 0);
  }

  function handleCellBlur(uid) {
    if (cancelEditRef.current) { cancelEditRef.current = false; return; }
    setLocalOverrides(prev => ({ ...prev, [uid]: editingText }));
    updateBlock({ uid, text: editingText });
    setEditingCell(null);
    setEditingText('');
    setEditingCellWidth(null);
  }

  function handleCellKeyDown(e, uid, rowIndex, colIndex) {
    if (e.key === 'Escape') { e.preventDefault(); discardEdit(); return; }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commitEdit(uid);
      if (rowIndex >= 0) handleEnterKey(rowIndex, colIndex);
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      commitEdit(uid);
      handleTabKey(rowIndex, colIndex, e.shiftKey);
    }
  }

  function handleTabKey(rowIndex, colIndex, reverse) {
    const numCols = headerCells.length;
    let nextRow = rowIndex, nextCol = colIndex + (reverse ? -1 : 1);
    if (nextCol >= numCols) { nextCol = 0; nextRow = rowIndex < 0 ? 0 : rowIndex + 1; }
    if (nextCol < 0) { nextCol = numCols - 1; nextRow = rowIndex <= 0 ? -1 : rowIndex - 1; }
    // Tab navigation stays within visible rows only
    if (nextRow < -1 || nextRow >= visibleRows.length) return;
    if (nextRow === -1) {
      const cell = headerCells[nextCol];
      if (cell) startEdit(-1, nextCol, cell.text);
    } else {
      const row = visibleRows[nextRow];
      if (row) {
        const cells = getRowCells(row);
        startEdit(nextRow, nextCol, cells[nextCol]?.text ?? '');
      }
    }
  }

  // ── Enter key: add row and move down ────────────────────────────────────
  const headerCells = useMemo(
    () => headerNode ? getRowCells(headerNode) : [],
    [headerNode]
  );
  const numCols = headerCells.length;

  const enterStateRef = useRef({ rows, numCols, blockUid });
  useEffect(() => { enterStateRef.current = { rows, numCols, blockUid }; }, [rows, numCols, blockUid]);

  const [pendingEdit, setPendingEdit] = useState(null);

  useEffect(() => {
    if (!pendingEdit) return;
    const { rowIndex, colIndex } = pendingEdit;
    const row = visibleRows[rowIndex];
    if (row) {
      const cells = getRowCells(row);
      startEdit(rowIndex, colIndex, cells[colIndex]?.text ?? '');
    }
    setPendingEdit(null);
  }, [pendingEdit, visibleRows]);

  const isCreatingRowRef = useRef(false);

  function handleEnterKey(rowIndex, colIndex) {
    if (isCreatingRowRef.current) return;
    const { rows: currentRows, numCols: currentNumCols, blockUid: uid } = enterStateRef.current;
    const nextRowIndex = rowIndex + 1;
    if (nextRowIndex >= visibleRows.length) {
      if (hasActiveFilter) return;
      isCreatingRowRef.current = true;
      const fresh = getTableState(uid);
      createBlock({
        node: buildRowNode(currentNumCols),
        order: fresh.rows.length + 1,
        parentUid: uid,
      }).then(() => {
        isCreatingRowRef.current = false;
        setState(getTableState(uid));
        setPendingEdit({ rowIndex: nextRowIndex, colIndex });
      });
    } else {
      setPendingEdit({ rowIndex: nextRowIndex, colIndex });
    }
  }

  // ── Pull watch ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let debounceTimer;
    const query = `[:block/uid "${blockUid}"]`;
    const pattern = '[:block/uid :block/string {:block/children ...}]';
    const unwatch = window.roamAlphaAPI.data.addPullWatch(pattern, query, () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        setState(getTableState(blockUid));
        setLocalOverrides({});
      }, 200);
    });
    return () => {
      clearTimeout(debounceTimer);
      if (typeof unwatch === 'function') unwatch();
    };
  }, [blockUid]);

  // ── Column resize ──────────────────────────────────────────────────────────
  const [thRefs, setThRefs] = useState([]);
  useEffect(() => {
    setThRefs(headerCells.map(() => React.createRef()));
  }, [headerCells.length]);

  const resizeDragStart = useCallback((e) => {
    e.stopPropagation();
    e.dataTransfer.setDragImage(dragImage, 0, 0);
  }, []);

  const dragHandler = useCallback((e) => {
    const delta = e.clientX - e.currentTarget.getBoundingClientRect().left;
    const cellWidth = e.currentTarget.parentElement?.getBoundingClientRect().width;
    if (typeof cellWidth === 'undefined') return;
    if (cellWidth + delta <= 0) return;
    const rowWidth = e.currentTarget.parentElement?.parentElement?.getBoundingClientRect().width;
    if (typeof rowWidth === 'undefined') return;
    if (cellWidth + delta >= rowWidth) return;

    const column = e.currentTarget.getAttribute('data-column');
    if (!column) return;
    const columnIndex = parseInt(column.split('-')[1]) - 1;
    const th = thRefs[columnIndex]?.current;
    if (!th) return;

    const newWidth = `${cellWidth + delta}px`;
    th.style.width = newWidth;

    if (e.type !== 'dragend') return;

    const newWidths = Object.fromEntries(
      thRefs.map((ref, i) => [i, ref.current?.style.width]).filter(([, w]) => w)
    );
    const existing = getBlockSettings(blockUid);
    saveBlockSettings(blockUid, { ...existing, widths: newWidths });
  }, [blockUid, thRefs]);

  // ── Column type config ─────────────────────────────────────────────────────
  // headerMenu: colIndex | null  (right-click context menu open)
  // columnConfigOpen: colIndex | null  (options editor open)
  const [headerMenu, setHeaderMenu] = useState(null);
  const [columnConfigOpen, setColumnConfigOpen] = useState(null);
  // Prevents onInteraction(false) from immediately clearing columnConfigOpen
  // when a menu item click transitions us from menu → config editor.
  const openingConfigRef = useRef(false);

  function saveColumnSettings(colIndex, colSettings) {
    const existing = getBlockSettings(blockUid);
    const newColumns = { ...(existing.columns || {}), [colIndex]: colSettings };
    saveBlockSettings(blockUid, { ...existing, columns: newColumns });
    setState(prev => ({ ...prev, columns: newColumns }));
  }

  function setColumnType(colIndex, type) {
    const existing = columns[colIndex] || {};
    const updated = { ...existing, type, options: existing.options || [] };
    saveColumnSettings(colIndex, updated);
    if (type !== 'text') openingConfigRef.current = true;
    setHeaderMenu(null);
    if (type !== 'text') setColumnConfigOpen(colIndex);
  }

  function saveColumnOptions(colIndex, options) {
    const existing = columns[colIndex] || {};
    saveColumnSettings(colIndex, { ...existing, options });
    setColumnConfigOpen(null);
  }

  // ── Drag-and-drop row reordering ──────────────────────────────────────────
  const [dragRowUid, setDragRowUid] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  // Drag reorder only available when no sort and no text filter active
  const isDragEnabled = sortCol === null && !hasActiveFilter;

  async function handleRowDrop(dropIndex) {
    const dragIndex = visibleRows.findIndex(r => r.uid === dragRowUid);
    if (dragIndex === -1 || dragIndex === dropIndex) {
      setDragRowUid(null);
      setDragOverIndex(null);
      return;
    }
    const newVisible = [...visibleRows];
    const [moved] = newVisible.splice(dragIndex, 1);
    newVisible.splice(dropIndex, 0, moved);

    // Commit new order to Roam: visible rows first, then hidden
    const newOrder = [...newVisible, ...hiddenRows];
    for (let i = 0; i < newOrder.length; i++) {
      await window.roamAlphaAPI.moveBlock({
        location: { 'parent-uid': blockUid, order: i + 1 },
        block: { uid: newOrder[i].uid },
      });
    }
    setDragRowUid(null);
    setDragOverIndex(null);
    setState(getTableState(blockUid));
  }

  // ── Rendering helpers ──────────────────────────────────────────────────────
  const showAddresses = !!styles.showAddresses;

  function renderCellContent(cell, rowIndex, colIndex) {
    const colSetting = columns[colIndex];
    const isTyped = colSetting && (colSetting.type === 'dropdown' || colSetting.type === 'status');
    const isStatus = colSetting?.type === 'status';
    const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.colIndex === colIndex;
    const isDropdownOpen = dropdownCell?.rowIndex === rowIndex && dropdownCell?.colIndex === colIndex;

    if (isEditing) {
      return (
        <AutoTextarea
          ref={editInputRef}
          autoFocus
          className="rdt-cell-input"
          minWidth={editingCellWidth}
          value={editingText}
          onChange={(e) => setEditingText(e.target.value)}
          onBlur={() => handleCellBlur(cell.uid)}
          onKeyDown={(e) => handleCellKeyDown(e, cell.uid, rowIndex, colIndex)}
        />
      );
    }

    const rawText = localOverrides[cell.uid] ?? cell.text;
    const formula = isFormula(rawText);
    const RoamString = getRoamString();

    // Typed column (dropdown / status) — show pill + dropdown popover
    if (isTyped && !formula) {
      const opts = colSetting.options || [];
      const pillBgStyle = isStatus ? (getStatusColor(rawText)?.bg ?? null) : null;
      const isHiddenStatus = isStatus && hiddenStatusLabels.has(rawText?.toLowerCase());

      return (
        <Popover
          isOpen={isDropdownOpen}
          onInteraction={(v) => { if (!v) setDropdownCell(null); }}
          enforceFocus={false}
          autoFocus={false}
          content={
            <Menu className="rdt-dropdown-menu">
              {opts.length === 0 && (
                <MenuItem disabled text="No options — right-click column header to configure" />
              )}
              {opts.map((opt, i) => {
                const label = typeof opt === 'string' ? opt : opt.label;
                const optBg = isStatus ? (getStatusColor(label)?.bg ?? null) : null;
                return (
                  <MenuItem
                    key={i}
                    text={
                      isStatus
                        ? <span className="rdt-status-pill" style={optBg ? { backgroundColor: optBg } : {}}>{label}</span>
                        : label
                    }
                    onClick={() => {
                      setLocalOverrides(prev => ({ ...prev, [cell.uid]: label }));
                      updateBlock({ uid: cell.uid, text: label });
                      setDropdownCell(null);
                    }}
                  />
                );
              })}
            </Menu>
          }
        >
          <div className="rdt-cell-display rdt-cell-typed">
            {rawText
              ? (
                <span
                  className={`rdt-status-pill${isHiddenStatus ? ' rdt-status-done' : ''}`}
                  style={pillBgStyle ? { backgroundColor: pillBgStyle } : {}}
                >
                  {rawText}
                </span>
              )
              : <span className="rdt-cell-placeholder">▾</span>
            }
          </div>
        </Popover>
      );
    }

    // Default: formula or plain Roam block
    return (
      <div className={`rdt-cell-display${formula ? ' rdt-formula-cell' : ''}`}>
        {formula
          ? (() => {
              const displayText = evalFormula(rawText, getCellValue);
              return displayText
                ? (RoamString ? <RoamString string={displayText} /> : displayText)
                : <span className="rdt-cell-placeholder">&nbsp;</span>;
            })()
          : <RoamBlock uid={cell.uid} />
        }
        {formula && <span className="rdt-formula-badge" title={rawText}>fx</span>}
      </div>
    );
  }

  // ── Settings helpers ───────────────────────────────────────────────────────
  function toggleStyle(key) {
    const newStyles = { ...styles, [key]: !styles[key] };
    setState(prev => ({ ...prev, styles: newStyles }));
    const existing = getBlockSettings(blockUid);
    saveBlockSettings(blockUid, { ...existing, styles: newStyles });
  }

  // ── Table menu ─────────────────────────────────────────────────────────────
  const tableMenu = (
    <Popover
      enforceFocus={false}
      autoFocus={false}
      isOpen={isMenuOpen}
      target={<Button minimal icon="more" />}
      onInteraction={(v) => setIsMenuOpen(v)}
      content={
        <Menu>
          <MenuItem icon="add" text="Add">
            <MenuItem
              icon="add-row-bottom"
              text="Row"
              onClick={async () => {
                const fresh = getTableState(blockUid);
                await createBlock({
                  node: buildRowNode(numCols),
                  order: fresh.rows.length + 1,
                  parentUid: blockUid,
                });
                setState(getTableState(blockUid));
              }}
            />
            <MenuItem
              icon="add-column-right"
              text="Column"
              onClick={async () => {
                if (!headerNode) return;
                await createBlock({
                  node: { text: `Header ${numCols + 1}` },
                  order: 'last',
                  parentUid: getChainTail(headerNode).uid,
                });
                for (const row of rows) {
                  await createBlock({
                    node: { text: '' },
                    order: 'last',
                    parentUid: getChainTail(row).uid,
                  });
                }
                setState(getTableState(blockUid));
              }}
            />
          </MenuItem>
          <MenuItem icon="remove" text="Remove">
            <MenuItem
              icon="remove-row-bottom"
              text="Last Row"
              onClick={async () => {
                const fresh = getTableState(blockUid);
                if (!fresh.rows.length) return;
                const lastRow = fresh.rows[fresh.rows.length - 1];
                await window.roamAlphaAPI.deleteBlock({ block: { uid: lastRow.uid } });
                setState(getTableState(blockUid));
              }}
            />
            <MenuItem
              icon="remove-column-right"
              text="Last Column"
              onClick={async () => {
                if (numCols <= 1) return;
                const depth = numCols - 2;
                const preTailHeader = getChainNodeAtDepth(headerNode, depth);
                if (preTailHeader?.children?.[0]) {
                  await window.roamAlphaAPI.deleteBlock({ block: { uid: preTailHeader.children[0].uid } });
                }
                for (const row of rows) {
                  const preTailRow = getChainNodeAtDepth(row, depth);
                  if (preTailRow?.children?.[0]) {
                    await window.roamAlphaAPI.deleteBlock({ block: { uid: preTailRow.children[0].uid } });
                  }
                }
                setState(getTableState(blockUid));
              }}
            />
          </MenuItem>
          {showFilterRow && (
            <>
              <MenuDivider />
              <MenuItem
                icon="filter-remove"
                text="Clear Filters"
                onClick={() => { setFilters({}); setOpenFilters(new Set()); }}
              />
            </>
          )}
          <MenuDivider />
          <MenuItem icon="cog" text="Settings">
            {STYLE_CONFIG.map(({ key, label }) => (
              <MenuItem
                key={key}
                icon={styles[key] ? 'tick' : 'blank'}
                text={label}
                onClick={() => toggleStyle(key)}
              />
            ))}
          </MenuItem>
        </Menu>
      }
    />
  );

  // ── Row renderer ───────────────────────────────────────────────────────────
  function renderRow(row, rowIndex, opts = {}) {
    const { isHidden = false } = opts;
    const cells = getRowCells(row);
    const rowBgStyle = getRowBgStyle(row);
    const isDragging = dragRowUid === row.uid;
    const isDropTarget = !isHidden && dragOverIndex === rowIndex;

    return (
      <tr
        key={row.uid}
        style={isHidden ? { ...rowBgStyle, opacity: 0.55 } : rowBgStyle}
        className={`${isDragging ? 'rdt-row-dragging' : ''}${isDropTarget ? ' rdt-row-drop-target' : ''}${isHidden ? ' rdt-hidden-row' : ''}`}
        onDragOver={(e) => {
          if (!isDragEnabled || !dragRowUid || isHidden) return;
          e.preventDefault();
          setDragOverIndex(rowIndex);
        }}
        onDrop={(e) => {
          if (!isDragEnabled || isHidden) return;
          e.preventDefault();
          handleRowDrop(rowIndex);
        }}
      >
        {isDragEnabled && (
          <td className="rdt-drag-handle-col" onClick={e => e.stopPropagation()}>
            {!isHidden && (
              <span
                className="rdt-drag-handle"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setDragImage(dragImage, 0, 0);
                  setDragRowUid(row.uid);
                }}
                onDragEnd={() => { setDragRowUid(null); setDragOverIndex(null); }}
              >
                ⠿
              </span>
            )}
          </td>
        )}
        {showAddresses && (
          <td className="rdt-addr-col">{rowIndex + 1}</td>
        )}
        {cells.map((cell, colIndex) => {
          const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.colIndex === colIndex;
          const colSetting = columns[colIndex];
          const isTyped = colSetting && (colSetting.type === 'dropdown' || colSetting.type === 'status');
          return (
            <td
              key={cell.uid}
              className={`rdt-cell${isEditing ? ' rdt-cell-editing' : ''}${isInFormulaSelection(rowIndex, colIndex) ? ' rdt-formula-selecting' : ''}`}
              style={{ overflow: 'hidden', position: 'relative', padding: 0 }}
              onMouseDown={(e) => {
                if (isFormulaEditing && !isEditing) {
                  e.preventDefault();
                  setFormulaAnchor({ rowIndex, colIndex });
                  setFormulaDragCurrent({ rowIndex, colIndex });
                }
              }}
              onMouseEnter={() => {
                if (formulaAnchor) setFormulaDragCurrent({ rowIndex, colIndex });
              }}
              onMouseUp={() => {
                if (isFormulaEditing && formulaAnchor) resolveFormulaMouseUp(rowIndex, colIndex);
              }}
              onClick={() => {
                if (isFormulaEditing) return;
                if (isTyped) {
                  setDropdownCell({ rowIndex, colIndex, uid: cell.uid });
                  return;
                }
                if (!isEditing) startEdit(rowIndex, colIndex, cell.text);
              }}
            >
              {renderCellContent(cell, rowIndex, colIndex)}
              {colIndex < cells.length - 1 && (
                <div
                  style={{
                    width: 11, cursor: 'ew-resize', position: 'absolute',
                    top: 0, right: 0, bottom: 0, paddingLeft: 5, pointerEvents: 'auto',
                  }}
                  data-column={`column-${colIndex + 1}`}
                  draggable
                  onDragStart={resizeDragStart}
                  onDrag={dragHandler}
                  onDragEnd={dragHandler}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </td>
          );
        })}
        <td className="rdt-menu-col" />
      </tr>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="rdt-table-wrap" ref={containerRef}>
      <HTMLTable
        className="rdt-table dont-focus-block"
        style={{ tableLayout: 'auto', pointerEvents: 'auto' }}
        bordered={styles.bordered}
        interactive={styles.interactive}
        striped={styles.striped}
      >
        <thead>
          <tr>
            {isDragEnabled && <th className="rdt-drag-col" />}
            {showAddresses && <th className="rdt-addr-col" style={{ width: 28 }}>#</th>}
            {headerCells.map((cell, i) => {
              const isEditing = editingCell?.rowIndex === -1 && editingCell?.colIndex === i;
              const colSetting = columns[i];
              const colType = colSetting?.type || 'text';
              const isHeaderMenuOpen = headerMenu === i;
              const isConfigOpen = columnConfigOpen === i;
              const showPopover = isHeaderMenuOpen || isConfigOpen;

              return (
                <th
                  key={cell.uid}
                  ref={thRefs[i]}
                  style={{ width: widths[i], overflow: 'hidden', padding: 0 }}
                >
                  <Popover
                    isOpen={showPopover}
                    onInteraction={(v) => {
                      if (!v) {
                        if (openingConfigRef.current) {
                          openingConfigRef.current = false;
                          return;
                        }
                        setHeaderMenu(null);
                        setColumnConfigOpen(null);
                      }
                    }}
                    enforceFocus={false}
                    autoFocus={false}
                    content={
                      isConfigOpen
                        ? (
                          <ColumnOptionsEditor
                            colSettings={colSetting || {}}
                            isStatus={colType === 'status'}
                            onSave={(opts) => saveColumnOptions(i, opts)}
                            onClose={() => setColumnConfigOpen(null)}
                          />
                        )
                        : (
                          <Menu>
                            <MenuItem icon="tag" text="Column type">
                              <MenuItem
                                icon={colType === 'text' ? 'tick' : 'blank'}
                                text="Text"
                                onClick={() => setColumnType(i, 'text')}
                              />
                              <MenuItem
                                icon={colType === 'dropdown' ? 'tick' : 'blank'}
                                text="Dropdown"
                                onClick={() => setColumnType(i, 'dropdown')}
                              />
                              <MenuItem
                                icon={colType === 'status' ? 'tick' : 'blank'}
                                text="Status"
                                onClick={() => setColumnType(i, 'status')}
                              />
                            </MenuItem>
                            {colType !== 'text' && (
                              <MenuItem
                                icon="edit"
                                text="Edit options…"
                                onClick={() => { openingConfigRef.current = true; setHeaderMenu(null); setColumnConfigOpen(i); }}
                              />
                            )}
                          </Menu>
                        )
                    }
                  >
                    <div
                      className="rdt-th-inner"
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setColumnConfigOpen(null);
                        setHeaderMenu(i);
                      }}
                    >
                      {isEditing ? (
                        <input
                          ref={editInputRef}
                          autoFocus
                          className="rdt-cell-input rdt-header-input"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onBlur={() => handleCellBlur(cell.uid)}
                          onKeyDown={(e) => handleCellKeyDown(e, cell.uid, -1, i)}
                        />
                      ) : (
                        <div
                          className="rdt-cell-display rdt-header-display"
                          onClick={() => startEdit(-1, i, cell.text)}
                        >
                          {showAddresses && (
                            <span className="rdt-col-badge">{colIndexToLetter(i)}</span>
                          )}
                          <span className="rdt-header-text">
                            {(() => {
                              const t = localOverrides[cell.uid] ?? cell.text;
                              const RoamString = getRoamString();
                              return t
                                ? (RoamString ? <RoamString string={t} /> : t)
                                : <span>&nbsp;</span>;
                            })()}
                          </span>
                          {colType !== 'text' && (
                            <span className="rdt-col-type-badge" title={`Type: ${colType}`}>
                              {colType === 'status' ? '◈' : '▾'}
                            </span>
                          )}
                        </div>
                      )}
                      <SortIcon active={sortCol === i} dir={sortDir} onClick={() => cycleSort(i)} />
                      <span
                        className={`rdt-filter-icon${openFilters.has(i) ? ' rdt-filter-active' : ''}${filters[i] ? ' rdt-filter-has-value' : ''}`}
                        onClick={(e) => { e.stopPropagation(); toggleFilter(i); }}
                        title={openFilters.has(i) ? 'Hide filter' : 'Filter this column'}
                      >
                        <Icon icon="filter" iconSize={12} />
                      </span>
                    </div>
                  </Popover>
                </th>
              );
            })}
            <th className="rdt-menu-col">{tableMenu}</th>
          </tr>
          {showFilterRow && (
            <tr className="rdt-filter-row">
              {isDragEnabled && <th className="rdt-drag-col" />}
              {showAddresses && <th className="rdt-addr-col" />}
              {headerCells.map((_, i) => (
                <th key={i} style={{ padding: '2px 4px' }}>
                  {openFilters.has(i) ? (
                    <input
                      autoFocus={openFilters.size === 1}
                      className="rdt-filter-input dont-focus-block"
                      type="text"
                      placeholder="Filter…"
                      value={filters[i] ?? ''}
                      onChange={(e) => setFilters(prev => ({ ...prev, [i]: e.target.value }))}
                    />
                  ) : null}
                </th>
              ))}
              <th className="rdt-menu-col" />
            </tr>
          )}
        </thead>
        <tbody>
          {visibleRows.map((row, rowIndex) => renderRow(row, rowIndex))}

          {hiddenRows.length > 0 && (
            <>
              <tr
                className="rdt-hidden-disclosure"
                onClick={() => setShowHidden(v => !v)}
              >
                {isDragEnabled && <td className="rdt-drag-col" />}
                {showAddresses && <td className="rdt-addr-col" />}
                <td colSpan={numCols} className="rdt-hidden-disclosure-cell">
                  <span className="rdt-hidden-disclosure-icon">{showHidden ? '▾' : '▸'}</span>
                  {hiddenRows.length} hidden {hiddenRows.length === 1 ? 'row' : 'rows'}
                </td>
                <td className="rdt-menu-col" />
              </tr>
              {showHidden && hiddenRows.map((row, i) =>
                renderRow(row, visibleRows.length + i, { isHidden: true })
              )}
            </>
          )}
        </tbody>
      </HTMLTable>
      {hasActiveFilter && filteredRows.length === 0 && (
        <div className="rdt-no-results">No rows match the current filter.</div>
      )}
    </div>
  );
};

export default DisplayTable;
