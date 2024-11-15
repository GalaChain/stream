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

import { IIdentity } from "./CAService";
import { ChainService, TransactionFilter } from "./ChainService";
import { LoggerInterface } from "./ChainStream";
import { ConnectedStream } from "./ConnectedStream";
import { StreamedTransaction } from "./ConnectedTransactionStream";
import stream from "./stream";
import { Block, ChainInfo } from "./types";

jest.setTimeout(60 * 1000);

let connectedStream: ConnectedStream;
let logger: LoggerInterface;
let warnMessages: string[];

beforeAll(() => {
  warnMessages = [];
  logger = {
    log: (message: string) => process.stdout.write(`${new Date().toISOString()}: ${message}\n`),
    warn: (message: string) => {
      process.stdout.write(`${new Date().toISOString()}: ${message}\n`);
      warnMessages.push(message);
    },
    error: (message: string, e: Error) => {
      process.stderr.write(`${new Date().toISOString()}: ${message} ${e.message}\n`);
      process.stderr.write(e.stack ?? "");
    }
  };

  connectedStream = stream
    .connect({
      // lower values for faster tests
      stream: {
        chainInfoPollingIntervalMs: 100,
        intervalMs: 100,
        batchSize: 3,
        retryOnErrorDelayMs: 500,
        maxRetryCount: 10
      },
      logger
    })
    .channel("product-channel");
  addEntropy(connectedStream, logger);
});

afterAll(() => {
  logger.log("disconnecting...");
  connectedStream.disconnect();
});

it("should stream blocks", async () => {
  // Given
  const fetchedBlocks: Block[] = [];

  // When
  const subscription = connectedStream.fromBlock(25).subscribe({
    next: (block) => {
      logger.log(`Got block ${block.blockNumber} [${block.transactions.map((t) => t.method).join(", ")}]`);
      fetchedBlocks.push(block);
    },
    error: (err) => logger.error("Error:", err),
    complete: () => logger.log("Stream completed")
  });

  await new Promise((resolve) => setTimeout(resolve, 15 * 1000));
  subscription.unsubscribe();

  // Then - blocks were fetched with the correct order
  const numbers = fetchedBlocks.slice(0, 12).map((b) => b.blockNumber);
  expect(numbers).toEqual([25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36]);

  // Then - and there were errors
  expect(warnMessages).toContainEqual(expect.stringContaining("Error polling chain info"));
  expect(warnMessages).toContainEqual(expect.stringContaining("Error fetching blocks"));
  expect(warnMessages).toContainEqual(expect.stringContaining("Channel has been shut down"));
});

it("should stream transactions", async () => {
  // Given
  const fetchedTransactions: StreamedTransaction[] = [];

  const methodWanted = "GalaChainToken:TransferToken";

  // When
  connectedStream
    .transactions((t) => t.method === methodWanted)
    .fromBlock(0)
    .subscribe({
      next: (transaction) => {
        console.log("Transaction:", transaction.id);
        fetchedTransactions.push(transaction);
      },
      error: (err) => console.error("Error:", err),
      complete: () => console.log("Stream completed")
    });

  await new Promise((resolve) => setTimeout(resolve, 15 * 1000));

  // Then
  const methodNames = Array.from(new Set(fetchedTransactions.map((t) => t.method)));
  expect(methodNames).toEqual([methodWanted]);
});

it("should stream transactions", async () => {
  // Given
  const fetchedTransactions: StreamedTransaction[] = [];

  const methodWanted = "GalaChainToken:TransferToken";

  // When
  connectedStream
    .transactions((t) => t.method === methodWanted)
    .fromBlock(0)
    .subscribe({
      next: (transaction) => {
        console.log("Transaction:", transaction.id);
        fetchedTransactions.push(transaction);
      },
      error: (err) => console.error("Error:", err),
      complete: () => console.log("Stream completed")
    });

  await new Promise((resolve) => setTimeout(resolve, 10000));

  // Then
  const methodNames = Array.from(new Set(fetchedTransactions.map((t) => t.method)));
  expect(methodNames).toEqual([methodWanted]);
});

class ChainServiceWithEntropy {
  private readonly errorRate = 0.4;
  private readonly maxDelayMs = 500;
  private readonly closeGrpcConnectionIntervalMs = 2000;
  private readonly closeGrpcInterval: NodeJS.Timeout;

  constructor(
    private readonly wrapped: ChainService,
    private readonly logger: LoggerInterface
  ) {
    this.closeGrpcInterval = setInterval(() => {
      this.logger.log("Forcefully closing grpc connection");
      (this.wrapped as unknown as { client: { close: () => void } }).client.close();
    }, this.closeGrpcConnectionIntervalMs);
  }

  public connect(identity: IIdentity): void {
    this.wrapped.connect(identity);
  }

  public disconnect(): void {
    clearInterval(this.closeGrpcInterval);
    this.wrapped.disconnect();
  }

  public isConnected(): boolean {
    return this.wrapped.isConnected();
  }

  public reconnectIfNeeded(): void {
    this.wrapped.reconnectIfNeeded();
  }

  public async queryChainInfo(): Promise<ChainInfo> {
    await this.applyEntropy("queryChainInfo");
    return this.wrapped.queryChainInfo();
  }

  public async queryBlocks(blockNumbers: number[], transactionFilter: TransactionFilter): Promise<Block[]> {
    await this.applyEntropy("queryBlocks " + blockNumbers);
    return this.wrapped.queryBlocks(blockNumbers, transactionFilter);
  }

  private applyEntropy(info: string): Promise<void> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() < this.errorRate) {
          reject(new Error(`Random error (${info})`));
        } else {
          resolve();
        }
      }, Math.random() * this.maxDelayMs);
    });
  }
}

function addEntropy(s: ConnectedStream, logger: LoggerInterface): void {
  const { chainStream } = s as unknown as {
    chainStream: { chainService: ChainService | ChainServiceWithEntropy };
  };

  // default implementation of chain service is used
  expect(chainStream.chainService).toBeInstanceOf(ChainService);

  // but we want to change it to the implementation with entropy
  chainStream.chainService = new ChainServiceWithEntropy(chainStream.chainService as ChainService, logger);
  expect(chainStream.chainService).toBeInstanceOf(ChainServiceWithEntropy);
}
