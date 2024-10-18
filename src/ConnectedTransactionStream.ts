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
    return this.stream
      .fromBlock(number, this.config.batchSize, this.config.sleepIntervalMs, this.transactionFilter)
      .pipe(
        // Flatten the array of transactions
        mergeMap((block) =>
          block.transactions
            .filter((t) => t.validationCode === TransactionValidationCode.VALID)
            .map((transaction) => ({ ...transaction, blockNumber: block.blockNumber }))
        )
      );
  }
}
