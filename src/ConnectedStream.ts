import { Observable } from "rxjs";

import { TransactionFilter } from "./ChainService";
import { ChainStream } from "./ChainStream";
import { ConnectedTransactionStream } from "./ConnectedTransactionStream";
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

  public transactions(filter: TransactionFilter = () => true): ConnectedTransactionStream {
    return new ConnectedTransactionStream(this.chainStream, this.streamConfig, filter);
  }

  public disconnect(): void {
    this.chainStream.disconnect();
  }
}
