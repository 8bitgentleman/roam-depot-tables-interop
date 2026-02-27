import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  HTMLTable,
  EditableText,
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
} from '@blueprintjs/core';
import createBlock from 'roamjs-components/writes/createBlock';
import updateBlock from 'roamjs-components/writes/updateBlock';
import getBasicTreeByParentUid from 'roamjs-components/queries/getBasicTreeByParentUid';
import getUids from 'roamjs-components/dom/getUids';

// ─── Settings config ──────────────────────────────────────────────────────────
const STYLE_CONFIG = [
  { key: 'striped',     label: 'Striped',     description: 'Alternate row background colors' },
  { key: 'bordered',    label: 'Bordered',    description: 'Draw borders around each cell' },
  { key: 'condensed',   label: 'Compact',     description: 'Reduce cell padding' },
  { key: 'interactive', label: 'Interactive', description: 'Highlight rows on hover' },
];

const VIEW_CONFIG = [
  { value: 'plain', label: 'Basic Text', description: 'Edit cells as inline plain text' },
  { value: 'embed', label: 'Embed',      description: 'Render full Roam blocks — supports markdown, block refs, queries' },
];

// ─── Settings (stored in :block/props, invisible to native table rendering) ───
// Pattern from better-bullets: write with "key", read checking ":key" and "::key".
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

// ─── Block structure helpers ──────────────────────────────────────────────────
// Native Roam table uses a chain structure for columns:
//   {{[[table]]}}
//     - Header 1          ← col 0 (block text)
//         - Header 2      ← col 1 (first child)
//             - Header 3  ← col 2 (first child of first child)
//
// getBasicTreeByParentUid fetches the full recursive tree, so children[0]
// at each level is the next column in the chain.

// Walk the chain of first-children to collect all cells in a row.
function getRowCells(node) {
  const cells = [];
  let current = node;
  while (current) {
    cells.push({ uid: current.uid, text: current.text });
    current = current.children?.[0] ?? null;
  }
  return cells;
}

// Walk to the deepest node in the chain (where the next column would attach).
function getChainTail(node) {
  let current = node;
  while (current.children?.[0]) current = current.children[0];
  return current;
}

// Walk to the node at a given depth in the chain (depth 0 = node itself).
function getChainNodeAtDepth(node, depth) {
  let current = node;
  for (let i = 0; i < depth; i++) {
    if (!current.children?.[0]) return null;
    current = current.children[0];
  }
  return current;
}

// Build a node for createBlock that creates a full chain of numCols cells.
// getTextFn(colIndex) returns the text for that column (default: empty string).
function buildRowNode(numCols, getTextFn = () => '') {
  const build = (colIndex) => {
    const node = { text: getTextFn(colIndex) };
    if (colIndex < numCols - 1) node.children = [build(colIndex + 1)];
    return node;
  };
  return build(0);
}

// ─── Table state ──────────────────────────────────────────────────────────────
function getTableState(blockUid) {
  const tree = getBasicTreeByParentUid(blockUid);
  const headerNode = tree[0] ?? null;
  const rows = tree.slice(1);
  const settings = getBlockSettings(blockUid);
  return { tree, headerNode, rows, ...settings };
}

// ─── OptionLabel ──────────────────────────────────────────────────────────────
const OptionLabel = ({ label, description }) => (
  <span>
    {label}
    <span style={{ display: 'block', fontSize: '11px', color: 'var(--rm-text-color-muted, #888)', fontWeight: 'normal', marginTop: 1 }}>
      {description}
    </span>
  </span>
);

// ─── Configuration ────────────────────────────────────────────────────────────
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
      // Header row: chain of numCols cells labeled "Header 1", "Header 2", ...
      await createBlock({
        node: buildRowNode(numCols, (i) => `Header ${i + 1}`),
        order: 0,
        parentUid: blockUid,
      });
      // Data rows: chain of numCols empty cells.
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

// ─── CellEmbed ────────────────────────────────────────────────────────────────
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

