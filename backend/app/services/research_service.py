import base64
import binascii
import json
import logging
from functools import lru_cache
from typing import Any
from urllib.parse import quote

import httpx
from fastapi import HTTPException
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq

from ..core.config import Settings, get_settings
from ..models.detection import (
    Detection,
    ResearchAnalysis,
    ResearchAnalysisRequest,
    ResearchFindingAnalysis,
    ResearchNarrativePayload,
)

logger = logging.getLogger(__name__)

MAX_RESEARCH_IMAGE_BYTES = 14 * 1024 * 1024
GEMINI_REQUEST_TIMEOUT_SECONDS = 240.0
GEMINI_MAX_OUTPUT_TOKENS = 8000
GEMINI_OUTPUT_TOKENS_PER_FINDING = 256
GEMINI_OUTPUT_TOKENS_BASE = 512

_SYSTEM_PROMPT = """You are an AI research assistant reviewing dental radiographs.
This is an exploratory research prototype, not a medical device or clinical
decision-maker. Return concise, uncertain research hypotheses, not confirmed
diagnoses or instructions to treat a patient.

Use the supplied radiograph as visual evidence and the supplied detection list
as model output. A detection label and model confidence are not ground truth or
diagnostic probabilities. Do not claim a feature is visible unless the image
supports it. Distinguish direct image observations from inference, mention
image quality/overlap/2D limitations, and state when evidence is insufficient.
Do not infer FDI tooth numbers from bounding-box coordinates. Use a tooth number
only when explicitly supplied in a dentist annotation; otherwise say
"Tooth not identified". Treat dentist annotations as unverified context, not
ground truth.

Consider the detections together: identify likely duplicates/overlaps, possible
relationships, and broader patterns, but do not assume adjacent boxes belong
to the same tooth. Provide differential hypotheses with evidence that supports
and evidence that is missing or argues against each. Recommend appropriate
clinical examinations or imaging only as considerations for a dentist.

Potential treatment options may only be broad categories for a qualified
dentist's discussion after independent diagnosis. Never prescribe medication
or doses, give procedural instructions, claim treatment is required, or imply
an emergency/urgency from this image alone. If a treatment pathway cannot be
supported, state that it is indeterminate.

Do not invent literature references, citations, or external sources. No
literature retrieval is available. If model output cannot be reconciled with
the image, say so plainly. Return only a single JSON object matching the
provided schema. The application adds model confidence from the source
detections; do not estimate or alter it. Keep each narrative field to one or
two concise sentences, include at most two differentials and three
investigations per finding, and avoid repeating details across findings.
Prioritize image-supported evidence over exhaustive discussion."""


