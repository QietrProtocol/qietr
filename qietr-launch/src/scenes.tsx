/* =============================================================================
 * scenes.tsx — Scenes 1-4 (problem -> arrival arc).
 *
 * Frames in each component are LOCAL to that scene's <Sequence>.
 *   S1 Trail     240f   "Every payment leaves a trail."
 *   S2 Graph     240f   "Payments reveal more than they should."
 *   S3 Question  210f   "What if payments only revealed what was necessary?"
 *   S4 Arrival   180f   Q mark + "Introducing Qietr"
 * ============================================================================= */

import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Grid, DrawLine, Node, FadeUpText, QMark } from "./primitives";
import { COLORS, W, H, MARGIN, TYPE, EASE, makeRng, interTight, mono } from "./theme";

const lowerThird: React.CSSProperties = {
  position: "absolute",
  left: MARGIN,
  bottom: 220,
};

/* =============================================================================
 * SCENE 1 — The trail
 * ========================================================================== */
const CHAIN: [number, number][] = [
  [560, 760],
  [1180, 980],
  [1820, 720],
  [2460, 1000],
  [3080, 760],
  [3380, 1080],
];
const HASHES = ["3aF9…c1", "9bE2…7d", "Kp4…a0", "Z7m…11", "Q2x…9f"];

export const S1Trail: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: COLORS.ground }}>
      <Grid appear={[0, 24]} />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {CHAIN.slice(0, -1).map((p, i) => {
          const q = CHAIN[i + 1];
          const s = 48 + i * 30;
          return (
            <DrawLine
              key={`e${i}`}
              x1={p[0]}
              y1={p[1]}
              x2={q[0]}
              y2={q[1]}
              start={s}
              end={s + 30}
              color={COLORS.ink}
            />
          );
        })}
        {CHAIN.map((p, i) => (
          <Node key={`n${i}`} cx={p[0]} cy={p[1]} r={16} start={36 + i * 30} />
        ))}
      </svg>
      {/* tx hashes under midpoints, mono */}
      {CHAIN.slice(0, -1).map((p, i) => {
        const q = CHAIN[i + 1];
        const mx = (p[0] + q[0]) / 2;
        const my = (p[1] + q[1]) / 2;
        const o = interpolate(frame, [78 + i * 30, 96 + i * 30], [0, 0.7], {
          easing: EASE.out,
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={`h${i}`}
            style={{
              position: "absolute",
              left: mx - 90,
              top: my + 28,
              fontFamily: mono,
              fontSize: TYPE.mono,
              color: COLORS.inkSecondary,
              opacity: o,
            }}
          >
            {HASHES[i]}
          </div>
        );
      })}
      <div style={lowerThird}>
        <FadeUpText start={120} size={TYPE.hero}>
          Every payment leaves a trail.
        </FadeUpText>
      </div>
    </AbsoluteFill>
  );
};

/* =============================================================================
 * SCENE 2 — The graph (seeded, deterministic layout)
 * ========================================================================== */
type P = { x: number; y: number };
const buildGraph = () => {
  const rng = makeRng(20260613);
  const nodes: P[] = [];
  const N = 34;
  for (let i = 0; i < N; i++) {
    // central elliptical cloud, clear of the lower-third
    const cx = W / 2 + (rng() - 0.5) * 2600;
    const cy = 880 + (rng() - 0.5) * 1100;
    nodes.push({ x: cx, y: Math.min(cy, 1560) });
  }
  // connect each node to its 2 nearest predecessors
  const edges: [number, number][] = [];
  for (let i = 1; i < N; i++) {
    const dists = nodes
      .slice(0, i)
      .map((p, j) => ({ j, d: Math.hypot(p.x - nodes[i].x, p.y - nodes[i].y) }))
      .sort((a, b) => a.d - b.d);
    edges.push([dists[0].j, i]);
    if (i > 3 && dists[1]) edges.push([dists[1].j, i]);
  }
  return { nodes, edges };
};
const GRAPH = buildGraph();
const LABELS: Record<number, string> = { 2: "wallet", 9: "exchange", 17: "salary", 25: "merchant" };
const HILITE = new Set([0, 4, 9, 14, 21, 28]); // the reconstructed path nodes

