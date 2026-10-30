import base64
import json
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import HTTPException
import httpx
from pydantic import SecretStr, ValidationError

from app.core.config import Settings
from app.models.detection import (
    Detection,
    ImageInfo,
    ResearchAnalysisRequest,
    ResearchDentistAnnotation,
    ResearchNarrativePayload,
)
from app.services.research_service import (
    GEMINI_MAX_OUTPUT_TOKENS,
    GEMINI_OUTPUT_TOKENS_BASE,
    GEMINI_OUTPUT_TOKENS_PER_FINDING,
    GEMINI_REQUEST_TIMEOUT_SECONDS,
    ResearchAnalysisService,
)


def make_detection(detection_id: str, class_name: str) -> Detection:
    return Detection.model_validate(
        {
            "x": 20,
            "y": 30,
            "width": 10,
            "height": 12,
            "confidence": 0.81,
            "class": class_name,
            "class_id": 1,
            "detection_id": detection_id,
        }
    )


def make_image_info() -> ImageInfo:
    return ImageInfo(
        original_shape=[64, 64],
        converted_format="PNG",
        converted_size=[64, 64],
        original_dtype="uint8",
        pixel_array_min=0,
        pixel_array_max=255,
    )


def make_request() -> ResearchAnalysisRequest:
    image = base64.b64encode(
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
        b"\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00"
        b"\x1f\x15\xc4\x89\x00\x00\x00\x0bIDATx\xdac`\x00\x02"
        b"\x00\x00\x05\x00\x01\xa5\xf6E@\x00\x00\x00\x00IEND\xaeB`\x82"
    ).decode()
    detection = make_detection("finding-1", "restoration")
    return ResearchAnalysisRequest(
        predictions=[detection],
        raw_predictions=[detection],
        image_info=make_image_info(),
        modality="IO",
        image_data_url=f"data:image/png;base64,{image}",
        dentist_annotations=[
            ResearchDentistAnnotation(
                detection_id="finding-1",
                review_status="modified",
                dentist_label="restoration",
                assigned_tooth="36",
            )
        ],
        share_consent=True,
    )


def make_narrative() -> dict[str, object]:
    return {
        "findings": [
            {
                "detection_id": "finding-1",
                "anatomical_location": "Dentist-entered tooth 36",
                "possible_diagnosis": "Possible restoration",
                "differential_diagnoses": [
                    {
                        "diagnosis": "Radiopaque restorative material",
                        "supporting_evidence": "A radiopaque region is shown",
                        "evidence_against_or_missing": "Clinical examination is absent",
                    }
                ],
                "ai_interpretation": "The box may overlap restorative material.",
                "clinical_significance": "Margins require clinical review.",
                "recommended_investigations": ["Inspect the source image."],
                "potential_treatment_options": ["restorative assessment"],
                "follow_up": "Determine after dentist review.",
                "evidence_and_limitations": ["The model label is not a diagnosis."],
                "related_detection_ids": [],
                "dentist_annotation_comparison": "The supplied label is restoration.",
            }
        ],
        "combined_clinical_interpretation": "Unconfirmed research interpretation.",
        "cross_finding_patterns": [],
    }


