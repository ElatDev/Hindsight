import { useId } from 'react';
import type { ArrowSpec } from './Board';
import { arrowPath } from './arrowGeometry';

export type ArrowOverlayProps = {
  /** Arrows to render. Drawn in the order given so later arrows sit on top. */
  arrows: readonly ArrowSpec[];
  /** Match the board's orientation so square-to-coord math agrees. */
  orientation: 'white' | 'black';
  /** Default colour for arrows whose tuple omits the third element. Mirrors
   *  react-chessboard's `customArrowColor` semantics. */
  defaultColor: string;
};

/**
 * SVG overlay rendered above the chessboard. Knight jumps come out L-shaped
 * (two perpendicular segments meeting at a right angle); every other arrow
 * is a straight line. Each arrow is its own `<g>` so we can use a unique
 * `marker-end` id per colour without polluting the document with a global
 * marker registry. `pointer-events: none` keeps clicks falling through to
 * the underlying board for square selection / drag-drop / right-click.
 */
export function ArrowOverlay({
  arrows,
  orientation,
  defaultColor,
}: ArrowOverlayProps): JSX.Element | null {
  const baseId = useId();
  if (arrows.length === 0) return null;
  return (
    <svg
      className="arrow-overlay"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        {arrows.map((arrow, i) => {
          const color = arrow[2] ?? defaultColor;
          return (
            <marker
              key={`m${i}`}
              id={`${baseId}-head-${i}`}
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="3.5"
              markerHeight="3.5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
            </marker>
          );
        })}
      </defs>
      {arrows.map((arrow, i) => {
        const [from, to] = arrow;
        const color = arrow[2] ?? defaultColor;
        const { d, strokeWidth } = arrowPath(from, to, orientation);
        return (
          <path
            key={`${from}-${to}-${i}`}
            d={d}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            markerEnd={`url(#${baseId}-head-${i})`}
            opacity={0.85}
          />
        );
      })}
    </svg>
  );
}
