import React, { useMemo, useState } from 'react';
import getBasicTreeByParentUid from 'roamjs-components/queries/getBasicTreeByParentUid';
import Configuration from './components/Configuration';
import DisplayTable from './components/DisplayTable';

export { colIndexToLetter } from './utils/blockHelpers';

// ─── Table (wrapper) ───────────────────────────────────────────────────────────
const Table = ({ blockUid }) => {
  const tree = useMemo(() => getBasicTreeByParentUid(blockUid), [blockUid]);
  const [isEdit, setIsEdit] = useState(!tree[0]?.uid);

  return isEdit ? (
    <Configuration blockUid={blockUid} onSubmit={() => setIsEdit(false)} />
  ) : (
    <DisplayTable blockUid={blockUid} />
  );
};

export default Table;
