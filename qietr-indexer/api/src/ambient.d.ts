// Ambient declarations for untyped vendored libraries.
declare module "circomlibjs" {
  export function buildPoseidon(): Promise<{
    F: { toObject: (x: unknown) => bigint; p: bigint };
    (xs: ReadonlyArray<bigint | string | number>): unknown;
  }>;
}
