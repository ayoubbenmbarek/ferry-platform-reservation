import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { Text, Card, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { fetchPorts, fetchRoutes } from '../../store/slices/searchSlice';
import { RootStackParamList, MainTabParamList } from '../../types';
import { colors, spacing, borderRadius } from '../../constants/theme';
import LiveFerryMap from '../../components/LiveFerryMap';

type NavigationProp = NativeStackNavigationProp<RootStackParamList & MainTabParamList>;

const { width } = Dimensions.get('window');

const popularRoutes = [
  { from: 'Tunis', to: 'Marseille', image: 'https://images.unsplash.com/photo-1544351427-e15ae217ed4c?w=400' },
  { from: 'Genoa', to: 'Tunis', image: 'https://images.unsplash.com/photo-1515542622106-78bda8ba0e5b?w=400' },
  { from: 'Marseille', to: 'Algiers', image: 'https://images.unsplash.com/photo-1499678329028-101435549a4e?w=400' },
];

export default function HomeScreen() {
  const { t } = useTranslation(['common', 'search']);
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);

  const features = [
    { icon: 'shield-checkmark', title: t('common:home.secureBooking', 'Secure Booking'), description: t('common:home.secureDesc', 'Safe payment processing') },
    { icon: 'pricetag', title: t('common:home.bestPrices', 'Best Prices'), description: t('common:home.pricesDesc', 'Compare all operators') },
    { icon: 'time', title: t('common:home.support', '24/7 Support'), description: t('common:home.supportDesc', "We're here to help") },
  ];

  useEffect(() => {
    dispatch(fetchPorts());
    dispatch(fetchRoutes());
  }, [dispatch]);

  const handleSearchPress = () => {
    navigation.navigate('Search');
  };

  const handleRoutePress = (from: string, to: string) => {
    // Navigate to search with pre-filled route
    navigation.navigate('Search', {
      prefillDeparture: from,
      prefillArrival: to,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.hero}>
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>{t('common:home.title', 'Book Your Ferry')}</Text>
            <Text style={styles.heroSubtitle}>
              {t('common:home.subtitle', 'Find the best ferry routes across the Mediterranean')}
            </Text>
            <Button
              mode="contained"
              onPress={handleSearchPress}
              style={styles.searchButton}
              contentStyle={styles.searchButtonContent}
              icon="magnify"
            >
              {t('common:home.searchButton', 'Search Ferries')}
            </Button>
          </View>
          <View style={styles.heroIcon}>
            <Ionicons name="boat" size={100} color={colors.primary} />
          </View>
        </View>

        {/* Quick Actions */}
        {!isAuthenticated && (
          <Card style={styles.promoCard}>
            <Card.Content style={styles.promoContent}>
              <View style={styles.promoIconContainer}>
                <Ionicons name="gift" size={28} color="#fff" />
              </View>
              <View style={styles.promoText}>
                <Text style={styles.promoTitle}>{t('common:home.promoTitle', 'Sign in for exclusive deals')}</Text>
                <Text style={styles.promoSubtitle}>{t('common:home.promoSubtitle', 'Members save up to 15%')}</Text>
              </View>
              <TouchableOpacity
                style={styles.promoButton}
                onPress={() => navigation.navigate('Auth')}
              >
                <Text style={styles.promoButtonText}>{t('common:common.signIn', 'Sign In')}</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.primary} />
              </TouchableOpacity>
            </Card.Content>
          </Card>
        )}

        {isAuthenticated && user && (
          <Card style={styles.welcomeCard}>
            <Card.Content>
              <Text style={styles.welcomeTitle}>{t('common:home.welcomeBack', 'Welcome back')}, {user.first_name}!</Text>
              <TouchableOpacity
                style={styles.bookingsLink}
                onPress={() => navigation.navigate('Bookings')}
              >
                <Text style={styles.bookingsLinkText}>{t('common:home.viewBookings', 'View your bookings')}</Text>
                <Ionicons name="arrow-forward" size={18} color={colors.primary} />
              </TouchableOpacity>
            </Card.Content>
          </Card>
        )}

        {/* Popular Routes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('common:home.popularRoutes', 'Popular Routes')}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.routesScroll}
          >
            {popularRoutes.map((route, index) => (
              <TouchableOpacity
                key={index}
                style={styles.routeCard}
                onPress={() => handleRoutePress(route.from, route.to)}
              >
                <View style={styles.routeImagePlaceholder}>
                  <Ionicons name="boat" size={40} color={colors.primary} />
                </View>
                <View style={styles.routeInfo}>
                  <Text style={styles.routeText}>
                    {route.from} → {route.to}
                  </Text>
                  <Text style={styles.routeSubtext}>From €49</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Live Ferry Tracker */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('common:home.liveFerryTracker', 'Live Ferry Tracker')}</Text>
          <View style={styles.mapContainer}>
            <LiveFerryMap mode="homepage" height={300} />
          </View>
          <Text style={styles.mapNote}>
            {t('common:home.liveFerryTrackerNote', 'Ferry positions update every 30 seconds. Tap a ferry for details.')}
          </Text>
        </View>

        {/* Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('common:home.whyBookWithUs', 'Why Book With Us')}</Text>
          <View style={styles.featuresGrid}>
            {features.map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <View style={styles.featureIcon}>
                  <Ionicons name={feature.icon as any} size={28} color={colors.primary} />
                </View>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Operators */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('common:home.ourPartners', 'Our Partners')}</Text>
          <View style={styles.operatorsGrid}>
            {['CTN', 'Corsica Linea', 'GNV', 'La Méridionale'].map((operator, index) => (
              <View key={index} style={styles.operatorBadge}>
                <Text style={styles.operatorText}>{operator}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Bottom Spacing */}
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
  hero: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  heroContent: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  heroSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 24,
  },
  heroIcon: {
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.3,
  },
  searchButton: {
    borderRadius: borderRadius.md,
  },
  searchButtonContent: {
    paddingVertical: spacing.xs,
  },
  promoCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    elevation: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  promoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  promoIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  promoText: {
    flex: 1,
  },
  promoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  promoSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  promoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  promoButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  welcomeCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  bookingsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  bookingsLinkText: {
    color: colors.primary,
    fontSize: 14,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  routesScroll: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  routeCard: {
    width: width * 0.6,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  routeImagePlaceholder: {
    height: 100,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeInfo: {
    padding: spacing.md,
  },
  routeText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  routeSubtext: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
    marginTop: spacing.xs,
  },
  featuresGrid: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  featureItem: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  featureIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  featureDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  operatorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  operatorBadge: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  operatorText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  mapContainer: {
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  mapNote: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
});
