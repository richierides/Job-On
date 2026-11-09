import { Furniture } from "../model";
// Opposite corner remains fixed when resizing at any clockwise rotation.
export function resizeCorner(
  item: Furniture,
  dx: number,
  dy: number,
  cornerX: 1 | -1 = 1,
  cornerY: 1 | -1 = 1,
): Furniture {
  const a = (item.rotation * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a);
  const width = Math.max(5, item.width + cornerX * (c * dx + s * dy)),
    depth = Math.max(5, item.depth + cornerY * (-s * dx + c * dy));
  const lx = (cornerX * (width - item.width)) / 2,
    ly = (cornerY * (depth - item.depth)) / 2;
  return {
    ...item,
    width,
    depth,
    x: item.x + c * lx - s * ly,
    y: item.y + s * lx + c * ly,
    dimensionsConfirmed: false,
  };
}
