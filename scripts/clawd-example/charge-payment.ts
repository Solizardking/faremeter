import "dotenv/config";
import { logResponse } from "../logger";
import { createLocalWallet } from "@faremeter/wallet-solana";
import { createMPPSolanaNativeChargeClient } from "@faremeter/payment-solana/charge";
import { wrap as wrapFetch } from "@faremeter/fetch";
import fs from "fs";

const { PAYER_KEYPAIR_PATH } = process.env;

if (!PAYER_KEYPAIR_PATH) {
  throw new Error("PAYER_KEYPAIR_PATH must be set in your environment");
}

const RPC_URL = process.env.CLAWD_RPC_URL ?? "https://rpc.clawdchain.trade";
const RESOURCE_URL =
  process.env.RESOURCE_URL ?? "http://127.0.0.1:4021/resource";

const secretKey = Uint8Array.from(
  JSON.parse(fs.readFileSync(PAYER_KEYPAIR_PATH, "utf-8")),
);

const wallet = await createLocalWallet("clawd", secretKey);

const fetchWithPayer = wrapFetch(fetch, {
  handlers: [],
  mppHandlers: [createMPPSolanaNativeChargeClient({ wallet, rpc: RPC_URL })],
});

const req = await fetchWithPayer(RESOURCE_URL);
await logResponse(req);
