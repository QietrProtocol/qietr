import { Connection, PublicKey } from "@solana/web3.js";

const RPC = process.env.RPC ?? "https://api.devnet.solana.com";
const PROGRAM = new PublicKey("4XH6f74UFTvqx4j9UarXGrRZRrAwbnNNsRFBTfNqmWib");
const conn = new Connection(RPC, "confirmed");

function pda(seeds) {
  return PublicKey.findProgramAddressSync(seeds, PROGRAM)[0];
}

const enc = new TextEncoder();

// 1) Program upgrade authority (read program acct -> programdata -> authority)
const progAcct = await conn.getAccountInfo(PROGRAM);
let authority = "unknown";
let programDataAddr = null;
if (progAcct && progAcct.data.length >= 36) {
  programDataAddr = new PublicKey(progAcct.data.subarray(4, 36));
  const pd = await conn.getAccountInfo(programDataAddr);
  if (pd && pd.data.length >= 45) {
    const hasAuth = pd.data[12] === 1;
    authority = hasAuth ? new PublicKey(pd.data.subarray(13, 45)).toBase58() : "none (immutable)";
  }
}

// 2) PoolConfig PDA
const configPda = pda([enc.encode("config")]);
const cfg = await conn.getAccountInfo(configPda);

// 3) Denomination PDAs 0..3
const denoms = [];
for (let id = 0; id <= 3; id++) {
  const dPda = pda([enc.encode("denom"), Uint8Array.of(id)]);
  const acct = await conn.getAccountInfo(dPda);
  denoms.push({ id, pda: dPda.toBase58(), exists: !!acct, len: acct?.data.length ?? 0 });
}

console.log(JSON.stringify({
  rpc: RPC,
  program: PROGRAM.toBase58(),
  programDataAddr: programDataAddr?.toBase58() ?? null,
  upgradeAuthority: authority,
  configPda: configPda.toBase58(),
  poolInitialized: !!cfg,
  configLen: cfg?.data.length ?? 0,
  denoms,
}, null, 2));