class ResearchAnalysisService:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    def is_enabled(self) -> bool:
        if self.settings.research_provider == "gemini":
            return self.settings.google_api_key is not None
        return self.settings.groq_api_key is not None

    @property
    def provider(self) -> str:
        return self.settings.research_provider

    @property
    def model_name(self) -> str:
        if self.settings.research_provider == "gemini":
            return self.settings.google_research_model
        return self.settings.groq_research_model

    async def generate_analysis(
        self, request: ResearchAnalysisRequest
    ) -> ResearchAnalysis:
        if not request.share_consent:
            raise HTTPException(
                status_code=400,
                detail="Explicit consent is required before external image analysis.",
            )
        if not self.is_enabled():
            provider_key = (
                "GOOGLE_API_KEY"
                if self.settings.research_provider == "gemini"
                else "GROQ_API_KEY"
            )
            raise HTTPException(
                status_code=503,
                detail=(
                    "Research Mode is unavailable. Configure "
                    f"{provider_key} in the backend environment."
                ),
            )
        if not request.predictions:
            raise HTTPException(
                status_code=400,
                detail="At least one model detection is required for Research Mode.",
            )

        self._decode_image(request.image_data_url)
        input_context = {
            "image_dimensions_px": request.image_info.converted_size,
            "image_modality": request.modality or "not provided",
            "displayed_model_detections": [
                detection.model_dump(by_alias=True)
                for detection in request.predictions
            ],
            "raw_model_detections_for_overlap_comparison": [
                detection.model_dump(by_alias=True)
                for detection in request.raw_predictions
            ],
            "dentist_annotations_unverified": [
                annotation.model_dump(exclude_none=True)
                for annotation in request.dentist_annotations
            ],
        }
        schema = ResearchNarrativePayload.model_json_schema()
        user_text = (
            "Analyze the attached de-identified/test dental radiograph and the "
            "provided model output. Do not use or request patient-identifying "
            "metadata. Use the exact detection_id values in the input. Return "
            "one finding for each displayed detection, once each, and no "
            "invented IDs. Keep the entire response compact while preserving "
            "the key evidence, uncertainty, differentials, and dentist-directed "
            "next steps. The response schema is:\n"
            f"{json.dumps(schema, separators=(',', ':'))}\n\n"
            "Input context:\n"
            f"{json.dumps(input_context, separators=(',', ':'))}"
        )
        try:
            if self.settings.research_provider == "gemini":
                response_text = await self._generate_gemini_response(
                    user_text,
                    request.image_data_url,
                    max_output_tokens=min(
                        GEMINI_MAX_OUTPUT_TOKENS,
                        GEMINI_OUTPUT_TOKENS_BASE
                        + GEMINI_OUTPUT_TOKENS_PER_FINDING
                        * len(request.predictions),
                    ),
                )
            else:
                response_text = await self._generate_groq_response(
                    user_text, request.image_data_url
                )
            narrative = ResearchNarrativePayload.model_validate_json(
                response_text
            )
            return self._build_analysis(narrative, request.predictions)
        except HTTPException:
            raise
        except httpx.TimeoutException as error:
            logger.warning(
                "%s research analysis timed out (%s)",
                self.settings.research_provider,
                type(error).__name__,
            )
            raise HTTPException(
                status_code=504,
                detail=(
                    "LePro AI did not respond in time. No analysis was saved; "
                    "retry later or review the image manually."
                ),
            ) from None
        except Exception as error:
            if getattr(error, "status_code", None) == 429:
                logger.warning(
                    "%s research analysis rate limited (%s)",
                    self.settings.research_provider,
                    type(error).__name__,
                )
                raise HTTPException(
                    status_code=429,
                    detail=(
                        "LePro AI is temporarily busy. Wait before retrying; "
                        "no analysis was saved."
                    ),
                ) from None
            logger.error(
                "%s research analysis failed (%s)",
                self.settings.research_provider,
                type(error).__name__,
            )
            raise HTTPException(
                status_code=502,
                detail=(
                    "LePro AI could not complete this analysis. No analysis was "
                    "saved; try again or review the image manually."
                ),
            ) from None

    async def _generate_groq_response(
        self, user_text: str, image_data_url: str
    ) -> str:
        if self.settings.groq_api_key is None:
            raise RuntimeError("The configured Groq key is missing.")
        model = ChatGroq(
            model=self.settings.groq_research_model,
            api_key=self.settings.groq_api_key.get_secret_value(),
            temperature=0,
            max_tokens=8000,
            timeout=90,
            max_retries=0,
            model_kwargs={"response_format": {"type": "json_object"}},
        )
        response = await model.ainvoke(
            [
                SystemMessage(content=_SYSTEM_PROMPT),
                HumanMessage(
                    content=[
                        {"type": "text", "text": user_text},
                        {
                            "type": "image_url",
                            "image_url": {"url": image_data_url},
                        },
                    ]
                ),
            ]
        )
        return self._response_text(response.content)

    async def _generate_gemini_response(
        self,
        user_text: str,
        image_data_url: str,
        max_output_tokens: int,
    ) -> str:
        if self.settings.google_api_key is None:
            raise RuntimeError("The configured Gemini key is missing.")
        mime_type, _, encoded_image = image_data_url[5:].partition(";base64,")
        endpoint = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{quote(self.settings.google_research_model, safe='-_.')}:generateContent"
        )
        body = {
            "systemInstruction": {
                "parts": [{"text": _SYSTEM_PROMPT}],
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": user_text},
                        {
                            "inlineData": {
                                "mimeType": mime_type,
                                "data": encoded_image,
                            }
                        },
                    ],
                }
            ],
            "generationConfig": {
                "temperature": 0,
                "maxOutputTokens": max_output_tokens,
                "responseMimeType": "application/json",
            },
        }
        timeout = httpx.Timeout(
            GEMINI_REQUEST_TIMEOUT_SECONDS,
            connect=10.0,
        )
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                endpoint,
                headers={
                    "Content-Type": "application/json",
                    "X-goog-api-key": self.settings.google_api_key.get_secret_value(),
                },
                json=body,
            )
        if response.is_error:
            logger.error(
                "Gemini research analysis failed with HTTP %s",
                response.status_code,
            )
            raise RuntimeError("Gemini returned a non-success status.")
        response_payload = response.json()
        candidates = response_payload.get("candidates", [])
        if not candidates:
            raise ValueError("Gemini returned no candidate.")
        parts = candidates[0].get("content", {}).get("parts", [])
        text = "".join(
            part["text"]
            for part in parts
            if isinstance(part.get("text"), str)
        )
        if not text:
            raise ValueError("Gemini returned no text content.")
        return text

    @staticmethod
    def _decode_image(image_data_url: str) -> bytes:
        encoded_image = image_data_url.partition(",")[2]
        try:
            image_bytes = base64.b64decode(encoded_image, validate=True)
        except (binascii.Error, ValueError):
            raise HTTPException(
                status_code=400, detail="The supplied image data is invalid."
            ) from None

        if len(image_bytes) > MAX_RESEARCH_IMAGE_BYTES:
            raise HTTPException(
                status_code=413,
                detail="Research Mode images must be smaller than 14 MB.",
            )
        is_png_url = image_data_url.startswith("data:image/png;")
        is_jpeg_url = image_data_url.startswith("data:image/jpeg;")
        if not (
            (is_png_url and image_bytes.startswith(b"\x89PNG\r\n\x1a\n"))
            or (is_jpeg_url and image_bytes.startswith(b"\xff\xd8\xff"))
        ):
            raise HTTPException(
                status_code=400,
                detail="The supplied data is not a valid PNG or JPEG image.",
            )
        return image_bytes

    @staticmethod
    def _response_text(content: Any) -> str:
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            text = "".join(
                block["text"]
                for block in content
                if isinstance(block, dict)
                and block.get("type") == "text"
                and isinstance(block.get("text"), str)
            )
            if text:
                return text
        raise ValueError("The research model response did not contain JSON text.")

    def _build_analysis(
        self,
        narrative: ResearchNarrativePayload,
        detections: list[Detection],
    ) -> ResearchAnalysis:
        expected_detections = {detection.detection_id: detection for detection in detections}
        returned_ids = [finding.detection_id for finding in narrative.findings]
        if (
            len(returned_ids) != len(set(returned_ids))
            or set(returned_ids) != set(expected_detections)
        ):
            raise ValueError(
                "Research output did not match the supplied detection IDs."
            )

        findings: list[ResearchFindingAnalysis] = []
        expected_ids = set(expected_detections)
        for finding in narrative.findings:
            if not set(finding.related_detection_ids).issubset(expected_ids):
                raise ValueError(
                    "Research output referenced an unknown related detection."
                )
            detection = expected_detections[finding.detection_id]
            findings.append(
                ResearchFindingAnalysis(
                    **finding.model_dump(),
                    finding_name=detection.class_,
                    model_confidence=detection.confidence,
                )
            )

        return ResearchAnalysis(
            model=self.model_name,
            findings=findings,
            combined_clinical_interpretation=(
                narrative.combined_clinical_interpretation
            ),
            cross_finding_patterns=narrative.cross_finding_patterns,
        )


@lru_cache
def get_research_analysis_service() -> ResearchAnalysisService:
    return ResearchAnalysisService()
