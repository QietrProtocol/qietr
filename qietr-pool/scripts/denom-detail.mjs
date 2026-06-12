import { Connection, PublicKey } from "@solana/web3.js";

const RPC = process.env.RPC ?? "https://api.devnet.solana.com";
const PROGRAM = new PublicKey("4XH6f74UFTvqx4j9UarXGrRZRrAwbnNNsRFBTfNqmWib");
const conn = new Connection(RPC, "confirmed");
const enc = new TextEncoder();
const pda = (s) => PublicKey.findProgramAddressSync(s, PROGRAM)[0];

function parseDenom(data) {
  const b = Buffer.from(data);
  let o = 8;
  const denomId = b.readUInt8(o); o += 1;
  const amount = b.readBigUInt64LE(o); o += 8;
  const depositCount = b.readBigUInt64LE(o); o += 8;
  const vault = new PublicKey(b.subarray(o, o + 32)); o += 32;
  const mint = new PublicKey(b.subarray(o, o + 32)); o += 32;
  const vaultBump = b.readUInt8(o); o += 1;
  const bump = b.readUInt8(o);
  return { denomId, amount: amount.toString(), depositCount: depositCount.toString(),
    vault: vault.toBase58(), mint: mint.toBase58(), vaultBump, bump };
}

function parseTree(data) {
  const b = Buffer.from(data);
  // disc(8) + denom_id(1) + next_leaf_index(8)
  const denomId = b.readUInt8(8);
  const nextLeaf = b.readBigUInt64LE(9);
  return { denomId, nextLeafIndex: nextLeaf.toString() };
}

const out = [];
for (let id = 0; id <= 3; id++) {
  const d = await conn.getAccountInfo(pda([enc.encode("denom"), Uint8Array.of(id)]));
  const t = await conn.getAccountInfo(pda([enc.encode("tree"), Uint8Array.of(id)]));
  const denom = d ? parseDenom(d.data) : null;
  const tree = t ? parseTree(t.data) : null;
  let mintAuthority = null, mintSupply = null;
  if (denom) {
    const m = await conn.getAccountInfo(new PublicKey(denom.mint));
    if (m && m.data.length >= 82) {
      const mb = Buffer.from(m.data);
      const hasAuth = mb.readUInt32LE(0) === 1;
      mintAuthority = hasAuth ? new PublicKey(mb.subarray(4, 36)).toBase58() : "none";
      mintSupply = mb.readBigUInt64LE(36).toString();
    }
  }
  out.push({ denom, tree, mintAuthority, mintSupply });
}
console.log(JSON.stringify(out, null, 2));
