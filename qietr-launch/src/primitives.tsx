/* =============================================================================
 * primitives.tsx — reusable motion building blocks.
 *
 * Everything animates off useCurrentFrame() + interpolate(). No CSS transitions.
 * ============================================================================= */

import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { COLORS, EASE, STROKE, interTight, inter } from "./theme";

/* ----------------------------------------------------------------------------
 * Grid — thin technical background lines. Fades in via `appear` window.
 * -------------------------------------------------------------------------- */
export const Grid: React.FC<{
  cell?: number;
  maxOpacity?: number;
  appear?: [number, number];
  disappear?: [number, number];
}> = ({ cell = 192, maxOpacity = 0.08, appear = [0, 24], disappear }) => {
  const frame = useCurrentFrame();
  let o = interpolate(frame, appear, [0, maxOpacity], {
    easing: EASE.out,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (disappear) {
    o *= interpolate(frame, disappear, [1, 0], {
      easing: EASE.in,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }
  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: "absolute", inset: 0, opacity: o }}
    >
      <defs>
        <pattern id="g" width={cell} height={cell} patternUnits="userSpaceOnUse">
          <path
            d={`M ${cell} 0 L 0 0 0 ${cell}`}
            fill="none"
            stroke={COLORS.grid}
            strokeWidth={2}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)" />
    </svg>
  );
};

/* ----------------------------------------------------------------------------
 * DrawLine — a segment drawn via stroke-dashoffset over [start, end] frames.
 * `back` reverses (retraction). Works inside an <svg>.
 * -------------------------------------------------------------------------- */
export const DrawLine: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  start: number;
  end: number;
  width?: number;
  color?: string;
  opacity?: number;
  back?: boolean;
}> = ({
  x1,
  y1,
  x2,
  y2,
  start,
  end,
  width = STROKE.line,
  color = COLORS.strong,
  opacity = 1,
  back = false,
}) => {
  const frame = useCurrentFrame();
  const len = Math.hypot(x2 - x1, y2 - y1);
  const p = interpolate(frame, [start, end], back ? [1, 0] : [0, 1], {
    easing: EASE.inOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      opacity={opacity}
      strokeDasharray={len}
      strokeDashoffset={len * (1 - p)}
    />
  );
};

/* ----------------------------------------------------------------------------
 * Node — a dot. Filled (solid) or hollow (agent). Scales+fades in at `start`.
 * -------------------------------------------------------------------------- */
export const Node: React.FC<{
  cx: number;
  cy: number;
  r?: number;
  start?: number;
  hollow?: boolean;
  color?: string;
  pulse?: boolean;
}> = ({
  cx,
  cy,
  r = 12,
  start = 0,
  hollow = false,
  color = COLORS.ink,
  pulse = false,
}) => {
  const frame = useCurrentFrame();
  const s = interpolate(frame, [start, start + 12], [0.6, 1], {
    easing: EASE.out,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const o = interpolate(frame, [start, start + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pr = pulse
    ? r * (1 + 0.15 * Math.sin((frame - start) / 6))
    : r * s;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={pr}
      fill={hollow ? "none" : color}
      stroke={hollow ? color : "none"}
      strokeWidth={hollow ? STROKE.ring : 0}
      opacity={o}
    />
  );
};

/* ----------------------------------------------------------------------------
 * FadeUpText — opacity 0->1 + translateY 16px->0 entrance, optional exit.
 * The film's single text-entrance gesture.
 * -------------------------------------------------------------------------- */
export const FadeUpText: React.FC<{
  children: React.ReactNode;
  start: number;
  exit?: [number, number];
  size: number;
  display?: boolean; // Inter Tight 600 vs Inter 400
  weight?: number;
  color?: string;
  tracking?: number;
  style?: React.CSSProperties;
}> = ({
  children,
  start,
  exit,
  size,
  display = true,
  weight,
  color = COLORS.ink,
  tracking = -0.01,
  style,
}) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [start, start + 18], [0, 1], {
    easing: EASE.out,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const leave = exit
    ? interpolate(frame, exit, [1, 0], {
        easing: EASE.in,
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;
  const o = enter * leave;
  const y = (1 - enter) * 16 + (1 - leave) * -16;
  return (
    <div
      style={{
        fontFamily: display ? interTight : inter,
        fontWeight: weight ?? (display ? 600 : 400),
        fontSize: size,
        letterSpacing: `${tracking}em`,
        color,
        opacity: o,
        transform: `translateY(${y}px)`,
        lineHeight: 1.1,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/* ----------------------------------------------------------------------------
 * QMark — the brand mark: a ring drawn clockwise from 12 o'clock, then a tail
 * segment exiting at 315 deg, terminating in one solid node.
 * "Everything mixes in the pool; only what is necessary leaves."
 * -------------------------------------------------------------------------- */
export const QMark: React.FC<{
  cx: number;
  cy: number;
  d: number; // diameter
  ringStart: number;
  ringEnd: number;
  tailStart: number;
  tailEnd: number;
  width?: number;
  color?: string;
}> = ({
  cx,
  cy,
  d,
  ringStart,
  ringEnd,
  tailStart,
  tailEnd,
  width = STROKE.ring,
  color = COLORS.strong,
}) => {
  const frame = useCurrentFrame();
  const r = d / 2;
  const circ = 2 * Math.PI * r;
  const ringP = interpolate(frame, [ringStart, ringEnd], [0, 1], {
    easing: EASE.inOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // tail at 315deg (down-right), from the ring outward
  const a = Math.PI / 4; // 45 deg below horizontal
  const tx1 = cx + r * Math.cos(a);
  const ty1 = cy + r * Math.sin(a);
  const tailLen = d * 0.22;
  const tx2 = tx1 + tailLen * Math.cos(a);
  const ty2 = ty1 + tailLen * Math.sin(a);
  const nodeO = interpolate(frame, [tailEnd - 6, tailEnd + 6], [0, 1], {
    easing: EASE.out,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <g>
      {/* ring: start the dash from the top (rotate -90deg about center) */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - ringP)}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <DrawLine
        x1={tx1}
        y1={ty1}
        x2={tx2}
        y2={ty2}
        start={tailStart}
        end={tailEnd}
        width={width}
        color={color}
      />
      <circle cx={tx2} cy={ty2} r={width * 1.5} fill={color} opacity={nodeO} />
    </g>
  );
};
