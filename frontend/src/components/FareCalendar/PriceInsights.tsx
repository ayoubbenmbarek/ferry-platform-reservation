import React, { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { pricingAPI, PricePrediction, RouteInsights } from '../../services/api';

interface PriceInsightsProps {
  departurePort: string;
  arrivalPort: string;
  departureDate?: string;
  passengers?: number;
  className?: string;
}

const PriceInsights: React.FC<PriceInsightsProps> = ({
  departurePort,
  arrivalPort,
  departureDate,
  passengers = 1,
  className = '',
}) => {
  const [prediction, setPrediction] = useState<PricePrediction | null>(null);
  const [insights, setInsights] = useState<RouteInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'prediction' | 'insights'>('prediction');

  const fetchData = useCallback(async () => {
    if (!departurePort || !arrivalPort) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch insights for the route
      const insightsData = await pricingAPI.getRouteInsights({
        departurePort,
        arrivalPort,
      });
      setInsights(insightsData);

      // If a date is selected, fetch prediction for that date
      if (departureDate) {
        const predictionData = await pricingAPI.getPrediction({
          departurePort,
          arrivalPort,
          departureDate,
          passengers,
        });
        setPrediction(predictionData);
      }
    } catch (err: any) {
      console.error('Failed to fetch price insights:', err);
      setError(err.response?.data?.detail || 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  }, [departurePort, arrivalPort, departureDate, passengers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getRecommendationStyle = (recommendation: string): { bg: string; text: string; icon: JSX.Element } => {
    switch (recommendation) {
      case 'great_deal':
        return {
          bg: 'bg-green-100',
          text: 'text-green-800',
          icon: (
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        };
      case 'book_now':
        return {
          bg: 'bg-blue-100',
          text: 'text-blue-800',
          icon: (
            <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          ),
        };
      case 'wait':
        return {
          bg: 'bg-yellow-100',
          text: 'text-yellow-800',
          icon: (
            <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        };
      default:
        return {
          bg: 'bg-gray-100',
          text: 'text-gray-800',
          icon: (
            <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        };
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'bg-green-500';
    if (confidence >= 0.6) return 'bg-blue-500';
    if (confidence >= 0.4) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getTrendIcon = (trend: string): JSX.Element => {
    switch (trend) {
      case 'rising':
        return (
          <span className="text-red-500 flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            Rising
          </span>
        );
      case 'falling':
        return (
          <span className="text-green-500 flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            Falling
          </span>
        );
      default:
        return (
          <span className="text-gray-500 flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
            </svg>
            Stable
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-24 bg-gray-100 rounded"></div>
          <div className="h-20 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <p className="text-red-500">{error}</p>
        <button onClick={fetchData} className="mt-2 text-blue-600 hover:underline">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow overflow-hidden ${className}`}>
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('prediction')}
          className={`flex-1 px-4 py-3 text-sm font-medium ${
            activeTab === 'prediction'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          AI Prediction
        </button>
        <button
          onClick={() => setActiveTab('insights')}
          className={`flex-1 px-4 py-3 text-sm font-medium ${
            activeTab === 'insights'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Route Insights
        </button>
      </div>

      {/* Prediction Tab */}
      {activeTab === 'prediction' && (
        <div className="p-4">
          {!departureDate ? (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p>Select a date to see price predictions</p>
            </div>
          ) : prediction ? (
            <div className="space-y-4">
              {/* Recommendation Banner */}
              <div className={`${getRecommendationStyle(prediction.recommendation).bg} rounded-lg p-4`}>
                <div className="flex items-start gap-3">
                  {getRecommendationStyle(prediction.recommendation).icon}
                  <div>
                    <h4 className={`font-semibold ${getRecommendationStyle(prediction.recommendation).text}`}>
                      {prediction.recommendation === 'great_deal' && 'Great Deal!'}
                      {prediction.recommendation === 'book_now' && 'Book Now'}
                      {prediction.recommendation === 'wait' && 'Consider Waiting'}
                      {prediction.recommendation === 'neutral' && 'Fair Price'}
                    </h4>
                    <p className={`text-sm ${getRecommendationStyle(prediction.recommendation).text} opacity-80`}>
                      {prediction.recommendation_reason}
                    </p>
                    {prediction.potential_savings > 0 && (
                      <p className={`text-sm font-medium mt-1 ${getRecommendationStyle(prediction.recommendation).text}`}>
                        Potential savings: {prediction.potential_savings}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Price Prediction */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-500 uppercase">Current Price</p>
                  <p className="text-2xl font-bold text-gray-900">{prediction.current_price}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-blue-600 uppercase">Predicted</p>
                  <p className="text-2xl font-bold text-blue-700">{prediction.predicted_price}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    ({prediction.predicted_low} - {prediction.predicted_high})
                  </p>
                </div>
              </div>

              {/* Trend & Confidence */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-500">Price Trend</p>
                  {getTrendIcon(prediction.trend)}
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Confidence</p>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getConfidenceColor(prediction.confidence)}`}
                        style={{ width: `${prediction.confidence * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium">{(prediction.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>

              {/* Booking Window */}
              {prediction.booking_window && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h5 className="text-sm font-medium text-gray-900 mb-2">Optimal Booking Window</h5>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Best time to book:</span>
                    <span className="font-medium">{prediction.booking_window.optimal_days_before} days before</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-gray-600">Expected savings:</span>
                    <span className="font-medium text-green-600">{prediction.booking_window.expected_savings}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-gray-600">Risk level:</span>
                    <span className={`font-medium ${
                      prediction.booking_window.risk_level === 'low' ? 'text-green-600' :
                      prediction.booking_window.risk_level === 'medium' ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {prediction.booking_window.risk_level.charAt(0).toUpperCase() + prediction.booking_window.risk_level.slice(1)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Insights Tab */}
      {activeTab === 'insights' && insights && (
        <div className="p-4 space-y-4">
          {/* Current Status */}
          <div className={`rounded-lg p-4 ${insights.current_status.is_good_deal ? 'bg-green-50' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Current Price</p>
                <p className="text-2xl font-bold">{insights.current_status.current_price}</p>
              </div>
              <div className="text-right">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  insights.current_status.is_good_deal ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {insights.current_status.deal_quality}
                </span>
                <p className="text-sm text-gray-500 mt-1">
                  {insights.current_status.percentile.toFixed(0)}th percentile
                </p>
              </div>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">30-Day Average</p>
              <p className="text-lg font-bold">{insights.statistics.avg_price_30d}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Price Range</p>
              <p className="text-lg font-bold">
                {insights.statistics.min_price_30d} - {insights.statistics.max_price_30d}
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-xs text-green-600">All-Time Low</p>
              <p className="text-lg font-bold text-green-700">{insights.statistics.all_time_low}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-xs text-red-600">All-Time High</p>
              <p className="text-lg font-bold text-red-700">{insights.statistics.all_time_high}</p>
            </div>
          </div>

          {/* Patterns */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h5 className="text-sm font-medium text-gray-900 mb-3">Booking Patterns</h5>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Best day to travel:</span>
                <span className="font-medium text-green-600">{insights.patterns.best_day_of_week}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Most expensive day:</span>
                <span className="font-medium text-red-600">{insights.patterns.worst_day_of_week}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Best booking window:</span>
                <span className="font-medium">{insights.patterns.best_booking_window}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Weekend premium:</span>
                <span className="font-medium">+{(insights.patterns.weekday_vs_weekend * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>

          {/* Recent Trend */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-600">7-Day Trend</span>
            {getTrendIcon(insights.current_status.trend_7d)}
          </div>
        </div>
      )}
    </div>
  );
};

export default PriceInsights;
