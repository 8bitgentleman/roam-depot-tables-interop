import React from 'react';
import ReactDOM from 'react-dom';
import createHTMLObserver from 'roamjs-components/dom/createHTMLObserver';
import getUids from 'roamjs-components/dom/getUids';
import addStyle from 'roamjs-components/dom/addStyle';
import Table from './table.jsx';
import { setExtensionAPI } from './utils/extensionAPI';
import { STYLE_CONFIG } from './utils/settings';

// Track all mounts for cleanup on unload.
// Key: .rm-table element, Value: { root, container, nativeTable, hoverOnly }
const mounts = new Map();
let styleEl;

function mount(el) {
  if (mounts.has(el)) return;

  const blockEl = el.closest('.roam-block');
  if (!blockEl) return;
  const { blockUid } = getUids(blockEl);
  if (!blockUid) return;

  // Hide Roam's native table and its edit/download button bar.
  const nativeTable = el.querySelector('.roam-table');
  if (nativeTable) nativeTable.style.display = 'none';
  const hoverOnly = el.querySelector('.hoveronly');
  if (hoverOnly) hoverOnly.style.display = 'none';

  const container = document.createElement('div');
  container.className = 'rdt-table-container dont-focus-block';
  el.appendChild(container);

  const root = ReactDOM.createRoot(container);
  root.render(<Table blockUid={blockUid} />);
  mounts.set(el, { root, container, nativeTable, hoverOnly });
}

function unmount(el) {
  const m = mounts.get(el);
  if (!m) return;
  m.root.unmount();
  m.container.remove();
  if (m.nativeTable) m.nativeTable.style.display = '';
  if (m.hoverOnly) m.hoverOnly.style.display = '';
  mounts.delete(el);
}

let observer;

