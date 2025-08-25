import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Card } from '@/components/ui/card';
import { BlockHashrateData, formatHashrate } from '@/lib/hashrate';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface HashrateChartProps {
  data: BlockHashrateData[];
  isLoading: boolean;
}

export const HashrateChart: React.FC<HashrateChartProps> = ({ data, isLoading }) => {
  const chartData = useMemo(() => {
    const validData = data.filter(d => d.hashrate !== null);
    // Sort by height ascending so higher block numbers appear on the right
    const sortedData = validData.sort((a, b) => a.height - b.height);
    
    return {
      labels: sortedData.map(d => d.height.toString()),
      datasets: [
        {
          label: 'Hash Rate',
          data: sortedData.map(d => d.hashrate),
          borderColor: 'hsl(39 100% 50%)',
          backgroundColor: 'rgba(255, 193, 7, 0.1)',
          borderWidth: 3,
          pointBackgroundColor: 'hsl(39 100% 50%)',
          pointBorderColor: 'hsl(39 100% 60%)',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8,
          tension: 0.3,
          fill: true,
        },
      ],
    };
  }, [data]);

  const options: ChartOptions<'line'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(30, 41, 59, 0.95)',
        titleColor: 'rgb(248, 250, 252)',
        bodyColor: 'rgb(248, 250, 252)',
        borderColor: 'hsl(39 100% 50%)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: (context) => {
            const value = context.parsed.y;
            return `Hash Rate: ${formatHashrate(value)}`;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Block Height',
          color: 'hsl(220 14% 60%)',
          font: {
            size: 14,
            weight: 500,
          },
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.1)',
        },
        ticks: {
          color: 'hsl(220 14% 60%)',
          font: {
            size: 12,
          },
        },
      },
      y: {
        title: {
          display: true,
          text: 'Hash Rate',
          color: 'hsl(220 14% 60%)',
          font: {
            size: 14,
            weight: 500,
          },
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.1)',
        },
        ticks: {
          color: 'hsl(220 14% 60%)',
          font: {
            size: 12,
          },
          callback: function(value) {
            return formatHashrate(value as number);
          },
        },
      },
    },
  }), []);

  if (isLoading) {
    return (
      <Card className="glass rounded-2xl p-6 border-0">
        <div className="h-80 bg-muted animate-pulse rounded-lg" />
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="glass rounded-2xl p-6 border-0">
        <div className="h-80 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <div className="text-lg font-medium">No data available</div>
            <div className="text-sm mt-2">Unable to fetch block data for chart</div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="glass rounded-2xl p-6 border-0">
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-foreground">Hash Rate Trend</h3>
        <p className="text-muted-foreground text-sm">
          Estimated hash rate per block over the last 10 blocks
        </p>
      </div>
      <div className="h-80">
        <Line data={chartData} options={options} />
      </div>
    </Card>
  );
};