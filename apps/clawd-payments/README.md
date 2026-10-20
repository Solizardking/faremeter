# Clawd Chain payments service

A payment-gated resource service for Clawd Chain, the standalone SVM
chain in the clawd ecosystem (network id `clawd`, CAIP-2
`solana:7nu7q65M7dhJu9j6Zo1XkL4VRfMdg854`).

It serves one MPP `charge` intent on the solana method, settled in the
chain's native coin (test CLAWD, 9 decimals, no monetary value) via
`createMPPSolanaNativeChargeHandler` from
`@faremeter/payment-solana/charge`. The MPP handler runs in-process in
this resource service; there is no separate facilitator process for
MPP. An optional fee payer keypair sponsors transaction fees.

Endpoints:

- `GET /health` — plain `ok`.
- `GET /supported` — JSON describing the network, method, intent,
  fee payer, and pay-to address.
- `GET /resource` — a demo resource behind the MPP charge middleware.

Configuration (environment):

| Variable             | Default                        | Meaning                                                                     |
| -------------------- | ------------------------------ | --------------------------------------------------------------------------- |
| `PORT`               | `4021`                         | Listen port.                                                                |
| `CLAWD_RPC_URL`      | `https://rpc.clawdchain.trade` | Clawd Chain RPC endpoint.                                                   |
| `PAYTO_ADDRESS`      | (required)                     | Recipient address for charges.                                              |
| `ADMIN_KEYPAIR_PATH` | (unset)                        | Solana keypair JSON for the fee payer. Omit to disable fee sponsorship.     |
| `MPP_SECRET_KEY`     | random per boot                | Challenge-signing secret, 32 bytes hex.                                     |
| `MPP_REALM`          | `clawd-payments`               | MPP realm string.                                                           |
| `RESOURCE_PRICE`     | `1000000`                      | Price of `/resource` in the native coin's smallest unit (0.001 test CLAWD). |

Run it:

```bash
pnpm install -r
PAYTO_ADDRESS=<clawd-chain-address> pnpm tsx src/index.ts
```

Note on vocabulary: the MPP solana method labels the native asset
`sol` / currency `sol` at the protocol level. On Clawd Chain that
native asset is test CLAWD.
