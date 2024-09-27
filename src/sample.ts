import stream from "./stream";


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

stream
  .connect(config)
  .channel("product-channel")
  .fromBlock(0)
  .subscribe({
    next: (block) => {
      console.log("Block:", block);
    },
    error: (err) => {
      console.error("Error:", err);
    },
    complete: () => {
      console.log("Stream completed");
    }
  });
