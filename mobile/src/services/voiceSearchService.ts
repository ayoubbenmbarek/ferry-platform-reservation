/**
 * Voice Search Service
 * Handles audio recording and transcription via backend Whisper API
 */

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import api from './api';

export interface TranscriptionResponse {
  text: string;
  language: string;
}

class VoiceSearchService {
  private recording: Audio.Recording | null = null;
  private isRecording: boolean = false;

  /**
   * Request microphone permission
   */
  async requestPermission(): Promise<boolean> {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting microphone permission:', error);
      return false;
    }
  }

  /**
   * Check if microphone permission is granted
   */
  async hasPermission(): Promise<boolean> {
    try {
      const { status } = await Audio.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error checking microphone permission:', error);
      return false;
    }
  }

  /**
   * Start recording audio
   */
  async startRecording(): Promise<void> {
    try {
      // Check permission first
      const hasPermission = await this.hasPermission();
      if (!hasPermission) {
        const granted = await this.requestPermission();
        if (!granted) {
          throw new Error('Microphone permission denied');
        }
      }

      // Set audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Create recording with high quality settings
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      this.recording = recording;
      this.isRecording = true;
    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }

  /**
   * Stop recording and return the audio file URI
   */
  async stopRecording(): Promise<string | null> {
    if (!this.recording) {
      return null;
    }

    try {
      await this.recording.stopAndUnloadAsync();

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      const uri = this.recording.getURI();
      this.recording = null;
      this.isRecording = false;

      return uri;
    } catch (error) {
      console.error('Error stopping recording:', error);
      this.recording = null;
      this.isRecording = false;
      throw error;
    }
  }

  /**
   * Cancel recording without saving
   */
  async cancelRecording(): Promise<void> {
    if (this.recording) {
      try {
        await this.recording.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
        });
      } catch (error) {
        console.error('Error canceling recording:', error);
      }
      this.recording = null;
      this.isRecording = false;
    }
  }

  /**
   * Get recording status
   */
  getIsRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Transcribe audio file using backend Whisper API
   */
  async transcribeAudio(audioUri: string, language?: string): Promise<TranscriptionResponse> {
    try {
      // Read the file as base64
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      if (!fileInfo.exists) {
        throw new Error('Audio file not found');
      }

      // Get file extension from URI
      const extension = audioUri.split('.').pop() || 'm4a';
      const mimeType = this.getMimeType(extension);

      // Create form data
      const formData = new FormData();

      // Append the audio file
      formData.append('audio', {
        uri: audioUri,
        type: mimeType,
        name: `recording.${extension}`,
      } as any);

      // Add language hint if provided
      if (language) {
        formData.append('language', language);
      }

      // Send to backend for transcription
      const response = await api.post('/voice/transcribe', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000, // 30 second timeout for transcription
      });

      return {
        text: response.data.text || '',
        language: response.data.language || 'auto',
      };
    } catch (error: any) {
      console.error('Error transcribing audio:', error);

      if (error.response?.status === 400) {
        throw new Error('Invalid audio file or format');
      } else if (error.response?.status === 500) {
        throw new Error('Transcription service unavailable');
      }

      throw new Error('Failed to transcribe audio');
    }
  }

  /**
   * Record and transcribe in one go
   */
  async recordAndTranscribe(
    durationMs: number = 5000,
    language?: string
  ): Promise<TranscriptionResponse> {
    await this.startRecording();

    // Wait for specified duration
    await new Promise(resolve => setTimeout(resolve, durationMs));

    const audioUri = await this.stopRecording();

    if (!audioUri) {
      throw new Error('No audio recorded');
    }

    return this.transcribeAudio(audioUri, language);
  }

  /**
   * Get MIME type for audio file extension
   */
  private getMimeType(extension: string): string {
    const mimeTypes: Record<string, string> = {
      'm4a': 'audio/m4a',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'webm': 'audio/webm',
      'ogg': 'audio/ogg',
      'caf': 'audio/x-caf', // iOS Core Audio Format
      '3gp': 'audio/3gpp',
    };

    return mimeTypes[extension.toLowerCase()] || 'audio/m4a';
  }

  /**
   * Clean up any temporary audio files
   */
  async cleanup(audioUri: string): Promise<void> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(audioUri);
      }
    } catch (error) {
      console.error('Error cleaning up audio file:', error);
    }
  }
}

export const voiceSearchService = new VoiceSearchService();
