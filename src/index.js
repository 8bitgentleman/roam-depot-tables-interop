import React from 'react';
import createButtonObserver from 'roamjs-components/dom/createButtonObserver';
import { createComponentRender } from 'roamjs-components/components/ComponentContainer';
import addStyle from 'roamjs-components/dom/addStyle';
import updateBlock from 'roamjs-components/writes/updateBlock';
import Table from './table.jsx';

let observer;

export default {
  onload({ extensionAPI }) {
    extensionAPI.ui.commandPalette.addCommand({
      label: 'Create Table+',
      callback: async () => {
        const uid = window.roamAlphaAPI.ui.getFocusedBlock()?.['block-uid'];
        if (!uid) return;
        document.querySelector('body')?.click();
        setTimeout(async () => {
          await updateBlock({ uid, text: '{{table-plus}}' });
        }, 200);
      },
    });

    observer = createButtonObserver({
      attribute: 'table-plus',
      render: (b) => {
        createComponentRender(
          ({ blockUid }) => <Table blockUid={blockUid} />,
          'rdt-table-container'
        )(b);
      },
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
      .rdt-workbench-table .rm-block-separator,
      .rdt-table-container .roamjs-edit-component {
        display: none;
      }
    `);
  },

  onunload() {
    observer?.disconnect();
  },
};
