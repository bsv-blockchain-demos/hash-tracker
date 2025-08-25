import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorDisplayProps {
  error: string;
  onRetry: () => void;
  isRetrying?: boolean;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ 
  error, 
  onRetry, 
  isRetrying = false 
}) => {
  return (
    <Card className="glass-intense rounded-2xl p-8 border-0 text-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="p-4 rounded-full bg-destructive/10">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-foreground">
            Unable to Load Data
          </h3>
          <p className="text-muted-foreground max-w-md">
            {error}
          </p>
        </div>
        
        <Button
          onClick={onRetry}
          disabled={isRetrying}
          className="bg-bsv-gold hover:bg-bsv-gold/90 text-bsv-gold-dark transition-smooth"
        >
          {isRetrying ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Retrying...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </>
          )}
        </Button>
        
        <div className="text-xs text-muted-foreground mt-4">
          <p>If the problem persists, the WhatsOnChain API may be temporarily unavailable.</p>
        </div>
      </div>
    </Card>
  );
};