/* =============================================================================
 * Launch.tsx — master timeline (full film, 1740 frames @ 30fps = 58s).
 *
 *   S1 Trail     0    240   "Every payment leaves a trail."
 *   S2 Graph     240  240   "Payments reveal more than they should."
 *   S3 Question  480  210   "What if payments only revealed what was necessary?"
 *   S4 Arrival   690  180   Q mark + "Introducing Qietr"
 *   S5 Flow      870  300   "Private USDC payments on Solana"
 *   S6 Princ.    1170 210   Privacy-first / Open source / Non-custodial / Dev-friendly
 *   S7 Agents    1380 180   "Built for the agent economy"
 *   S8 Close     1560 180   tagline + qietr.com
 *
 * Audio drops in here once a track exists:
 *   <Audio src={staticFile("audio/launch.mp3")} />  (from "@remotion/media")
 * ============================================================================= */

import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile } from "remotion";
import { COLORS } from "./theme";
import { S1Trail, S2Graph, S3Question, S4Arrival } from "./scenes";
import { S5Flow, S6Principles, S7Agents, S8Close } from "./scenes2";

/* Volume envelope: fade in -> duck to near-silence over Scene 3 (the held
 * pause, frames 480-690) -> back up -> fade out at the end.
 * The Scene-3 silence is the film's strongest beat; let the music recede. */
const volumeAt = (f: number) =>
  interpolate(
    f,
    [0, 30, 470, 510, 660, 700, 1680, 1740],
    [0, 1, 1, 0.1, 0.1, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

export const Launch: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.ground }}>
      <Audio src={staticFile("launch.mp3")} volume={volumeAt} />
      <Sequence durationInFrames={240}>
        <S1Trail />
      </Sequence>
      <Sequence from={240} durationInFrames={240}>
        <S2Graph />
      </Sequence>
      <Sequence from={480} durationInFrames={210}>
        <S3Question />
      </Sequence>
      <Sequence from={690} durationInFrames={180}>
        <S4Arrival />
      </Sequence>
      <Sequence from={870} durationInFrames={300}>
        <S5Flow />
      </Sequence>
      <Sequence from={1170} durationInFrames={210}>
        <S6Principles />
      </Sequence>
      <Sequence from={1380} durationInFrames={180}>
        <S7Agents />
      </Sequence>
      <Sequence from={1560} durationInFrames={180}>
        <S8Close />
      </Sequence>
    </AbsoluteFill>
  );
};
