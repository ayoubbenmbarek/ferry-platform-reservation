import React, { useState, useEffect, useCallback } from 'react';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { pricingAPI, PriceHistoryData } from '../../services/api';

interface PriceEvolutionChartProps {
  departurePort: string;
  arrivalPort: string;
  days?: number;
  showRange?: boolean;
  className?: string;
}

interface ChartDataPoint {
  date: string;
  dateFormatted: string;
  lowest: number;
  highest: number;
  average: number;
  ferries: number;
}

const PriceEvolutionChart: React.FC<PriceEvolutionChartProps> = ({
  departurePort,
  arrivalPort,
  days = 30,
  showRange = true,
  className = '',
}) => {
  const [historyData, setHistoryData] = useState<PriceHistoryData | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState(days);

  const fetchData = useCallback(async () => {
    if (!departurePort || !arrivalPort) return;

    setLoading(true);
    setError(null);

    try {
      const data = await pricingAPI.getPriceHistory({
        departurePort,
        arrivalPort,
        days: selectedPeriod,
      });

      setHistoryData(data);

      // Transform data for chart
      const transformed = data.history.map((point) => ({
        date: point.date,
        dateFormatted: format(parseISO(point.date), 'MMM dd'),
        lowest: point.lowest || point.price,
        highest: point.highest || point.price,
        average: point.price,
        ferries: point.available || 0,
      }));

      setChartData(transformed);
    } catch (err: any) {
      console.error('Failed to fetch price history:', err);
      setError(err.response?.data?.detail || 'Failed to load price history');
    } finally {
      setLoading(false);
    }
  }, [departurePort, arrivalPort, selectedPeriod]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getTrendColor = (trend: string): string => {
    switch (trend) {
      case 'rising':
        return 'text-red-500';
      case 'falling':
        return 'text-green-500';
      default:
        return 'text-gray-500';
    }
  };

  const getTrendIcon = (trend: string): JSX.Element => {
    switch (trend) {
      case 'rising':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        );
      case 'falling':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
          </svg>
        );
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // Find values by dataKey name since order in payload depends on render order
      const lowestData = payload.find((p: any) => p.dataKey === 'lowest');
      const averageData = payload.find((p: any) => p.dataKey === 'average');
      const highestData = payload.find((p: any) => p.dataKey === 'highest' && p.name === 'Highest Price');

      return (
        <div className="bg-white shadow-lg rounded-lg p-3 border border-gray-200">
          <p className="text-sm font-medium text-gray-900 mb-2">{label}</p>
          <div className="space-y-1">
            <p className="text-sm">
              <span className="text-green-600 font-medium">Lowest:</span>{' '}
              <span className="font-bold">{lowestData?.value?.toFixed(2)}€</span>
            </p>
            {showRange && (
              <>
                <p className="text-sm">
                  <span className="text-blue-600 font-medium">Average:</span>{' '}
                  <span className="font-bold">{averageData?.value?.toFixed(2)}€</span>
                </p>
                <p className="text-sm">
                  <span className="text-red-600 font-medium">Highest:</span>{' '}
                  <span className="font-bold">{highestData?.value?.toFixed(2)}€</span>
                </p>
              </>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <p className="text-red-500">{error}</p>
        <button type="button" onClick={fetchData} className="mt-2 text-blue-600 hover:underline">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-lg font-semibold text-gray-900">Price Evolution</h3>

          {/* Period selector */}
          <div className="flex rounded-lg overflow-hidden border border-gray-300">
            {[7, 14, 30, 60].map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => setSelectedPeriod(period)}
                className={`px-3 py-1 text-sm transition-colors ${
                  selectedPeriod === period
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                {period}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="dateFormatted"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#e0e0e0' }}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#e0e0e0' }}
                tickFormatter={(value) => `${value}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />

              {showRange && (
                <Area
                  type="monotone"
                  dataKey="highest"
                  stroke="transparent"
                  fill="#fee2e2"
                  name="Price Range"
                />
              )}

              <Line
                type="monotone"
                dataKey="lowest"
                stroke="#16a34a"
                strokeWidth={2}
                dot={{ fill: '#16a34a', strokeWidth: 0, r: 3 }}
                name="Lowest Price"
                activeDot={{ r: 5 }}
              />

              {showRange && (
                <>
                  <Line
                    type="monotone"
                    dataKey="average"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Average"
                  />
                  <Line
                    type="monotone"
                    dataKey="highest"
                    stroke="#ef4444"
                    strokeWidth={1}
                    dot={false}
                    name="Highest Price"
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Statistics */}
      {historyData && (
        <div className="px-4 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 uppercase">Average</p>
              <p className="text-xl font-bold text-gray-900">
                {historyData.average_price}€
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-xs text-green-600 uppercase">Period Low</p>
              <p className="text-xl font-bold text-green-700">
                {historyData.min_price}€
              </p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-xs text-red-600 uppercase">Period High</p>
              <p className="text-xl font-bold text-red-700">
                {historyData.max_price}€
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 uppercase">Trend</p>
              <div className={`flex items-center justify-center ${getTrendColor(historyData.trend)}`}>
                {getTrendIcon(historyData.trend)}
                <span className="text-xl font-bold ml-1 capitalize">
                  {historyData.trend}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PriceEvolutionChart;
