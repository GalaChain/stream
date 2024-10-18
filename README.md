# GalaChain Block Stream

A Node.js library to stream blocks from GalaChain or Hyperledger Fabric network as RxJS Observables.

Sample usage:

```typescript
import stream from "@gala-chain/stream";

stream
  .connect(config)
  .channel("product-channel")
  .fromBlock(9)
  .subscribe({
    next: (block) => {
      console.log("Block:", block.blockNumber);
    },
    error: (err) => {
      console.error("Error:", err);
    },
    complete: () => {
      console.log("Stream completed");
    }
  });
```

The sample code above connects to the network, subscribes to the `product-channel` channel, and starts streaming blocks from block number 9.
It will get all transactions in the block, even invalid ones (e.g. those that failed with MVCC error).
To get only valid transactions, you need to filter them out manually by transaction validation code.

Using that sample is also hard and non-performant to filter given transactions (e.g. by chaincode name).
This is why we support also a way to get only transactions that are valid and match given criteria:

```typescript
import stream from "@gala-chain/stream";

stream
  .connect(config)
  .channel("product-channel")
  .transactions(({ methodName }) => methodName === "GalaChainToken:TransferToken")
  .fromBlock(3)
  .subscribe({
    next: (tx) => {
      console.log("Transaction:", tx.transactionId, "from block:", tx.blockNumber);
    },
    error: (err) => {
      console.error("Error:", err);
    },
    complete: () => {
      console.log("Stream completed");
    }
  });
```

The `config` object should contain all the configuration needed to connect to the network.
It can also be skipped to get default configuration, which is:

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
    intervalMs: 1000,
    batchSize: 10,
    retryOnErrorDelayMs: 5000,
    maxRetryCount: 5
  }
};
```

See also the usage sample at `./src/sample.ts`.

## The end-to-end sample

This section describes how to create a GalaChain local network, fill it with some data and then stream blocks from it.

**Step 1**: Install the GalaChain CLI
```bash
npm install -g @gala-chain/cli
```

**Step 2**: Create a sample chaincode in the current directory
```bash
galachain init test-chaincode
```

**Step 3**: Start the network for test chaincode
```bash
npm run network:up --prefix test-chaincode
```

**Step 4**: Run the e2e tests for the chaincode to populate the network with some data
```bash
npm run test:e2e --prefix test-chaincode
```

**Step 5**: Stream blocks from the network
```bash
npx ts-node src/sample.ts
```

Once you're done, you can stop the network by running:
```bash
npm run network:prune --prefix test-chaincode
```
