import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { Text, Card, Button, IconButton, Chip } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { paymentMethodService, PaymentMethod } from '../services/paymentMethodService';
import { colors, spacing, borderRadius } from '../constants/theme';
import LoadingScreen from '../components/LoadingScreen';

export default function PaymentMethodsScreen() {
  const navigation = useNavigation();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPaymentMethods = async () => {
    try {
      setError(null);
      const methods = await paymentMethodService.getPaymentMethods();
      setPaymentMethods(methods);
    } catch (err: any) {
      setError(err.message || 'Failed to load payment methods');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPaymentMethods();
    }, [])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchPaymentMethods();
  };

  const handleSetDefault = async (methodId: number) => {
    try {
      await paymentMethodService.setDefaultPaymentMethod(methodId);
      fetchPaymentMethods();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to set default payment method');
    }
  };

  const handleDelete = (method: PaymentMethod) => {
    Alert.alert(
      'Delete Payment Method',
      `Are you sure you want to remove ${paymentMethodService.formatCardDisplayName(method)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await paymentMethodService.deletePaymentMethod(method.id);
              fetchPaymentMethods();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete payment method');
            }
          },
        },
      ]
    );
  };

  const getCardBrandLogo = (brand: string | null) => {
    switch (brand?.toLowerCase()) {
      case 'visa':
        return '💳'; // In production, use actual brand logos
      case 'mastercard':
        return '💳';
      case 'amex':
        return '💳';
      default:
        return '💳';
    }
  };

  if (isLoading) {
    return <LoadingScreen message="Loading payment methods" />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={20} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {paymentMethods.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons name="card-outline" size={64} color={colors.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>No Payment Methods</Text>
            <Text style={styles.emptySubtitle}>
              Add a payment method to make checkout faster
            </Text>
          </View>
        ) : (
          <View style={styles.methodsList}>
            {paymentMethods.map((method) => {
              const isExpired = paymentMethodService.isCardExpired(method);

              return (
                <Card
                  key={method.id}
                  style={[
                    styles.methodCard,
                    method.is_default && styles.defaultCard,
                    isExpired && styles.expiredCard,
                  ]}
                >
                  <Card.Content>
                    <View style={styles.methodHeader}>
                      <View style={styles.cardInfo}>
                        <Text style={styles.cardBrandEmoji}>
                          {getCardBrandLogo(method.card_brand)}
                        </Text>
                        <View>
                          <Text style={styles.cardName}>
                            {paymentMethodService.formatCardDisplayName(method)}
                          </Text>
                          <Text style={styles.cardExpiry}>
                            Expires {paymentMethodService.formatExpiryDate(method)}
                            {isExpired && (
                              <Text style={styles.expiredText}> (Expired)</Text>
                            )}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.cardActions}>
                        {method.is_default ? (
                          <Chip
                            mode="flat"
                            style={styles.defaultChip}
                            textStyle={styles.defaultChipText}
                          >
                            Default
                          </Chip>
                        ) : (
                          <TouchableOpacity
                            style={styles.setDefaultButton}
                            onPress={() => handleSetDefault(method.id)}
                          >
                            <Text style={styles.setDefaultText}>Set Default</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    {method.billing_name && (
                      <View style={styles.billingInfo}>
                        <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
                        <Text style={styles.billingText}>{method.billing_name}</Text>
                      </View>
                    )}

                    <View style={styles.cardFooter}>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDelete(method)}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.error} />
                        <Text style={styles.deleteText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </Card.Content>
                </Card>
              );
            })}
          </View>
        )}

        {/* Info Section */}
        <View style={styles.infoSection}>
          <View style={styles.infoItem}>
            <Ionicons name="shield-checkmark-outline" size={24} color={colors.primary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Secure Storage</Text>
              <Text style={styles.infoText}>
                Your card details are encrypted and stored securely with Stripe
              </Text>
            </View>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="lock-closed-outline" size={24} color={colors.primary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>PCI Compliant</Text>
              <Text style={styles.infoText}>
                We never store your full card number on our servers
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Add Payment Method Button - Currently shown as info since adding requires Stripe Elements */}
      <View style={styles.addButtonContainer}>
        <Button
          mode="contained"
          icon="plus"
          onPress={() => {
            Alert.alert(
              'Add Payment Method',
              'To add a new payment method, complete a booking and select "Save this card for future payments" during checkout.',
              [{ text: 'OK' }]
            );
          }}
          style={styles.addButton}
          contentStyle={styles.addButtonContent}
        >
          Add Payment Method
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  errorText: {
    flex: 1,
    color: colors.error,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  methodsList: {
    gap: spacing.md,
  },
  methodCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
  },
  defaultCard: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  expiredCard: {
    opacity: 0.7,
  },
  methodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardBrandEmoji: {
    fontSize: 32,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  cardExpiry: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  expiredText: {
    color: colors.error,
    fontWeight: '600',
  },
  cardActions: {
    alignItems: 'flex-end',
  },
  defaultChip: {
    backgroundColor: colors.primary + '20',
  },
  defaultChipText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  setDefaultButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  setDefaultText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  billingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  billingText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  deleteText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '500',
  },
  infoSection: {
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  infoItem: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  infoText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  addButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  addButton: {
    borderRadius: borderRadius.md,
  },
  addButtonContent: {
    paddingVertical: spacing.xs,
  },
});
