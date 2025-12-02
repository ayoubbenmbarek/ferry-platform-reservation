import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../constants/theme';

export type AvailabilityType = 'passenger' | 'vehicle' | 'cabin';

interface AvailabilityBadgeProps {
  type: AvailabilityType;
  count: number;
  needed?: number;
  showNotifyButton?: boolean;
  onNotifyPress?: () => void;
  compact?: boolean;
}

// Thresholds for "limited" availability
const THRESHOLDS = {
  passenger: 10,
  vehicle: 5,
  cabin: 2,
};

// Icons for each type
const ICONS: Record<AvailabilityType, keyof typeof Ionicons.glyphMap> = {
  passenger: 'people-outline',
  vehicle: 'car-outline',
  cabin: 'bed-outline',
};

// Labels for each type
const LABELS: Record<AvailabilityType, string> = {
  passenger: 'seats',
  vehicle: 'spaces',
  cabin: 'cabins',
};

export default function AvailabilityBadge({
  type,
  count,
  needed = 1,
  showNotifyButton = true,
  onNotifyPress,
  compact = false,
}: AvailabilityBadgeProps) {
  const threshold = THRESHOLDS[type];
  const icon = ICONS[type];
  const label = LABELS[type];

  // Determine availability status
  const isUnavailable = count === 0 || count < needed;
  const isLimited = !isUnavailable && count <= threshold;
  const isAvailable = !isUnavailable && !isLimited;

  // Determine colors based on status
  const getStatusColors = () => {
    if (isUnavailable) {
      return {
        bg: '#FEE2E2',
        text: '#991B1B',
        icon: '#DC2626',
      };
    }
    if (isLimited) {
      return {
        bg: '#FEF3C7',
        text: '#92400E',
        icon: '#D97706',
      };
    }
    return {
      bg: '#D1FAE5',
      text: '#065F46',
      icon: '#059669',
    };
  };

  const statusColors = getStatusColors();

  // Get status text
  const getStatusText = () => {
    if (isUnavailable) {
      return 'Unavailable';
    }
    if (isLimited) {
      return `${count} left`;
    }
    return `${count} ${label}`;
  };

  const shouldShowNotify = showNotifyButton && (isUnavailable || isLimited) && onNotifyPress;

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={[styles.compactBadge, { backgroundColor: statusColors.bg }]}>
          <Ionicons name={icon} size={14} color={statusColors.icon} />
          <Text style={[styles.compactText, { color: statusColors.text }]}>
            {isUnavailable ? '0' : count}
          </Text>
        </View>
        {shouldShowNotify && (
          <TouchableOpacity
            style={styles.compactNotifyButton}
            onPress={onNotifyPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="notifications-outline" size={14} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.badge, { backgroundColor: statusColors.bg }]}>
        <Ionicons name={icon} size={16} color={statusColors.icon} />
        <Text style={[styles.statusText, { color: statusColors.text }]}>
          {getStatusText()}
        </Text>
      </View>

      {shouldShowNotify && (
        <TouchableOpacity
          style={styles.notifyButton}
          onPress={onNotifyPress}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications-outline" size={14} color={colors.primary} />
          <Text style={styles.notifyText}>Notify</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  notifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primary + '15',
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  notifyText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    gap: 3,
  },
  compactText: {
    fontSize: 11,
    fontWeight: '600',
  },
  compactNotifyButton: {
    padding: 2,
  },
});
