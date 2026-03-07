import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  HTMLTable,
  NumericInput,
  Checkbox,
  Button,
  Card,
  Elevation,
  FormGroup,
  RadioGroup,
  Radio,
  MenuItem,
  Popover,
  Menu,
  MenuDivider,
  Divider,
  Icon,
} from '@blueprintjs/core';
import createBlock from 'roamjs-components/writes/createBlock';
import updateBlock from 'roamjs-components/writes/updateBlock';
import getBasicTreeByParentUid from 'roamjs-components/queries/getBasicTreeByParentUid';
import getUids from 'roamjs-components/dom/getUids';

// ─── Settings config ───────────────────────────────────────────────────────────
const STYLE_CONFIG = [
  { key: 'striped',       label: 'Striped',         description: 'Alternate row background colors' },
  { key: 'bordered',      label: 'Bordered',         description: 'Draw borders around each cell' },
  { key: 'condensed',     label: 'Compact',          description: 'Reduce cell padding' },
  { key: 'interactive',   label: 'Interactive',      description: 'Highlight rows on hover' },
  { key: 'showAddresses', label: 'Cell Addresses',   description: 'Show A1 row/column address labels' },
];

const VIEW_CONFIG = [
  { value: 'plain', label: 'Basic Text', description: 'Edit cells as inline plain text' },
  { value: 'embed', label: 'Embed',      description: 'Render full Roam blocks — supports markdown, block refs, queries' },
];

// ─── Settings storage ─────────────────────────────────────────────────────────
const PROP_WRITE_KEY = 'table-plus/settings';
const PROP_READ_KEYS = ['::table-plus/settings', ':table-plus/settings', 'table-plus/settings'];

function defaultSettings() {
  return {
    styles: Object.fromEntries(STYLE_CONFIG.map(({ key }) => [key, key === 'striped'])),
    widths: {},
    view: 'plain',
  };
}

function getBlockSettings(blockUid) {
  try {
    const pulled = window.roamAlphaAPI.pull('[:block/props]', [':block/uid', blockUid]);
    const props = pulled?.[':block/props'];
    if (props) {
      for (const k of PROP_READ_KEYS) {
        if (Object.prototype.hasOwnProperty.call(props, k)) {
          const raw = props[k];
          if (typeof raw === 'string') return JSON.parse(raw);
        }
      }
    }
  } catch {}
  return defaultSettings();
}

function saveBlockSettings(blockUid, settings) {
  try {
    window.roamAlphaAPI.updateBlock({
      block: { uid: blockUid, props: { [PROP_WRITE_KEY]: JSON.stringify(settings) } },
    });
  } catch {}
}

// ─── Block structure helpers ───────────────────────────────────────────────────
function getRowCells(node) {
  const cells = [];
  let current = node;
  while (current) {
    cells.push({ uid: current.uid, text: current.text });
    current = current.children?.[0] ?? null;
  }
  return cells;
}

function getChainTail(node) {
  let current = node;
  while (current.children?.[0]) current = current.children[0];
  return current;
}

function getChainNodeAtDepth(node, depth) {
  let current = node;
  for (let i = 0; i < depth; i++) {
    if (!current.children?.[0]) return null;
    current = current.children[0];
  }
  return current;
}

function buildRowNode(numCols, getTextFn = () => '') {
  const build = (colIndex) => {
    const node = { text: getTextFn(colIndex) };
    if (colIndex < numCols - 1) node.children = [build(colIndex + 1)];
    return node;
  };
  return build(0);
}

// ─── Table state ───────────────────────────────────────────────────────────────
function getTableState(blockUid) {
  const tree = getBasicTreeByParentUid(blockUid);
  const headerNode = tree[0] ?? null;
  const rows = tree.slice(1);
  const settings = getBlockSettings(blockUid);
  return { tree, headerNode, rows, ...settings };
}

// ─── Address utilities (for future formula support) ───────────────────────────
export function colIndexToLetter(index) {
  let result = '', i = index + 1;
  while (i > 0) {
    result = String.fromCharCode(65 + ((i - 1) % 26)) + result;
    i = Math.floor((i - 1) / 26);
  }
  return result;
}

