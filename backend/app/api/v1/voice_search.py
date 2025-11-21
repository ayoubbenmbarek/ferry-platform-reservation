"""
Voice Search API endpoint using OpenAI Whisper for transcription.
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, status, Form
from pydantic import BaseModel
import logging

from app.services.voice_search_service import voice_search_service

logger = logging.getLogger(__name__)

router = APIRouter()


class TranscriptionResponse(BaseModel):
    """Response model for voice transcription."""
    text: str
    language: str


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    audio: UploadFile = File(...),
    language: str = Form(None)
):
    """
    Transcribe audio using OpenAI Whisper API.

    Args:
        audio: Audio file (webm, mp3, wav, m4a, etc.)
        language: Optional language hint for transcription (en, fr, ar).
                 If not provided, Whisper will auto-detect the language.

    Returns:
        Transcribed text and detected language
    """
    # Check if service is configured
    if not voice_search_service.is_configured():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OpenAI API key not configured"
        )

    # Validate file type
    allowed_types = [
        "audio/webm", "audio/mp3", "audio/mpeg", "audio/wav",
        "audio/m4a", "audio/ogg", "audio/flac", "audio/x-m4a",
        "video/webm"  # Chrome sometimes sends webm as video
    ]

    content_type = audio.content_type or ""
    if not any(t in content_type for t in ["audio", "video/webm"]):
        logger.warning(f"Unexpected content type: {content_type}")

    try:
        # Read the audio file
        audio_content = await audio.read()

        # Use the service to transcribe (let Whisper auto-detect language if not provided)
        transcribed_text = voice_search_service.transcribe_audio(
            audio_content=audio_content,
            language=language,  # Pass None if not provided, let Whisper auto-detect
            content_type=content_type
        )

        return TranscriptionResponse(
            text=transcribed_text,
            language=language or "auto"  # Return "auto" if language wasn't specified
        )

    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Transcription error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transcription failed: {str(e)}"
        )
