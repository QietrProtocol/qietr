/* =============================================================================
 * scenes2.tsx — Scenes 5-8 (product -> close arc).
 *
 *   S5 Flow        300f   "Private USDC payments on Solana"
 *   S6 Principles  210f   Privacy-first / Open source / Non-custodial / Dev-friendly
 *   S7 Agents      180f   "Built for the agent economy"
 *   S8 Close       180f   tagline + qietr.com
 * ============================================================================= */

import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Grid, Node, FadeUpText, QMark } from "./primitives";
import { COLORS, W, H, MARGIN, TYPE, EASE, makeRng, interTight, mono } from "./theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const lowerThird: React.CSSProperties = { position: "absolute", left: MARGIN, bottom: 220 };

/* =============================================================================
 * SCENE 5 — Deposit -> Private Pool -> Payment
 * ========================================================================== */
export const S5Flow: React.FC = () => {
  const frame = useCurrentFrame();
  const railY = 980;
  const depX = 720;
  const poolX = 1920;
  const poolR = 230;
  const payX = 3120;

  const ringO = interpolate(frame, [20, 60], [0, 1], { easing: EASE.out, ...clamp });
  const railO = interpolate(frame, [30, 70], [0, 1], { easing: EASE.out, ...clamp });

  // deposit chips: travel depX -> pool boundary, then homogenize (fade + drift in)
  const chips = [0, 1, 2, 3, 4];
  // payment exit
  const exitStart = 200;
  const payX0 = poolX + poolR;
  const payCx = interpolate(frame, [exitStart, exitStart + 70], [payX0, payX - 30], { easing: EASE.inOut, ...clamp });
  const payO = interpolate(frame, [exitStart, exitStart + 16], [0, 1], { easing: EASE.out, ...clamp });
  // trace-back probe: from recipient leftward, halts at pool boundary
  const tbStart = 240;
  const tbCx = interpolate(frame, [tbStart, tbStart + 50], [payX - 30, poolX + poolR + 10], { easing: EASE.out, ...clamp });
  const tbO = interpolate(frame, [tbStart, tbStart + 12, tbStart + 60, tbStart + 80], [0, 0.55, 0.55, 0], { ...clamp });

  return (
    <AbsoluteFill style={{ background: COLORS.ground }}>
      <Grid appear={[0, 30]} maxOpacity={0.06} />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {/* rail */}
        <line x1={depX} y1={railY} x2={payX} y2={railY} stroke={COLORS.grid} strokeWidth={3} opacity={railO} />
        {/* pool fill + ring */}
        <circle cx={poolX} cy={railY} r={poolR} fill={COLORS.surface1} opacity={ringO} />
        <circle cx={poolX} cy={railY} r={poolR} fill="none" stroke={COLORS.strong} strokeWidth={8} opacity={ringO} />

        {/* deposit chips */}
        {chips.map((i) => {
          const t0 = 60 + i * 16;
          const t1 = t0 + 70;
          const cx = interpolate(frame, [t0, t1], [depX + 30, poolX - poolR], { easing: EASE.inOut, ...clamp });
          const driftIn = interpolate(frame, [t1, t1 + 16], [0, poolR * 0.7], { easing: EASE.out, ...clamp });
          const o = interpolate(frame, [t0, t0 + 10, t1, t1 + 16], [0, 1, 1, 0], { ...clamp });
          return <circle key={i} cx={cx + driftIn} cy={railY + (i - 2) * 26} r={14} fill={COLORS.ink} opacity={o} />;
        })}

        {/* deposit + payment station nodes */}
        <Node cx={depX} cy={railY} r={18} start={30} />
        <Node cx={payX} cy={railY} r={18} start={exitStart} />

        {/* payment exit chip */}
        <circle cx={payCx} cy={railY} r={14} fill={COLORS.ink} opacity={payO} />

        {/* trace-back probe (halts at pool) */}
        <circle cx={tbCx} cy={railY} r={12} fill="none" stroke={COLORS.inkSecondary} strokeWidth={4} opacity={tbO} />
      </svg>

      {/* USDC label riding deposit */}
      <div style={{ position: "absolute", left: depX - 70, top: railY - 150, fontFamily: mono, fontSize: TYPE.mono, color: COLORS.inkSecondary, opacity: railO }}>USDC · 402</div>

      {/* station captions */}
      {[["Deposit", depX], ["Private Pool", poolX], ["Payment", payX]].map(([t, x], i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: (x as number) - 200,
            top: railY + poolR + 60,
            width: 400,
            textAlign: "center",
            fontFamily: interTight,
            fontWeight: 600,
            fontSize: 56,
            color: COLORS.ink,
            letterSpacing: "-0.01em",
            opacity: interpolate(frame, [40 + i * 12, 70 + i * 12], [0, 1], { easing: EASE.out, ...clamp }),
          }}
        >
          {t}
        </div>
      ))}

      <div style={lowerThird}>
        <FadeUpText start={110} size={TYPE.hero}>
          Private USDC payments on Solana
        </FadeUpText>
      </div>
    </AbsoluteFill>
  );
};

