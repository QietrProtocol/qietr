// Ambient declarations for untyped vendored libraries.
declare module "circomlibjs" {
  export function buildPoseidon(): Promise<{
    F: { toObject: (x: unknown) => bigint; p: bigint };
    (xs: ReadonlyArray<bigint | string | number>): unknown;
  }>;
}

declare module "snarkjs" {
  export namespace groth16 {
    export function fullProve(
      input: Record<string, unknown>,
      wasm: string | Uint8Array,
      zkey: string | Uint8Array,
    ): Promise<{
      proof: {
        pi_a: string[];
        pi_b: string[][];
        pi_c: string[];
        protocol: string;
        curve: string;
      };
      publicSignals: string[];
    }>;
    export function verify(
      vk: Record<string, unknown>,
      publicSignals: string[],
      proof: Record<string, unknown>,
    ): Promise<boolean>;
  }
}
