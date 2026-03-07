# Table Plus

An enhanced table editor for Roam Research that replaces the native table renderer with a richer interface. Because it works directly with native `{{table}}` blocks, your data is always in standard Roam format — disable the extension and your tables are still fully readable with Roam's built-in renderer.

Display preferences (styles, column widths) are stored in the block's properties, not as child blocks, so they never appear as extra rows in the native rendering.

## How it works

Table+ intercepts every native table block in your graph and replaces the default table view with its own component. The underlying block structure is identical to what Roam uses natively: each row is a block whose text is the first cell, and whose children form a chain of remaining cells. The extension adds nothing to that structure — settings live in `:block/props` on the table block itself.

## Usage

**Creating a table**

1. Place your cursor in any block.
2. Open the configuration panel (via the table block's UI).
3. Choose the number of rows and columns, select display options, and click "Create Table".

**Editing cells**

Click any cell to edit it inline using an auto-resizing text area. Press `Enter` to confirm and move down, or `Escape` to discard. Cell content renders as full Roam markdown (`[[page links]]`, `((block refs))`, **bold**, etc.) when not actively being edited.

**Keyboard navigation**

| Key | Action |
|-----|--------|
| `Enter` | Commit edit, move down (adds a new row when at the last row) |
| `Shift+Enter` | Insert newline in cell |
| `Tab` | Commit, move right (wraps to next row) |
| `Shift+Tab` | Commit, move left |
| `Escape` | Discard edit |

**Sorting**

Click the sort icon (▲▼) in any column header to cycle: unsorted → ascending → descending. Numeric values sort numerically; text values sort alphabetically.

**Filtering**

Click the filter icon (⊿) in any column header to open a filter input for that column. Filters are session-only (not persisted) and multiple columns can be filtered simultaneously. A "Clear Filters" option appears in the table menu when any filter is active.

**Formulas**

Cells starting with `=` are evaluated as formulas. The computed value is displayed when not editing; the raw formula is shown while editing. Formulas evaluate against the visual (post-sort, post-filter) row positions.

| Syntax | Description |
|--------|-------------|
| `=SUM(B2:B5)` | Sum of a range |
| `=AVG(B2:B5)` | Average of a range |
| `=COUNT(B2:B5)` | Count of numeric values in range |
| `=MIN(B2:B5)` | Minimum value |
| `=MAX(B2:B5)` | Maximum value |
| `=B3` | Bare cell reference |

A1 notation: column A = leftmost data column, row 1 = first data row (header = row 0). Formula cells can reference other formula cells; circular references display `#CIRC!`. A small `=` badge on a cell indicates it contains a formula — hover over it to confirm, and the tooltip shows the raw formula.

**Adding and removing rows/columns**

Click the `···` menu in the top-right corner of the table to access:

- **Add Row** — appends a new row at the bottom
- **Add Column** — appends a new column on the right
- **Remove Last Row** — deletes the bottom row
- **Remove Last Column** — deletes the rightmost column

**Resizing columns**

Drag the resize handle at the right edge of any cell to adjust column width. Widths are saved automatically in block settings.

**Changing display settings**

Open the table menu and select "Settings" to toggle display options:
- **Striped** — alternate row background colors
- **Bordered** — draw borders around each cell
- **Interactive** — highlight rows on hover
- **Cell Addresses** — show row numbers and A/B/C column badges (useful when writing formulas)

**Editing the source block**

Select "Edit Block" from the table menu to focus the underlying block in Roam's native editor.

## Native table interop

Table+ renders every `{{table}}` block in your graph. If you disable the extension, Roam renders your tables exactly as it normally would — there is nothing to convert or clean up.

## Development

```bash
npm install
npm run build   # outputs extension.js
```

Built with webpack + babel (JSX). React, ReactDOM, and Blueprint Core are provided by Roam at runtime and excluded from the bundle.