/* =============================================================================
 * SCENE 6 — Principles (one large word at a time)
 * ========================================================================== */
const PRINCIPLES = ["Privacy-first", "Open source", "Non-custodial", "Developer-friendly"];
export const S6Principles: React.FC = () => {
  const frame = useCurrentFrame();
  const each = 50;
  const ruleO = interpolate(frame, [6, 30], [0, 1], { easing: EASE.out, ...clamp });
  return (
    <AbsoluteFill style={{ background: COLORS.ground, justifyContent: "center", alignItems: "center" }}>
      <Grid appear={[0, 30]} maxOpacity={0.05} />
      {PRINCIPLES.map((p, i) => {
        const s = i * each;
        return (
          <div key={i} style={{ position: "absolute" }}>
            <FadeUpText start={s + 4} exit={[s + 36, s + each]} size={TYPE.principle} tracking={-0.02} style={{ textAlign: "center" }}>
              {p}
            </FadeUpText>
          </div>
        );
      })}
      {/* persistent baseline rule */}
      <div style={{ position: "absolute", bottom: 760, width: 1200, height: 2, background: COLORS.grid, opacity: ruleO }} />
    </AbsoluteFill>
  );
};

/* =============================================================================
 * SCENE 7 — The agent economy (constellation of agents paying endpoints)
 * ========================================================================== */
const buildAgents = () => {
  const rng = makeRng(770);
  const agents = Array.from({ length: 5 }, () => ({
    x: 700 + rng() * 700,
    y: 560 + rng() * 1000,
  }));
  const endpoints = [
    { x: 2900, y: 640, label: "api" },
    { x: 3120, y: 980, label: "inference" },
    { x: 2860, y: 1320, label: "storage" },
    { x: 3060, y: 1620, label: "402" },
  ];
  return { agents, endpoints };
};
const AG = buildAgents();
const poolGlyph = { x: 1960, y: 1060 };

