# Table Plus

An enhanced table editor for Roam Research that replaces the native table renderer. It works directly with native `{{table}}` blocks, so your data stays in standard Roam format. Disable the extension and Roam renders your tables exactly as it always has.

## Features

**Direct Cell Editing**

Click any cell to edit it inline. Press `Enter` to confirm and move down, or `Escape` to discard. Cell content renders as full Roam markdown (`[[page links]]`, `((block refs))`, **bold**, etc.) when not editing.

**Keyboard navigation**

| Key | Action |
|-----|--------|
| `Enter` | Commit edit, move down (adds a new row at the last row) |
| `Shift+Enter` | Insert newline in cell |
| `Tab` | Commit, move right (wraps to next row) |
| `Shift+Tab` | Commit, move left |
| `Escape` | Discard edit |

**Sorting**

Click the sort icon (▲▼) in any column header to cycle through unsorted, ascending, and descending. Numbers sort numerically, text alphabetically.

**Filtering**

Click the filter icon (⊿) in a column header to open a filter input. Filters are session-only and multiple columns can be filtered at once. A "Clear Filters" option appears in the table menu when any filter is active.

**Formulas**

Cells starting with `=` are evaluated as formulas, similar to excel or google sheets. The computed value shows when not editing; the raw formula shows while editing. Formulas evaluate against the visual row order (post-sort, post-filter).

| Syntax | Description |
|--------|-------------|
| `=SUM(B2:B5)` | Sum of a range |
| `=AVG(B2:B5)` | Average of a range |
| `=COUNT(B2:B5)` | Count of numeric values in range |
| `=MIN(B2:B5)` | Minimum value |
| `=MAX(B2:B5)` | Maximum value |
| `=B3` | Bare cell reference |

Column A is the leftmost data column; row 1 is the first data row (header is row 0). Formula cells can reference other formula cells; circular references display `#CIRC!`. A small badge marks formula cells, and the tooltip shows the raw formula.

**Adding and removing rows/columns**

The `···` menu in the top-right of the table has:

- Add Row — appends a row at the bottom
- Add Column — appends a column on the right
- Remove Last Row — deletes the bottom row
- Remove Last Column — deletes the rightmost column

**Resizing columns**

Drag the resize handle at the right edge of any header cell. Widths are saved automatically.

**Display settings**

Open the table menu and select "Settings" to toggle:

- Striped — alternate row background colors
- Bordered — draw borders around each cell
- Interactive — highlight rows on hover
- Cell Addresses — show row numbers and column badges (useful when writing formulas)
