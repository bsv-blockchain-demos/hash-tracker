import React, { useState, useEffect, useCallback } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { SummaryCard } from "@/components/SummaryCard";
import { HashrateChart } from "@/components/HashrateChart";
import { BlockTable } from "@/components/BlockTable";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import MinerChart from "@/components/MinerChart";
import { getLast100Blocks, getLast10BlocksWithMinerData, BlockProgressCallback } from './lib/whatsonchain';
import { processBlockHashrates, BlockHashrateData, MinerStats } from "@/lib/hashrate";

interface AppState {
  blockData: BlockHashrateData[];
  averageHashrate: string;
  blockRange: { start: number; end: number } | null;
  minerStats: MinerStats[];
  isLoading: boolean;
  isLoadingFull: boolean;
  hasFullData: boolean;
  fetchProgress: { fetched: number; total: number; percentage: number } | null;
  error: string | null;
  lastUpdated: Date | null;
}

const CACHE_KEY = 'bsv-hashrate-cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    blockData: [],
    averageHashrate: '—',
    blockRange: null,
    minerStats: [],
    isLoading: true,
    isLoadingFull: false,
    hasFullData: false,
    fetchProgress: null,
    error: null,
    lastUpdated: null,
  });

  // Load cached data
  const loadCachedData = useCallback(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        const age = Date.now() - new Date(data.timestamp).getTime();
        
        if (age < CACHE_DURATION) {
          setState(prev => ({
            ...prev,
            ...data.state,
            lastUpdated: new Date(data.timestamp),
          }));
          return true;
        }
      }
    } catch (error) {
      console.warn('Failed to load cached data:', error);
    }
    return false;
  }, []);

  // Save data to cache
  const saveCachedData = useCallback((newState: Partial<AppState>) => {
    try {
      const dataToCache = {
        state: {
          blockData: newState.blockData,
          averageHashrate: newState.averageHashrate,
          blockRange: newState.blockRange,
        },
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(dataToCache));
    } catch (error) {
      console.warn('Failed to save cached data:', error);
    }
  }, []);

  // Fetch initial 10 blocks
  const fetchInitialData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Fetch the last 10 blocks with miner data from WhatsOnChain
      const headerMap = await getLast10BlocksWithMinerData();
      
      if (headerMap.size < 10) {
        throw new Error(`Only received ${headerMap.size} headers, expected at least 10`);
      }
      
      // Process the hash rate calculations
      const result = processBlockHashrates(headerMap);
      
      const newState = {
        blockData: result.blockData,
        averageHashrate: result.averageHashrateFormatted,
        blockRange: result.blockRange,
        minerStats: result.minerStats,
        isLoading: false,
        hasFullData: false,
        error: null,
        lastUpdated: new Date(),
      };
      
      setState(prev => ({ ...prev, ...newState }));
      saveCachedData(newState);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, [saveCachedData]);

  // Fetch full 100 blocks with progressive updates
  const fetchFullData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoadingFull: true, error: null, fetchProgress: null }));

    try {
      // Progress callback to update UI as blocks are fetched
      const onProgress: BlockProgressCallback = (currentBlocks, progress) => {
        // Process the current blocks for display
        const result = processBlockHashrates(currentBlocks);
        
        setState(prev => ({
          ...prev,
          blockData: result.blockData,
          averageHashrate: result.averageHashrateFormatted,
          blockRange: result.blockRange,
          minerStats: result.minerStats,
          fetchProgress: progress,
          lastUpdated: new Date(),
        }));
      };

      // Fetch the last 100 blocks from WhatsOnChain with progressive updates
      const headerMap = await getLast100Blocks(onProgress);
      
      if (headerMap.size < 100) {
        throw new Error(`Only received ${headerMap.size} blocks, expected 100`);
      }
      
      // Final processing
      const result = processBlockHashrates(headerMap);
      
      const newState = {
        blockData: result.blockData,
        averageHashrate: result.averageHashrateFormatted,
        blockRange: result.blockRange,
        minerStats: result.minerStats,
        isLoadingFull: false,
        hasFullData: true,
        fetchProgress: null,
        error: null,
        lastUpdated: new Date(),
      };
      
      setState(prev => ({ ...prev, ...newState }));
      saveCachedData(newState);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setState(prev => ({
        ...prev,
        isLoadingFull: false,
        fetchProgress: null,
        error: errorMessage,
      }));
    }
  }, [saveCachedData]);

  // Initialize app
  useEffect(() => {
    const hasCachedData = loadCachedData();
    
    if (hasCachedData) {
      // Show cached data immediately, then refresh in background
      setState(prev => ({ ...prev, isLoading: false }));
      fetchInitialData();
    } else {
      // No cached data, fetch immediately
      fetchInitialData();
    }
  }, [loadCachedData, fetchInitialData]);

  const handleRefresh = useCallback(() => {
    if (state.hasFullData) {
      fetchFullData();
    } else {
      fetchInitialData();
    }
  }, [fetchInitialData, fetchFullData, state.hasFullData]);

  if (state.error && !state.lastUpdated) {
    return (
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <ErrorDisplay
            error={state.error}
            onRetry={handleRefresh}
            isRetrying={state.isLoading}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <Toaster />
      
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-medium text-muted-foreground">
              Real-time BSV Network Analysis
            </h2>
            {state.lastUpdated && (
              <p className="text-sm text-muted-foreground">
                Last updated: {state.lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
          
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              {!state.hasFullData && (
                <Button
                  onClick={fetchFullData}
                  disabled={state.isLoadingFull}
                  className="bg-blue-600 hover:bg-blue-700 text-white transition-smooth"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${state.isLoadingFull ? 'animate-spin' : ''}`} />
                  Get Last 100 Blocks
                </Button>
              )}
              
              <Button
                onClick={handleRefresh}
                disabled={state.isLoading || state.isLoadingFull}
                className="bg-bsv-gold hover:bg-bsv-gold/90 text-bsv-gold-dark transition-smooth"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${(state.isLoading || state.isLoadingFull) ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            
            {/* Progress indicator */}
            {state.fetchProgress && state.fetchProgress.total > 0 && (
              <div className="w-full max-w-xs">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Fetching blocks...</span>
                  <span>{state.fetchProgress.fetched}/{state.fetchProgress.total}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${state.fetchProgress.percentage}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1 text-center">
                  {state.fetchProgress.percentage}% complete
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Summary Card */}
        <SummaryCard
          averageHashrate={state.averageHashrate}
          blockRange={state.blockRange}
          isLoading={state.isLoading}
        />

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg border p-6">
            <HashrateChart
              data={state.blockData}
              isLoading={state.isLoading}
            />
          </div>
          
          <div className="bg-white rounded-lg border p-6">
            <MinerChart
              minerStats={state.minerStats}
            />
          </div>
        </div>

        {/* Table */}
        <BlockTable
          data={state.blockData}
          isLoading={state.isLoading}
        />

        {/* Footer */}
        <div className="text-center py-8 text-muted-foreground text-sm">
          <p>
            Data sourced from{' '}
            <a
              href="https://whatsonchain.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-bsv-gold hover:underline"
            >
              WhatsOnChain
            </a>{' '}
            • Hash rate estimations use Poisson arrival assumptions
          </p>
          <p className="mt-2">
            10-block averaging reduces noise from natural block time variance
          </p>
        </div>
      </div>
    </div>
  );
};

export default App;
