from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from typing import Annotated
import tempfile
import os
import logging

from ..models.detection import (
    Detection,
    DetectionResponse,
    DicomDetectionResponse,
    ErrorResponse,
    DiagnosticReportResponse,
    DiagnosticReportRequest,
    ResearchAnalysisRequest,
    ResearchAnalysisResponse,
    ResearchModeStatus,
)
from ..services.inference_service import InferenceService, get_inference_service
from ..services.diagnostic_service import (
    DiagnosticReportService,
    get_diagnostic_report_service,
)
from ..services.research_service import (
    ResearchAnalysisService,
    get_research_analysis_service,
)
from ..core.config import get_settings, Settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["detection"])


@router.post(
    "/detect",
    response_model=DetectionResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid file format"},
        413: {"model": ErrorResponse, "description": "File too large"},
        500: {"model": ErrorResponse, "description": "Inference failed"},
    },
)
async def detect_dental_conditions(
    file: UploadFile,
    inference_service: Annotated[InferenceService, Depends(get_inference_service)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> DetectionResponse:
    """
    Detect cavities and periapical lesions in uploaded dental image

    This endpoint processes dental X-ray images and returns detected conditions
    with their locations, confidence scores, and classifications.
    """

    # Validate file type
    if file.content_type not in settings.allowed_file_types:
        raise HTTPException(
            status_code=400,
            detail=f"File must be one of: {', '.join(settings.allowed_file_types)}",
        )

    # Validate file size efficiently using seek
    if file.size and file.size > settings.max_file_size:
        raise HTTPException(
            status_code=413,
            detail=f"File size ({file.size} bytes) exceeds maximum allowed size ({settings.max_file_size} bytes)",
        )

    # Read content only once
    content = await file.read()

    # Double-check size if not available from file.size
    if not file.size and len(content) > settings.max_file_size:
        raise HTTPException(
            status_code=413,
            detail=f"File size ({len(content)} bytes) exceeds maximum allowed size ({settings.max_file_size} bytes)",
        )

    # Save uploaded file temporarily
    temp_file_path = None
    try:
        with tempfile.NamedTemporaryFile(
            delete=False, suffix=os.path.splitext(file.filename or "image.jpg")[1]
        ) as temp_file:
            temp_file.write(content)
            temp_file_path = temp_file.name

        # Run inference using the service
        result = await inference_service.detect_dental_conditions(
            temp_file_path, settings.default_model_id
        )

        return DetectionResponse(**result)

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Unexpected error in detection endpoint: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred during processing"
        )
    finally:
        # Clean up temporary file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except OSError as e:
                logger.warning(f"Failed to delete temporary file {temp_file_path}: {e}")


@router.post(
    "/detect-dicom",
    response_model=DicomDetectionResponse,
    responses={
        400: {
            "model": ErrorResponse,
            "description": "Invalid DICOM or PNG file",
        },
        413: {"model": ErrorResponse, "description": "File too large"},
        500: {"model": ErrorResponse, "description": "Processing failed"},
    },
)
async def detect_dental_conditions_dicom(
    file: UploadFile,
    inference_service: Annotated[InferenceService, Depends(get_inference_service)],
    settings: Annotated[Settings, Depends(get_settings)],
    diagnostic_service: Annotated[
        DiagnosticReportService, Depends(get_diagnostic_report_service)
    ],
) -> DicomDetectionResponse:
    """
    Detect cavities and periapical lesions in an uploaded DICOM or PNG image

    This endpoint processes DICOM and PNG files by:
    1. Extracting DICOM metadata when present
    2. Normalizing the image to a model-compatible format
    3. Running AI inference to detect dental conditions
    4. Returning all information together

    The response includes:
    - Detection predictions with bounding boxes and confidence scores
    - DICOM metadata when present
    - Image conversion information
    """

    # DICOM files can have various content types; PNG uploads may use a generic MIME type.
    allowed_extensions = {".dcm", ".dicom", ".rvg"}
    file_extension = os.path.splitext(file.filename or "")[1] if file.filename else ""
    is_png = file.content_type == "image/png" or file_extension.lower() == ".png"
    is_dicom = (
        file.content_type in settings.allowed_dicom_file_types
        or file_extension.lower() in allowed_extensions
    )

    if not is_png and not is_dicom:
        raise HTTPException(
            status_code=400,
            detail="File must be a DICOM/RVG file (.dcm, .dicom, .rvg) or a PNG image (.png)",
        )

    # Validate file size
    content = await file.read()
    file_size = len(content)

    if file_size > settings.max_file_size:
        raise HTTPException(
            status_code=413,
            detail=f"File size ({file_size} bytes) exceeds maximum allowed size ({settings.max_file_size} bytes)",
        )

    # Save uploaded study file temporarily
    temp_file_path = None
    try:
        suffix = ".png" if is_png else ".dcm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(content)
            temp_file_path = temp_file.name

        if is_png:
            inference_results, metadata, image_info = (
                await inference_service.detect_dental_conditions_from_png(
                    temp_file_path, settings.default_model_id
                )
            )
        else:
            inference_results, metadata, image_info = (
                await inference_service.detect_dental_conditions_from_dicom(
                    temp_file_path, settings.default_model_id
                )
            )

        predictions = [
            Detection.model_validate(prediction)
            for prediction in inference_results.get("predictions", [])
        ]
        diagnostic_report = await diagnostic_service.generate_diagnostic_report(
            predictions
        )

        return DicomDetectionResponse(
            predictions=predictions,
            metadata=metadata,
            image_info=image_info,
            recommended_actions=[
                assessment.suggestion
                for assessment in diagnostic_report.suggested_assessments
            ],
        )

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(
            f"Unexpected error in study detection endpoint: {str(e)}", exc_info=True
        )
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred during study processing",
        )
    finally:
        # Clean up temporary file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except OSError as e:
                logger.warning(f"Failed to delete temporary file {temp_file_path}: {e}")


