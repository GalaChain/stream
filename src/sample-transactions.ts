import stream from "./index";

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
    tlsCACertPath:
      "./test-chaincode/test-network/fablo-target/fabric-config/crypto-config/peerOrganizations/curator.local/msp/tlscacerts/tlsca.curator.local-cert.pem",
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

stream
  .connect(config)
  .channel("product-channel")
  .transactions(({ method }) => method === "GalaChainToken:TransferToken")
  .fromBlock(3)
  .subscribe({
    next: (tx) => {
      console.log("Transaction:", tx.id, "from block:", tx.blockNumber);
    },
    error: (err) => {
      console.error("Error:", err);
    },
    complete: () => {
      console.log("Stream completed");
    }
  });
