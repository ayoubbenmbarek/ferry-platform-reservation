import React, { useState, useEffect } from 'react';
import FareCalendar from './FareCalendar';
import PriceEvolutionChart from './PriceEvolutionChart';
import PriceInsights from './PriceInsights';
import FlexibleDatesSearch from './FlexibleDatesSearch';

interface SmartPricingPanelProps {
  departurePort: string;
  arrivalPort: string;
  departureDate?: string;
  passengers?: number;
  onDateSelect?: (date: string, price: number) => void;
  className?: string;
  compact?: boolean;
}

type ViewMode = 'calendar' | 'chart' | 'insights' | 'flexible';

const SmartPricingPanel: React.FC<SmartPricingPanelProps> = ({
  departurePort,
  arrivalPort,
  departureDate,
  passengers = 1,
  onDateSelect,
  className = '',
  compact = false,
}) => {
  const [selectedDate, setSelectedDate] = useState<string | undefined>(departureDate);
  const [activeView, setActiveView] = useState<ViewMode>('calendar');

  // Sync selectedDate when departureDate prop changes from parent
  useEffect(() => {
    setSelectedDate(departureDate);
  }, [departureDate]);

  const handleDateSelect = (date: string, price: number) => {
    setSelectedDate(date);
    onDateSelect?.(date, price);
  };

  if (!departurePort || !arrivalPort) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 text-center ${className}`}>
        <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        <p className="text-gray-500">Select departure and arrival ports to see pricing insights</p>
      </div>
    );
  }

  const viewTabs = [
    { id: 'calendar' as ViewMode, label: 'Calendar', icon: 'calendar' },
    { id: 'chart' as ViewMode, label: 'Price Trend', icon: 'chart' },
    { id: 'insights' as ViewMode, label: 'AI Insights', icon: 'brain' },
    { id: 'flexible' as ViewMode, label: 'Flexible Dates', icon: 'swap' },
  ];

  const getIcon = (icon: string): JSX.Element => {
    switch (icon) {
      case 'calendar':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'chart':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
        );
      case 'brain':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        );
      case 'swap':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        );
      default:
        return <span />;
    }
  };

  if (compact) {
    // Compact mode: Just show the calendar
    return (
      <div className={className}>
        <FareCalendar
          departurePort={departurePort}
          arrivalPort={arrivalPort}
          passengers={passengers}
          onDateSelect={handleDateSelect}
          selectedDate={selectedDate}
        />
      </div>
    );
  }

  return (
    <div className={`bg-gray-50 rounded-xl overflow-hidden ${className}`}>
      {/* Header with tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Smart Pricing
          </h2>
          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full font-medium">
            AI-Powered
          </span>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto scrollbar-hide">
          {viewTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveView(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeView === tab.id
                  ? 'text-blue-600 border-blue-600 bg-blue-50'
                  : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {getIcon(tab.icon)}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeView === 'calendar' && (
          <FareCalendar
            departurePort={departurePort}
            arrivalPort={arrivalPort}
            passengers={passengers}
            onDateSelect={handleDateSelect}
            selectedDate={selectedDate}
          />
        )}

        {activeView === 'chart' && (
          <PriceEvolutionChart
            departurePort={departurePort}
            arrivalPort={arrivalPort}
            days={30}
            showRange={true}
          />
        )}

        {activeView === 'insights' && (
          <PriceInsights
            departurePort={departurePort}
            arrivalPort={arrivalPort}
            departureDate={selectedDate}
            passengers={passengers}
          />
        )}

        {activeView === 'flexible' && (
          <FlexibleDatesSearch
            departurePort={departurePort}
            arrivalPort={arrivalPort}
            departureDate={selectedDate || departureDate || ''}
            passengers={passengers}
            onDateSelect={handleDateSelect}
          />
        )}
      </div>

      {/* Footer tip */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 px-4 py-3 border-t border-blue-100">
        <p className="text-xs text-blue-700 flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {activeView === 'calendar' && 'Click on a date to see available ferries and detailed pricing'}
          {activeView === 'chart' && 'See how prices have changed over time to find the best booking window'}
          {activeView === 'insights' && 'Our AI analyzes pricing patterns to give you smart booking advice'}
          {activeView === 'flexible' && 'Explore nearby dates to find the best deals for your trip'}
        </p>
      </div>
    </div>
  );
};

export default SmartPricingPanel;
