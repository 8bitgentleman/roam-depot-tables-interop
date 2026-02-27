import React from 'react';
import ReactDOM from 'react-dom';
import createHTMLObserver from 'roamjs-components/dom/createHTMLObserver';
import getUids from 'roamjs-components/dom/getUids';
import addStyle from 'roamjs-components/dom/addStyle';
import updateBlock from 'roamjs-components/writes/updateBlock';
import Table from './table.jsx';

// Track all mounts for cleanup on unload.
// Key: .rm-table element, Value: { root, container, nativeTable, hoverOnly }
const mounts = new Map();

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
    extensionAPI.ui.commandPalette.addCommand({
      label: 'Create Table',
      callback: async () => {
        const uid = window.roamAlphaAPI.ui.getFocusedBlock()?.['block-uid'];
        if (!uid) return;
        document.querySelector('body')?.click();
        setTimeout(async () => {
          await updateBlock({ uid, text: '{{[[table]]}}' });
        }, 200);
      },
    });

    observer = createHTMLObserver({
      tag: 'DIV',
      className: 'rm-table',
      callback: mount,
      removeCallback: unmount,
    });

    addStyle(`
      .rdt-table-config .rdt-input-label label {
        min-width: 70px;
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
      .rdt-workbench-table.basic-text td {
        user-select: none;
        pointer-events: none;
      }
      .rdt-workbench-table.basic-text input,
      .rdt-workbench-table.basic-text span {
        pointer-events: auto;
        width: 100%;
      }
      .rdt-workbench-table .rm-block-separator {
        display: none;
      }
    `);
  },

  onunload() {
    observer?.disconnect();
    for (const el of mounts.keys()) {
      unmount(el);
    }
  },
};
