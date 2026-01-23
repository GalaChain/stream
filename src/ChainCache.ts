import { Block, ChainInfo } from "./types";

export interface ChainCache {
    getChainInfo(channelName: string): ChainInfo;
    setChainInfo(channelName: string, chainInfo: ChainInfo): void;
    getBlock(channelName: string, blockNumber: number): Block;
    setBlock(channelName: string, blockNumber: number, block: Block): void;
}