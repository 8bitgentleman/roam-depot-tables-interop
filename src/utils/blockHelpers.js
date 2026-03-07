import getBasicTreeByParentUid from 'roamjs-components/queries/getBasicTreeByParentUid';
import { getBlockSettings } from './settings';

// ─── Block structure helpers ───────────────────────────────────────────────────
export function getRowCells(node) {
  const cells = [];
  let current = node;
  while (current) {
    cells.push({ uid: current.uid, text: current.text });
    current = current.children?.[0] ?? null;
  }
  return cells;
}

export function getChainTail(node) {
  let current = node;
  while (current.children?.[0]) current = current.children[0];
  return current;
}

export function getChainNodeAtDepth(node, depth) {
  let current = node;
  for (let i = 0; i < depth; i++) {
    if (!current.children?.[0]) return null;
    current = current.children[0];
  }
  return current;
}

export function buildRowNode(numCols, getTextFn = () => '') {
  const build = (colIndex) => {
    const node = { text: getTextFn(colIndex) };
    if (colIndex < numCols - 1) node.children = [build(colIndex + 1)];
    return node;
  };
  return build(0);
}

// ─── Table state ───────────────────────────────────────────────────────────────
export function getTableState(blockUid) {
  const tree = getBasicTreeByParentUid(blockUid);
  const headerNode = tree[0] ?? null;
  const rows = tree.slice(1);
  const settings = getBlockSettings(blockUid);
  return { tree, headerNode, rows, ...settings };
}

// ─── Address utilities ────────────────────────────────────────────────────────
export function colIndexToLetter(index) {
  let result = '', i = index + 1;
  while (i > 0) {
    result = String.fromCharCode(65 + ((i - 1) % 26)) + result;
    i = Math.floor((i - 1) / 26);
  }
  return result;
}
