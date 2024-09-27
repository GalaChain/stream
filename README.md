# GalaChain Stream

A library which streams blocks from GalaChain or Hyperledger Fabric network.

Sample usage:

```typescript
import stream from "@gala-chain/stream";

stream
  .connect(config)
  .channel("product-channel")
  .fromBlock(0)
```

This call returns RxJS Observable with Hyperledger Fabric blocks.

Sample config object (filled with defaults):

```typescript
const config = {
  ca: {
    url: "https://localhost:7040",
    name: "ca.curator.local",
    orgMsp: "CuratorOrg"
  },
  user: {
    userId: "admin",
    userSecret: "adminpw"
  },
  peer: {
    url: "grpcs://localhost:7041",
    tlsCACertPath: "./test-chaincode/test-network/fablo-target/fabric-config/crypto-config/peerOrganizations/curator.local/msp/tlscacerts/tlsca.curator.local-cert.pem",
    grpcHostnameOverride: "peer0.curator.local"
  },
  stream: {
    chainInfoPollingIntervalMs: 2000,
    sleepIntervalMs: 500,
    batchSize: 10
  }
};
```

The above config file is compatible with default network that comes from running local GalaChain network.
You can get it running by calling:

```bash
npm i -g @gala-chain/cli
galachain init test-chaincode
npm run network:up --prefix ./test-chaincode
```
