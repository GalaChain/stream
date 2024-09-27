import { ChainService } from "./ChainService";
import { ChainInfo } from "./types";
import { BehaviorSubject, concatMap, expand, interval, of, range, switchMap, tap, timer } from "rxjs";
import { bufferCount } from "rxjs/operators";
import { CAService, IIdentity } from "./CAService";

const logger = {
  log(message: string) {
    console.log(`[ChainStream] ${new Date().toISOString()}: ${message}`);
  },
  error(message: string, e: Error) {
    console.error(`[ChainStream] ${new Date().toISOString()}: ${message}`, e);
  }
};

export class ChainStream {
  private readonly chainInfo: BehaviorSubject<ChainInfo>;
  private identityPromise: Promise<IIdentity> | undefined;

  constructor(
    private readonly caService: CAService,
    private readonly chainService: ChainService
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
    if (!this.chainService.isConnected()) {
      const identity = await this.identity;
      this.chainService.connect(identity);
    }

    return this.chainService.queryChainInfo();
  }

  public startPollingChainHeight(intervalMs: number) {
    return interval(intervalMs).pipe(
      switchMap(async () => {
        const chainInfo = await this.queryChainInfo();
        logger.log(`Polled chain info. Channel: ${chainInfo.channelName}, height: ${chainInfo.height}`);
        return chainInfo;
      })
    ).subscribe({
      next: (newInfo) => this.chainInfo.next(newInfo), // Update global height
      error: (err) => logger.error("Error polling chain height:", err)
    });
  }

  public fromBlock(startBlock: number, batchSize: number, sleepIntervalMs: number) {
    let currentBlock = startBlock; // Keep track of the current block we're fetching

    return of([]).pipe(
      expand(() => {

        if (currentBlock >= this.chainInfo.value.height) {
          return timer(sleepIntervalMs).pipe(
            tap(() => logger.log(`No new blocks, retrying after ${sleepIntervalMs} ms...`)),
            switchMap(() => of([]))
          );
        }

        // Calculate how many blocks to fetch in the next batch
        const remainingBlocks = this.chainInfo.value.height - currentBlock;
        const batchCount = Math.min(batchSize, remainingBlocks); // Don't fetch beyond the latest height

        return range(currentBlock, batchCount).pipe(
          bufferCount(batchSize), // Fetch in batches of batchSize

          switchMap(async (blockNums) => {
            const blocks = await this.getBlocks(blockNums);
            currentBlock = blockNums[blockNums.length - 1] + 1; // needs to be after getting blocks
            return blocks;
          })
        );
      }),

      concatMap(blocks => blocks)
    );
  }

  private async getBlocks(blockNums: number[]) {
    return await Promise.all(blockNums.map((n) => this.chainService.queryBlock(n)));
  }

  public disconnect() {
    this.chainService.disconnect();
  }
}