// ─── OptionLabel ───────────────────────────────────────────────────────────────
const OptionLabel = ({ label, description }) => (
  <span>
    {label}
    <span style={{ display: 'block', fontSize: '11px', color: 'var(--rm-text-color-muted, #888)', fontWeight: 'normal', marginTop: 1 }}>
      {description}
    </span>
  </span>
);

// ─── Configuration ─────────────────────────────────────────────────────────────
const Configuration = ({ blockUid, onSubmit }) => {
  const initialState = useMemo(() => getTableState(blockUid), [blockUid]);
  const isLoaded = !!initialState.headerNode?.uid;

  const [isCreatingBlocks, setIsCreatingBlocks] = useState(false);
  const [numRows, setNumRows] = useState(3);
  const [numCols, setNumCols] = useState(3);
  const [view, setView] = useState(initialState.view);
  const [styleOptions, setStyleOptions] = useState(
    isLoaded ? initialState.styles : defaultSettings().styles
  );

  const handleSubmit = async () => {
    if (!isLoaded) {
      await createBlock({
        node: buildRowNode(numCols, (i) => `Header ${i + 1}`),
        order: 0,
        parentUid: blockUid,
      });
      for (let i = 0; i < numRows; i++) {
        await createBlock({
          node: buildRowNode(numCols),
          order: i + 1,
          parentUid: blockUid,
        });
      }
      await window.roamAlphaAPI.data.block.update({
        block: { uid: blockUid, open: false },
      });
      saveBlockSettings(blockUid, { styles: styleOptions, widths: {}, view });
    } else {
      const existing = getBlockSettings(blockUid);
      saveBlockSettings(blockUid, { ...existing, styles: styleOptions, view });
    }
  };

  return (
    <div className="rdt-table-config" style={{ width: '230px' }}>
      <Card elevation={Elevation.ONE}>
        {!isLoaded && (
          <>
            <FormGroup label="Rows" labelFor="rdt-rows-input" inline={true} className="rdt-input-label">
              <NumericInput id="rdt-rows-input" defaultValue={numRows} onValueChange={setNumRows} style={{ width: '50px' }} />
            </FormGroup>
            <FormGroup label="Columns" labelFor="rdt-cols-input" inline={true} className="rdt-input-label">
              <NumericInput id="rdt-cols-input" defaultValue={numCols} onValueChange={setNumCols} style={{ width: '50px' }} />
            </FormGroup>
            <Divider />
          </>
        )}
        <div>
          {STYLE_CONFIG.map(({ key, label, description }) => (
            <Checkbox
              key={key}
              alignIndicator="right"
              checked={!!styleOptions[key]}
              label={<OptionLabel label={label} description={description} />}
              onChange={(e) => setStyleOptions(prev => ({ ...prev, [key]: e.target.checked }))}
            />
          ))}
        </div>
        <Divider />
        <RadioGroup onChange={(e) => setView(e.target.value)} selectedValue={view}>
          {VIEW_CONFIG.map(({ value, label, description }) => (
            <Radio key={value} value={value} alignIndicator="right"
              label={<OptionLabel label={label} description={description} />}
            />
          ))}
        </RadioGroup>
        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          <Button
            loading={isCreatingBlocks}
            text={isLoaded ? 'Update Settings' : 'Create Table'}
            onClick={async () => {
              setIsCreatingBlocks(true);
              await handleSubmit();
              onSubmit();
              setIsCreatingBlocks(false);
            }}
            intent="primary"
          />
        </div>
      </Card>
    </div>
  );
};

// ─── CellEmbed ─────────────────────────────────────────────────────────────────
const CellEmbed = ({ uid }) => {
  const contentRef = useRef(null);
  useEffect(() => {
    const el = contentRef.current;
    if (el) window.roamAlphaAPI.ui.components.renderBlock({ uid, el });
  }, [uid]);
  return <div className="rdt-table-embed" ref={contentRef} />;
};

const dragImage = document.createElement('img');
dragImage.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

// ─── Roam string renderer ─────────────────────────────────────────────────────
const { String: RoamString } = window.roamAlphaAPI.ui.react;

