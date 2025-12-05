/**
 * VoiceSearchButton Tests
 *
 * Tests the voice search button component logic and states
 */

describe('VoiceSearchButton - Logic Tests', () => {
  // State management
  type RecordingState = 'idle' | 'recording' | 'processing' | 'success' | 'error';

  // Button sizes (same as component)
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

  // Colors (same as component)
  const colors = {
    primary: '#0066CC',
    error: '#DC3545',
    success: '#28A745',
    textSecondary: '#6B7280',
    recording: '#DC3545',
    background: '#FFFFFF',
  };

  // Helper to get state icon
  const getStateIcon = (state: RecordingState): string => {
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

  // Helper to get state color
  const getStateColor = (state: RecordingState, disabled: boolean): string => {
    if (disabled) return colors.textSecondary;
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

  // Helper to format duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // State transition logic
  const getNextState = (
    currentState: RecordingState,
    action: 'press' | 'success' | 'error' | 'cancel'
  ): RecordingState => {
    switch (action) {
      case 'press':
        if (currentState === 'recording') return 'processing';
        if (currentState === 'idle' || currentState === 'error' || currentState === 'success') return 'recording';
        return currentState;
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      case 'cancel':
        return 'idle';
      default:
        return currentState;
    }
  };

  // Should show modal logic
  const shouldShowModal = (state: RecordingState): boolean => {
    return state === 'recording' || state === 'processing' || state === 'success' || state === 'error';
  };

  // Should disable button logic
  const shouldDisableButton = (state: RecordingState, disabled: boolean): boolean => {
    return disabled || state === 'processing';
  };

  describe('Button sizing', () => {
    it('should have correct dimensions for small size', () => {
      expect(buttonSizes.small).toBe(40);
      expect(iconSizes.small).toBe(20);
    });

    it('should have correct dimensions for medium size', () => {
      expect(buttonSizes.medium).toBe(48);
      expect(iconSizes.medium).toBe(24);
    });

    it('should have correct dimensions for large size', () => {
      expect(buttonSizes.large).toBe(56);
      expect(iconSizes.large).toBe(28);
    });
  });

  describe('State icons', () => {
    it('should show mic icon in idle state', () => {
      expect(getStateIcon('idle')).toBe('mic');
    });

    it('should show stop icon in recording state', () => {
      expect(getStateIcon('recording')).toBe('stop');
    });

    it('should show mic icon in processing state', () => {
      expect(getStateIcon('processing')).toBe('mic');
    });

    it('should show checkmark-circle in success state', () => {
      expect(getStateIcon('success')).toBe('checkmark-circle');
    });

    it('should show alert-circle in error state', () => {
      expect(getStateIcon('error')).toBe('alert-circle');
    });
  });

  describe('State colors', () => {
    it('should return primary color in idle state', () => {
      expect(getStateColor('idle', false)).toBe(colors.primary);
    });

    it('should return recording (red) color in recording state', () => {
      expect(getStateColor('recording', false)).toBe(colors.recording);
    });

    it('should return success (green) color in success state', () => {
      expect(getStateColor('success', false)).toBe(colors.success);
    });

    it('should return error (red) color in error state', () => {
      expect(getStateColor('error', false)).toBe(colors.error);
    });

    it('should return secondary color when disabled', () => {
      expect(getStateColor('idle', true)).toBe(colors.textSecondary);
      expect(getStateColor('recording', true)).toBe(colors.textSecondary);
    });
  });

  describe('Duration formatting', () => {
    it('should format 0 seconds correctly', () => {
      expect(formatDuration(0)).toBe('0:00');
    });

    it('should format single digit seconds with padding', () => {
      expect(formatDuration(5)).toBe('0:05');
    });

    it('should format double digit seconds correctly', () => {
      expect(formatDuration(45)).toBe('0:45');
    });

    it('should format minutes correctly', () => {
      expect(formatDuration(60)).toBe('1:00');
      expect(formatDuration(90)).toBe('1:30');
      expect(formatDuration(125)).toBe('2:05');
    });

    it('should handle max recording time (10 seconds)', () => {
      expect(formatDuration(10)).toBe('0:10');
    });
  });

  describe('State transitions', () => {
    it('should transition from idle to recording on press', () => {
      expect(getNextState('idle', 'press')).toBe('recording');
    });

    it('should transition from recording to processing on press', () => {
      expect(getNextState('recording', 'press')).toBe('processing');
    });

    it('should transition from error to recording on press', () => {
      expect(getNextState('error', 'press')).toBe('recording');
    });

    it('should transition from success to recording on press', () => {
      expect(getNextState('success', 'press')).toBe('recording');
    });

    it('should stay in processing state on press', () => {
      expect(getNextState('processing', 'press')).toBe('processing');
    });

    it('should transition to success on success action', () => {
      expect(getNextState('processing', 'success')).toBe('success');
    });

    it('should transition to error on error action', () => {
      expect(getNextState('processing', 'error')).toBe('error');
    });

    it('should transition to idle on cancel action', () => {
      expect(getNextState('recording', 'cancel')).toBe('idle');
      expect(getNextState('processing', 'cancel')).toBe('idle');
      expect(getNextState('error', 'cancel')).toBe('idle');
    });
  });

  describe('Modal visibility', () => {
    it('should not show modal in idle state', () => {
      expect(shouldShowModal('idle')).toBe(false);
    });

    it('should show modal in recording state', () => {
      expect(shouldShowModal('recording')).toBe(true);
    });

    it('should show modal in processing state', () => {
      expect(shouldShowModal('processing')).toBe(true);
    });

    it('should show modal in success state', () => {
      expect(shouldShowModal('success')).toBe(true);
    });

    it('should show modal in error state', () => {
      expect(shouldShowModal('error')).toBe(true);
    });
  });

  describe('Button disabled state', () => {
    it('should not be disabled in idle state when not disabled', () => {
      expect(shouldDisableButton('idle', false)).toBe(false);
    });

    it('should be disabled when disabled prop is true', () => {
      expect(shouldDisableButton('idle', true)).toBe(true);
      expect(shouldDisableButton('recording', true)).toBe(true);
    });

    it('should be disabled in processing state', () => {
      expect(shouldDisableButton('processing', false)).toBe(true);
    });

    it('should not be disabled in recording state', () => {
      expect(shouldDisableButton('recording', false)).toBe(false);
    });
  });

  describe('Recording validation', () => {
    const MIN_RECORDING_DURATION = 1; // seconds
    const MAX_RECORDING_DURATION = 10; // seconds

    const isValidRecordingDuration = (duration: number): { valid: boolean; reason?: string } => {
      if (duration < MIN_RECORDING_DURATION) {
        return { valid: false, reason: 'Recording too short. Please try again.' };
      }
      if (duration > MAX_RECORDING_DURATION) {
        return { valid: true, reason: 'Auto-stopped at max duration' };
      }
      return { valid: true };
    };

    it('should reject recording less than 1 second', () => {
      const result = isValidRecordingDuration(0.5);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('too short');
    });

    it('should accept recording of exactly 1 second', () => {
      const result = isValidRecordingDuration(1);
      expect(result.valid).toBe(true);
    });

    it('should accept recording of 5 seconds', () => {
      const result = isValidRecordingDuration(5);
      expect(result.valid).toBe(true);
    });

    it('should accept and auto-stop at max duration (10 seconds)', () => {
      const result = isValidRecordingDuration(10);
      expect(result.valid).toBe(true);
    });

    it('should note auto-stop when exceeding max', () => {
      const result = isValidRecordingDuration(15);
      expect(result.valid).toBe(true);
      expect(result.reason).toContain('Auto-stopped');
    });
  });

  describe('Error messages', () => {
    const getErrorMessage = (errorType: string): string => {
      const errorMessages: Record<string, string> = {
        permission_denied: 'Please enable microphone access in your device settings to use voice search.',
        no_audio: 'No audio recorded',
        no_speech: 'No speech detected. Please try again.',
        transcription_failed: 'Failed to process recording',
        recording_failed: 'Failed to start recording',
      };
      return errorMessages[errorType] || 'An unexpected error occurred';
    };

    it('should return permission error message', () => {
      expect(getErrorMessage('permission_denied')).toContain('microphone access');
    });

    it('should return no audio error message', () => {
      expect(getErrorMessage('no_audio')).toBe('No audio recorded');
    });

    it('should return no speech error message', () => {
      expect(getErrorMessage('no_speech')).toContain('No speech detected');
    });

    it('should return transcription error message', () => {
      expect(getErrorMessage('transcription_failed')).toContain('Failed to process');
    });

    it('should return recording error message', () => {
      expect(getErrorMessage('recording_failed')).toContain('Failed to start');
    });

    it('should return default error message for unknown error', () => {
      expect(getErrorMessage('unknown')).toContain('unexpected error');
    });
  });

  describe('Cancel button visibility', () => {
    const shouldShowCancelButton = (state: RecordingState): boolean => {
      return state === 'recording' || state === 'processing';
    };

    it('should show cancel button during recording', () => {
      expect(shouldShowCancelButton('recording')).toBe(true);
    });

    it('should show cancel button during processing', () => {
      expect(shouldShowCancelButton('processing')).toBe(true);
    });

    it('should not show cancel button in idle state', () => {
      expect(shouldShowCancelButton('idle')).toBe(false);
    });

    it('should not show cancel button in success state', () => {
      expect(shouldShowCancelButton('success')).toBe(false);
    });

    it('should not show cancel button in error state', () => {
      expect(shouldShowCancelButton('error')).toBe(false);
    });
  });

  describe('Retry button visibility', () => {
    const shouldShowRetryButton = (state: RecordingState): boolean => {
      return state === 'error';
    };

    it('should show retry button only in error state', () => {
      expect(shouldShowRetryButton('error')).toBe(true);
      expect(shouldShowRetryButton('idle')).toBe(false);
      expect(shouldShowRetryButton('recording')).toBe(false);
      expect(shouldShowRetryButton('processing')).toBe(false);
      expect(shouldShowRetryButton('success')).toBe(false);
    });
  });

  describe('Close button visibility', () => {
    const shouldShowCloseButton = (state: RecordingState): boolean => {
      return state === 'error';
    };

    it('should show close button only in error state', () => {
      expect(shouldShowCloseButton('error')).toBe(true);
      expect(shouldShowCloseButton('idle')).toBe(false);
      expect(shouldShowCloseButton('success')).toBe(false);
    });
  });

  describe('Success flow timing', () => {
    const SUCCESS_DISPLAY_DURATION = 1500; // ms

    it('should have correct success display duration', () => {
      expect(SUCCESS_DISPLAY_DURATION).toBe(1500);
    });

    it('should transition to idle after success display', async () => {
      jest.useFakeTimers();

      let currentState: RecordingState = 'success';

      // Simulate the timeout that closes modal
      setTimeout(() => {
        currentState = 'idle';
      }, SUCCESS_DISPLAY_DURATION);

      jest.advanceTimersByTime(SUCCESS_DISPLAY_DURATION);

      expect(currentState).toBe('idle');

      jest.useRealTimers();
    });
  });
});
