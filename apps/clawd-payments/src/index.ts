import "dotenv/config";
import { logger } from "./logger";
import { Hono } from "hono";
import { logger as honoLogger } from "hono/logger";
import { serve } from "@hono/node-server";
import { createMiddleware } from "@faremeter/middleware/hono";
import {
  createMPPSolanaNativeChargeHandler,
  createInMemoryReplayStore,
} from "@faremeter/payment-solana/charge";
import { lookupX402Network } from "@faremeter/info/solana";
import { configureApp } from "@faremeter/logs";
import {
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  type KeyPairSigner,
} from "@solana/kit";
import crypto from "crypto";
import fs from "fs";

await configureApp();

// Clawd Chain is a standalone SVM chain. Its native coin is test CLAWD
// (9 decimals, no monetary value). The MPP solana method labels the
// native asset "sol" at the protocol level; on this network that asset
// is the chain's native coin.
const NETWORK = "clawd";
const solanaNetwork = lookupX402Network(NETWORK);

const rpcUrl = process.env.CLAWD_RPC_URL ?? "https://rpc.clawdchain.trade";
const rpc = createSolanaRpc(rpcUrl);

const payTo = process.env.PAYTO_ADDRESS;
if (!payTo) {
  logger.error("ERROR: PAYTO_ADDRESS must be set");
  process.exit(1);
}

// Price of the demo resource, in the native coin's smallest unit
// (9 decimals): the default 1000000 is 0.001 test CLAWD.
const resourcePrice = process.env.RESOURCE_PRICE ?? "1000000";

const realm = process.env.MPP_REALM ?? "clawd-payments";

// Challenge-signing secret. Challenges and the replay store are
// in-memory, so a random per-boot secret is acceptable for a demo
// service; set MPP_SECRET_KEY (hex, 32 bytes) to persist it.
let secretKey: Uint8Array;
if (process.env.MPP_SECRET_KEY) {
  secretKey = Uint8Array.from(Buffer.from(process.env.MPP_SECRET_KEY, "hex"));
  if (secretKey.length !== 32) {
    logger.error("ERROR: MPP_SECRET_KEY must be 32 bytes, hex encoded");
    process.exit(1);
  }
} else {
  secretKey = crypto.randomBytes(32);
  logger.warning(
    "MPP_SECRET_KEY not set; using a random per-boot challenge secret",
  );
}

// Optional fee payer: when configured, the facilitator side of the
// charge handler sponsors transaction fees on Clawd Chain.
let feePayerSigner: KeyPairSigner | undefined;
if (process.env.ADMIN_KEYPAIR_PATH) {
  feePayerSigner = await createKeyPairSignerFromBytes(
    Uint8Array.from(
      JSON.parse(fs.readFileSync(process.env.ADMIN_KEYPAIR_PATH, "utf-8")),
    ),
  );
}

const nativeChargeHandler = await createMPPSolanaNativeChargeHandler({
  network: NETWORK,
  rpc,
  ...(feePayerSigner ? { feePayerSigner } : {}),
  replayStore: createInMemoryReplayStore(),
  realm,
  secretKey,
});

const app = new Hono();
app.use(
  honoLogger((message: string, ...rest: string[]) => {
    logger.info([message, ...rest].join(" "));
  }),
);

app.get("/health", (c) => c.text("ok"));

app.get("/supported", (c) =>
  c.json({
    network: NETWORK,
    caip2: solanaNetwork.caip2,
    rpc: rpcUrl,
    methods: [
      {
        method: "solana",
        intents: ["charge"],
        asset: "native",
        currency: "sol",
      },
    ],
    feePayer: feePayerSigner ? feePayerSigner.address : null,
    payTo,
  }),
);

app.get(
  "/resource",
  await createMiddleware({
    mppMethodHandlers: [nativeChargeHandler],
    pricing: [
      {
        amount: resourcePrice,
        asset: "sol",
        recipient: payTo,
        network: solanaNetwork.caip2,
      },
    ],
  }),
  (c) => {
    return c.json({ msg: "success", network: NETWORK });
  },
);

const listenPort = process.env.PORT ? parseInt(process.env.PORT) : 4021;

serve({ fetch: app.fetch, port: listenPort }, (info) => {
  logger.info(`Clawd payments server listening on port ${info.port}`);
  logger.info(`   - Network: ${NETWORK} (${solanaNetwork.caip2})`);
  logger.info(`   - RPC: ${rpcUrl}`);
  logger.info(`   - MPP charge (native) -> ${payTo}`);
  if (feePayerSigner) {
    logger.info(`   - Fee payer: ${feePayerSigner.address}`);
  }
});
