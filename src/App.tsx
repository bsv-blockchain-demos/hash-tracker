import React, { useState, useEffect, useCallback } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { SummaryCard } from "@/components/SummaryCard";
import { HashrateChart } from "@/components/HashrateChart";
import { BlockTable } from "@/components/BlockTable";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { getTipHeight, getHeaders } from "@/lib/whatsonchain";
import { processBlockHashrates, BlockHashrateData } from "@/lib/hashrate";

interface AppState {
  blockData: BlockHashrateData[];
  averageHashrate: string;
  blockRange: { start: number; end: number } | null;
  isLoading: boolean;
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
    isLoading: true,
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

  // Fetch hash rate data
  const fetchHashrateData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Get current blockchain tip
      const tipHeight = await getTipHeight();
      
      // Calculate heights needed: last 10 blocks plus one previous for delta calculation
      const heights: number[] = [];
      for (let i = tipHeight - 10; i <= tipHeight; i++) {
        heights.push(i);
      }
      
      // Fetch all headers in parallel
      const headerMap = await getHeaders(heights);
      
      if (headerMap.size < 11) {
        throw new Error(`Only received ${headerMap.size} headers, expected 11`);
      }
      
      // Process the hash rate calculations
      const result = processBlockHashrates(headerMap);
      
      const newState = {
        blockData: result.blockData,
        averageHashrate: result.averageHashrateFormatted,
        blockRange: result.blockRange,
        isLoading: false,
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

  // Initialize app
  useEffect(() => {
    const hasCachedData = loadCachedData();
    
    if (hasCachedData) {
      // Show cached data immediately, then refresh in background
      setState(prev => ({ ...prev, isLoading: false }));
      fetchHashrateData();
    } else {
      // No cached data, fetch immediately
      fetchHashrateData();
    }
  }, [loadCachedData, fetchHashrateData]);

  const handleRefresh = useCallback(() => {
    fetchHashrateData();
  }, [fetchHashrateData]);

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
          
          <Button
            onClick={handleRefresh}
            disabled={state.isLoading}
            className="bg-bsv-gold hover:bg-bsv-gold/90 text-bsv-gold-dark transition-smooth"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${state.isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Summary Card */}
        <SummaryCard
          averageHashrate={state.averageHashrate}
          blockRange={state.blockRange}
          isLoading={state.isLoading}
        />

        {/* Chart */}
        <HashrateChart
          data={state.blockData}
          isLoading={state.isLoading}
        />

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
