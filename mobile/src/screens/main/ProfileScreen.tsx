import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Text, Avatar, Divider, Switch } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { logout } from '../../store/slices/authSlice';
import { selectActiveAlertCount, fetchUserAlerts } from '../../store/slices/alertSlice';
import { useNotifications } from '../../contexts/NotificationContext';
import { biometricService, BiometricStatus } from '../../services/biometricService';
import { RootStackParamList } from '../../types';
import { colors, spacing, borderRadius } from '../../constants/theme';
import { APP_NAME } from '../../constants/config';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface MenuItemProps {
  icon: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  danger?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({
  icon,
  title,
  subtitle,
  onPress,
  rightElement,
  danger,
}) => (
  <TouchableOpacity
    style={styles.menuItem}
    onPress={onPress}
    disabled={!onPress}
  >
    <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
      <Ionicons
        name={icon as any}
        size={22}
        color={danger ? colors.error : colors.primary}
      />
    </View>
    <View style={styles.menuContent}>
      <Text style={[styles.menuTitle, danger && styles.menuTitleDanger]}>
        {title}
      </Text>
      {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
    </View>
    {rightElement || (
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    )}
  </TouchableOpacity>
);

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();
  const { isAuthenticated, user, token } = useAppSelector((state) => state.auth);
  const activeAlertCount = useAppSelector(selectActiveAlertCount);
  const { settings, hasPermission } = useNotifications();

  // Fetch alerts on mount when authenticated
  React.useEffect(() => {
    if (isAuthenticated && user?.email) {
      dispatch(fetchUserAlerts({ email: user.email }));
    }
  }, [isAuthenticated, user?.email, dispatch]);

  const [biometricStatus, setBiometricStatus] = React.useState<BiometricStatus>({
    isAvailable: false,
    biometricType: 'none',
    isEnrolled: false,
    isEnabled: false,
  });
  const [isTogglingBiometric, setIsTogglingBiometric] = React.useState(false);

  // Check biometric status on mount and when auth changes
  React.useEffect(() => {
    const checkBiometric = async () => {
      const status = await biometricService.getStatus();
      setBiometricStatus(status);
    };
    checkBiometric();
  }, [isAuthenticated]);

  const handleToggleBiometric = async (enabled: boolean) => {
    if (!user || !token) return;

    setIsTogglingBiometric(true);
    try {
      if (enabled) {
        const success = await biometricService.enableBiometric(token, user.email);
        if (success) {
          setBiometricStatus((prev) => ({ ...prev, isEnabled: true }));
          Alert.alert(
            'Biometric Login Enabled',
            `You can now sign in with ${biometricService.getBiometricName(biometricStatus.biometricType)}.`
          );
        } else {
          Alert.alert('Setup Failed', 'Could not enable biometric login. Please try again.');
        }
      } else {
        const success = await biometricService.disableBiometric();
        if (success) {
          setBiometricStatus((prev) => ({ ...prev, isEnabled: false }));
        }
      }
    } catch (error) {
      console.error('Error toggling biometric:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsTogglingBiometric(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await dispatch(logout());
            // Navigate to Home tab after logout
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [
                  {
                    name: 'Main',
                    state: {
                      routes: [
                        { name: 'Home' },
                        { name: 'Search' },
                        { name: 'Bookings' },
                        { name: 'Profile' },
                      ],
                      index: 0, // Home tab
                    },
                  },
                ],
              })
            );
          },
        },
      ]
    );
  };

  const getInitials = () => {
    if (user) {
      return `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase();
    }
    return 'G';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

        {/* User Info */}
        <View style={styles.userSection}>
          <Avatar.Text
            size={80}
            label={getInitials()}
            style={styles.avatar}
          />
          {isAuthenticated && user ? (
            <>
              <Text style={styles.userName}>
                {user.first_name} {user.last_name}
              </Text>
              <Text style={styles.userEmail}>{user.email}</Text>
              {user.is_verified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              )}
            </>
          ) : (
            <>
              <Text style={styles.userName}>Guest User</Text>
              <TouchableOpacity
                style={styles.signInPrompt}
                onPress={() => navigation.navigate('Auth')}
              >
                <Text style={styles.signInText}>Sign in to manage your account</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.primary} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Account Section */}
        {isAuthenticated && (
          <>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.menuSection}>
              <MenuItem
                icon="person-outline"
                title="Personal Information"
                subtitle="Name, email, phone"
                onPress={() => {}}
              />
              <Divider style={styles.divider} />
              <MenuItem
                icon="card-outline"
                title="Payment Methods"
                subtitle="Manage your cards"
                onPress={() => {}}
              />
              <Divider style={styles.divider} />
              <MenuItem
                icon="lock-closed-outline"
                title="Security"
                subtitle="Password, 2FA"
                onPress={() => {}}
              />
              {biometricStatus.isAvailable && (
                <>
                  <Divider style={styles.divider} />
                  <MenuItem
                    icon={biometricStatus.biometricType === 'face' ? 'scan-outline' : 'finger-print-outline'}
                    title={biometricService.getBiometricName(biometricStatus.biometricType)}
                    subtitle={biometricStatus.isEnabled ? 'Enabled for quick sign in' : 'Enable for quick sign in'}
                    rightElement={
                      <Switch
                        value={biometricStatus.isEnabled}
                        onValueChange={handleToggleBiometric}
                        disabled={isTogglingBiometric}
                        color={colors.primary}
                      />
                    }
                  />
                </>
              )}
              <Divider style={styles.divider} />
              <MenuItem
                icon="notifications-outline"
                title="My Alerts"
                subtitle={activeAlertCount > 0 ? `${activeAlertCount} active alert${activeAlertCount !== 1 ? 's' : ''}` : 'Availability notifications'}
                onPress={() => navigation.navigate('MyAlerts')}
              />
            </View>
          </>
        )}

        {/* Preferences Section */}
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.menuSection}>
          <MenuItem
            icon="notifications-outline"
            title="Notifications"
            subtitle={hasPermission && settings.enabled ? 'On' : 'Off'}
            onPress={() => navigation.navigate('NotificationSettings')}
          />
          <Divider style={styles.divider} />
          <MenuItem
            icon="language-outline"
            title="Language"
            subtitle="English"
            onPress={() => {}}
          />
          <Divider style={styles.divider} />
          <MenuItem
            icon="cash-outline"
            title="Currency"
            subtitle="EUR (€)"
            onPress={() => {}}
          />
        </View>

        {/* Support Section */}
        <Text style={styles.sectionTitle}>Support</Text>
        <View style={styles.menuSection}>
          <MenuItem
            icon="help-circle-outline"
            title="Help Center"
            onPress={() => {}}
          />
          <Divider style={styles.divider} />
          <MenuItem
            icon="chatbubble-outline"
            title="Contact Us"
            onPress={() => {}}
          />
          <Divider style={styles.divider} />
          <MenuItem
            icon="document-text-outline"
            title="Terms of Service"
            onPress={() => {}}
          />
          <Divider style={styles.divider} />
          <MenuItem
            icon="shield-outline"
            title="Privacy Policy"
            onPress={() => {}}
          />
        </View>

        {/* Sign Out */}
        {isAuthenticated && (
          <View style={styles.menuSection}>
            <MenuItem
              icon="log-out-outline"
              title="Sign Out"
              onPress={handleLogout}
              danger
            />
          </View>
        )}

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appName}>{APP_NAME}</Text>
          <Text style={styles.appVersion}>Version 1.0.0</Text>
        </View>

        {/* Bottom spacing */}
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
  header: {
    padding: spacing.lg,
    paddingBottom: 0,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  userSection: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  avatar: {
    backgroundColor: colors.primary,
    marginBottom: spacing.md,
  },
  userName: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.text,
  },
  userEmail: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
  },
  verifiedText: {
    fontSize: 12,
    color: colors.success,
    fontWeight: '500',
  },
  signInPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  signInText: {
    color: colors.primary,
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  menuSection: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  menuIconDanger: {
    backgroundColor: '#FEE2E2',
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    color: colors.text,
  },
  menuTitleDanger: {
    color: colors.error,
  },
  menuSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    marginLeft: 72,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  appName: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  appVersion: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
});