class ResearchAnalysisServiceTests(unittest.IsolatedAsyncioTestCase):
    def test_selected_provider_must_have_its_own_api_key(self) -> None:
        gemini_without_key = ResearchAnalysisService(
            Settings(
                roboflow_api_key="test-key",
                research_provider="gemini",
                google_api_key=None,
                groq_api_key=None,
            )
        )
        groq_with_key = ResearchAnalysisService(
            Settings(
                roboflow_api_key="test-key",
                research_provider="groq",
                groq_api_key=SecretStr("groq-test-key"),
                google_api_key=None,
            )
        )
        self.assertFalse(gemini_without_key.is_enabled())
        self.assertTrue(groq_with_key.is_enabled())

    async def test_generation_preserves_model_score_and_uses_opted_in_image(self) -> None:
        settings = Settings(
            roboflow_api_key="test-key",
            research_provider="groq",
            groq_api_key=SecretStr("groq-test-key"),
            google_api_key=None,
        )
        service = ResearchAnalysisService(settings)
        fake_model = AsyncMock(
            return_value=MagicMock(content=json.dumps(make_narrative()))
        )

        with patch(
            "app.services.research_service.ChatGroq"
        ) as chat_groq:
            chat_groq.return_value.ainvoke = fake_model
            analysis = await service.generate_analysis(make_request())

        self.assertEqual(analysis.findings[0].model_confidence, 0.81)
        self.assertEqual(analysis.findings[0].finding_name, "restoration")
        self.assertEqual(analysis.model, "qwen/qwen3.8-27b")

        messages = fake_model.await_args.args[0]
        human_content = messages[1].content
        self.assertEqual(
            human_content[1]["image_url"]["url"],
            make_request().image_data_url,
        )
        self.assertNotIn("patient_id", human_content[0]["text"])
        self.assertNotIn("observations", human_content[0]["text"])

    async def test_gemini_provider_uses_generate_content_json_and_image_parts(self) -> None:
        settings = Settings(
            roboflow_api_key="test-key",
            research_provider="gemini",
            google_api_key=SecretStr("rotated-test-key"),
            groq_api_key=None,
        )
        service = ResearchAnalysisService(settings)
        fake_response = MagicMock(
            is_error=False,
            json=MagicMock(
                return_value={
                    "candidates": [
                        {
                            "content": {
                                "parts": [{"text": json.dumps(make_narrative())}]
                            }
                        }
                    ]
                }
            ),
        )
        fake_client = AsyncMock()
        fake_client.__aenter__.return_value = fake_client
        fake_client.__aexit__.return_value = False
        fake_client.post.return_value = fake_response

        with patch(
            "app.services.research_service.httpx.AsyncClient",
            return_value=fake_client,
        ) as client_factory:
            analysis = await service.generate_analysis(make_request())

        self.assertEqual(analysis.model, "gemini-flash-latest")
        self.assertEqual(analysis.findings[0].model_confidence, 0.81)
        request = fake_client.post.await_args
        self.assertEqual(
            request.args[0],
            "https://generativelanguage.googleapis.com/v1beta/models/"
            "gemini-flash-latest:generateContent",
        )
        self.assertEqual(
            request.kwargs["headers"]["X-goog-api-key"], "rotated-test-key"
        )
        body = request.kwargs["json"]
        self.assertEqual(
            body["generationConfig"]["responseMimeType"], "application/json"
        )
        self.assertEqual(
            body["generationConfig"]["maxOutputTokens"],
            GEMINI_OUTPUT_TOKENS_BASE + GEMINI_OUTPUT_TOKENS_PER_FINDING,
        )
        self.assertTrue(body["contents"][0]["parts"][1]["inlineData"]["data"])
        self.assertNotIn("patient_id", body["contents"][0]["parts"][0]["text"])
        self.assertEqual(
            client_factory.call_args.kwargs["timeout"].read,
            GEMINI_REQUEST_TIMEOUT_SECONDS,
        )

    async def test_gemini_output_limit_scales_with_findings_and_is_capped(self) -> None:
        settings = Settings(
            roboflow_api_key="test-key",
            research_provider="gemini",
            google_api_key=SecretStr("rotated-test-key"),
            groq_api_key=None,
        )
        service = ResearchAnalysisService(settings)
        detections = [
            make_detection(f"finding-{index}", "restoration")
            for index in range(40)
        ]
        request = make_request().model_copy(
            update={"predictions": detections, "raw_predictions": detections}
        )
        fake_response = MagicMock(
            is_error=False,
            json=MagicMock(
                return_value={
                    "candidates": [
                        {
                            "content": {
                                "parts": [{"text": json.dumps({
                                    **make_narrative(),
                                    "findings": [
                                        {
                                            **make_narrative()["findings"][0],
                                            "detection_id": detection.detection_id,
                                        }
                                        for detection in detections
                                    ],
                                })}]
                            }
                        }
                    ]
                }
            ),
        )
        fake_client = AsyncMock()
        fake_client.__aenter__.return_value = fake_client
        fake_client.__aexit__.return_value = False
        fake_client.post.return_value = fake_response

        with patch(
            "app.services.research_service.httpx.AsyncClient",
            return_value=fake_client,
        ):
            await service.generate_analysis(request)

        generation_config = fake_client.post.await_args.kwargs["json"][
            "generationConfig"
        ]
        self.assertEqual(
            generation_config["maxOutputTokens"],
            GEMINI_MAX_OUTPUT_TOKENS,
        )

    async def test_provider_timeout_returns_gateway_timeout(self) -> None:
        settings = Settings(
            roboflow_api_key="test-key",
            research_provider="gemini",
            google_api_key=SecretStr("rotated-test-key"),
            groq_api_key=None,
        )
        service = ResearchAnalysisService(settings)
        fake_client = AsyncMock()
        fake_client.__aenter__.return_value = fake_client
        fake_client.__aexit__.return_value = False
        fake_client.post.side_effect = httpx.ReadTimeout("provider timed out")

        with patch(
            "app.services.research_service.httpx.AsyncClient",
            return_value=fake_client,
        ):
            with self.assertRaises(HTTPException) as exception_context:
                await service.generate_analysis(make_request())

        self.assertEqual(exception_context.exception.status_code, 504)
        self.assertIn("did not respond in time", exception_context.exception.detail)

    async def test_groq_rate_limit_returns_actionable_response(self) -> None:
        class ProviderRateLimitError(Exception):
            status_code = 429

        settings = Settings(
            roboflow_api_key="test-key",
            research_provider="groq",
            groq_api_key=SecretStr("groq-test-key"),
            google_api_key=None,
        )
        service = ResearchAnalysisService(settings)
        fake_model = AsyncMock(side_effect=ProviderRateLimitError())

        with patch("app.services.research_service.ChatGroq") as chat_groq:
            chat_groq.return_value.ainvoke = fake_model
            with self.assertRaises(HTTPException) as exception_context:
                await service.generate_analysis(make_request())

        self.assertEqual(exception_context.exception.status_code, 429)
        self.assertEqual(
            exception_context.exception.detail,
            "Groq is temporarily rate-limited. Wait before retrying; no analysis was saved.",
        )

    def test_request_requires_explicit_consent(self) -> None:
        request = make_request().model_dump()
        request["share_consent"] = False
        with self.assertRaises(ValidationError):
            ResearchAnalysisRequest.model_validate(request)

    def test_rejects_non_image_payload(self) -> None:
        with self.assertRaises(HTTPException):
            ResearchAnalysisService._decode_image(
                "data:image/png;base64," + base64.b64encode(b"not an image").decode()
            )

    def test_rejects_mismatched_finding_ids(self) -> None:
        service = ResearchAnalysisService(
            Settings(
                roboflow_api_key="test-key",
                research_provider="groq",
                groq_api_key=SecretStr("groq-test-key"),
                google_api_key=None,
            )
        )
        narrative = ResearchNarrativePayload.model_validate(make_narrative())
        mismatched_finding = narrative.findings[0].model_copy(
            update={"detection_id": "unexpected-id"}
        )
        narrative = narrative.model_copy(update={"findings": [mismatched_finding]})
        with self.assertRaises(ValueError):
            service._build_analysis(
                narrative, [make_detection("finding-1", "restoration")]
            )


if __name__ == "__main__":
    unittest.main()