export default {
  onload({ extensionAPI }) {
    setExtensionAPI(extensionAPI);

    extensionAPI.settings.panel.create({
      tabTitle: 'Table Plus',
      settings: [
        {
          id: 'default-rows',
          name: 'Default Rows',
          description: 'Number of rows when creating a new table',
          action: { type: 'input', placeholder: '3' },
        },
        {
          id: 'default-cols',
          name: 'Default Columns',
          description: 'Number of columns when creating a new table',
          action: { type: 'input', placeholder: '3' },
        },
        ...STYLE_CONFIG.map(({ key, label, description }) => ({
          id: `default-style-${key}`,
          name: `Default: ${label}`,
          description,
          action: { type: 'switch' },
        })),
      ],
    });

    observer = createHTMLObserver({
      tag: 'DIV',
      className: 'rm-table',
      callback: mount,
      removeCallback: unmount,
    });

    styleEl = addStyle(`
      .rdt-table-config .rdt-input-label label {
        min-width: 20px;
      }
      /* Chrome, Safari, Edge, Opera */
      .rdt-table-config input::-webkit-outer-spin-button,
      .rdt-table-config input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      /* Firefox */
      .rdt-table-config input[type=number] {
        -moz-appearance: textfield;
      }
      .rdt-table .rm-block-separator {
        display: none;
      }
      .rdt-table{
        border: 1px solid var(--rm-border-color, #d4d4d4);
      }

      /* ── Cell editor ── */
      .rdt-cell { cursor: text; }
      .rdt-cell-display {
        padding: 6px 11px;
        min-height: 30px;
        white-space: pre-wrap;
        word-break: break-word;
        line-height: 1.4;
      }
      .rdt-cell-input {
        width: 100%;
        border: none;
        outline: none;
        background: transparent;
        font: inherit;
        color: inherit;
        padding: 6px 11px;
        box-sizing: border-box;
        min-height: 30px;
        line-height: 1.4;
        display: block;
        resize: none;
        overflow: hidden;
      }
      .rdt-cell-editing {
        outline: 2px solid var(--rm-link-color, #137cbd);
        outline-offset: -2px;
      }

      /* ── Header ── */
      .rdt-th-inner {
        display: flex;
        align-items: center;
        padding: 6px 11px;
        gap: 4px;
        min-height: 30px;
      }
      .rdt-header-display {
        padding: 0;
        flex: 1;
        min-height: unset;
        cursor: text;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 4px;
      }
      .rdt-header-input {
        flex: 1;
        padding: 0;
        min-height: unset;
        font-weight: 700;
      }
      .rdt-col-badge {
        flex-shrink: 0;
        font-size: 10px;
        font-weight: 600;
        font-family: monospace;
        color: var(--rm-text-color-muted, #666);
        background: rgba(0,0,0,0.07);
        border-radius: 3px;
        padding: 0 4px;
        line-height: 16px;
        letter-spacing: 0.02em;
        user-select: none;
      }
      .rdt-header-text {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* ── Sort icon ── */
      .rdt-sort-icon {
        flex-shrink: 0;
        opacity: 0;
        cursor: pointer;
        user-select: none;
        display: flex;
        align-items: center;
        padding: 2px;
        border-radius: 2px;
        transition: opacity 0.1s;
      }
      th:hover .rdt-sort-icon { opacity: 0.4; }
      .rdt-sort-icon:hover { opacity: 0.7 !important; background: rgba(0,0,0,0.05); }
      .rdt-sort-active { opacity: 1 !important; color: var(--rm-link-color, #137cbd); }
      .rdt-sort-active .bp3-icon svg { fill: var(--rm-link-color, #137cbd); }

      /* ── Filter icon (in header) ── */
      .rdt-filter-icon {
        flex-shrink: 0;
        opacity: 0;
        cursor: pointer;
        user-select: none;
        display: flex;
        align-items: center;
        padding: 2px;
        border-radius: 2px;
        transition: opacity 0.1s;
      }
      th:hover .rdt-filter-icon { opacity: 0.4; }
      .rdt-filter-icon:hover { opacity: 0.7 !important; background: rgba(0,0,0,0.05); }
      .rdt-filter-active { opacity: 1 !important; color: var(--rm-link-color, #137cbd); }
      .rdt-filter-active .bp3-icon svg { fill: var(--rm-link-color, #137cbd); }
      .rdt-filter-has-value { opacity: 1 !important; color: var(--rm-intent-warning-color, #d9822b); }
      .rdt-filter-has-value .bp3-icon svg { fill: var(--rm-intent-warning-color, #d9822b); }

      /* ── Filter row ── */
      .rdt-filter-row th {
        padding: 2px 4px !important;
        background: var(--rm-bg-secondary, #f5f5f5);
      }
      .rdt-filter-input {
        width: 100%;
        border: 1px solid var(--rm-border-color, #d4d4d4);
        border-radius: 3px;
        padding: 2px 6px;
        font-size: 12px;
        background: var(--rm-bg, white);
        color: inherit;
        box-sizing: border-box;
        outline: none;
      }
      .rdt-filter-input:focus { border-color: var(--rm-link-color, #137cbd); }
      .rdt-filter-input::placeholder { color: var(--rm-text-color-muted, #aaa); }

      /* ── Address column ── */
      .rdt-addr-col {
        width: 28px !important;
        min-width: 28px;
        max-width: 28px;
        text-align: center !important;
        color: var(--rm-text-color-muted, #888);
        font-size: 11px;
        font-family: monospace;
        user-select: none;
        pointer-events: none;
        padding: 6px 2px !important;
      }

      /* ── Menu column ── */
      .rdt-menu-col {
        width: 32px !important;
        min-width: 32px;
        max-width: 32px;
        padding: 0 !important;
        text-align: center;
        vertical-align: middle;
        border-left: none !important;
      }
      /* Show the menu button only when hovering the table */
      .rdt-table-wrap .rdt-menu-col .bp3-button { opacity: 0; transition: opacity 0.1s; }
      .rdt-table-wrap:hover .rdt-menu-col .bp3-button { opacity: 1; }

      /* ── Formula range selection ── */
      .rdt-formula-selecting {
        background: rgba(19, 123, 189, 0.18) !important;
        outline: 1px solid rgba(19, 123, 189, 0.5);
        outline-offset: -1px;
      }

      /* ── Formula cells ── */
      .rdt-formula-cell {
        position: relative;
        background: rgba(19, 123, 189, 0.07) !important;
        color: rgba(19, 123, 189, 0.8);
      }
      .rdt-formula-badge {
        position: absolute;
        top: 3px;
        right: 5px;
        font-size: 9px;
        font-family: monospace;
        font-weight: 700;
        letter-spacing: -0.03em;
        color: var(--rm-link-color, #137cbd);
        opacity: 0.45;
        user-select: none;
        pointer-events: none;
        line-height: 1;
        transition: opacity 0.1s;
      }
      .rdt-cell:hover .rdt-formula-badge { opacity: 0.9; }

      /* ── No results ── */
      .rdt-no-results {
        text-align: center;
        padding: 12px;
        color: var(--rm-text-color-muted, #888);
        font-size: 13px;
      }

      /* ── Drag handle column ── */
      .rdt-drag-col {
        width: 22px !important;
        min-width: 22px;
        max-width: 22px;
        padding: 0 !important;
        border-right: none !important;
      }
      .rdt-drag-handle-col {
        width: 22px;
        padding: 0 !important;
        text-align: center;
        border-right: none !important;
      }
      .rdt-drag-handle {
        display: inline-block;
        opacity: 0;
        color: var(--rm-text-color-muted, #aaa);
        font-size: 14px;
        line-height: 1;
        cursor: grab;
        padding: 6px 4px;
        user-select: none;
        transition: opacity 0.1s;
      }
      tr:hover .rdt-drag-handle { opacity: 0.45; }
      .rdt-drag-handle:hover { opacity: 0.85 !important; }
      .rdt-drag-handle:active { cursor: grabbing; }
      .rdt-row-dragging { opacity: 0.35; }
      .rdt-row-drop-target > td { box-shadow: inset 0 2px 0 var(--rm-link-color, #137cbd); }

      /* ── Status pill ── */
      .rdt-status-pill {
        display: inline-block;
        padding: 1px 8px;
        border-radius: 10px;
        font-size: 12px;
        font-weight: 500;
        line-height: 18px;
        white-space: nowrap;
        background: rgba(0,0,0,0.07);
      }
      .rdt-status-done {
        text-decoration: line-through;
        opacity: 0.65;
      }
      .rdt-cell-typed { cursor: pointer; }
      .rdt-cell-typed .rdt-cell-placeholder {
        color: var(--rm-text-color-muted, #bbb);
        font-size: 11px;
      }

      /* ── Column type badge in header ── */
      .rdt-col-type-badge {
        font-size: 11px;
        opacity: 0.45;
        flex-shrink: 0;
        user-select: none;
      }

      /* ── Column config editor popover ── */
      .rdt-col-config {
        padding: 12px 14px;
        min-width: 230px;
        max-width: 310px;
      }
      .rdt-col-config-header {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--rm-text-color-muted, #888);
        margin-bottom: 10px;
      }
      .rdt-col-config-list {
        display: flex;
        flex-direction: column;
        gap: 5px;
        margin-bottom: 8px;
        max-height: 260px;
        overflow-y: auto;
      }
      .rdt-col-config-row {
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .rdt-col-config-input {
        flex: 1;
        min-width: 0;
        border: 1px solid var(--rm-border-color, #d4d4d4);
        border-radius: 3px;
        padding: 3px 7px;
        font-size: 13px;
        background: var(--rm-bg, white);
        color: inherit;
        box-sizing: border-box;
        outline: none;
      }
      .rdt-col-config-input:focus { border-color: var(--rm-link-color, #137cbd); }
      .rdt-col-config-hidden-label {
        display: flex;
        align-items: center;
        gap: 3px;
        font-size: 11px;
        color: var(--rm-text-color-muted, #888);
        white-space: nowrap;
        cursor: pointer;
        flex-shrink: 0;
      }
      .rdt-col-config-delete {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--rm-text-color-muted, #aaa);
        font-size: 17px;
        padding: 0 3px;
        line-height: 1;
        flex-shrink: 0;
      }
      .rdt-col-config-delete:hover { color: var(--rm-intent-danger-color, #c23030); }
      .rdt-col-config-add {
        display: flex;
        align-items: center;
        gap: 5px;
        padding-top: 4px;
        border-top: 1px solid var(--rm-border-color, #eee);
        margin-bottom: 10px;
      }
      .rdt-col-config-footer {
        display: flex;
        align-items: center;
        gap: 6px;
        justify-content: flex-end;
      }

      /* ── Hidden rows disclosure ── */
      .rdt-hidden-disclosure {
        cursor: pointer;
        user-select: none;
      }
      .rdt-hidden-disclosure-cell {
        padding: 5px 11px !important;
        font-size: 12px;
        color: var(--rm-text-color-muted, #999);
        border-top: 1px dashed var(--rm-border-color, #ddd) !important;
      }
      .rdt-hidden-disclosure:hover .rdt-hidden-disclosure-cell {
        color: var(--rm-text-color, #444);
        background: var(--rm-bg-secondary, #f7f7f7);
      }
      .rdt-hidden-disclosure-icon {
        margin-right: 5px;
        font-size: 10px;
        display: inline-block;
        width: 10px;
      }
    `);
  },

  onunload() {
    observer?.disconnect();
    styleEl?.remove();
    for (const el of mounts.keys()) {
      unmount(el);
    }
  },
};
