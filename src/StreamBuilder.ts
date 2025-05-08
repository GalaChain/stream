/*
 * Copyright (c) Gala Games Inc. All rights reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { CAConfig, CAService, UserConfig } from "./CAService";
import { ChainService, PeerConfig } from "./ChainService";
import { ChainStream, LoggerInterface } from "./ChainStream";
import { ConnectedStream, StreamConfig } from "./ConnectedStream";

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
  tlsCACertPath:
    "./test-chaincode/test-network/fablo-target/fabric-config/crypto-config/peerOrganizations/curator.local/msp/tlscacerts/tlsca.curator.local-cert.pem",
  grpcHostnameOverride: "peer0.curator.local"
};

const defaultStreamConfig = {
  gracePeriodMs: 1000,
  batchSize: 10,
  retryOnErrorDelayMs: 5000,
  maxRetryCount: 5
};

const defaultLogger: LoggerInterface = {
  log(message: string) {
    console.log(`[ChainStream] ${new Date().toISOString()}: ${message}`);
  },
  warn(message: string) {
    console.warn(`[ChainStream] ${new Date().toISOString()}: ${message}`);
  },
  error(message: string, e: Error) {
    console.error(`[ChainStream] ${new Date().toISOString()}: ${message}`, e);
  }
};

export interface ConnectionParams {
  ca?: Partial<CAConfig>;
  user?: Partial<UserConfig>;
  peer?: Partial<PeerConfig>;
  stream?: Partial<StreamConfig>;
  logger?: LoggerInterface;
}

export class StreamBuilder {
  private readonly ca: CAConfig;
  private readonly user: UserConfig;
  private readonly peer: PeerConfig;
  private readonly streamConfig: StreamConfig;
  private readonly logger: LoggerInterface;

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
      gracePeriodMs: params.stream?.gracePeriodMs ?? defaultStreamConfig.gracePeriodMs,
      batchSize: params.stream?.batchSize ?? defaultStreamConfig.batchSize,
      retryOnErrorDelayMs: params.stream?.retryOnErrorDelayMs ?? defaultStreamConfig.retryOnErrorDelayMs,
      maxRetryCount: params.stream?.maxRetryCount ?? defaultStreamConfig.maxRetryCount
    };
    this.logger = params.logger ?? defaultLogger;
  }

  public build(channelName: string): ConnectedStream {
    const caService = new CAService(this.ca, this.user);
    const chainService = new ChainService(this.peer, channelName, this.logger);
    const chainStream = new ChainStream(caService, chainService, this.logger);
    return new ConnectedStream(chainStream, this.streamConfig);
  }
}
