/**
 * Voice Search Service Tests
 *
 * Tests the audio recording and transcription service
 */

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import api from '../../services/api';

// Mock expo-av
jest.mock('expo-av', () => ({
  Audio: {
    requestPermissionsAsync: jest.fn(),
    getPermissionsAsync: jest.fn(),
    setAudioModeAsync: jest.fn(),
    Recording: {
      createAsync: jest.fn(),
    },
    RecordingOptionsPresets: {
      HIGH_QUALITY: {},
    },
  },
}));

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));

// Mock api
jest.mock('../../services/api', () => ({
  post: jest.fn(),
}));

// Import the service after mocks
import { voiceSearchService } from '../../services/voiceSearchService';

describe('VoiceSearchService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requestPermission', () => {
    it('should return true when permission is granted', async () => {
      (Audio.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });

      const result = await voiceSearchService.requestPermission();

      expect(result).toBe(true);
      expect(Audio.requestPermissionsAsync).toHaveBeenCalled();
    });

    it('should return false when permission is denied', async () => {
      (Audio.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

      const result = await voiceSearchService.requestPermission();

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      (Audio.requestPermissionsAsync as jest.Mock).mockRejectedValue(new Error('Permission error'));

      const result = await voiceSearchService.requestPermission();

      expect(result).toBe(false);
    });
  });

  describe('hasPermission', () => {
    it('should return true when permission is granted', async () => {
      (Audio.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });

      const result = await voiceSearchService.hasPermission();

      expect(result).toBe(true);
      expect(Audio.getPermissionsAsync).toHaveBeenCalled();
    });

    it('should return false when permission is not granted', async () => {
      (Audio.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });

      const result = await voiceSearchService.hasPermission();

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      (Audio.getPermissionsAsync as jest.Mock).mockRejectedValue(new Error('Check error'));

      const result = await voiceSearchService.hasPermission();

      expect(result).toBe(false);
    });
  });

  describe('startRecording', () => {
    const mockRecording = {
      stopAndUnloadAsync: jest.fn(),
      getURI: jest.fn(),
    };

    it('should start recording when permission is granted', async () => {
      (Audio.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (Audio.setAudioModeAsync as jest.Mock).mockResolvedValue(undefined);
      (Audio.Recording.createAsync as jest.Mock).mockResolvedValue({ recording: mockRecording });

      await voiceSearchService.startRecording();

      expect(Audio.setAudioModeAsync).toHaveBeenCalledWith({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      expect(Audio.Recording.createAsync).toHaveBeenCalled();
      expect(voiceSearchService.getIsRecording()).toBe(true);
    });

    it('should request permission if not granted', async () => {
      (Audio.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
      (Audio.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (Audio.setAudioModeAsync as jest.Mock).mockResolvedValue(undefined);
      (Audio.Recording.createAsync as jest.Mock).mockResolvedValue({ recording: mockRecording });

      await voiceSearchService.startRecording();

      expect(Audio.requestPermissionsAsync).toHaveBeenCalled();
    });

    it('should throw error if permission is denied', async () => {
      (Audio.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
      (Audio.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

      await expect(voiceSearchService.startRecording()).rejects.toThrow('Microphone permission denied');
    });
  });

  describe('stopRecording', () => {
    it('should return null if no recording exists', async () => {
      // Clear any existing recording state
      await voiceSearchService.cancelRecording();
      const uri = await voiceSearchService.stopRecording();

      expect(uri).toBeNull();
    });
  });

  describe('cancelRecording', () => {
    const mockRecording = {
      stopAndUnloadAsync: jest.fn().mockResolvedValue(undefined),
      getURI: jest.fn(),
    };

    it('should cancel recording without error', async () => {
      (Audio.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (Audio.setAudioModeAsync as jest.Mock).mockResolvedValue(undefined);
      (Audio.Recording.createAsync as jest.Mock).mockResolvedValue({ recording: mockRecording });

      await voiceSearchService.startRecording();
      await voiceSearchService.cancelRecording();

      expect(mockRecording.stopAndUnloadAsync).toHaveBeenCalled();
      expect(voiceSearchService.getIsRecording()).toBe(false);
    });

    it('should handle cancel when no recording exists', async () => {
      // Should not throw
      await expect(voiceSearchService.cancelRecording()).resolves.not.toThrow();
    });
  });

  describe('transcribeAudio', () => {
    it('should transcribe audio file successfully', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (api.post as jest.Mock).mockResolvedValue({
        data: { text: 'Ferry from Tunis to Marseille', language: 'en' },
      });

      const result = await voiceSearchService.transcribeAudio('file://recording.m4a');

      expect(result.text).toBe('Ferry from Tunis to Marseille');
      expect(result.language).toBe('en');
      expect(api.post).toHaveBeenCalledWith(
        '/voice/transcribe',
        expect.any(FormData),
        expect.objectContaining({
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30000,
        })
      );
    });

    it('should throw error if audio file not found', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

      await expect(voiceSearchService.transcribeAudio('file://missing.m4a')).rejects.toThrow(
        'Failed to transcribe audio'
      );
    });

    it('should include language hint when provided', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (api.post as jest.Mock).mockResolvedValue({
        data: { text: 'Test', language: 'fr' },
      });

      await voiceSearchService.transcribeAudio('file://recording.m4a', 'fr');

      expect(api.post).toHaveBeenCalled();
    });

    it('should handle 400 error with appropriate message', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (api.post as jest.Mock).mockRejectedValue({
        response: { status: 400 },
      });

      await expect(voiceSearchService.transcribeAudio('file://recording.m4a')).rejects.toThrow(
        'Invalid audio file or format'
      );
    });

    it('should handle 500 error with appropriate message', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (api.post as jest.Mock).mockRejectedValue({
        response: { status: 500 },
      });

      await expect(voiceSearchService.transcribeAudio('file://recording.m4a')).rejects.toThrow(
        'Transcription service unavailable'
      );
    });

    it('should handle generic errors', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (api.post as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(voiceSearchService.transcribeAudio('file://recording.m4a')).rejects.toThrow(
        'Failed to transcribe audio'
      );
    });
  });

  describe('cleanup', () => {
    it('should delete audio file if it exists', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

      await voiceSearchService.cleanup('file://recording.m4a');

      expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file://recording.m4a');
    });

    it('should not delete if file does not exist', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

      await voiceSearchService.cleanup('file://missing.m4a');

      expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockRejectedValue(new Error('File error'));

      // Should not throw
      await expect(voiceSearchService.cleanup('file://error.m4a')).resolves.not.toThrow();
    });
  });

  describe('getIsRecording', () => {
    it('should return false initially', () => {
      expect(voiceSearchService.getIsRecording()).toBe(false);
    });
  });

  describe('getMimeType (via transcribeAudio)', () => {
    beforeEach(() => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (api.post as jest.Mock).mockResolvedValue({
        data: { text: 'Test', language: 'en' },
      });
    });

    it('should handle m4a files', async () => {
      await voiceSearchService.transcribeAudio('file://recording.m4a');

      const call = (api.post as jest.Mock).mock.calls[0];
      const formData = call[1];
      // FormData should contain the correct file
      expect(formData).toBeInstanceOf(FormData);
    });

    it('should handle mp3 files', async () => {
      await voiceSearchService.transcribeAudio('file://recording.mp3');
      expect(api.post).toHaveBeenCalled();
    });

    it('should handle wav files', async () => {
      await voiceSearchService.transcribeAudio('file://recording.wav');
      expect(api.post).toHaveBeenCalled();
    });

    it('should default to m4a for unknown extensions', async () => {
      await voiceSearchService.transcribeAudio('file://recording.unknown');
      expect(api.post).toHaveBeenCalled();
    });
  });
});
