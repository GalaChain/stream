import { IIdentity } from "./CAService";
import { ChainService } from "./ChainService";
import { LoggerInterface } from "./ChainStream";
import { ConnectedStream } from "./ConnectedStream";
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
  addEntropy(connectedStream);
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

  await new Promise((resolve) => setTimeout(resolve, 10000));
  subscription.unsubscribe();

  // Then - blocks were fetched with the correct order
  const numbers = fetchedBlocks.slice(0, 20).map((b) => b.blockNumber);
  expect(numbers).toEqual([25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44]);

  // Then - and there were errors
  expect(warnMessages).toContainEqual(expect.stringContaining("Error polling chain height"));
  expect(warnMessages).toContainEqual(expect.stringContaining("Error fetching blocks"));
});

class ChainServiceWithEntropy {
  private readonly errorRate = 0.4;
  private readonly maxDelayMs = 500;

  constructor(private readonly wrapped: ChainService) {}

  public connect(identity: IIdentity): void {
    this.wrapped.connect(identity);
  }

  public disconnect(): void {
    this.wrapped.disconnect();
  }

  public isConnected(): boolean {
    return this.wrapped.isConnected();
  }

  public async queryChainInfo(): Promise<ChainInfo> {
    await this.applyEntropy("queryChainInfo");
    return this.wrapped.queryChainInfo();
  }

  public async queryBlocks(blockNumbers: number[]): Promise<Block[]> {
    await this.applyEntropy("queryBlocks " + blockNumbers);
    return this.wrapped.queryBlocks(blockNumbers);
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

function addEntropy(s: ConnectedStream) {
  const { chainStream } = s as unknown as {
    chainStream: { chainService: ChainService | ChainServiceWithEntropy };
  };

  // default implementation of chain service is used
  expect(chainStream.chainService).toBeInstanceOf(ChainService);

  // but we want to change it to the implementation with entropy
  chainStream.chainService = new ChainServiceWithEntropy(chainStream.chainService as ChainService);
  expect(chainStream.chainService).toBeInstanceOf(ChainServiceWithEntropy);
}
