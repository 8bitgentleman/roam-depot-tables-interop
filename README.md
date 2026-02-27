# Table+

A table extension for Roam Research that stores your data in the same block structure as native `{{[[table]]}}` blocks. Your data is never locked into a proprietary format -- if you uninstall the extension, the underlying blocks remain and can be read by Roam's built-in table renderer.

## How it works

Table+ uses a `{{table-plus}}` button block. The child blocks beneath it follow the exact same structure Roam uses for native tables: each row is a block whose text is the first cell, and whose children are the remaining cells. A `__table-settings__` block at the end stores display preferences (styles, column widths, view mode).

This means you can copy the data rows under a `{{[[table]]}}` block at any time and get a fully functional native Roam table -- no conversion needed.

## Usage

**Creating a table**

1. Place your cursor in any block.
2. Open the command palette (Cmd+P on Mac, Ctrl+P on Windows) and run "Create Table+", or type `{{table-plus}}` directly into a block.
3. A configuration panel will appear. Choose your number of rows and columns, select any display options, and click "Create Table".

**Editing cells**

Click any cell to edit it inline. Press Enter or click outside to confirm.

In Embed view, cells render as full Roam blocks -- you can use markdown, block references, and all standard Roam syntax. In Basic Text view, cells show plain editable text.

**Adding and removing rows/columns**

Click the menu icon (three dots) in the top-right corner of the table to access:

- Add Row -- appends a new row at the bottom
- Add Column -- appends a new column on the right
- Remove Last Row -- deletes the bottom row
- Remove Last Column -- deletes the rightmost column

**Resizing columns**

Drag the resize handle at the right edge of any cell to adjust column width. Widths are saved automatically.

**Changing display settings**

Open the table menu and select "Settings" to return to the configuration panel. You can update styles (striped, bordered, condensed, interactive) and the view mode (Basic Text or Embed) without losing your data.

**Editing the source block**

Select "Edit Block" from the table menu to focus the underlying `{{table-plus}}` block, where you can inspect or manually edit the raw block structure.

## Native table interop

To convert a Table+ table to a native Roam table:

1. Create a new block with `{{[[table]]}}`
2. Move the data row blocks (everything except `__table-settings__`) as children of that block
3. Delete the `__table-settings__` block

The data rows are already in the correct format and will render immediately as a native table.
