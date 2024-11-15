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

import { Observable, Subscription } from "rxjs";

import { TransactionFilter } from "./ChainService";
import { ChainStream } from "./ChainStream";
import { ConnectedTransactionStream } from "./ConnectedTransactionStream";
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

  public transactions(filter: TransactionFilter = () => true): ConnectedTransactionStream {
    return new ConnectedTransactionStream(this.chainStream, this.streamConfig, filter);
  }

  public disconnect(): void {
    this.chainHeightSubscription.unsubscribe();
    this.chainStream.disconnect();
  }
}