@router.post(
    "/generate-diagnostic-report",
    response_model=DiagnosticReportResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid input data"},
        500: {"model": ErrorResponse, "description": "Report generation failed"},
    },
)
async def generate_diagnostic_report_from_detections(
    request: DiagnosticReportRequest,
    diagnostic_service: Annotated[
        DiagnosticReportService, Depends(get_diagnostic_report_service)
    ],
) -> DiagnosticReportResponse:
    """
    Generate a clinical review aid from actual inference results.

    The generated clinician next steps are tied to the supplied detection IDs;
    no LLM-generated diagnosis or treatment advice is returned.

    This endpoint is designed to be called after /detect-dicom
    to generate reports from existing detection results.
    """

    try:
        diagnostic_report = await diagnostic_service.generate_diagnostic_report(
            detections=request.predictions
        )

        return DiagnosticReportResponse(
            diagnostic_report=diagnostic_report,
            detections_used=request.predictions,
            metadata=request.metadata,
        )

    except Exception as e:
        logger.error(
            f"Unexpected error in diagnostic report generation: {str(e)}", exc_info=True
        )
        raise HTTPException(
            status_code=500,
            detail="Clinical review aid generation failed. Check the backend logs.",
        )


@router.get("/research-mode", response_model=ResearchModeStatus)
async def get_research_mode_status(
    research_service: Annotated[
        ResearchAnalysisService, Depends(get_research_analysis_service)
    ],
) -> ResearchModeStatus:
    return ResearchModeStatus(
        enabled=research_service.is_enabled(),
        provider=research_service.provider,
        model=research_service.model_name,
    )


@router.post(
    "/research-analysis",
    response_model=ResearchAnalysisResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid research input"},
        413: {"model": ErrorResponse, "description": "Image too large"},
        502: {"model": ErrorResponse, "description": "External research provider failed"},
        504: {"model": ErrorResponse, "description": "External research provider timed out"},
        503: {"model": ErrorResponse, "description": "Research Mode is disabled"},
    },
)
async def generate_research_analysis(
    request: ResearchAnalysisRequest,
    research_service: Annotated[
        ResearchAnalysisService, Depends(get_research_analysis_service)
    ],
) -> ResearchAnalysisResponse:
    """Run opt-in exploratory analysis on a de-identified/test image."""
    analysis = await research_service.generate_analysis(request)
    return ResearchAnalysisResponse(
        analysis=analysis,
        model_predictions=request.predictions,
    )


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "dental-detection-api"}
