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

// ─── Settings (stored in :block/props, invisible to native table rendering) ───
//
// Pattern from better-bullets: write with "key", read checking ":key" and "::key"
// because Roam normalizes prop keys differently depending on context.
const PROP_WRITE_KEY = 'table-plus/settings';
const PROP_READ_KEYS = ['::table-plus/settings', ':table-plus/settings', 'table-plus/settings'];

function defaultSettings() {
  return {
    styles: { striped: true, bordered: false, condensed: false, interactive: false },
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

// ─── Table state ──────────────────────────────────────────────────────────────
//
// Native block structure (same as {{[[table]]}}):
//   {{[[table]]}}         ← blockUid
//     - Header Col 1      ← tree[0], text = col 0 header, children = remaining headers
//         - Header Col 2
//     - Row 1 Col 1       ← tree[1..n], text = col 0 cell, children = remaining cells
//         - Row 1 Col 2
function getTableState(blockUid) {
  const tree = getBasicTreeByParentUid(blockUid);
  const headerNode = tree[0] ?? null;
  const rows = tree.slice(1);
  const settings = getBlockSettings(blockUid);
  return { tree, headerNode, rows, ...settings };
}

// ─── Configuration ────────────────────────────────────────────────────────────
const Configuration = ({ blockUid, onSubmit }) => {
  const initialState = useMemo(() => getTableState(blockUid), [blockUid]);
  const isLoaded = !!initialState.headerNode?.uid;

  const [isCreatingBlocks, setIsCreatingBlocks] = useState(false);
  const [numRows, setNumRows] = useState(3);
  const [numCols, setNumCols] = useState(3);
  const [view, setView] = useState(initialState.view);
  const [styleOptions, setStyleOptions] = useState(
    isLoaded
      ? initialState.styles
      : { striped: true, bordered: false, condensed: false, interactive: false }
  );

  const handleSubmit = async () => {
    if (!isLoaded) {
      // First child = header row. text = col 0, children = remaining cols.
      await createBlock({
        node: {
          text: 'Header 1',
          children: Array.from({ length: numCols - 1 }, (_, i) => ({
            text: `Header ${i + 2}`,
          })),
        },
        order: 0,
        parentUid: blockUid,
      });

      // Data rows: text = col 0, children = remaining cols.
      for (let i = 0; i < numRows; i++) {
        await createBlock({
          node: {
            text: '',
            children: Array.from({ length: numCols - 1 }, () => ({ text: '' })),
          },
          order: i + 1,
          parentUid: blockUid,
        });
      }

      await window.roamAlphaAPI.data.block.update({
        block: { uid: blockUid, open: false },
      });

      saveBlockSettings(blockUid, { styles: styleOptions, widths: {}, view });
    } else {
      // Settings update only — preserve existing column widths.
      const existing = getBlockSettings(blockUid);
      saveBlockSettings(blockUid, { ...existing, styles: styleOptions, view });
    }
  };

  return (
    <div className="rdt-table-config" style={{ width: '215px' }}>
      <Card elevation={Elevation.ONE}>
        {!isLoaded && (
          <>
            <FormGroup
              label="Rows"
              labelFor="rdt-rows-input"
              inline={true}
              className="rdt-input-label"
            >
              <NumericInput
                id="rdt-rows-input"
                defaultValue={numRows}
                onValueChange={(value) => setNumRows(value)}
                style={{ width: '50px' }}
              />
            </FormGroup>
            <FormGroup
              label="Columns"
              labelFor="rdt-cols-input"
              inline={true}
              className="rdt-input-label"
            >
              <NumericInput
                id="rdt-cols-input"
                defaultValue={numCols}
                onValueChange={(value) => setNumCols(value)}
                style={{ width: '50px' }}
              />
            </FormGroup>
            <Divider />
          </>
        )}
        <div>
          {Object.entries(styleOptions).map(([key, value]) => (
            <Checkbox
              key={key}
              alignIndicator="right"
              checked={value}
              label={key}
              onChange={(e) => {
                const isChecked = e.target.checked;
                setStyleOptions(prev => ({ ...prev, [key]: isChecked }));
              }}
              className="capitalize"
            />
          ))}
        </div>
        <Divider />
        <RadioGroup onChange={(e) => setView(e.target.value)} selectedValue={view}>
          <Radio label="Basic Text" value="plain" alignIndicator="right" />
          <Radio label="Embed" value="embed" alignIndicator="right" />
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
  const containerRef = useRef(null);
  const { headerNode, rows, styles, widths, view } = state;

  // Col 0 = block text (no separate child); col 1+ = child blocks.
  const headerCells = useMemo(() => {
    if (!headerNode) return [];
    return [{ uid: headerNode.uid, text: headerNode.text }, ...headerNode.children];
  }, [headerNode]);

  const numCols = headerCells.length;

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
                  node: {
                    text: '',
                    children: Array.from({ length: numCols - 1 }, () => ({ text: '' })),
                  },
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
                  parentUid: headerNode.uid,
                });
                for (const row of rows) {
                  await createBlock({ node: { text: '' }, order: 'last', parentUid: row.uid });
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
                const lastHeader = headerNode.children[headerNode.children.length - 1];
                if (lastHeader) {
                  await window.roamAlphaAPI.deleteBlock({ block: { uid: lastHeader.uid } });
                }
                for (const row of rows) {
                  const lastCell = row.children[row.children.length - 1];
                  if (lastCell) {
                    await window.roamAlphaAPI.deleteBlock({ block: { uid: lastCell.uid } });
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
    <div style={{ position: 'relative' }} ref={containerRef}>
      <span style={{ position: 'absolute', top: 4, right: 0 }}>
        <TableMenu />
      </span>
      <HTMLTable
        className={`rdt-workbench-table${view === 'plain' ? ' basic-text' : ''}`}
        style={{ width: '100%', tableLayout: 'fixed', pointerEvents: 'auto' }}
        bordered={styles.bordered}
        condensed={styles.condensed}
        interactive={styles.interactive}
        striped={styles.striped}
      >
        <thead>
          <tr ref={trRef}>
            {headerCells.map((cell, i) => (
              <th
                key={cell.uid}
                ref={thRefs[i]}
                style={{ width: widths[i], overflow: 'hidden' }}
              >
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
          {rows.map((row) => {
            const cells = [{ uid: row.uid, text: row.text }, ...row.children];
            return (
              <tr key={row.uid}>
                {cells.map((cell, i) => (
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
                    {i < cells.length - 1 && (
                      <div
                        style={{
                          width: 11,
                          cursor: 'ew-resize',
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          bottom: 0,
                          paddingLeft: 5,
                          pointerEvents: 'auto',
                        }}
                        data-column={`column-${i + 1}`}
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
