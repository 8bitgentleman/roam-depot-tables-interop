// ─── Settings config ───────────────────────────────────────────────────────────
export const STYLE_CONFIG = [
  { key: 'striped',       label: 'Striped',         description: 'Alternate row background colors' },
  { key: 'bordered',      label: 'Bordered',         description: 'Draw borders around each cell' },
  { key: 'condensed',     label: 'Compact',          description: 'Reduce cell padding' },
  { key: 'interactive',   label: 'Interactive',      description: 'Highlight rows on hover' },
  { key: 'showAddresses', label: 'Cell Addresses',   description: 'Show A1 row/column address labels' },
];

export const VIEW_CONFIG = [
  { value: 'plain', label: 'Basic Text', description: 'Edit cells as inline plain text' },
  { value: 'embed', label: 'Embed',      description: 'Render full Roam blocks — supports markdown, block refs, queries' },
];

// ─── Settings storage ─────────────────────────────────────────────────────────
const PROP_WRITE_KEY = 'table-plus/settings';
const PROP_READ_KEYS = ['::table-plus/settings', ':table-plus/settings', 'table-plus/settings'];

export function defaultSettings() {
  return {
    styles: Object.fromEntries(STYLE_CONFIG.map(({ key }) => [key, key === 'striped'])),
    widths: {},
    view: 'plain',
  };
}

export function getBlockSettings(blockUid) {
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

export function saveBlockSettings(blockUid, settings) {
  try {
    window.roamAlphaAPI.updateBlock({
      block: { uid: blockUid, props: { [PROP_WRITE_KEY]: JSON.stringify(settings) } },
    });
  } catch {}
}
