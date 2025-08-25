// WhatsOnChain API client for BSV blockchain data
import { Script, Utils } from '@bsv/sdk';

export interface BlockHeader {
  hash: string;
  height: number;
  time: number;
  bits: string;
  difficulty: number;
  minerAddress?: string;
  minerTag?: string;
}

export interface CoinbaseTx {
  vin: Array<{
    coinbase: string;
  }>;
  vout: Array<{
    scriptPubKey: {
      addresses?: string[];
    };
  }>;
}

export interface FullBlock {
  hash: string;
  height: number;
  time: number;
  bits: string;
  difficulty: number;
  coinbaseTx: CoinbaseTx;
}

export interface ChainInfo {
  chain: string;
  blocks: number;
  headers: number;
  bestblockhash: string;
  difficulty: number;
  mediantime: number;
  verificationprogress: number;
  pruned: boolean;
}

const BASE_URL = 'https://api.whatsonchain.com/v1/bsv/main';
const TIMEOUT_MS = 12000;
const RATE_LIMIT_DELAY = 334; // ~3 requests per second (1000ms / 3 = 333.33ms)
const BLOCK_CACHE_KEY = 'bsv-block-cache';
const BLOCK_CACHE_DURATION = 60 * 60 * 1000; // 1 hour for individual blocks

class WhatsOnChainError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'WhatsOnChainError';
  }
}

// Rate limiting queue to ensure we don't exceed 3 requests per second
class RateLimitedClient {
  private queue: Array<() => Promise<void>> = [];
  private isProcessing = false;
  private aborted = false;

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          if (this.aborted) {
            reject(new WhatsOnChainError('Requests aborted due to rate limit'));
            return;
          }
          const result = await fn();
          resolve(result);
        } catch (error) {
          if (error instanceof WhatsOnChainError && error.status === 429) {
            this.abort();
          }
          reject(error);
        }
      });
      
      this.processQueue();
    });
  }

  abort() {
    this.aborted = true;
    this.queue.length = 0; // Clear remaining requests
  }

  reset() {
    this.aborted = false;
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    
    while (this.queue.length > 0 && !this.aborted) {
      const task = this.queue.shift();
      if (task) {
        await task();
        // Wait between requests to respect rate limit
        if (this.queue.length > 0 && !this.aborted) {
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
        }
      }
    }
    
    this.isProcessing = false;
  }
}

const rateLimitedClient = new RateLimitedClient();

// Block cache interface
interface CachedBlock {
  data: BlockHeader;
  timestamp: number;
}

// Block cache management
class BlockCache {
  private cache: Map<number, CachedBlock> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const cached = localStorage.getItem(BLOCK_CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        Object.entries(data).forEach(([height, cachedBlock]) => {
          this.cache.set(parseInt(height), cachedBlock as CachedBlock);
        });
      }
    } catch (error) {
      console.warn('Failed to load block cache:', error);
    }
  }

  private saveToStorage() {
    try {
      const data: Record<string, CachedBlock> = {};
      this.cache.forEach((cachedBlock, height) => {
        data[height.toString()] = cachedBlock;
      });
      localStorage.setItem(BLOCK_CACHE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save block cache:', error);
    }
  }

  get(height: number): BlockHeader | null {
    const cached = this.cache.get(height);
    if (!cached) return null;

    // Check if cache is still valid
    const now = Date.now();
    if (now - cached.timestamp > BLOCK_CACHE_DURATION) {
      this.cache.delete(height);
      this.saveToStorage();
      return null;
    }

    return cached.data;
  }

  set(height: number, data: BlockHeader) {
    this.cache.set(height, {
      data,
      timestamp: Date.now()
    });
    this.saveToStorage();
  }

  clear() {
    this.cache.clear();
    localStorage.removeItem(BLOCK_CACHE_KEY);
  }

  // Clean expired entries
  cleanup() {
    const now = Date.now();
    let hasChanges = false;
    
    this.cache.forEach((cachedBlock, height) => {
      if (now - cachedBlock.timestamp > BLOCK_CACHE_DURATION) {
        this.cache.delete(height);
        hasChanges = true;
      }
    });

    if (hasChanges) {
      this.saveToStorage();
    }
  }
}

const blockCache = new BlockCache();

async function fetchWithTimeout(url: string, timeoutMs = TIMEOUT_MS): Promise<Response> {
  return rateLimitedClient.enqueue(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetch(url, { 
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        }
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 429) {
          throw new WhatsOnChainError(
            'Rate limit exceeded. Please wait a moment before trying again.',
            429
          );
        }
        throw new WhatsOnChainError(
          `API request failed: ${response.status} ${response.statusText}`,
          response.status
        );
      }
      
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new WhatsOnChainError('Request timeout - API took too long to respond');
      }
      throw error;
    }
  });
}

