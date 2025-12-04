import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, addMonths, subMonths, startOfMonth, getDaysInMonth, getDay, isBefore, startOfDay, parseISO } from 'date-fns';
import { colors, spacing, borderRadius } from '../constants/theme';
import { pricingService, FareCalendarData, FareCalendarDay } from '../services/pricingService';

interface FareCalendarProps {
  departurePort: string;
  arrivalPort: string;
  passengers?: number;
  onDateSelect?: (date: string, price: number) => void;
  selectedDate?: string;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function FareCalendar({
  departurePort,
  arrivalPort,
  passengers = 1,
  onDateSelect,
  selectedDate,
}: FareCalendarProps) {
  // Initialize month based on selectedDate or current date
  const getInitialMonth = () => {
    if (selectedDate) {
      try {
        return startOfMonth(parseISO(selectedDate));
      } catch {
        return startOfMonth(new Date());
      }
    }
    return startOfMonth(new Date());
  };

  const [currentMonth, setCurrentMonth] = useState(getInitialMonth);
  const [calendarData, setCalendarData] = useState<FareCalendarData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update month when selectedDate changes from outside (e.g., from parent component)
  useEffect(() => {
    if (selectedDate) {
      try {
        const selectedMonth = startOfMonth(parseISO(selectedDate));
        setCurrentMonth(selectedMonth);
      } catch {
        // Invalid date format, ignore
      }
    }
  }, [selectedDate]);

  const fetchCalendarData = useCallback(async () => {
    if (!departurePort || !arrivalPort) return;

    setLoading(true);
    setError(null);

    try {
      const yearMonth = format(currentMonth, 'yyyy-MM');
      const data = await pricingService.getFareCalendar({
        departurePort,
        arrivalPort,
        yearMonth,
        passengers,
      });
      setCalendarData(data);
    } catch (err: any) {
      console.error('Failed to fetch fare calendar:', err);
      setError(err.response?.data?.detail || 'Failed to load prices');
    } finally {
      setLoading(false);
    }
  }, [departurePort, arrivalPort, currentMonth, passengers]);

  useEffect(() => {
    fetchCalendarData();
  }, [fetchCalendarData]);

  const handlePrevMonth = () => {
    const prevMonth = subMonths(currentMonth, 1);
    if (!isBefore(prevMonth, startOfMonth(new Date()))) {
      setCurrentMonth(prevMonth);
    }
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleDatePress = (day: FareCalendarDay, dayDate: Date) => {
    if (!day.available || day.price === null) return;

    // Don't allow selecting past dates
    const today = startOfDay(new Date());
    if (isBefore(dayDate, today)) return;

    const dateStr = format(dayDate, 'yyyy-MM-dd');
    onDateSelect?.(dateStr, day.price);
  };

  const getPriceColors = (priceLevel: string): { bg: string; text: string; border: string } => {
    switch (priceLevel) {
      case 'cheap':
        return { bg: '#DCFCE7', text: '#166534', border: '#86EFAC' };
      case 'expensive':
        return { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' };
      default:
        return { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE' };
    }
  };

  const renderTrendIcon = (trend: string) => {
    switch (trend) {
      case 'rising':
        return <Ionicons name="trending-up" size={10} color="#EF4444" />;
      case 'falling':
        return <Ionicons name="trending-down" size={10} color="#22C55E" />;
      default:
        return null;
    }
  };

  const isPrevDisabled = isBefore(subMonths(currentMonth, 1), startOfMonth(new Date()));

  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDayOfMonth = getDay(startOfMonth(currentMonth));

    // Adjust for Monday start (0 = Monday, 6 = Sunday)
    const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

    const days: React.ReactElement[] = [];

    // Empty cells for days before the first day of the month
    for (let i = 0; i < adjustedFirstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }

    // Days of the month
    const today = startOfDay(new Date());

    for (let day = 1; day <= daysInMonth; day++) {
      const dayDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const dayData = calendarData?.days.find((d) => d.day === day);
      const dateStr = format(dayDate, 'yyyy-MM-dd');
      const isSelected = selectedDate === dateStr;
      const isPast = isBefore(dayDate, today);

      // Show as disabled if no data, not available, no price, or past date
      if (!dayData || !dayData.available || dayData.price === null || isPast) {
        days.push(
          <View key={day} style={[styles.dayCell, styles.dayCellDisabled]}>
            <Text style={styles.dayTextDisabled}>{day}</Text>
            {dayData && !isPast && <Text style={styles.naText}>N/A</Text>}
          </View>
        );
      } else {
        const priceColors = getPriceColors(dayData.price_level);

        days.push(
          <TouchableOpacity
            key={day}
            style={[
              styles.dayCell,
              {
                backgroundColor: priceColors.bg,
                borderColor: isSelected ? colors.primary : priceColors.border,
                borderWidth: isSelected ? 2 : 1,
              },
            ]}
            onPress={() => handleDatePress(dayData, dayDate)}
          >
            <View style={styles.dayHeader}>
              <Text style={[styles.dayText, { color: priceColors.text }]}>{day}</Text>
              {dayData.trend && renderTrendIcon(dayData.trend)}
            </View>
            <Text style={[styles.priceText, { color: priceColors.text }]}>{dayData.price}€</Text>
            <Text style={styles.ferriesText}>{dayData.num_ferries} ferries</Text>
          </TouchableOpacity>
        );
      }
    }

    return days;
  };

  const formatPortName = (port: string) => port.charAt(0).toUpperCase() + port.slice(1);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handlePrevMonth}
          disabled={isPrevDisabled}
          style={[styles.navButton, isPrevDisabled && styles.navButtonDisabled]}
        >
          <Ionicons name="chevron-back" size={24} color={isPrevDisabled ? '#9CA3AF' : '#fff'} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.monthText}>{format(currentMonth, 'MMMM yyyy')}</Text>
          <Text style={styles.routeText}>
            {formatPortName(departurePort)} to {formatPortName(arrivalPort)}
          </Text>
        </View>

        <TouchableOpacity onPress={handleNextMonth} style={styles.navButton}>
          <Ionicons name="chevron-forward" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#DCFCE7' }]} />
          <Text style={styles.legendText}>Cheap</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#EFF6FF' }]} />
          <Text style={styles.legendText}>Normal</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FEE2E2' }]} />
          <Text style={styles.legendText}>Expensive</Text>
        </View>
      </View>

      {/* Calendar Grid */}
      <View style={styles.calendarContainer}>
        {/* Day Headers */}
        <View style={styles.dayNamesRow}>
          {DAY_NAMES.map((day) => (
            <Text key={day} style={styles.dayName}>
              {day}
            </Text>
          ))}
        </View>

        {/* Days */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={fetchCalendarData}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.daysGrid}>{renderCalendarDays()}</View>
        )}
      </View>

      {/* Summary */}
      {calendarData && !loading && !error && calendarData.summary.min_price && (
        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Lowest</Text>
            <Text style={[styles.summaryValue, { color: '#16A34A' }]}>
              {calendarData.summary.min_price}€
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Average</Text>
            <Text style={[styles.summaryValue, { color: '#2563EB' }]}>
              {calendarData.summary.avg_price}€
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Highest</Text>
            <Text style={[styles.summaryValue, { color: '#DC2626' }]}>
              {calendarData.summary.max_price}€
            </Text>
          </View>
        </View>
      )}

      {calendarData?.summary.cheapest_date && !loading && !error && (
        <Text style={styles.cheapestDateText}>
          Cheapest date: <Text style={styles.cheapestDateValue}>{calendarData.summary.cheapest_date}</Text>
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  navButton: {
    padding: spacing.xs,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  headerCenter: {
    alignItems: 'center',
  },
  monthText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  routeText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  legendText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  calendarContainer: {
    padding: spacing.sm,
  },
  dayNamesRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  dayName: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 0.85,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    marginBottom: 2,
  },
  dayCellDisabled: {
    backgroundColor: '#F3F4F6',
    opacity: 0.5,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  dayText: {
    fontSize: 11,
    fontWeight: '600',
  },
  dayTextDisabled: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  priceText: {
    fontSize: 13,
    fontWeight: '700',
  },
  ferriesText: {
    fontSize: 8,
    color: '#6B7280',
  },
  naText: {
    fontSize: 9,
    color: '#9CA3AF',
  },
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#EF4444',
    marginBottom: spacing.sm,
  },
  retryText: {
    color: colors.primary,
    fontWeight: '600',
  },
  summary: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  cheapestDateText: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textSecondary,
    paddingVertical: spacing.sm,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cheapestDateValue: {
    fontWeight: '600',
    color: '#16A34A',
  },
});
