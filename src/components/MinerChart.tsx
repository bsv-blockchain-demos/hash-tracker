import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { MinerStats } from '@/lib/hashrate';

interface MinerChartProps {
  minerStats: MinerStats[];
}

// Colors for the pie chart segments
const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8',
  '#82CA9D', '#FFC658', '#FF7C7C', '#8DD1E1', '#D084D0'
];

const MinerChart: React.FC<MinerChartProps> = ({ minerStats }) => {
  if (!minerStats || minerStats.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No miner data available
      </div>
    );
  }

  // Prepare data for the chart
  const chartData = minerStats.map((miner, index) => ({
    name: miner.displayName,
    value: miner.blockCount,
    percentage: miner.percentage,
    address: miner.address,
    color: COLORS[index % COLORS.length]
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
          <p className="font-medium">{data.name}</p>
          <p className="text-sm text-gray-600">Blocks: {data.value}</p>
          <p className="text-sm text-gray-600">Percentage: {data.percentage.toFixed(1)}%</p>
          <p className="text-xs text-gray-500 mt-1 break-all">{data.address}</p>
        </div>
      );
    }
    return null;
  };

  const CustomLegend = ({ payload }: any) => {
    return null;
  };

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold mb-4 text-center">
        Miner Distribution
      </h3>
      <ResponsiveContainer width="100%" height={400}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ percentage }) => `${percentage.toFixed(1)}%`}
            outerRadius={120}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />
        </PieChart>
      </ResponsiveContainer>
      
      {/* Summary table */}
      <div className="mt-6">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Miner Address</th>
                <th className="text-right py-2">Blocks</th>
                <th className="text-right py-2">Percentage</th>
              </tr>
            </thead>
            <tbody>
              {minerStats.map((miner, index) => (
                <tr key={miner.address} className="border-b border-gray-100">
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="font-mono text-xs break-all">
                        {miner.displayName}
                      </span>
                    </div>
                  </td>
                  <td className="text-right py-2 font-medium">
                    {miner.blockCount}
                  </td>
                  <td className="text-right py-2">
                    {miner.percentage.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MinerChart;
