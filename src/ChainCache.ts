import { Block, ChainInfo } from "./types";

export interface ChainCache {
    getChainInfo(channelName: string): Promise<ChainInfo | undefined>;
    setChainInfo(channelName: string, chainInfo: ChainInfo): Promise<void>;
    getBlock(channelName: string, blockNumber: number): Promise<Block | undefined>;
    setBlock(channelName: string, blockNumber: number, block: Block): Promise<void>;
}