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

import * as grpc from "@grpc/grpc-js";
import { Gateway, GrpcClient, Identity, Network, connect, signers } from "@hyperledger/fabric-gateway";
import * as crypto from "crypto";
// @ts-expect-error: unhandled type in fabric-common
import { BlockDecoder } from "fabric-common";
import { common as fabricProtos } from "fabric-protos";
import fs from "fs";

import { IIdentity } from "./CAService";
import { LoggerInterface } from "./ChainStream";
import { parseBlock } from "./parseBlock";
import { Block, ChainInfo, Transaction, TransactionValidationCode } from "./types";

export interface PeerConfig {
  url: string;
  tlsCACertPath: string;
  grpcHostnameOverride: string;
}

// we don't know the validation code when the filter is applied
export type TransactionFilter = (transaction: Omit<Transaction, "validationCode">) => boolean;

export class ChainService {
  private client: GrpcClient | undefined;
  private gateway: Gateway | undefined;
  private network: Network | undefined;
  private identity: IIdentity | undefined;

  constructor(
    private readonly peer: PeerConfig,
    public readonly channelName: string,
    private readonly logger: LoggerInterface
  ) {}

  public connect(identity: IIdentity): void {
    this.logger.log(`Connecting to channel ${this.channelName}`);

    if (this.client) {
      throw new Error("Client already connected");
    }

    if (this.gateway) {
      throw new Error("Gateway already connected");
    }

    this.identity = identity;

    const peerEndpoint = this.peer.url.replace("grpcs://", "");
    const tlsCACert = fs.readFileSync(this.peer.tlsCACertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsCACert);

    this.client = new grpc.Client(peerEndpoint, tlsCredentials, {
      "grpc.ssl_target_name_override": this.peer.grpcHostnameOverride
    });

    const gatewayIdentity: Identity = {
      mspId: identity.mspId,
      credentials: Buffer.from(identity.credentials.certificate)
    };

    const gatewaySigner = signers.newPrivateKeySigner(
      crypto.createPrivateKey(identity.credentials.privateKey)
    );

    this.gateway = connect({
      client: this.client,
      identity: gatewayIdentity,
      signer: gatewaySigner,
      // Default timeouts for different gRPC calls
      evaluateOptions: () => {
        return { deadline: Date.now() + 5000 }; // 5 seconds
      },
      endorseOptions: () => {
        return { deadline: Date.now() + 15000 }; // 15 seconds
      },
      submitOptions: () => {
        return { deadline: Date.now() + 5000 }; // 5 seconds
      },
      commitStatusOptions: () => {
        return { deadline: Date.now() + 60000 }; // 1 minute
      }
    });

    this.network = this.gateway.getNetwork(this.channelName);
  }

  public disconnect(): void {
    this.logger.log(`Disconnecting from channel ${this.channelName}`);

    this.network = undefined;

    if (this.gateway) {
      try {
        this.gateway.close();
        this.gateway = undefined;
      } catch (e) {
        console.error(e);
      }
    }
    if (this.client) {
      try {
        this.client.close();
        this.client = undefined;
      } catch (e) {
        console.error(e);
      }
    }
  }

  public isConnected(): boolean {
    return !!this.network;
  }

  public reconnectIfNeeded(): void {
    this.logger.log(`Reconnecting to channel ${this.channelName}`);

    const currentState = this.client?.getChannel()?.getConnectivityState(false);
    if (currentState !== grpc.connectivityState.READY) {
      this.disconnect();
      if (this.identity) {
        this.connect(this.identity);
      } else {
        const err = new Error(`Identity not set for reconnect to channel ${this.channelName}`);
        this.logger.error(err.message, err);
        throw err;
      }
    }
  }

  public async queryChainInfo(): Promise<ChainInfo> {
    if (!this.network) {
      throw new Error(`Network ${this.channelName} not connected`);
    }

    const querySystemCC = this.network.getContract("qscc");
    const blockBuffer = await querySystemCC.evaluateTransaction("GetChainInfo", this.channelName);

    const info = fabricProtos.BlockchainInfo.decode(blockBuffer);

    return {
      channelName: this.channelName,
      height: +info.height.toString()
    };
  }

  public async queryBlocks(blockNumbers: number[], transactionFilter: TransactionFilter): Promise<Block[]> {
    if (!this.network) {
      throw new Error(`Network ${this.channelName} not connected`);
    }

    const blocks = await Promise.all(
      blockNumbers.map((blockNumber) => this.queryBlock(blockNumber, this.network!, transactionFilter))
    );

    return blocks;
  }

  private async queryBlock(
    blockNumber: number,
    network: Network,
    transactionFilter: TransactionFilter
  ): Promise<Block> {
    const querySystemCC = network.getContract("qscc");
    const blockBuffer = await querySystemCC.evaluateTransaction(
      "GetBlockByNumber",
      this.channelName,
      blockNumber.toString()
    );

    const convertedBlockBuffer = blockBuffer instanceof Uint8Array ? Buffer.from(blockBuffer) : blockBuffer;
    const block = parseBlock(BlockDecoder.decode(convertedBlockBuffer));

    // apply filter
    block.transactions = block.transactions.filter(transactionFilter);

    // query transaction codes
    const codes = await this.queryTransactionCodes(
      network,
      block.transactions.map((tx) => tx.id)
    );

    block.transactions.forEach((t) => {
      t.validationCode = codes[t.id] ?? TransactionValidationCode.UNKNOWN;
    });

    return block;
  }

  private async queryTransactionCodes(network: Network, txIds: string[]) {
    const kvs: [string, number][] = await Promise.all(
      txIds.map(async (txId) => [txId, await this.queryTransactionCode(network, txId)] as [string, number])
    );
    return kvs.reduce((all, [k, v]) => ({ ...all, [k]: v }), {} as Record<string, TransactionValidationCode>);
  }

  // `GetTransactionByID` returns transaction validation code, and `GetBlockByNumber` doesn't
  // see: https://github.com/hyperledger/fabric/blob/main/core/ledger/kvledger/kv_ledger.go
  private async queryTransactionCode(network: Network, txId: string): Promise<number> {
    const querySystemCC = network.getContract("qscc");
    const txBuffer = await querySystemCC.evaluateTransaction("GetTransactionByID", this.channelName, txId);
    const convertedTxBuffer = txBuffer instanceof Uint8Array ? Buffer.from(txBuffer) : txBuffer;
    const tx = BlockDecoder.decodeTransaction(convertedTxBuffer);
    return tx.validationCode;
  }
}
