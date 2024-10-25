import {
  BehaviorSubject,
  catchError,
  concatMap,
  expand,
  interval,
  of,
  range,
  retry,
  switchMap,
  tap,
  timer
} from "rxjs";
import { bufferCount } from "rxjs/operators";

import { CAService, IIdentity } from "./CAService";
import { ChainService, TransactionFilter } from "./ChainService";
import { ChainInfo } from "./types";

export interface LoggerInterface {
  log(message: string): void;
  warn(message: string): void;
  error(message: string, e: Error): void;
}

export class ChainStream {
  private readonly chainInfo: BehaviorSubject<ChainInfo>;
  private identityPromise: Promise<IIdentity> | undefined;

  constructor(
    private readonly caService: CAService,
    private readonly chainService: ChainService,
    private readonly logger: LoggerInterface
  ) {
    this.chainInfo = new BehaviorSubject<ChainInfo>({ height: 0, channelName: chainService.channelName });
  }

  private get identity() {
    if (this.identityPromise === undefined) {
      this.identityPromise = this.caService.getIdentity();
    }
    return this.identityPromise;
  }

  private async queryChainInfo(): Promise<ChainInfo> {
    const identity = await this.identity;

    // note no promises inside (prevents from potential race condition)
    if (!this.chainService.isConnected()) {
      this.chainService.connect(identity);
    }

    return this.chainService.queryChainInfo();
  }

  public startPollingChainHeight(config: {
    intervalMs: number;
    retryOnErrorDelayMs: number;
    maxRetryCount: number;
  }) {
    return interval(config.intervalMs)
      .pipe(
        switchMap(async () => {
          const info = await this.queryChainInfo();
          this.logger.log(`Polled chain info for channel ${info.channelName} (height: ${info.height})`);
          return info;
        }),

        catchError((err) => {
          const channel = this.chainInfo.value.channelName;
          this.logger.warn(`Error polling chain info for channel ${channel}: ${err.message}`);
          this.chainService.reconnectIfNeeded();
          throw err; // Allow error to be caught by retry logic
        }),

        retry({
          delay: config.retryOnErrorDelayMs,
          count: config.maxRetryCount,
          resetOnSuccess: true
        })
      )
      .subscribe({
        next: (newInfo) => this.chainInfo.next(newInfo), // Update global height
        error: (err) => this.logger.error("Polling chain height failed permanently:", err)
      });
  }

  public fromBlock(
    startBlock: number,
    config: { batchSize: number; intervalMs: number; retryOnErrorDelayMs: number; maxRetryCount: number },
    transactionFilter: TransactionFilter = () => true
  ) {
    let currentBlock = startBlock; // Keep track of the current block we're fetching

    return of([]).pipe(
      expand(() => {
        if (currentBlock >= this.chainInfo.value.height) {
          return timer(config.intervalMs).pipe(
            tap(() => this.logger.log(`No new blocks, retrying after ${config.intervalMs} ms...`)),
            switchMap(() => of([]))
          );
        }

        // Calculate how many blocks to fetch in the next batch
        const remainingBlocks = this.chainInfo.value.height - currentBlock;
        const batchCount = Math.min(config.batchSize, remainingBlocks); // Don't fetch beyond the latest height

        return range(currentBlock, batchCount).pipe(
          bufferCount(config.batchSize), // Fetch in batches of batchSize

          tap((blockNums) => {
            const channel = this.chainInfo.value.channelName;
            this.logger.log(`Fetching blocks from channel ${channel}: ${blockNums.join(", ")}`);
          }),

          switchMap(async (blockNums) => {
            const blocks = await this.chainService.queryBlocks(blockNums, transactionFilter);
            currentBlock = blockNums[blockNums.length - 1] + 1; // needs to be after getting blocks
            return blocks;
          }),

          catchError((err) => {
            const channel = this.chainInfo.value.channelName;
            this.logger.warn(`Error fetching blocks from channel ${channel}: ${err.message}`);
            this.chainService.reconnectIfNeeded();
            throw err;
          }),

          retry({
            delay: config.retryOnErrorDelayMs,
            count: config.maxRetryCount,
            resetOnSuccess: true
          })
        );
      }),

      concatMap((blocks) => blocks)
    );
  }

  public disconnect() {
    this.chainService.disconnect();
  }
}
