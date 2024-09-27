import { CAService } from "./CAService";
import { ChainService } from "./ChainService";
import { ChainStream } from "./ChainStream";

const caService = new CAService({
  url: "https://localhost:7040",
  name: "ca.curator.local",
  orgMsp: "CuratorOrg"
}, {
  userId: "admin",
  userSecret: "adminpw"
});

const chainService = new ChainService({
  url: "grpcs://localhost:7041",
  tlsCACertPath: "./test-chaincode/test-network/fablo-target/fabric-config/crypto-config/peerOrganizations/curator.local/msp/tlscacerts/tlsca.curator.local-cert.pem",
  grpcHostnameOverride: "peer0.curator.local"
}, "product-channel");

const stream = new ChainStream(caService, chainService);

stream.startPollingChainHeight(1000);

// Start the block stream from block 1
stream.fromBlock(0, 5, 1000)
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
