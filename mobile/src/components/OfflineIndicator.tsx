import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNetwork } from '../contexts/NetworkContext';
import { colors, spacing } from '../constants/theme';

interface OfflineIndicatorProps {
  showWhenOnline?: boolean;
  style?: object;
}

export default function OfflineIndicator({ showWhenOnline = false, style }: OfflineIndicatorProps) {
  const { isConnected, isSyncing, pendingOperationsCount } = useNetwork();
  const insets = useSafeAreaInsets();
  const slideAnim = React.useRef(new Animated.Value(-100)).current;

  React.useEffect(() => {
    const shouldShow = !isConnected || (showWhenOnline && pendingOperationsCount > 0);

    Animated.timing(slideAnim, {
      toValue: shouldShow ? 0 : -100,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isConnected, showWhenOnline, pendingOperationsCount]);

  if (isConnected && !showWhenOnline) {
    return null;
  }

  if (isConnected && pendingOperationsCount === 0) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        { paddingTop: insets.top + spacing.sm, transform: [{ translateY: slideAnim }] },
        !isConnected ? styles.offlineContainer : styles.syncingContainer,
        style,
      ]}
    >
      <Ionicons
        name={!isConnected ? 'cloud-offline-outline' : isSyncing ? 'sync' : 'cloud-upload-outline'}
        size={18}
        color={!isConnected ? '#92400E' : colors.primary}
      />
      <Text style={!isConnected ? styles.offlineText : styles.syncingText}>
        {!isConnected
          ? 'No internet connection'
          : isSyncing
          ? 'Syncing changes...'
          : `${pendingOperationsCount} pending change${pendingOperationsCount > 1 ? 's' : ''}`}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    zIndex: 1000,
  },
  offlineContainer: {
    backgroundColor: '#FEF3C7',
  },
  syncingContainer: {
    backgroundColor: colors.primary + '15',
  },
  offlineText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#92400E',
  },
  syncingText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
  },
});