export const S2Graph: React.FC = () => {
  const frame = useCurrentFrame();
  const { nodes, edges } = GRAPH;
  // dim everything except the highlighted path during 120-192
  const dim = interpolate(frame, [120, 150], [1, 0.18], {
    easing: EASE.out,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // retraction in the final 48 frames -> scene ends clean
  const retract = frame >= 192;
  return (
    <AbsoluteFill style={{ background: COLORS.ground }}>
      <Grid appear={[0, 1]} maxOpacity={0.1} disappear={[192, 236]} />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {edges.map(([a, b], i) => {
          const hot = HILITE.has(a) && HILITE.has(b);
          const s = i * 2;
          return (
            <DrawLine
              key={`e${i}`}
              x1={nodes[a].x}
              y1={nodes[a].y}
              x2={nodes[b].x}
              y2={nodes[b].y}
              start={s}
              end={s + 24}
              color={hot ? COLORS.ink : COLORS.grid}
              width={hot ? 6 : 3}
              opacity={hot ? 1 : dim}
              back={retract}
            />
          );
        })}
        {nodes.map((p, i) => {
          const hot = HILITE.has(i);
          const fade = retract
            ? interpolate(frame, [192, 230], [1, 0], {
                easing: EASE.in,
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })
            : hot
              ? 1
              : dim;
          return (
            <g key={`n${i}`} opacity={fade}>
              <Node
                cx={p.x}
                cy={p.y}
                r={hot ? 16 : 11}
                start={i * 2}
                color={hot ? COLORS.ink : COLORS.inkSecondary}
              />
            </g>
          );
        })}
      </svg>
      {Object.entries(LABELS).map(([k, v]) => {
        const p = nodes[Number(k)];
        const o = interpolate(frame, [70, 96], [0, 0.7], {
          easing: EASE.out,
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={k}
            style={{
              position: "absolute",
              left: p.x + 24,
              top: p.y - 16,
              fontFamily: mono,
              fontSize: TYPE.mono,
              color: COLORS.inkSecondary,
              opacity: retract ? 0 : o,
            }}
          >
            {v}
          </div>
        );
      })}
      <div style={lowerThird}>
        <FadeUpText start={24} exit={[196, 220]} size={TYPE.hero}>
          Payments reveal more than they should.
        </FadeUpText>
      </div>
    </AbsoluteFill>
  );
};

/* =============================================================================
 * SCENE 3 — The question (held white + centered line)
 * ========================================================================== */
export const S3Question: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        background: COLORS.ground,
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 2200, padding: `0 ${MARGIN}px` }}>
        {/* held white for ~30f, then the line fades up */}
        <FadeUpText start={40} size={TYPE.hero} style={{ textAlign: "center", lineHeight: 1.18 }}>
          What if payments only revealed
          <br />
          what was necessary?
        </FadeUpText>
      </div>
    </AbsoluteFill>
  );
};

/* =============================================================================
 * SCENE 4 — Arrival (Q mark assembles, wordmark types in)
 * ========================================================================== */
export const S4Arrival: React.FC = () => {
  const frame = useCurrentFrame();
  const d = 560;
  const cx = W / 2 - 360;
  const cy = H / 2;
  // wordmark slides in to the right of the mark
  const wmO = interpolate(frame, [120, 150], [0, 1], {
    easing: EASE.out,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const wmX = interpolate(frame, [120, 150], [40, 0], {
    easing: EASE.out,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ background: COLORS.ground }}>
      <Grid appear={[0, 30]} maxOpacity={0.06} />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <QMark
          cx={cx}
          cy={cy}
          d={d}
          ringStart={6}
          ringEnd={96}
          tailStart={96}
          tailEnd={120}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          left: cx + d / 2 + 120,
          top: cy - 150,
          opacity: wmO,
          transform: `translateX(${wmX}px)`,
        }}
      >
        <div
          style={{
            fontFamily: interTight,
            fontWeight: 400,
            fontSize: TYPE.kicker,
            color: COLORS.inkSecondary,
            marginBottom: 16,
          }}
        >
          Introducing
        </div>
        <div
          style={{
            fontFamily: interTight,
            fontWeight: 600,
            fontSize: 220,
            letterSpacing: "-0.02em",
            color: COLORS.ink,
            lineHeight: 1,
          }}
        >
          Qietr
        </div>
      </div>
    </AbsoluteFill>
  );
};