export const S7Agents: React.FC = () => {
  const frame = useCurrentFrame();
  const intro = interpolate(frame, [0, 40], [0, 1], { easing: EASE.out, ...clamp });
  // pulses: each agent fires toward an endpoint, routed through the pool glyph, repeating
  const pulses: React.ReactNode[] = [];
  AG.agents.forEach((a, ai) => {
    const ep = AG.endpoints[ai % AG.endpoints.length];
    const period = 70;
    const delay = ai * 14 + 30;
    for (let k = 0; k < 2; k++) {
      const t = ((frame - delay - k * 35) % period + period) % period;
      const p = interpolate(t, [0, period * 0.5, period], [0, 0.5, 1], { ...clamp });
      // leg 1: agent -> pool, leg 2: pool -> endpoint
      let px: number, py: number;
      if (p < 0.5) {
        const q = p / 0.5;
        px = a.x + (poolGlyph.x - a.x) * q;
        py = a.y + (poolGlyph.y - a.y) * q;
      } else {
        const q = (p - 0.5) / 0.5;
        px = poolGlyph.x + (ep.x - poolGlyph.x) * q;
        py = poolGlyph.y + (ep.y - poolGlyph.y) * q;
      }
      const vis = frame > delay ? intro : 0;
      pulses.push(<circle key={`p${ai}-${k}`} cx={px} cy={py} r={9} fill={COLORS.ink} opacity={vis * 0.9} />);
    }
  });
  return (
    <AbsoluteFill style={{ background: COLORS.ground }}>
      <Grid appear={[0, 30]} maxOpacity={0.05} />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {/* faint routing edges through the pool glyph */}
        {AG.agents.map((a, ai) => {
          const ep = AG.endpoints[ai % AG.endpoints.length];
          return (
            <g key={ai} opacity={intro * 0.5}>
              <line x1={a.x} y1={a.y} x2={poolGlyph.x} y2={poolGlyph.y} stroke={COLORS.grid} strokeWidth={2} />
              <line x1={poolGlyph.x} y1={poolGlyph.y} x2={ep.x} y2={ep.y} stroke={COLORS.grid} strokeWidth={2} />
            </g>
          );
        })}
        {/* central pool glyph */}
        <circle cx={poolGlyph.x} cy={poolGlyph.y} r={70} fill="none" stroke={COLORS.strong} strokeWidth={6} opacity={intro} />
        {/* agents (hollow rings — echoes of the Q) */}
        {AG.agents.map((a, ai) => (
          <Node key={`a${ai}`} cx={a.x} cy={a.y} r={46} hollow start={ai * 6} color={COLORS.strong} />
        ))}
        {/* endpoints */}
        {AG.endpoints.map((e, ei) => (
          <Node key={`e${ei}`} cx={e.x} cy={e.y} r={16} start={20 + ei * 6} color={COLORS.inkSecondary} />
        ))}
        {pulses}
      </svg>
      {AG.endpoints.map((e, ei) => (
        <div key={ei} style={{ position: "absolute", left: e.x + 30, top: e.y - 18, fontFamily: mono, fontSize: TYPE.mono, color: COLORS.inkSecondary, opacity: intro }}>
          {e.label}
        </div>
      ))}
      <div style={lowerThird}>
        <FadeUpText start={40} size={TYPE.hero}>
          Built for the agent economy
        </FadeUpText>
      </div>
    </AbsoluteFill>
  );
};

/* =============================================================================
 * SCENE 8 — Hero close
 * ========================================================================== */
export const S8Close: React.FC = () => {
  const frame = useCurrentFrame();
  const d = 520;
  const cx = W / 2;
  const cy = 820;
  const tagO = interpolate(frame, [80, 110], [0, 1], { easing: EASE.out, ...clamp });
  const tagY = interpolate(frame, [80, 110], [16, 0], { easing: EASE.out, ...clamp });
  const urlO = interpolate(frame, [104, 130], [0, 1], { easing: EASE.out, ...clamp });
  return (
    <AbsoluteFill style={{ background: COLORS.ground, alignItems: "center" }}>
      <Grid appear={[40, 90]} maxOpacity={0.06} />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <QMark cx={cx} cy={cy} d={d} ringStart={6} ringEnd={86} tailStart={86} tailEnd={108} />
      </svg>
      <div style={{ position: "absolute", top: cy + d / 2 + 140, width: W, textAlign: "center", opacity: tagO, transform: `translateY(${tagY}px)` }}>
        <div style={{ fontFamily: interTight, fontWeight: 600, fontSize: TYPE.tagline, letterSpacing: "-0.01em", color: COLORS.ink, lineHeight: 1.1 }}>
          Private payments for the agent economy.
        </div>
        <div style={{ fontFamily: mono, fontSize: 48, color: COLORS.inkSecondary, marginTop: 48, opacity: urlO }}>qietr.com</div>
      </div>
    </AbsoluteFill>
  );
};
