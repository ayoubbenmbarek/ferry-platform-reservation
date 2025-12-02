import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Linking, Platform } from 'react-native';
import { Text, Switch, Card, Button, Divider, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useNotifications } from '../contexts/NotificationContext';
import { notificationService } from '../services/notificationService';
import { colors, spacing, borderRadius } from '../constants/theme';

interface SettingRowProps {
  icon: string;
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

function SettingRow({ icon, title, description, value, onValueChange, disabled }: SettingRowProps) {
  return (
    <View style={[styles.settingRow, disabled && styles.settingRowDisabled]}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon as any} size={22} color={disabled ? colors.disabled : colors.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, disabled && styles.textDisabled]}>{title}</Text>
        <Text style={[styles.settingDescription, disabled && styles.textDisabled]}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        color={colors.primary}
      />
    </View>
  );
}

export default function NotificationSettingsScreen() {
  const { hasPermission, settings, updateSettings, requestPermissions } = useNotifications();
  const [isLoading, setIsLoading] = useState(false);
  const [scheduledCount, setScheduledCount] = useState(0);

  useEffect(() => {
    loadScheduledCount();
  }, []);

  const loadScheduledCount = async () => {
    const scheduled = await notificationService.getScheduledNotifications();
    setScheduledCount(scheduled.length);
  };

  const handleEnableNotifications = async () => {
    setIsLoading(true);
    const granted = await requestPermissions();
    setIsLoading(false);

    if (!granted) {
      Alert.alert(
        'Permission Required',
        'Please enable notifications in your device settings to receive booking updates and reminders.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
  };

  const handleToggleSetting = async (key: keyof typeof settings, value: boolean) => {
    await updateSettings({ [key]: value });
    loadScheduledCount();
  };

  const handleClearAllNotifications = () => {
    Alert.alert(
      'Clear All Notifications',
      'This will cancel all scheduled departure reminders. You will need to view your bookings again to reschedule them.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await notificationService.cancelAllNotifications();
            setScheduledCount(0);
            Alert.alert('Done', 'All scheduled notifications have been cleared.');
          },
        },
      ]
    );
  };

  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.permissionContainer}>
          <View style={styles.permissionIcon}>
            <Ionicons name="notifications-off" size={60} color={colors.textSecondary} />
          </View>
          <Text style={styles.permissionTitle}>Notifications Disabled</Text>
          <Text style={styles.permissionDescription}>
            Enable notifications to receive booking confirmations, departure reminders, and price alerts.
          </Text>
          <Button
            mode="contained"
            onPress={handleEnableNotifications}
            loading={isLoading}
            style={styles.enableButton}
            icon="bell"
          >
            Enable Notifications
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Master Toggle */}
        <Card style={styles.section}>
          <Card.Content>
            <SettingRow
              icon="notifications"
              title="All Notifications"
              description="Master toggle for all notifications"
              value={settings.enabled}
              onValueChange={(value) => handleToggleSetting('enabled', value)}
            />
          </Card.Content>
        </Card>

        {/* Booking Notifications */}
        <Card style={styles.section}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Booking Updates</Text>

            <SettingRow
              icon="checkmark-circle"
              title="Booking Confirmations"
              description="Get notified when your booking is confirmed"
              value={settings.bookingConfirmations}
              onValueChange={(value) => handleToggleSetting('bookingConfirmations', value)}
              disabled={!settings.enabled}
            />

            <Divider style={styles.divider} />

            <SettingRow
              icon="time"
              title="24-Hour Reminder"
              description="Reminder one day before departure"
              value={settings.departureReminder24h}
              onValueChange={(value) => handleToggleSetting('departureReminder24h', value)}
              disabled={!settings.enabled}
            />

            <Divider style={styles.divider} />

            <SettingRow
              icon="alarm"
              title="2-Hour Reminder"
              description="Reminder 2 hours before departure"
              value={settings.departureReminder2h}
              onValueChange={(value) => handleToggleSetting('departureReminder2h', value)}
              disabled={!settings.enabled}
            />
          </Card.Content>
        </Card>

        {/* Marketing Notifications */}
        <Card style={styles.section}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Deals & Offers</Text>

            <SettingRow
              icon="pricetag"
              title="Price Alerts"
              description="Get notified when prices drop for saved routes"
              value={settings.priceAlerts}
              onValueChange={(value) => handleToggleSetting('priceAlerts', value)}
              disabled={!settings.enabled}
            />

            <Divider style={styles.divider} />

            <SettingRow
              icon="megaphone"
              title="Promotions"
              description="Special offers and seasonal deals"
              value={settings.promotions}
              onValueChange={(value) => handleToggleSetting('promotions', value)}
              disabled={!settings.enabled}
            />
          </Card.Content>
        </Card>

        {/* Scheduled Notifications Info */}
        <Card style={styles.section}>
          <Card.Content>
            <View style={styles.infoRow}>
              <Ionicons name="calendar" size={20} color={colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Scheduled Reminders</Text>
                <Text style={styles.infoValue}>
                  {scheduledCount} {scheduledCount === 1 ? 'reminder' : 'reminders'} scheduled
                </Text>
              </View>
            </View>

            {scheduledCount > 0 && (
              <Button
                mode="outlined"
                onPress={handleClearAllNotifications}
                style={styles.clearButton}
                textColor={colors.error}
              >
                Clear All Scheduled Reminders
              </Button>
            )}
          </Card.Content>
        </Card>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color={colors.textSecondary} />
          <Text style={styles.infoText}>
            Departure reminders are automatically scheduled when you book a trip. You can also manage notification permissions in your device settings.
          </Text>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  permissionIcon: {
    marginBottom: spacing.lg,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  permissionDescription: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  enableButton: {
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
  },
  section: {
    margin: spacing.md,
    marginBottom: 0,
    borderRadius: borderRadius.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  settingRowDisabled: {
    opacity: 0.5,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  settingDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  textDisabled: {
    color: colors.disabled,
  },
  divider: {
    marginVertical: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  infoValue: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  clearButton: {
    marginTop: spacing.md,
    borderColor: colors.error,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
