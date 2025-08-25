// Hash rate calculation utilities for BSV blockchain analysis

import { BlockHeader } from './whatsonchain';

export interface BlockHashrateData {
  height: number;
  time: number;
  difficulty: number;
  deltaTime: number | null;
  hashrate: number | null;
  hashrateFormatted: string;
  minerAddress?: string;
}

export interface MinerStats {
  address: string;
  blockCount: number;
  percentage: number;
  displayName: string;
}

// Difficulty 1 target (Bitcoin's genesis difficulty)
const DIFF1_TARGET = 0x1d00ffff;

/**
 * Convert compact bits format to target value
 */
function bitsToTarget(bits: string): bigint {
  const bitsNum = parseInt(bits, 16);
  const exp = bitsNum >> 24;
  const mantissa = bitsNum & 0xffffff;
  
  if (exp <= 3) {
    return BigInt(mantissa >> (8 * (3 - exp)));
  }
  
  return BigInt(mantissa) << BigInt(8 * (exp - 3));
}

/**
 * Calculate difficulty from bits
 */
function calculateDifficultyFromBits(bits: string): number {
  const target = bitsToTarget(bits);
  const diff1Target = bitsToTarget(DIFF1_TARGET.toString(16));
  
  return Number(diff1Target) / Number(target);
}

/**
 * Estimate hash rate from difficulty and time interval
 */
function calculateHashrate(difficulty: number, deltaTimeSeconds: number): number {
  if (deltaTimeSeconds <= 0) return 0;
  
  // Hash rate = difficulty * 2^32 / time_interval
  return difficulty * Math.pow(2, 32) / deltaTimeSeconds;
}

/**
 * Format hash rate with appropriate SI units
 */
export function formatHashrate(hashrate: number, precision = 3): string {
  if (hashrate === 0 || !isFinite(hashrate)) return '—';
  
  const units = [
    { threshold: 1e18, suffix: 'EH/s' },
    { threshold: 1e15, suffix: 'PH/s' },
    { threshold: 1e12, suffix: 'TH/s' },
    { threshold: 1e9, suffix: 'GH/s' },
    { threshold: 1e6, suffix: 'MH/s' },
    { threshold: 1e3, suffix: 'kH/s' },
    { threshold: 1, suffix: 'H/s' }
  ];
  
  for (const unit of units) {
    if (hashrate >= unit.threshold) {
      const value = hashrate / unit.threshold;
      return `${value.toPrecision(precision)} ${unit.suffix}`;
    }
  }
  
  return `${hashrate.toPrecision(precision)} H/s`;
}

/**
 * Calculate miner statistics from block headers
 */
export function calculateMinerStats(headers: Map<number, BlockHeader>): MinerStats[] {
  const minerCounts = new Map<string, number>();
  let totalBlocks = 0;

  // Count blocks per miner
  headers.forEach(header => {
    if (header.minerAddress) {
      const current = minerCounts.get(header.minerAddress) || 0;
      minerCounts.set(header.minerAddress, current + 1);
      totalBlocks++;
    }
  });

  // Convert to stats array with percentages
  const stats: MinerStats[] = [];
  minerCounts.forEach((count, address) => {
    stats.push({
      address,
      blockCount: count,
      percentage: (count / totalBlocks) * 100,
      displayName: address
    });
  });

  // Sort by block count descending
  return stats.sort((a, b) => b.blockCount - a.blockCount);
}

/**
 * Process block headers to calculate hash rates
 */
export function processBlockHashrates(headers: Map<number, BlockHeader>): {
  blockData: BlockHashrateData[];
  averageHashrate: number | null;
  averageHashrateFormatted: string;
  blockRange: { start: number; end: number } | null;
  minerStats: MinerStats[];
} {
  const heights = Array.from(headers.keys()).sort((a, b) => a - b);
  
  if (heights.length < 2) {
    return {
      blockData: [],
      averageHashrate: null,
      averageHashrateFormatted: '—',
      blockRange: null,
      minerStats: []
    };
  }
  
  const blockData: BlockHashrateData[] = [];
  const validHashrates: number[] = [];
  
  // Process blocks starting from the second one (need previous block for time delta)
  for (let i = 1; i < heights.length; i++) {
    const height = heights[i];
    const prevHeight = heights[i - 1];
    
    const header = headers.get(height);
    const prevHeader = headers.get(prevHeight);
    
    if (!header || !prevHeader) continue;
    
    // Calculate time difference in seconds
    const deltaTime = header.time - prevHeader.time;
    
    let hashrate: number | null = null;
    let hashrateFormatted = '—';
    
    if (deltaTime > 0) {
      // Use API difficulty or calculate from bits as fallback
      const difficulty = header.difficulty || calculateDifficultyFromBits(header.bits);
      hashrate = calculateHashrate(difficulty, deltaTime);
      hashrateFormatted = formatHashrate(hashrate);
      validHashrates.push(hashrate);
    }
    
    blockData.push({
      height: header.height,
      time: header.time,
      difficulty: header.difficulty || calculateDifficultyFromBits(header.bits),
      deltaTime: deltaTime > 0 ? deltaTime : null,
      hashrate,
      hashrateFormatted,
      minerAddress: header.minerAddress
    });
  }
  
  // Calculate average hash rate
  let averageHashrate: number | null = null;
  let averageHashrateFormatted = '—';
  
  if (validHashrates.length > 0) {
    averageHashrate = validHashrates.reduce((sum, hr) => sum + hr, 0) / validHashrates.length;
    averageHashrateFormatted = formatHashrate(averageHashrate);
  }
  
  // Determine block range (all processed blocks)
  let blockRange: { start: number; end: number } | null = null;
  if (blockData.length > 0) {
    const sortedData = blockData.sort((a, b) => a.height - b.height);
    blockRange = {
      start: sortedData[0].height,
      end: sortedData[sortedData.length - 1].height
    };
  }
  
  // Calculate miner statistics
  const minerStats = calculateMinerStats(headers);
  
  return {
    blockData: blockData, // Return all blocks for display
    averageHashrate,
    averageHashrateFormatted,
    blockRange,
    minerStats
  };
}

/**
 * Format block time as ISO string
 */
export function formatBlockTime(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}

/**
 * Format difficulty with proper number formatting
 */
export function formatDifficulty(difficulty: number): string {
  if (difficulty >= 1e12) {
    return `${(difficulty / 1e12).toFixed(2)}T`;
  } else if (difficulty >= 1e9) {
    return `${(difficulty / 1e9).toFixed(2)}B`;
  } else if (difficulty >= 1e6) {
    return `${(difficulty / 1e6).toFixed(2)}M`;
  } else if (difficulty >= 1e3) {
    return `${(difficulty / 1e3).toFixed(2)}K`;
  }
  return difficulty.toLocaleString();
}