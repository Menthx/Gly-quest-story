import { Shape } from '../models/game.models';

/** Arrondit à 0,1 % près : assez précis, et lisible dans le JSON. */
export const round = (n: number) => Math.round(n * 10) / 10;

/** Chaîne `points` pour un <polygon> SVG. */
export function polygonPoints(points: [number, number][]): string {
  return points.map(([x, y]) => `${x},${y}`).join(' ');
}

/** Rectangle englobant d'une forme, en %. */
export function boundingBox(shape: Shape): { x: number; y: number; width: number; height: number } {
  if (shape.type === 'rect') {
    return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
  }
  const xs = shape.points.map((p) => p[0]);
  const ys = shape.points.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}
