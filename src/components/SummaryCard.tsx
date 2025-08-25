import React from 'react';
import { Card } from '@/components/ui/card';

interface SummaryCardProps {
  averageHashrate: string;
  blockRange: { start: number; end: number } | null;
  isLoading: boolean;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  averageHashrate,
  blockRange,
  isLoading
}) => {
  return (
    <Card className="glass-intense rounded-2xl p-8 border-0">
      <div className="text-center space-y-4">
        <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-bsv-gold to-yellow-400 bg-clip-text text-transparent">
          BSV Estimated Hash Rate
        </h1>
        <p className="text-muted-foreground text-lg">
          Last 10 blocks network analysis
        </p>
        
        <div className="pt-6">
          {isLoading ? (
            <div className="space-y-4">
              <div className="h-16 bg-muted animate-pulse rounded-lg" />
              <div className="h-6 bg-muted animate-pulse rounded-lg w-48 mx-auto" />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-5xl md:text-6xl font-bold text-foreground glow-gold">
                {averageHashrate}
              </div>
              {blockRange && (
                <div className="text-muted-foreground text-lg">
                  Heights {blockRange.start.toLocaleString()}–{blockRange.end.toLocaleString()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};