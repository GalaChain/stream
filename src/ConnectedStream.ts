import { ChainStream } from "./ChainStream";
import { Observable } from "rxjs";
import { Block } from "./types";

export interface StreamConfig {
  chainInfoPollingIntervalMs: number;
  sleepIntervalMs: number;
  batchSize: number;
}

export class ConnectedStream {
  constructor(
    private readonly chainStream: ChainStream,
    private readonly streamConfig: StreamConfig
  ) {
    chainStream.startPollingChainHeight(this.streamConfig.chainInfoPollingIntervalMs);
  }

  public fromBlock(number: number): Observable<Block> {
    return this.chainStream.fromBlock(number, this.streamConfig.batchSize, this.streamConfig.sleepIntervalMs);
  }

  public disconnect(): void {
    this.chainStream.disconnect();
  }
}