// Invisible edge/corner handles for resizing the frameless window.

import { getCurrentWindow } from '@tauri-apps/api/window';

const win = getCurrentWindow();

type Direction =
  | 'North' | 'South' | 'East' | 'West'
  | 'NorthWest' | 'NorthEast' | 'SouthWest' | 'SouthEast';

const startResize = (dir: Direction) => async (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  try { await win.startResizeDragging(dir as never); }
  catch (err) { console.warn('startResizeDragging failed:', err); }
};

const SIDE = 4;    // edge handle thickness in px
const CORNER = 12; // corner handle size in px

const base: React.CSSProperties = {
  position: 'fixed',
  zIndex: 9000,
  background: 'transparent',
  // Sit above all content but below modals/palette (which are 9999)
};

export default function ResizeHandles() {
  return (
    <>
      {/* Edges */}
      <div onMouseDown={startResize('North')}     style={{ ...base, top: 0,    left: CORNER, right: CORNER, height: SIDE, cursor: 'ns-resize' }} />
      <div onMouseDown={startResize('South')}     style={{ ...base, bottom: 0, left: CORNER, right: CORNER, height: SIDE, cursor: 'ns-resize' }} />
      <div onMouseDown={startResize('West')}      style={{ ...base, left: 0,   top: CORNER,  bottom: CORNER, width: SIDE, cursor: 'ew-resize' }} />
      <div onMouseDown={startResize('East')}      style={{ ...base, right: 0,  top: CORNER,  bottom: CORNER, width: SIDE, cursor: 'ew-resize' }} />

      {/* Corners */}
      <div onMouseDown={startResize('NorthWest')} style={{ ...base, top: 0,    left: 0,    width: CORNER, height: CORNER, cursor: 'nwse-resize' }} />
      <div onMouseDown={startResize('NorthEast')} style={{ ...base, top: 0,    right: 0,   width: CORNER, height: CORNER, cursor: 'nesw-resize' }} />
      <div onMouseDown={startResize('SouthWest')} style={{ ...base, bottom: 0, left: 0,    width: CORNER, height: CORNER, cursor: 'nesw-resize' }} />
      <div onMouseDown={startResize('SouthEast')} style={{ ...base, bottom: 0, right: 0,   width: CORNER, height: CORNER, cursor: 'nwse-resize' }} />
    </>
  );
}
