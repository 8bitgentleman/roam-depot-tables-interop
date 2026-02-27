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
import getSubTree from 'roamjs-components/util/getSubTree';
import getUids from 'roamjs-components/dom/getUids';
import setInputSetting from 'roamjs-components/util/setInputSetting';
import setInputSettings from 'roamjs-components/util/setInputSettings';

const SETTINGS_KEY = '__table-settings__';

// Reads the native-compatible block structure under blockUid.
// Header row: first child block (its text = col 0 header; its children = remaining headers).
// Data rows: subsequent child blocks (text = col 0 cell; children = remaining cells).
// Settings: last child with text === SETTINGS_KEY.
function getTableState(blockUid) {
  const tree = getBasicTreeByParentUid(blockUid);
  const settingsNode = getSubTree({ tree, key: SETTINGS_KEY, parentUid: blockUid });
  const dataNodes = tree.filter(c => c.text !== SETTINGS_KEY);
  const headerNode = dataNodes[0] ?? null;
  const rows = dataNodes.slice(1);

  const stylesNode = settingsNode.uid
    ? getSubTree({ tree: settingsNode.children, key: 'styles', parentUid: settingsNode.uid })
    : { uid: '', children: [] };
  const widthsNode = settingsNode.uid
    ? getSubTree({ tree: settingsNode.children, key: 'widths', parentUid: settingsNode.uid })
    : { uid: '', children: [] };
  const viewNode = settingsNode.uid
    ? getSubTree({ tree: settingsNode.children, key: 'view', parentUid: settingsNode.uid })
    : { uid: '', children: [] };

  const styles = {
    striped:     stylesNode.children.some(c => c.text === 'striped'),
    bordered:    stylesNode.children.some(c => c.text === 'bordered'),
    condensed:   stylesNode.children.some(c => c.text === 'condensed'),
    interactive: stylesNode.children.some(c => c.text === 'interactive'),
  };
  // widths stored as child blocks with text like "0 - 30%"
  const widths = Object.fromEntries(
    widthsNode.children
      .map(c => /^(\d+) - (.+)$/.exec(c.text))
      .filter(Boolean)
      .map(m => [parseInt(m[1]), m[2]])
  );
  const view = viewNode.children[0]?.text ?? 'plain';

  return { tree, settingsNode, headerNode, rows, styles, widths, view };
}

// ─── Configuration ────────────────────────────────────────────────────────────
// Shows row/col inputs on first run; style/view controls always.
const Configuration = ({ blockUid, onSubmit }) => {
  const initialState = useMemo(() => getTableState(blockUid), [blockUid]);
  const { settingsNode, headerNode } = initialState;
  const isLoaded = !!headerNode?.uid;

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
    let activeSettingsUid = settingsNode.uid;

    if (!isLoaded) {
      // First child = header row block. text = col 0 header; children = remaining headers.
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

      // Data rows: text = col 0 cell; children = remaining cells.
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

      // Settings block goes last.
      activeSettingsUid = await createBlock({
        node: { text: SETTINGS_KEY },
        order: 'last',
        parentUid: blockUid,
      });

      // Collapse {{table-plus}} block so children don't clutter the page.
      await window.roamAlphaAPI.data.block.update({
        block: { uid: blockUid, open: false },
      });
    }

    setInputSettings({
      blockUid: activeSettingsUid,
      key: 'styles',
      values: Object.entries(styleOptions)
        .filter(([, value]) => value)
        .map(([key]) => key),
    });
    await setInputSetting({
      blockUid: activeSettingsUid,
      key: 'view',
      value: view,
    });
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
// Renders a Roam block embed inside a table cell.
const CellEmbed = ({ uid }) => {
  const contentRef = useRef(null);
  useEffect(() => {
    const el = contentRef.current;
    if (el) {
      window.roamAlphaAPI.ui.components.renderBlock({ uid, el });
    }
  }, [uid]);
  return <div className="rdt-table-embed" ref={contentRef} />;
};

// Transparent 1×1 gif so the drag ghost image is invisible.
const dragImage = document.createElement('img');
dragImage.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

// ─── DisplayTable ─────────────────────────────────────────────────────────────
const DisplayTable = ({ blockUid, setIsEdit }) => {
  const [state, setState] = useState(() => getTableState(blockUid));
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const containerRef = useRef(null);
  const { headerNode, rows, styles, widths, view, settingsNode } = state;

  // First column is the block text itself; remaining columns are children.
  const headerCells = useMemo(() => {
    if (!headerNode) return [];
    return [
      { uid: headerNode.uid, text: headerNode.text },
      ...headerNode.children,
    ];
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

    setInputSettings({
      blockUid: settingsNode.uid,
      key: 'widths',
      values: thRefs
        .map((ref, index) => [index, ref.current?.style.width])
        .filter(([, width]) => width)
        .map(([index, width]) => `${index} - ${width}`),
    });
  }, [settingsNode.uid, thRefs]);

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
                // Insert after all data rows, before settings.
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
                  await createBlock({
                    node: { text: '' },
                    order: 'last',
                    parentUid: row.uid,
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
                // Remove last child from header (col 0 is the block itself, never deleted)
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
              const location = getUids(
                containerRef.current?.closest('.roam-block')
              );
              window.roamAlphaAPI.ui.setBlockFocusAndSelection({
                location: {
                  'window-id': location.windowId,
                  'block-uid': location.blockUid,
                },
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
            // Col 0 = the row block itself; remaining = its children.
            const cells = [
              { uid: row.uid, text: row.text },
              ...row.children,
            ];
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
  const dataNodes = useMemo(
    () => tree.filter(c => c.text !== SETTINGS_KEY),
    [tree]
  );
  const hasData = !!dataNodes[0]?.uid;
  const [isEdit, setIsEdit] = useState(!hasData);

  return isEdit ? (
    <Configuration blockUid={blockUid} onSubmit={() => setIsEdit(false)} />
  ) : (
    <DisplayTable blockUid={blockUid} setIsEdit={setIsEdit} />
  );
};

export default Table;
