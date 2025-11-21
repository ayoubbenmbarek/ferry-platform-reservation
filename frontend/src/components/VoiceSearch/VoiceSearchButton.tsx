import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { parseVoiceSearch, ParsedSearchQuery } from '../../utils/voiceSearchParser';

interface VoiceSearchButtonProps {
  onResult: (result: ParsedSearchQuery) => void;
  onError?: (error: string) => void;
  className?: string;
}

const VoiceSearchButton: React.FC<VoiceSearchButtonProps> = ({
  onResult,
  onError,
  className = '',
}) => {
  const { t, i18n } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedSearchQuery | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        // Process the recording
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
      };

      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
      setShowResult(false);
      setParsedResult(null);

    } catch (error: any) {
      console.error('Failed to start recording:', error);

      if (error.name === 'NotAllowedError') {
        onError?.(t('voiceSearch.notAllowed', 'Microphone access denied. Please allow microphone access.'));
      } else if (error.name === 'NotFoundError') {
        onError?.(t('voiceSearch.noMicrophone', 'No microphone found. Please check your settings.'));
      } else {
        onError?.(t('voiceSearch.error', 'Failed to start recording. Please try again.'));
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);

    try {
      // Create form data with the audio file
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      // Don't send language - let Whisper auto-detect for best accuracy

      // Send to backend for Whisper transcription
      const response = await axios.post('/api/v1/voice/transcribe', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const transcribedText = response.data.text;
      console.log('Transcribed text:', transcribedText);
      console.log('Detected language:', response.data.language);

      if (transcribedText) {
        // Parse the transcript
        const parsed = parseVoiceSearch(transcribedText, i18n.language);
        console.log('Parsed result:', parsed);

        // Check if we got meaningful results (minimum confidence threshold)
        const hasPort = parsed.departurePort || parsed.arrivalPort;
        const hasDate = parsed.departureDate || parsed.returnDate;

        if (!hasPort && !hasDate) {
          // No meaningful search parameters detected
          onError?.(
            t('voiceSearch.noSearchParams',
              `Could not understand the search query. You said: "${transcribedText}". Try saying something like "Round trip from Genoa to Tunis next Friday"`
            )
          );
        } else {
          setParsedResult(parsed);
          setShowResult(true);
        }
      } else {
        onError?.(t('voiceSearch.noSpeech', 'No speech detected. Please try again.'));
      }

    } catch (error: any) {
      console.error('Transcription error:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Transcription failed';
      onError?.(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = () => {
    if (parsedResult) {
      onResult(parsedResult);
      setShowResult(false);
      setParsedResult(null);
    }
  };

  const handleCancel = () => {
    setShowResult(false);
    setParsedResult(null);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Main button */}
      <button
        type="button"
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
        className={`
          p-3 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
          ${isRecording
            ? 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-500 animate-pulse'
            : isProcessing
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500'
          }
        `}
        title={
          isRecording
            ? t('voiceSearch.stopListening', 'Stop recording')
            : isProcessing
              ? t('voiceSearch.processing', 'Processing...')
              : t('voiceSearch.startListening', 'Search by voice')
        }
      >
        {isProcessing ? (
          // Loading spinner
          <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : isRecording ? (
          // Stop icon
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="1" strokeWidth="2" />
          </svg>
        ) : (
          // Microphone icon
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
        )}
      </button>

      {/* Recording indicator */}
      {isRecording && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-white rounded-lg shadow-lg p-4 min-w-[280px] z-50">
          <div className="flex items-center space-x-3 mb-2">
            <div className="flex space-x-1">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
            <span className="text-sm text-gray-600">{t('voiceSearch.recording', 'Recording...')}</span>
          </div>
          <div className="text-xs text-gray-500 space-y-1">
            <p className="font-medium">Examples:</p>
            <p>• "Round trip from Genoa to Tunis next Friday"</p>
            <p>• "Marseille to Tunis tomorrow, 2 adults"</p>
            <p>• "One way from Barcelona to Tunis"</p>
          </div>
          <button
            onClick={stopRecording}
            className="mt-3 w-full py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600"
          >
            {t('voiceSearch.stopAndProcess', 'Stop & Process')}
          </button>
        </div>
      )}

      {/* Processing indicator */}
      {isProcessing && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-white rounded-lg shadow-lg p-4 min-w-[280px] z-50">
          <div className="flex items-center space-x-3">
            <svg className="w-5 h-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm text-gray-600">{t('voiceSearch.transcribing', 'Transcribing with AI...')}</span>
          </div>
        </div>
      )}

      {/* Result confirmation modal */}
      {showResult && parsedResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold mb-4">{t('voiceSearch.confirmSearch', 'Confirm Search')}</h3>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">{t('voiceSearch.youSaid', 'You said')}:</p>
              <p className="text-gray-800 italic">"{parsedResult.rawText}"</p>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">{t('voiceSearch.parsedAs', 'Parsed as')}:</p>
              <div className="bg-gray-50 rounded p-3 space-y-2">
                {parsedResult.departurePort && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{t('search.from', 'From')}:</span>
                    <span className="font-medium capitalize">{parsedResult.departurePort}</span>
                  </div>
                )}
                {parsedResult.arrivalPort && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{t('search.to', 'To')}:</span>
                    <span className="font-medium capitalize">{parsedResult.arrivalPort}</span>
                  </div>
                )}
                {parsedResult.departureDate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{t('search.departureDate', 'Departure')}:</span>
                    <span className="font-medium">{new Date(parsedResult.departureDate).toLocaleDateString()}</span>
                  </div>
                )}
                {parsedResult.isRoundTrip && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{t('search.tripType', 'Trip Type')}:</span>
                    <span className="font-medium">{t('search.roundTrip', 'Round Trip')}</span>
                  </div>
                )}
                {parsedResult.returnDate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{t('search.returnDate', 'Return')}:</span>
                    <span className="font-medium">{new Date(parsedResult.returnDate).toLocaleDateString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('search.passengers', 'Passengers')}:</span>
                  <span className="font-medium">
                    {parsedResult.adults} {t('search.adults', 'Adults')}
                    {parsedResult.children > 0 && `, ${parsedResult.children} ${t('search.children', 'Children')}`}
                    {parsedResult.infants > 0 && `, ${parsedResult.infants} ${t('search.infants', 'Infants')}`}
                  </span>
                </div>
                {parsedResult.hasVehicle && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{t('search.vehicle', 'Vehicle')}:</span>
                    <span className="font-medium">🚗 {t('search.yes', 'Yes')}</span>
                  </div>
                )}
              </div>
            </div>

            {parsedResult.confidence < 50 && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm text-yellow-800">
                  {t('voiceSearch.lowConfidence', 'Some details could not be detected. You can edit after confirmation.')}
                </p>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {t('voiceSearch.search', 'Search')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceSearchButton;