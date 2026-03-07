import React, { useState } from 'react';
import { NumericInput, Button, Card, Elevation, FormGroup } from '@blueprintjs/core';
import createBlock from 'roamjs-components/writes/createBlock';
import { defaultSettings, saveBlockSettings } from '../utils/settings';
import { buildRowNode } from '../utils/blockHelpers';
import { getExtensionAPI } from '../utils/extensionAPI';

function getDefaults() {
  const api = getExtensionAPI();
  const base = defaultSettings();
  return {
    rows: parseInt(api?.settings.get('default-rows')) || 3,
    cols: parseInt(api?.settings.get('default-cols')) || 3,
    styles: Object.fromEntries(
      Object.keys(base.styles).map((key) => [
        key,
        api?.settings.get(`default-style-${key}`) ?? base.styles[key],
      ])
    ),
    view: api?.settings.get('default-view') || base.view,
  };
}

const Configuration = ({ blockUid, onSubmit }) => {
  const defaults = getDefaults();
  const [numRows, setNumRows] = useState(defaults.rows);
  const [numCols, setNumCols] = useState(defaults.cols);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
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
    saveBlockSettings(blockUid, {
      styles: defaults.styles,
      widths: {},
      view: defaults.view,
    });
    onSubmit();
    setLoading(false);
  };

  return (
    <div className="rdt-table-config" style={{ width: '230px' }}>
      <Card elevation={Elevation.ONE}>
        <FormGroup label="Rows" labelFor="rdt-rows-input" inline className="rdt-input-label">
          <NumericInput id="rdt-rows-input" value={numRows} onValueChange={setNumRows} style={{ width: '50px' }} />
        </FormGroup>
        <FormGroup label="Columns" labelFor="rdt-cols-input" inline className="rdt-input-label">
          <NumericInput id="rdt-cols-input" value={numCols} onValueChange={setNumCols} style={{ width: '50px' }} />
        </FormGroup>
        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          <Button loading={loading} text="Create Table" onClick={handleCreate} intent="primary" />
        </div>
      </Card>
    </div>
  );
};

export default Configuration;
