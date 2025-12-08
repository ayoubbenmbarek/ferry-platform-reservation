import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { colors } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RunningBearProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  fullScreen?: boolean;
}

const RunningBear: React.FC<RunningBearProps> = ({
  message = 'Loading...',
  size = 'medium',
  fullScreen = true,
}) => {
  // Animation values
  const shipPosition = useRef(new Animated.Value(-60)).current;
  const bearRotation = useRef(new Animated.Value(0)).current;
  const luggageBounce = useRef(new Animated.Value(0)).current;
  const seagull1Position = useRef(new Animated.Value(-30)).current;
  const seagull2Position = useRef(new Animated.Value(SCREEN_WIDTH + 30)).current;
  const waveOffset = useRef(new Animated.Value(0)).current;
  const wave1Y = useRef(new Animated.Value(0)).current;
  const wave2Y = useRef(new Animated.Value(0)).current;
  const wave3Y = useRef(new Animated.Value(0)).current;
  const dotsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Ship sailing animation
    const shipAnimation = Animated.loop(
      Animated.timing(shipPosition, {
        toValue: SCREEN_WIDTH + 60,
        duration: 6000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );

    // Bear looking around animation
    const bearAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(bearRotation, {
          toValue: -5,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bearRotation, {
          toValue: 5,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bearRotation, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    // Luggage bounce animation
    const luggageAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(luggageBounce, {
          toValue: -3,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(luggageBounce, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    // Seagull 1 animation
    const seagull1Animation = Animated.loop(
      Animated.timing(seagull1Position, {
        toValue: SCREEN_WIDTH + 30,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // Seagull 2 animation
    const seagull2Animation = Animated.loop(
      Animated.timing(seagull2Position, {
        toValue: -30,
        duration: 10000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // Wave pattern scroll animation
    const waveAnimation = Animated.loop(
      Animated.timing(waveOffset, {
        toValue: 40,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // Wave decorations float animation
    const createWaveFloat = (animValue: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(animValue, {
            toValue: -4,
            duration: 750,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0,
            duration: 750,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );

    // Loading dots animation
    const dotsAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(dotsOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(dotsOpacity, { toValue: 2, duration: 500, useNativeDriver: true }),
        Animated.timing(dotsOpacity, { toValue: 3, duration: 500, useNativeDriver: true }),
        Animated.timing(dotsOpacity, { toValue: 0, duration: 100, useNativeDriver: true }),
      ])
    );

    // Start all animations
    shipAnimation.start();
    bearAnimation.start();
    luggageAnimation.start();
    seagull1Animation.start();
    seagull2Animation.start();
    waveAnimation.start();
    createWaveFloat(wave1Y, 0).start();
    createWaveFloat(wave2Y, 200).start();
    createWaveFloat(wave3Y, 400).start();
    dotsAnimation.start();

    return () => {
      shipAnimation.stop();
      bearAnimation.stop();
      luggageAnimation.stop();
      seagull1Animation.stop();
      seagull2Animation.stop();
      waveAnimation.stop();
      dotsAnimation.stop();
    };
  }, []);

  const bearRotationStyle = {
    transform: [
      {
        rotate: bearRotation.interpolate({
          inputRange: [-5, 5],
          outputRange: ['-5deg', '5deg'],
        }),
      },
    ],
  };

  const containerStyle = fullScreen ? styles.fullScreenContainer : styles.inlineContainer;

  // Get dots string based on animation value
  const getDots = () => {
    const val = Math.floor((dotsOpacity as any)._value || 0);
    return '.'.repeat(val);
  };

  return (
    <View style={containerStyle}>
      <View style={styles.content}>
        {/* Scene container */}
        <View style={styles.sceneContainer}>
          {/* Ship sailing in background */}
          <Animated.Text
            style={[
              styles.ship,
              { transform: [{ translateX: shipPosition }] },
            ]}
          >
            🚢
          </Animated.Text>

          {/* Captain bear with luggage - stationary in center */}
          <View style={styles.bearContainer}>
            <Animated.Text
              style={[
                styles.luggage,
                { transform: [{ translateY: luggageBounce }] },
              ]}
            >
              🧳
            </Animated.Text>
            <View style={styles.bearWithHat}>
              <Text style={styles.hat}>🎩</Text>
              <Animated.Text style={[styles.bear, bearRotationStyle]}>
                🐻
              </Animated.Text>
            </View>
          </View>

          {/* Water/waves at bottom */}
          <View style={styles.waterContainer}>
            <View style={styles.wavePattern} />
          </View>

          {/* Seagulls */}
          <Animated.Text
            style={[
              styles.seagull1,
              { transform: [{ translateX: seagull1Position }] },
            ]}
          >
            🕊️
          </Animated.Text>
          <Animated.Text
            style={[
              styles.seagull2,
              { transform: [{ translateX: seagull2Position }] },
            ]}
          >
            🕊️
          </Animated.Text>
        </View>

        {/* Loading text with animated dots */}
        <View style={styles.loadingTextContainer}>
          <Text style={styles.loadingText}>{message}</Text>
          <LoadingDots />
        </View>

        {/* Wave decorations */}
        <View style={styles.waveDecorations}>
          <Animated.Text
            style={[styles.waveEmoji, { transform: [{ translateY: wave1Y }] }]}
          >
            🌊
          </Animated.Text>
          <Animated.Text
            style={[styles.waveEmoji, { transform: [{ translateY: wave2Y }] }]}
          >
            🌊
          </Animated.Text>
          <Animated.Text
            style={[styles.waveEmoji, { transform: [{ translateY: wave3Y }] }]}
          >
            🌊
          </Animated.Text>
        </View>
      </View>
    </View>
  );
};

// Separate component for animated dots
const LoadingDots: React.FC = () => {
  const [dots, setDots] = React.useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev.length >= 3) return '';
        return prev + '.';
      });
    }, 400);

    return () => clearInterval(interval);
  }, []);

  return <Text style={styles.loadingDots}>{dots}</Text>;
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E0F2FE', // sky-100 equivalent
  },
  inlineContainer: {
    paddingVertical: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F9FF', // sky-50 equivalent
    borderRadius: 12,
  },
  content: {
    alignItems: 'center',
  },
  sceneContainer: {
    width: 300,
    height: 140,
    overflow: 'hidden',
    position: 'relative',
  },
  ship: {
    fontSize: 48,
    position: 'absolute',
    bottom: 32,
    left: 0,
  },
  bearContainer: {
    position: 'absolute',
    bottom: 16,
    left: '50%',
    marginLeft: -40,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  luggage: {
    fontSize: 32,
  },
  bearWithHat: {
    position: 'relative',
  },
  hat: {
    fontSize: 20,
    position: 'absolute',
    top: -12,
    left: '50%',
    marginLeft: -10,
    zIndex: 1,
  },
  bear: {
    fontSize: 44,
  },
  waterContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 24,
    backgroundColor: 'rgba(96, 165, 250, 0.3)', // blue-400 with opacity
  },
  wavePattern: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.4)',
  },
  seagull1: {
    fontSize: 18,
    position: 'absolute',
    top: 8,
  },
  seagull2: {
    fontSize: 16,
    position: 'absolute',
    top: 24,
  },
  loadingTextContainer: {
    flexDirection: 'row',
    marginTop: 16,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  loadingDots: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.textSecondary,
    width: 24,
  },
  waveDecorations: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  waveEmoji: {
    fontSize: 20,
    opacity: 0.6,
  },
});

export default RunningBear;
