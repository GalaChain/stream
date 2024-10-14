import * as grpc from "@grpc/grpc-js";
import { Gateway, GrpcClient, Identity, Network, connect, signers } from "@hyperledger/fabric-gateway";
import * as crypto from "crypto";
// @ts-expect-error: unhandled type in fabric-common
import { BlockDecoder } from "fabric-common";
import { common as fabricProtos } from "fabric-protos";
import fs from "fs";

import { IIdentity } from "./CAService";
import { parseBlock } from "./parseBlock";
import { Block, ChainInfo, TransactionValidationCode } from "./types";

export interface PeerConfig {
  url: string;
  tlsCACertPath: string;
  grpcHostnameOverride: string;
}

export class ChainService {
  private client: GrpcClient | undefined;
  private gateway: Gateway | undefined;
  private network: Network | undefined;

  constructor(
    private readonly peer: PeerConfig,
    public readonly channelName: string
  ) {}

  public connect(identity: IIdentity): void {
    if (this.client) {
      throw new Error("Client already connected");
    }

    if (this.gateway) {
      throw new Error("Gateway already connected");
    }

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

  public async queryBlocks(blockNumbers: number[]): Promise<Block[]> {
    if (!this.network) {
      throw new Error(`Network ${this.channelName} not connected`);
    }

    const blocks = await Promise.all(
      blockNumbers.map((blockNumber) => this.queryBlock(blockNumber, this.network!))
    );

    return blocks;
  }

  private async queryBlock(blockNumber: number, network: Network): Promise<Block> {
    const querySystemCC = network.getContract("qscc");
    const blockBuffer = await querySystemCC.evaluateTransaction(
      "GetBlockByNumber",
      this.channelName,
      blockNumber.toString()
    );

    const convertedBlockBuffer = blockBuffer instanceof Uint8Array ? Buffer.from(blockBuffer) : blockBuffer;
    const block = parseBlock(BlockDecoder.decode(convertedBlockBuffer));

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
