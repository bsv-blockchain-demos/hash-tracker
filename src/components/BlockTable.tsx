import React from 'react';
import { Card } from '@/components/ui/card';
import { BlockHashrateData, formatBlockTime, formatDifficulty } from '@/lib/hashrate';

interface BlockTableProps {
  data: BlockHashrateData[];
  isLoading: boolean;
}

export const BlockTable: React.FC<BlockTableProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <Card className="glass rounded-2xl p-6 border-0">
        <div className="space-y-4">
          <div className="h-6 bg-muted animate-pulse rounded w-1/3" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="grid grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="h-4 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="glass rounded-2xl p-6 border-0">
        <div className="text-center py-8 text-muted-foreground">
          <div className="text-lg font-medium">No block data available</div>
          <div className="text-sm mt-2">Unable to fetch block information</div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="glass rounded-2xl p-6 border-0">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-foreground">Block Details</h3>
        <p className="text-muted-foreground text-sm">
          Detailed analysis of the last 10 blocks
        </p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-2 text-muted-foreground font-medium text-sm">
                Height
              </th>
              <th className="text-left py-3 px-2 text-muted-foreground font-medium text-sm">
                Time (UTC)
              </th>
              <th className="text-left py-3 px-2 text-muted-foreground font-medium text-sm">
                Difficulty
              </th>
              <th className="text-left py-3 px-2 text-muted-foreground font-medium text-sm">
                Δt (s)
              </th>
              <th className="text-left py-3 px-2 text-muted-foreground font-medium text-sm">
                Est. Hashrate
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((block) => (
              <tr
                key={block.height}
                className="border-b border-border/50 hover:bg-muted/30 transition-colors"
              >
                <td className="py-3 px-2 font-mono text-sm font-medium text-bsv-gold">
                  {block.height.toLocaleString()}
                </td>
                <td className="py-3 px-2 font-mono text-sm text-foreground">
                  {formatBlockTime(block.time).slice(0, 19).replace('T', ' ')}
                </td>
                <td className="py-3 px-2 font-mono text-sm text-foreground">
                  {formatDifficulty(block.difficulty)}
                </td>
                <td className="py-3 px-2 font-mono text-sm text-foreground">
                  {block.deltaTime !== null ? block.deltaTime.toLocaleString() : '—'}
                </td>
                <td className="py-3 px-2 font-mono text-sm font-medium text-foreground">
                  {block.hashrateFormatted}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {data.length > 0 && (
        <div className="mt-4 text-xs text-muted-foreground">
          <p>
            * Hash rate estimated using formula: difficulty × 2³² ÷ block_interval
          </p>
          <p className="mt-1">
            * Δt represents time difference from previous block in seconds
          </p>
        </div>
      )}
    </Card>
  );
};