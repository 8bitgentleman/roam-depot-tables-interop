import React, { useMemo, useState } from 'react';
import {
  NumericInput,
  Checkbox,
  Button,
  Card,
  Elevation,
  FormGroup,
  RadioGroup,
  Radio,
  Divider,
} from '@blueprintjs/core';
import createBlock from 'roamjs-components/writes/createBlock';
import { STYLE_CONFIG, VIEW_CONFIG, defaultSettings, getBlockSettings, saveBlockSettings } from '../utils/settings';
import { buildRowNode, getTableState } from '../utils/blockHelpers';

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

export default Configuration;
