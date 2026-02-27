# Table+

An enhanced table editor for Roam Research that replaces the native table renderer with a richer interface. Because it works directly with native `{{table}}` and `{{[[table]]}}` blocks, your data is always in standard Roam format -- disable the extension and your tables are still fully readable with Roam's built-in renderer.

Display preferences (styles, column widths, view mode) are stored in the block's properties, not as child blocks, so they never appear as extra rows in the native rendering.

## How it works

Table+ intercepts every native table block in your graph and replaces the default table view with its own component. The underlying block structure is identical to what Roam uses natively: each row is a block whose text is the first cell, and whose children are the remaining cells. The extension adds nothing to that structure -- settings live in `:block/props` on the table block itself.

## Usage

**Creating a table**

1. Place your cursor in any block.
2. Open the command palette (Cmd+P on Mac, Ctrl+P on Windows) and run "Create Table", or type `{{[[table]]}}` directly into a block.
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

Table+ works directly on native `{{table}}` and `{{[[table]]}}` blocks. If you disable the extension, Roam renders your tables exactly as it normally would -- there is nothing to convert or clean up.
