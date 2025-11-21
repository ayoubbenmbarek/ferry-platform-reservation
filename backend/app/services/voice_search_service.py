"""
Voice Search Service for handling audio transcription using OpenAI Whisper.
"""
import os
import tempfile
import logging
from typing import Optional
import openai

logger = logging.getLogger(__name__)


class VoiceSearchService:
    """Service for handling voice search transcription."""

    def __init__(self):
        """Initialize the VoiceSearchService with OpenAI API key."""
        self.api_key = os.getenv("OPENAI_API_KEY")
        if self.api_key:
            openai.api_key = self.api_key
        else:
            logger.warning("OPENAI_API_KEY not configured - voice search will not work")

    def is_configured(self) -> bool:
        """Check if the service is properly configured."""
        return self.api_key is not None

    def transcribe_audio(
        self,
        audio_content: bytes,
        language: Optional[str] = None,
        content_type: Optional[str] = None
    ) -> str:
        """
        Transcribe audio using OpenAI Whisper API.

        Args:
            audio_content: The audio file content as bytes
            language: Optional language hint for transcription (en, fr, ar).
                     If None, Whisper will auto-detect the language.
            content_type: MIME type of the audio file

        Returns:
            Transcribed text

        Raises:
            ValueError: If audio is empty or API key is not configured
            openai.APIError: If the OpenAI API request fails
        """
        if not self.is_configured():
            raise ValueError("OpenAI API key not configured")

        if len(audio_content) == 0:
            raise ValueError("Empty audio file")

        # Determine file extension based on content type
        suffix = ".webm" if content_type and "webm" in content_type else ".mp3"

        # Save to temporary file (Whisper API requires a file)
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(audio_content)
            temp_file_path = temp_file.name

        try:
            # Call Whisper API
            with open(temp_file_path, "rb") as audio_file:
                client = openai.OpenAI()

                # Let Whisper auto-detect language for best accuracy
                # Only provide language hint if explicitly specified
                if language:
                    # Map language codes to Whisper-compatible codes
                    lang_map = {
                        "en": "en",
                        "fr": "fr",
                        "ar": "ar",
                        "en-US": "en",
                        "fr-FR": "fr",
                        "ar-SA": "ar"
                    }
                    whisper_lang = lang_map.get(language, language)

                    transcript = client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file,
                        language=whisper_lang,
                        response_format="text"
                    )
                else:
                    # Auto-detect language and translate to English for easier parsing
                    # Use translations endpoint to convert any language (Arabic, French, etc.) to English
                    transcript = client.audio.translations.create(
                        model="whisper-1",
                        file=audio_file,
                        response_format="text"
                    )

            # transcript is just the text string when response_format="text"
            transcribed_text = transcript.strip() if isinstance(transcript, str) else str(transcript).strip()

            logger.info(f"Successfully transcribed/translated audio: {transcribed_text[:100]}...")
            return transcribed_text

        finally:
            # Clean up temp file
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)


# Singleton instance
voice_search_service = VoiceSearchService()
