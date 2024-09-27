import { CAConfig, CAService, UserConfig } from "./CAService";
import { ChainService, PeerConfig } from "./ChainService";
import { ConnectedStream, StreamConfig } from "./ConnectedStream";
import { ChainStream } from "./ChainStream";

const defaultCaConfig = {
  orgMsp: "CuratorOrg",
  url: "https://localhost:7040",
  name: "ca.curator.local"
};

const defaultUserConfig = {
  userId: "admin",
  userSecret: "adminpw"
};

const defaultPeerConfig = {
  url: "grpcs://localhost:7041",
  tlsCACertPath: "../galachain-operation-api/test-chaincode/test-network/fablo-target/fabric-config/crypto-config/peerOrganizations/curator.local/msp/tlscacerts/tlsca.curator.local-cert.pem",
  grpcHostnameOverride: "peer0.curator.local"
};

const defaultStreamConfig = {
  chainInfoPollingIntervalMs: 2000,
  sleepIntervalMs: 500,
  batchSize: 10
}

export interface ConnectionParams {
  ca?: Partial<CAConfig>,
  user?: Partial<UserConfig>,
  peer?: Partial<PeerConfig>,
  stream?: Partial<StreamConfig>
}

export class StreamBuilder {
  private readonly ca: CAConfig;
  private readonly user: UserConfig;
  private readonly peer: PeerConfig;
  private readonly streamConfig: StreamConfig;

  constructor(params: ConnectionParams) {
    this.ca = {
      url: params.ca?.url ?? defaultCaConfig.url,
      name: params.ca?.name ?? defaultCaConfig.name,
      orgMsp: params.ca?.orgMsp ?? defaultCaConfig.orgMsp,
      tlsCert: params.ca?.tlsCert,
      tlsCertPath: params.ca?.tlsCertPath
    };
    this.user = {
      userId: params.user?.userId ?? defaultUserConfig.userId,
      userSecret: params.user?.userSecret ?? defaultUserConfig.userSecret
    };
    this.peer = {
      url: params.peer?.url ?? defaultPeerConfig.url,
      tlsCACertPath: params.peer?.tlsCACertPath ?? defaultPeerConfig.tlsCACertPath,
      grpcHostnameOverride: params.peer?.grpcHostnameOverride ?? defaultPeerConfig.grpcHostnameOverride
    };
    this.streamConfig = {
      chainInfoPollingIntervalMs: params.stream?.chainInfoPollingIntervalMs ?? defaultStreamConfig.chainInfoPollingIntervalMs,
      sleepIntervalMs: params.stream?.sleepIntervalMs ?? defaultStreamConfig.sleepIntervalMs,
      batchSize: params.stream?.batchSize ?? defaultStreamConfig.batchSize
    };
  }

  public build(channelName: string): ConnectedStream {
    const caService = new CAService(this.ca, this.user);
    const chainService = new ChainService(this.peer, channelName);
    const chainStream = new ChainStream(caService, chainService);
    return new ConnectedStream(chainStream, this.streamConfig);
  }

}