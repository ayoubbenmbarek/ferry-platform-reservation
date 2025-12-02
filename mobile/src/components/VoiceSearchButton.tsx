/**
 * Voice Search Button Component
 * Provides voice search functionality with visual feedback
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  Pressable,
  Alert,
  Platform,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { voiceSearchService } from '../services/voiceSearchService';
import { parseVoiceSearch, getQuerySummary, ParsedSearchQuery } from '../utils/voiceSearchParser';

// Design tokens
const colors = {
  primary: '#0066CC',
  primaryLight: '#E6F0FA',
  error: '#DC3545',
  errorLight: '#FEE2E2',
  success: '#28A745',
  successLight: '#D4EDDA',
  text: '#1A1A1A',
  textSecondary: '#6B7280',
  background: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.5)',
  recording: '#DC3545',
};

const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

interface VoiceSearchButtonProps {
  onResult: (result: ParsedSearchQuery) => void;
  onError?: (error: string) => void;
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
}

type RecordingState = 'idle' | 'recording' | 'processing' | 'success' | 'error';

const VoiceSearchButton: React.FC<VoiceSearchButtonProps> = ({
  onResult,
  onError,
  size = 'medium',
  disabled = false,
}) => {
  const [state, setState] = useState<RecordingState>('idle');
  const [transcribedText, setTranscribedText] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);
  const durationInterval = useRef<NodeJS.Timeout | null>(null);

  // Button sizes
  const buttonSizes = {
    small: 40,
    medium: 48,
    large: 56,
  };

  const iconSizes = {
    small: 20,
    medium: 24,
    large: 28,
  };

  // Pulse animation for recording state
  useEffect(() => {
    if (state === 'recording') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [state, pulseAnim]);

  // Duration timer for recording
  useEffect(() => {
    if (state === 'recording') {
      setRecordingDuration(0);
      durationInterval.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }
    }

    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    };
  }, [state]);

  const handlePress = async () => {
    if (disabled) return;

    if (state === 'recording') {
      await stopRecording();
    } else if (state === 'idle' || state === 'error' || state === 'success') {
      await startRecording();
    }
  };

  const startRecording = async () => {
    try {
      // Check/request permission
      const hasPermission = await voiceSearchService.hasPermission();
      if (!hasPermission) {
        const granted = await voiceSearchService.requestPermission();
        if (!granted) {
          Alert.alert(
            'Microphone Permission Required',
            'Please enable microphone access in your device settings to use voice search.',
            [{ text: 'OK' }]
          );
          return;
        }
      }

      setShowModal(true);
      setState('recording');
      setErrorMessage('');
      setTranscribedText('');

      await voiceSearchService.startRecording();

      // Auto-stop after 10 seconds
      recordingTimer.current = setTimeout(() => {
        stopRecording();
      }, 10000);
    } catch (error: any) {
      console.error('Error starting recording:', error);
      setState('error');
      setErrorMessage(error.message || 'Failed to start recording');
      onError?.(error.message || 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (recordingTimer.current) {
      clearTimeout(recordingTimer.current);
      recordingTimer.current = null;
    }

    if (state !== 'recording') return;

    // Check minimum duration (0.5 seconds)
    if (recordingDuration < 1) {
      setState('error');
      setErrorMessage('Recording too short. Please try again.');
      await voiceSearchService.cancelRecording();
      return;
    }

    setState('processing');

    try {
      const audioUri = await voiceSearchService.stopRecording();

      if (!audioUri) {
        throw new Error('No audio recorded');
      }

      // Transcribe the audio
      const { text, language } = await voiceSearchService.transcribeAudio(audioUri);

      if (!text || text.trim().length === 0) {
        throw new Error('No speech detected. Please try again.');
      }

      setTranscribedText(text);

      // Parse the transcribed text
      const parsedResult = parseVoiceSearch(text, language);

      setState('success');

      // Clean up audio file
      await voiceSearchService.cleanup(audioUri);

      // Wait a moment to show success state, then close modal and return result
      setTimeout(() => {
        setShowModal(false);
        setState('idle');
        onResult(parsedResult);
      }, 1500);
    } catch (error: any) {
      console.error('Error processing recording:', error);
      setState('error');
      setErrorMessage(error.message || 'Failed to process recording');
      onError?.(error.message || 'Failed to process recording');
    }
  };

  const cancelRecording = async () => {
    if (recordingTimer.current) {
      clearTimeout(recordingTimer.current);
      recordingTimer.current = null;
    }

    await voiceSearchService.cancelRecording();
    setState('idle');
    setShowModal(false);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStateIcon = (): keyof typeof Ionicons.glyphMap => {
    switch (state) {
      case 'recording':
        return 'stop';
      case 'processing':
        return 'mic';
      case 'success':
        return 'checkmark-circle';
      case 'error':
        return 'alert-circle';
      default:
        return 'mic';
    }
  };

  const getStateColor = (): string => {
    switch (state) {
      case 'recording':
        return colors.recording;
      case 'success':
        return colors.success;
      case 'error':
        return colors.error;
      default:
        return colors.primary;
    }
  };

  return (
    <>
      <Animated.View style={{ transform: [{ scale: state === 'recording' ? pulseAnim : 1 }] }}>
        <TouchableOpacity
          onPress={handlePress}
          disabled={disabled || state === 'processing'}
          style={[
            styles.button,
            {
              width: buttonSizes[size],
              height: buttonSizes[size],
              backgroundColor: disabled ? colors.textSecondary : getStateColor(),
            },
          ]}
          activeOpacity={0.7}
        >
          {state === 'processing' ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <Ionicons
              name={getStateIcon()}
              size={iconSizes[size]}
              color={colors.background}
            />
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Recording Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={cancelRecording}
      >
        <Pressable style={styles.modalOverlay} onPress={cancelRecording}>
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            {/* Recording indicator */}
            {state === 'recording' && (
              <View style={styles.recordingContainer}>
                <Animated.View
                  style={[
                    styles.recordingPulse,
                    { transform: [{ scale: pulseAnim }] },
                  ]}
                />
                <View style={styles.recordingDot} />
                <Text style={styles.recordingText}>Listening...</Text>
                <Text style={styles.durationText}>{formatDuration(recordingDuration)}</Text>
                <Text style={styles.hintText}>Tap to stop recording</Text>
              </View>
            )}

            {/* Processing indicator */}
            {state === 'processing' && (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.processingText}>Processing your request...</Text>
              </View>
            )}

            {/* Success state */}
            {state === 'success' && (
              <View style={styles.successContainer}>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark-circle" size={48} color={colors.success} />
                </View>
                <Text style={styles.transcribedText}>"{transcribedText}"</Text>
                <Text style={styles.successText}>Search query detected!</Text>
              </View>
            )}

            {/* Error state */}
            {state === 'error' && (
              <View style={styles.errorContainer}>
                <View style={styles.errorIcon}>
                  <Ionicons name="alert-circle" size={48} color={colors.error} />
                </View>
                <Text style={styles.errorText}>{errorMessage}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => {
                    setState('idle');
                    startRecording();
                  }}
                >
                  <Text style={styles.retryButtonText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Cancel button for recording/processing */}
            {(state === 'recording' || state === 'processing') && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={cancelRecording}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}

            {/* Close button for error state */}
            {state === 'error' && (
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setState('idle');
                  setShowModal(false);
                }}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  recordingContainer: {
    alignItems: 'center',
  },
  recordingPulse: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.errorLight,
  },
  recordingDot: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.recording,
    marginBottom: spacing.md,
  },
  recordingText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  durationText: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.recording,
    marginBottom: spacing.sm,
  },
  hintText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  processingContainer: {
    alignItems: 'center',
  },
  processingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  successContainer: {
    alignItems: 'center',
  },
  successIcon: {
    marginBottom: spacing.md,
  },
  transcribedText: {
    fontSize: 16,
    fontStyle: 'italic',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  successText: {
    fontSize: 14,
    color: colors.success,
    fontWeight: '600',
  },
  errorContainer: {
    alignItems: 'center',
  },
  errorIcon: {
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
  },
  retryButtonText: {
    color: colors.background,
    fontWeight: '600',
    fontSize: 14,
  },
  cancelButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  closeButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  closeButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});

export default VoiceSearchButton;
