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

import { Observable, mergeMap } from "rxjs";

import { TransactionFilter } from "./ChainService";
import { ChainStream } from "./ChainStream";
import { StreamConfig } from "./ConnectedStream";
import { Transaction, TransactionValidationCode } from "./types";

export type StreamedTransaction = Transaction & { blockNumber: number };

export class ConnectedTransactionStream {
  constructor(
    private readonly stream: ChainStream,
    private readonly config: StreamConfig,
    private readonly transactionFilter: TransactionFilter
  ) {}

  fromBlock(number: number): Observable<StreamedTransaction> {
    return this.stream.fromBlock(number, this.config, this.transactionFilter).pipe(
      // Flatten the array of transactions
      mergeMap((block) =>
        block.transactions
          .filter((t) => t.validationCode === TransactionValidationCode.VALID)
          .map((transaction) => ({ ...transaction, blockNumber: block.blockNumber }))
      )
    );
  }
}
