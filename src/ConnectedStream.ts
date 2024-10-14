import { Observable, Subscription } from "rxjs";

import { ChainStream } from "./ChainStream";
import { Block } from "./types";

export interface StreamConfig {
  chainInfoPollingIntervalMs: number;
  intervalMs: number;
  batchSize: number;
  retryOnErrorDelayMs: number;
  maxRetryCount: number;
}

export class ConnectedStream {
  private chainHeightSubscription: Subscription;

  constructor(
    private readonly chainStream: ChainStream,
    private readonly streamConfig: StreamConfig
  ) {
    this.chainHeightSubscription = chainStream.startPollingChainHeight({
      intervalMs: streamConfig.chainInfoPollingIntervalMs,
      retryOnErrorDelayMs: streamConfig.retryOnErrorDelayMs,
      maxRetryCount: streamConfig.maxRetryCount
    });
  }

  public fromBlock(number: number): Observable<Block> {
    return this.chainStream.fromBlock(number, {
      intervalMs: this.streamConfig.intervalMs,
      batchSize: this.streamConfig.batchSize,
      retryOnErrorDelayMs: this.streamConfig.retryOnErrorDelayMs,
      maxRetryCount: this.streamConfig.maxRetryCount
    });
  }

  public disconnect(): void {
    this.chainHeightSubscription.unsubscribe();
    this.chainStream.disconnect();
  }
}