export async function getTipHeight(): Promise<number> {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/chain/info`);
    const data: ChainInfo = await response.json();
    return data.headers;
  } catch (error) {
    if (error instanceof WhatsOnChainError) {
      throw error;
    }
    throw new WhatsOnChainError(`Failed to fetch tip height: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getHeader(height: number): Promise<BlockHeader> {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/block/headers/${height}`);
    const data: BlockHeader[] = await response.json();
    
    if (!Array.isArray(data) || data.length === 0) {
      throw new WhatsOnChainError(`No header data returned for height ${height}`);
    }
    
    const header = data[0];
    
    // Validate required fields
    if (!header.hash || typeof header.height !== 'number' || typeof header.time !== 'number') {
      throw new WhatsOnChainError(`Invalid header data for height ${height}`);
    }
    
    return header;
  } catch (error) {
    if (error instanceof WhatsOnChainError) {
      throw error;
    }
    throw new WhatsOnChainError(`Failed to fetch header for height ${height}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getBlockByHeight(height: number): Promise<BlockHeader> {
  // Check cache first
  const cached = blockCache.get(height);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetchWithTimeout(`${BASE_URL}/block/height/${height}`);
    const data: FullBlock = await response.json();
    
    // Validate required fields
    if (!data.hash || typeof data.height !== 'number' || typeof data.time !== 'number') {
      throw new WhatsOnChainError(`Invalid block data for height ${height}`);
    }
    
    // Extract miner tag and address from coinbase transaction
    let minerAddress: string | undefined;
    let minerTag: string | undefined;
    
    if (data.coinbaseTx) {
      // Try to extract miner tag from coinbase script
      try {
        if (data.coinbaseTx.vin && data.coinbaseTx.vin.length > 0 && data.coinbaseTx.vin[0].coinbase) {
          const script = Script.fromHex(data.coinbaseTx.vin[0].coinbase);
          const tag = script.chunks
            .map(c => Utils.toUTF8(c?.data || []))
            .reduce((allText, txt) => allText + txt.replace('\n', ' '), '')
            .trim();
          
          if (tag && tag.length > 0) {
            minerTag = tag;
          }
        }
      } catch (error) {
        console.warn(`Failed to extract miner tag for block ${height}:`, error);
      }
      
      // Extract miner address as fallback
      if (data.coinbaseTx.vout && data.coinbaseTx.vout.length > 0) {
        const coinbaseVout = data.coinbaseTx.vout[0];
        if (coinbaseVout.scriptPubKey && coinbaseVout.scriptPubKey.addresses && coinbaseVout.scriptPubKey.addresses.length > 0) {
          minerAddress = coinbaseVout.scriptPubKey.addresses[0];
        }
      }
    }
    
    const blockHeader: BlockHeader = {
      hash: data.hash,
      height: data.height,
      time: data.time,
      bits: data.bits || '',
      difficulty: data.difficulty || 0,
      minerAddress,
      minerTag
    };

    // Cache the result
    blockCache.set(height, blockHeader);
    
    return blockHeader;
  } catch (error) {
    if (error instanceof WhatsOnChainError) {
      throw error;
    }
    throw new WhatsOnChainError(`Failed to fetch block for height ${height}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getHeaders(): Promise<Map<number, BlockHeader>> {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/block/headers`);
    const data: BlockHeader[] = await response.json();
    
    if (!Array.isArray(data)) {
      throw new WhatsOnChainError('Invalid headers data returned from API');
    }
    
    const headerMap = new Map<number, BlockHeader>();
    
    data.forEach((header) => {
      // Validate required fields
      if (!header.hash || typeof header.height !== 'number' || typeof header.time !== 'number') {
        console.warn(`Invalid header data for height ${header.height}:`, header);
        return;
      }
      
      headerMap.set(header.height, header);
    });
    
    return headerMap;
  } catch (error) {
    if (error instanceof WhatsOnChainError) {
      throw error;
    }
    throw new WhatsOnChainError(`Failed to fetch headers: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getLast10BlocksWithMinerData(): Promise<Map<number, BlockHeader>> {
  try {
    // First get the last 10 headers to determine the height range
    const recentHeaders = await getHeaders();
    
    if (recentHeaders.size === 0) {
      throw new WhatsOnChainError('No recent headers available');
    }
    
    // Find the highest block heights from the recent headers
    const heights = Array.from(recentHeaders.keys()).sort((a, b) => b - a);
    const last10Heights = heights.slice(0, 10);
    
    // Check cache for all blocks first
    const allBlocks = new Map<number, BlockHeader>();
    const heightsToFetch: number[] = [];
    
    for (const height of last10Heights) {
      const cached = blockCache.get(height);
      if (cached) {
        allBlocks.set(height, cached);
      } else {
        heightsToFetch.push(height);
      }
    }
    
    // Fetch uncached blocks with full data (including miner info)
    if (heightsToFetch.length > 0) {
      console.log(`Fetching ${heightsToFetch.length} blocks with miner data from API`);
      
      const blockPromises = heightsToFetch.map(height => 
        getBlockByHeight(height).catch(error => {
          console.warn(`Failed to fetch block at height ${height}:`, error);
          return null;
        })
      );
      
      const blocks = await Promise.all(blockPromises);
      
      blocks.forEach(block => {
        if (block) {
          allBlocks.set(block.height, block);
        }
      });
    } else {
      console.log('All 10 blocks found in cache');
    }
    
    return allBlocks;
  } catch (error) {
    if (error instanceof WhatsOnChainError) {
      throw error;
    }
    throw new WhatsOnChainError(`Failed to fetch last 10 blocks with miner data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Callback type for progressive block loading
export type BlockProgressCallback = (
  currentBlocks: Map<number, BlockHeader>,
  progress: { fetched: number; total: number; percentage: number }
) => void;

export async function getLast100Blocks(
  onProgress?: BlockProgressCallback
): Promise<Map<number, BlockHeader>> {
  try {
    // Reset rate limiter in case it was previously aborted
    rateLimitedClient.reset();
    
    // First get the last 10 headers to determine the height range
    const recentHeaders = await getHeaders();
    
    if (recentHeaders.size === 0) {
      throw new WhatsOnChainError('No recent headers available');
    }
    
    // Find the highest block height from the recent headers
    const heights = Array.from(recentHeaders.keys()).sort((a, b) => b - a);
    const latestHeight = heights[0];
    
    // Calculate the range for the last 100 blocks
    const startHeight = latestHeight - 99; // 100 blocks total including latest
    
    // Check cache for all blocks in range first
    const allBlocks = new Map<number, BlockHeader>(recentHeaders);
    const heightsToFetch: number[] = [];
    
    for (let height = startHeight; height <= latestHeight; height++) {
      if (!allBlocks.has(height)) {
        // Check cache first
        const cached = blockCache.get(height);
        if (cached) {
          allBlocks.set(height, cached);
        } else {
          heightsToFetch.push(height);
        }
      }
    }
    
    // Sort heights to fetch from highest to lowest for progressive loading
    heightsToFetch.sort((a, b) => b - a);
    
    // Only fetch blocks that aren't cached
    if (heightsToFetch.length > 0) {
      console.log(`Fetching ${heightsToFetch.length} uncached blocks from API`);
      
      const totalToFetch = heightsToFetch.length;
      let fetchedCount = 0;
      
      // Initial progress callback with cached data
      if (onProgress) {
        onProgress(allBlocks, {
          fetched: 0,
          total: totalToFetch,
          percentage: 0
        });
      }
      
      // Fetch blocks sequentially to provide progressive updates
      for (const height of heightsToFetch) {
        try {
          const block = await getBlockByHeight(height);
          if (block) {
            allBlocks.set(block.height, block);
            fetchedCount++;
            
            // Call progress callback after each block
            if (onProgress) {
              onProgress(new Map(allBlocks), {
                fetched: fetchedCount,
                total: totalToFetch,
                percentage: Math.round((fetchedCount / totalToFetch) * 100)
              });
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch block at height ${height}:`, error);
          fetchedCount++; // Still count as processed
          
          if (onProgress) {
            onProgress(new Map(allBlocks), {
              fetched: fetchedCount,
              total: totalToFetch,
              percentage: Math.round((fetchedCount / totalToFetch) * 100)
            });
          }
        }
      }
    } else {
      console.log('All blocks found in cache, no API calls needed');
      
      // Still call progress callback to indicate completion
      if (onProgress) {
        onProgress(allBlocks, {
          fetched: 0,
          total: 0,
          percentage: 100
        });
      }
    }
    
    // Clean up expired cache entries periodically
    blockCache.cleanup();
    
    return allBlocks;
  } catch (error) {
    if (error instanceof WhatsOnChainError) {
      throw error;
    }
    throw new WhatsOnChainError(`Failed to fetch last 100 blocks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}