// ─── DisplayTable ─────────────────────────────────────────────────────────────
const DisplayTable = ({ blockUid, setIsEdit }) => {
  const [state, setState] = useState(() => getTableState(blockUid));
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // After setState, useEffect fires on next render and focuses the target cell.
  const [pendingFocus, setPendingFocus] = useState(null);
  const containerRef = useRef(null);
  const { headerNode, rows, styles, widths, view } = state;

  // headerCells: [{uid, text}] following the chain structure.
  const headerCells = useMemo(
    () => headerNode ? getRowCells(headerNode) : [],
    [headerNode]
  );
  const numCols = headerCells.length;

  // Watch for external changes to the block tree (e.g. user edits a cell
  // directly in the outline) and re-render.
  useEffect(() => {
    let debounceTimer;
    const query = `[:block/uid "${blockUid}"]`;
    const pattern = '[:block/uid :block/string {:block/children ...}]';
    const unwatch = window.roamAlphaAPI.data.addPullWatch(pattern, query, () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => setState(getTableState(blockUid)), 200);
    });
    return () => {
      clearTimeout(debounceTimer);
      if (typeof unwatch === 'function') unwatch();
    };
  }, [blockUid]);

  // Focus a body cell once the DOM has updated after a state change.
  useEffect(() => {
    if (!pendingFocus) return;
    const { rowIndex, colIndex } = pendingFocus;
    const tbody = containerRef.current?.querySelector('tbody');
    if (tbody) {
      const tr = tbody.querySelectorAll('tr')[rowIndex];
      tr?.querySelectorAll('td')[colIndex]?.querySelector('.bp3-editable-text')?.click();
    }
    setPendingFocus(null);
  }, [pendingFocus]);

  const [thRefs, setThRefs] = useState([]);
  useEffect(() => {
    setThRefs(headerCells.map(() => React.createRef()));
  }, [headerCells.length]);
  const trRef = useRef(null);

  // Enter key via event delegation on the container div.
  // Blueprint v3's EditableText doesn't forward onKeyDown to the textarea, so
  // we intercept the event as it bubbles. React batches Blueprint's setState
  // (confirm edit) with ours, so e.target is still in the DOM at this point.
  const handleContainerKeyDown = useCallback((e) => {
    if (e.key !== 'Enter' || e.shiftKey) return;

    const td = e.target.closest?.('td');
    const th = e.target.closest?.('th');

    if (td) {
      const tbody = containerRef.current?.querySelector('tbody');
      const rowIndex = Array.from(tbody?.children ?? []).indexOf(td.parentElement);
      const colIndex = Array.from(td.parentElement.children).indexOf(td);
      if (rowIndex >= 0 && colIndex >= 0) handleEnterKey(rowIndex, colIndex);
    } else if (th) {
      const colIndex = Array.from(th.parentElement?.children ?? []).indexOf(th);
      if (colIndex >= 0) handleEnterKey(-1, colIndex);
    }
  }, [/* handleEnterKey added below via ref trick to avoid stale closure */]);

  // handleEnterKey needs rows.length and numCols which change, so we use a ref
  // to avoid re-creating handleContainerKeyDown on every render.
  const enterStateRef = useRef({ rows, numCols, blockUid });
  useEffect(() => { enterStateRef.current = { rows, numCols, blockUid }; }, [rows, numCols, blockUid]);

  function handleEnterKey(rowIndex, colIndex) {
    const { rows, numCols, blockUid } = enterStateRef.current;
    const nextRowIndex = rowIndex + 1;
    const addRow = nextRowIndex >= rows.length;

    const doFocus = () => setPendingFocus({ rowIndex: nextRowIndex, colIndex });

    if (addRow) {
      const fresh = getTableState(blockUid);
      createBlock({
        node: buildRowNode(numCols),
        order: fresh.rows.length + 1,
        parentUid: blockUid,
      }).then(() => {
        setState(getTableState(blockUid));
        doFocus();
      });
    } else {
      doFocus();
    }
  }

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

    const newWidth = `${((cellWidth + delta) / rowWidth) * 100}%`;
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
                // Append to the tail of each row's chain.
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
                // The last column is the first child of the node at depth numCols-2.
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
    <div style={{ position: 'relative' }} ref={containerRef} onKeyDown={handleContainerKeyDown}>
      <span style={{ position: 'absolute', top: 4, right: 0 }}>
        <TableMenu />
      </span>
      <HTMLTable
        className={`rdt-workbench-table dont-focus-block${view === 'plain' ? ' basic-text' : ''}`}
        style={{ width: '100%', tableLayout: 'fixed', pointerEvents: 'auto' }}
        bordered={styles.bordered}
        condensed={styles.condensed}
        interactive={styles.interactive}
        striped={styles.striped}
      >
        <thead>
          <tr ref={trRef}>
            {headerCells.map((cell, i) => (
              <th key={cell.uid} ref={thRefs[i]} style={{ width: widths[i], overflow: 'hidden' }}>
                {view === 'embed' ? (
                  <CellEmbed uid={cell.uid} />
                ) : (
                  <EditableText
                    placeholder=""
                    defaultValue={cell.text}
                    onConfirm={(value) => updateBlock({ uid: cell.uid, text: value })}
                  />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            // Col 0 = the row block itself; remaining cols follow the chain.
            const cells = getRowCells(row);
            return (
              <tr key={row.uid}>
                {cells.map((cell, colIndex) => (
                  <td key={cell.uid} style={{ overflow: 'hidden', position: 'relative' }}>
                    {view === 'embed' ? (
                      <CellEmbed uid={cell.uid} />
                    ) : (
                      <EditableText
                        placeholder=""
                        defaultValue={cell.text}
                        onConfirm={(value) => updateBlock({ uid: cell.uid, text: value })}
                        style={{ width: '100%' }}
                      />
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
                      />
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </HTMLTable>
    </div>
  );
};

// ─── Table (wrapper) ──────────────────────────────────────────────────────────
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