// ─── Auto-resizing textarea ────────────────────────────────────────────────────
const AutoTextarea = React.forwardRef(({ value, onChange, onBlur, onKeyDown, className, autoFocus }, ref) => {
  const inner = useRef(null);

  // Expose the inner textarea via the forwarded ref
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
      value={value}
      rows={1}
      onChange={(e) => { onChange(e); resize(); }}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    />
  );
});

// ─── Sort icon ─────────────────────────────────────────────────────────────────
const SortIcon = ({ active, dir, onClick }) => (
  <span
    className={`rdt-sort-icon${active ? ' rdt-sort-active' : ''}`}
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    title="Sort"
  >
    <Icon
      icon={active ? (dir === 'asc' ? 'sort-asc' : 'sort-desc') : 'sort'}
      iconSize={12}
    />
  </span>
);

// ─── DisplayTable ──────────────────────────────────────────────────────────────
const DisplayTable = ({ blockUid, setIsEdit }) => {
  const [state, setState] = useState(() => getTableState(blockUid));
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const containerRef = useRef(null);
  const { headerNode, rows, styles, widths, view } = state;

  // ── Sort ────────────────────────────────────────────────────────────────────
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState(null); // 'asc' | 'desc'

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

  // ── Filter ──────────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState({});         // { [colIndex]: filterText }
  const [openFilters, setOpenFilters] = useState(new Set()); // which columns are expanded

  function toggleFilter(colIndex) {
    setOpenFilters(prev => {
      const next = new Set(prev);
      if (next.has(colIndex)) {
        next.delete(colIndex);
        // clear the filter value when closing
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

  // ── Custom cell editor ──────────────────────────────────────────────────────
  // editingCell: { rowIndex: -1 for header, colIndex } | null
  const [editingCell, setEditingCell] = useState(null);
  const [editingText, setEditingText] = useState('');
  const editInputRef = useRef(null);
  const cancelEditRef = useRef(false);
  // Optimistic text overrides: written immediately on commit, cleared when
  // the pull watch refreshes state so there's no flash of the old value.
  const [localOverrides, setLocalOverrides] = useState({});

  function startEdit(rowIndex, colIndex, text) {
    setEditingCell({ rowIndex, colIndex });
    setEditingText(text ?? '');
  }

  function commitEdit(uid) {
    cancelEditRef.current = true;
    setLocalOverrides(prev => ({ ...prev, [uid]: editingText }));
    updateBlock({ uid, text: editingText });
    setEditingCell(null);
    setEditingText('');
  }

  function discardEdit() {
    cancelEditRef.current = true;
    setEditingCell(null);
    setEditingText('');
  }

  function handleCellBlur(uid) {
    if (cancelEditRef.current) { cancelEditRef.current = false; return; }
    setLocalOverrides(prev => ({ ...prev, [uid]: editingText }));
    updateBlock({ uid, text: editingText });
    setEditingCell(null);
    setEditingText('');
  }

  function handleCellKeyDown(e, uid, rowIndex, colIndex) {
    if (e.key === 'Escape') {
      e.preventDefault();
      discardEdit();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commitEdit(uid);
      if (rowIndex >= 0) handleEnterKey(rowIndex, colIndex);
      return;
    }
    // Shift+Enter inserts a newline — let textarea handle it naturally
    if (e.key === 'Tab') {
      e.preventDefault();
      commitEdit(uid);
      handleTabKey(rowIndex, colIndex, e.shiftKey);
    }
  }

  // Tab navigation
  function handleTabKey(rowIndex, colIndex, reverse) {
    const numCols = headerCells.length;
    let nextRow = rowIndex, nextCol = colIndex + (reverse ? -1 : 1);
    if (nextCol >= numCols) { nextCol = 0; nextRow = rowIndex < 0 ? 0 : rowIndex + 1; }
    if (nextCol < 0) { nextCol = numCols - 1; nextRow = rowIndex <= 0 ? -1 : rowIndex - 1; }

    if (nextRow < -1 || nextRow >= filteredRows.length) return;

    if (nextRow === -1) {
      // Header row
      const cell = headerCells[nextCol];
      if (cell) startEdit(-1, nextCol, cell.text);
    } else {
      const row = filteredRows[nextRow];
      if (row) {
        const cells = getRowCells(row);
        startEdit(nextRow, nextCol, cells[nextCol]?.text ?? '');
      }
    }
  }

  // ── Enter key: add row and move down ────────────────────────────────────────
  const enterStateRef = useRef({ rows: filteredRows, numCols: 0, blockUid });
  const headerCells = useMemo(
    () => headerNode ? getRowCells(headerNode) : [],
    [headerNode]
  );
  const numCols = headerCells.length;

  useEffect(() => {
    enterStateRef.current = { rows: filteredRows, numCols, blockUid };
  }, [filteredRows, numCols, blockUid]);

  const [pendingEdit, setPendingEdit] = useState(null);

  useEffect(() => {
    if (!pendingEdit) return;
    const { rowIndex, colIndex } = pendingEdit;
    const row = filteredRows[rowIndex];
    if (row) {
      const cells = getRowCells(row);
      startEdit(rowIndex, colIndex, cells[colIndex]?.text ?? '');
    }
    setPendingEdit(null);
  }, [pendingEdit, filteredRows]);

  function handleEnterKey(rowIndex, colIndex) {
    const { rows: currentRows, numCols: currentNumCols, blockUid: uid } = enterStateRef.current;
    const nextRowIndex = rowIndex + 1;
    if (nextRowIndex >= currentRows.length) {
      const fresh = getTableState(uid);
      createBlock({
        node: buildRowNode(currentNumCols),
        order: fresh.rows.length + 1,
        parentUid: uid,
      }).then(() => {
        setState(getTableState(uid));
        setPendingEdit({ rowIndex: nextRowIndex, colIndex });
      });
    } else {
      setPendingEdit({ rowIndex: nextRowIndex, colIndex });
    }
  }

  // ── Pull watch ───────────────────────────────────────────────────────────────
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

  // ── Column resize ────────────────────────────────────────────────────────────
  const [thRefs, setThRefs] = useState([]);
  useEffect(() => {
    setThRefs(headerCells.map(() => React.createRef()));
  }, [headerCells.length]);
  const trRef = useRef(null);

  const onDragStart = useCallback((e) => {
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
      thRefs
        .map((ref, i) => [i, ref.current?.style.width])
        .filter(([, w]) => w)
    );
    const existing = getBlockSettings(blockUid);
    saveBlockSettings(blockUid, { ...existing, widths: newWidths });
  }, [blockUid, thRefs]);

  // ── Rendering helpers ────────────────────────────────────────────────────────
  const showAddresses = !!styles.showAddresses;

  function renderCellContent(cell, rowIndex, colIndex) {
    const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.colIndex === colIndex;

    if (isEditing) {
      return (
        <AutoTextarea
          ref={editInputRef}
          autoFocus
          className="rdt-cell-input"
          value={editingText}
          onChange={(e) => setEditingText(e.target.value)}
          onBlur={() => handleCellBlur(cell.uid)}
          onKeyDown={(e) => handleCellKeyDown(e, cell.uid, rowIndex, colIndex)}
        />
      );
    }

    const displayText = localOverrides[cell.uid] ?? cell.text;
    return (
      <div className="rdt-cell-display">
        {displayText
          ? (RoamString ? <RoamString string={displayText} /> : displayText)
          : <span className="rdt-cell-placeholder">&nbsp;</span>}
      </div>
    );
  }

  // ── Table menu ───────────────────────────────────────────────────────────────
  const TableMenu = () => (
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
          <MenuItem icon="cog" text="Settings" onClick={() => setIsEdit(true)} />
          <MenuItem
            icon="edit"
            text="Edit Block"
            onClick={() => {
              const location = getUids(containerRef.current?.closest('.roam-block'));
              window.roamAlphaAPI.ui.setBlockFocusAndSelection({
                location: { 'window-id': location.windowId, 'block-uid': location.blockUid },
              });
            }}
          />
        </Menu>
      }
    />
  );

  return (
    <div className="rdt-table-wrap" ref={containerRef}>
      <HTMLTable
        className={`rdt-workbench-table dont-focus-block`}
        style={{ tableLayout: 'auto', pointerEvents: 'auto' }}
        bordered={styles.bordered}
        condensed={styles.condensed}
        interactive={styles.interactive}
        striped={styles.striped}
      >
        <thead>
          {/* Header row */}
          <tr ref={trRef}>
            {showAddresses && (
              <th className="rdt-addr-col" style={{ width: 28 }}>#</th>
            )}
            {headerCells.map((cell, i) => {
              const isEditing = editingCell?.rowIndex === -1 && editingCell?.colIndex === i;
              return (
                <th
                  key={cell.uid}
                  ref={thRefs[i]}
                  style={{ width: widths[i], overflow: 'hidden', padding: 0 }}
                >
                  <div className="rdt-th-inner">
                    {view === 'embed' ? (
                      <CellEmbed uid={cell.uid} />
                    ) : isEditing ? (
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
                            return t
                              ? (RoamString ? <RoamString string={t} /> : t)
                              : <span>&nbsp;</span>;
                          })()}
                        </span>
                      </div>
                    )}
                    <SortIcon
                      active={sortCol === i}
                      dir={sortDir}
                      onClick={() => cycleSort(i)}
                    />
                    <span
                      className={`rdt-filter-icon${openFilters.has(i) ? ' rdt-filter-active' : ''}${filters[i] ? ' rdt-filter-has-value' : ''}`}
                      onClick={(e) => { e.stopPropagation(); toggleFilter(i); }}
                      title={openFilters.has(i) ? 'Hide filter' : 'Filter this column'}
                    >
                      <Icon icon="filter" iconSize={12} />
                    </span>
                  </div>
                </th>
              );
            })}
            {/* Dedicated menu column header */}
            <th className="rdt-menu-col">
              <TableMenu />
            </th>
          </tr>
          {/* Filter row — only shown when at least one column has its filter open */}
          {showFilterRow && (
            <tr className="rdt-filter-row">
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
          {filteredRows.map((row, rowIndex) => {
            const cells = getRowCells(row);
            return (
              <tr key={row.uid}>
                {showAddresses && (
                  <td className="rdt-addr-col">{rowIndex + 1}</td>
                )}
                {cells.map((cell, colIndex) => {
                  const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.colIndex === colIndex;
                  return (
                    <td
                      key={cell.uid}
                      className={`rdt-cell${isEditing ? ' rdt-cell-editing' : ''}`}
                      style={{ overflow: 'hidden', position: 'relative', padding: 0 }}
                      onClick={() => {
                        if (!isEditing && view !== 'embed') startEdit(rowIndex, colIndex, cell.text);
                      }}
                    >
                      {view === 'embed' ? (
                        <CellEmbed uid={cell.uid} />
                      ) : (
                        renderCellContent(cell, rowIndex, colIndex)
                      )}
                      {colIndex < cells.length - 1 && (
                        <div
                          style={{
                            width: 11, cursor: 'ew-resize', position: 'absolute',
                            top: 0, right: 0, bottom: 0, paddingLeft: 5, pointerEvents: 'auto',
                          }}
                          data-column={`column-${colIndex + 1}`}
                          draggable
                          onDragStart={onDragStart}
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
          })}
        </tbody>
      </HTMLTable>
      {hasActiveFilter && filteredRows.length === 0 && (
        <div className="rdt-no-results">No rows match the current filter.</div>
      )}
    </div>
  );
};

// ─── Table (wrapper) ───────────────────────────────────────────────────────────
const Table = ({ blockUid }) => {
  const tree = useMemo(() => getBasicTreeByParentUid(blockUid), [blockUid]);
  const [isEdit, setIsEdit] = useState(!tree[0]?.uid);

  return isEdit ? (
    <Configuration blockUid={blockUid} onSubmit={() => setIsEdit(false)} />
  ) : (
    <DisplayTable blockUid={blockUid} setIsEdit={setIsEdit} />
  );
};

export default Table;
