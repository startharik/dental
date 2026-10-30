from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from typing import List, Literal, Optional
from datetime import datetime
import re


class Detection(BaseModel):
    x: float
    y: float
    width: int
    height: int
    confidence: float
    class_: str = Field(alias="class")
    class_id: int
    detection_id: str


class DetectionResponse(BaseModel):
    predictions: List[Detection]


class DicomMetadata(BaseModel):
    """DICOM metadata fields"""

    patient_id: Optional[str] = None
    patient_name: Optional[str] = None
    patient_birth_date: Optional[str] = None
    patient_sex: Optional[str] = None
    study_date: Optional[str] = None
    study_time: Optional[str] = None
    study_description: Optional[str] = None
    series_description: Optional[str] = None
    modality: Optional[str] = None
    manufacturer: Optional[str] = None
    manufacturer_model_name: Optional[str] = None
    rows: Optional[int] = None
    columns: Optional[int] = None
    pixel_spacing: Optional[List[float]] = None
    bits_allocated: Optional[int] = None
    bits_stored: Optional[int] = None
    photometric_interpretation: Optional[str] = None
    acquisition_date: Optional[str] = None
    acquisition_time: Optional[str] = None
    institution_name: Optional[str] = None
    referring_physician_name: Optional[str] = None


class ImageInfo(BaseModel):
    """Type-safe model for image conversion information"""

    original_shape: List[int] = Field(description="Original DICOM image dimensions")
    converted_format: str = Field(
        description="Format of the converted image (e.g., 'JPEG')"
    )
    converted_size: List[int] = Field(
        description="Size of converted image [width, height]"
    )
    original_dtype: str = Field(description="Original pixel data type")
    pixel_array_min: float = Field(description="Minimum pixel value in original image")
    pixel_array_max: float = Field(description="Maximum pixel value in original image")
    photometric_interpretation: Optional[str] = Field(
        None, description="DICOM photometric interpretation"
    )
    transfer_syntax: Optional[str] = Field(
        None, description="DICOM transfer syntax UID"
    )


class DicomDetectionResponse(BaseModel):
    """Response model for DICOM file detection"""

    predictions: List[Detection]
    metadata: DicomMetadata
    image_info: ImageInfo
    recommended_actions: List[str] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    detail: str
    error_code: str = "VALIDATION_ERROR"


class SuggestedClinicalAssessment(BaseModel):
    detection_id: str = Field(description="ID of the supporting model detection")
    suggestion: str = Field(
        description="Non-diagnostic clinician next steps tied to a model detection"
    )


class DiagnosticReport(BaseModel):
    """Unconfirmed clinical review aid based on model detections."""

    uncertainty_and_limitations: str = Field(
        description="Limitations of the model predictions and this review aid"
    )
    suggested_assessments: List[SuggestedClinicalAssessment] = Field(
        default_factory=list,
        description="Clinical assessment suggestions linked to actual detection IDs",
    )
    generated_at: datetime = Field(default_factory=datetime.now)


class DiagnosticReportResponse(BaseModel):
    """Response model for diagnostic report generation"""

    diagnostic_report: DiagnosticReport
    detections_used: List[Detection] = Field(
        description="Detections that were analyzed"
    )
    metadata: Optional[DicomMetadata] = Field(
        None, description="DICOM metadata if available"
    )


class DiagnosticReportRequest(BaseModel):
    """Request model for diagnostic report generation"""

    predictions: List[Detection] = Field(description="Detection results to analyze")
    metadata: Optional[DicomMetadata] = Field(
        None, description="DICOM metadata if available"
    )
    image_info: Optional[ImageInfo] = Field(
        None, description="Image technical information"
    )


class ResearchDentistAnnotation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    detection_id: str
    review_status: Literal[
        "awaiting_review", "confirmed", "modified", "not_applicable"
    ]
    dentist_label: Optional[str] = Field(default=None, max_length=100)
    assigned_tooth: Optional[str] = Field(
        default=None, pattern=r"^(1[1-8]|2[1-8]|3[1-8]|4[1-8])$"
    )


class ResearchAnalysisRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    predictions: List[Detection] = Field(
        max_length=100,
        description="Displayed inference findings with stable detection IDs"
    )
    raw_predictions: List[Detection] = Field(
        default_factory=list,
        max_length=200,
        description="Unfiltered inference output for duplicate/overlap context",
    )
    image_info: ImageInfo
    modality: Optional[str] = None
    image_data_url: str = Field(max_length=20_000_000)
    dentist_annotations: List[ResearchDentistAnnotation] = Field(
        default_factory=list, max_length=100
    )
    share_consent: bool = Field(
        description="Explicit consent to send a de-identified/test image to the selected external provider"
    )

    @field_validator("image_data_url")
    @classmethod
    def validate_image_data_url(cls, value: str) -> str:
        if not re.fullmatch(
            r"data:image/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}", value
        ):
            raise ValueError("Only base64 PNG or JPEG image data is supported")
        return value

    @model_validator(mode="after")
    def validate_share_consent(self) -> "ResearchAnalysisRequest":
        if not self.share_consent:
            raise ValueError("Explicit consent is required for external image analysis")
        prediction_ids = {detection.detection_id for detection in self.predictions}
        annotation_ids = [
            annotation.detection_id for annotation in self.dentist_annotations
        ]
        if len(annotation_ids) != len(set(annotation_ids)) or not set(
            annotation_ids
        ).issubset(prediction_ids):
            raise ValueError(
                "Dentist annotations must uniquely reference supplied detections"
            )
        return self


class ResearchModeStatus(BaseModel):
    enabled: bool
    provider: Literal["groq", "gemini"]
    model: str


class ResearchDifferential(BaseModel):
    diagnosis: str = Field(max_length=160)
    supporting_evidence: str = Field(max_length=240)
    evidence_against_or_missing: str = Field(max_length=240)


ResearchTreatmentCategory = Literal[
    "monitoring or observation",
    "restorative assessment",
    "endodontic assessment",
    "periodontal assessment",
    "oral surgery assessment",
    "prosthodontic assessment",
    "further diagnostic work-up",
    "no pathway inferable from available evidence",
]


class ResearchFindingNarrative(BaseModel):
    detection_id: str
    anatomical_location: str = Field(max_length=160)
    possible_diagnosis: str = Field(max_length=240)
    differential_diagnoses: List[ResearchDifferential] = Field(max_length=2)
    ai_interpretation: str = Field(max_length=500)
    clinical_significance: str = Field(max_length=320)
    recommended_investigations: List[str] = Field(max_length=3)
    potential_treatment_options: List[ResearchTreatmentCategory] = Field(
        max_length=4
    )
    follow_up: str = Field(max_length=320)
    evidence_and_limitations: List[str] = Field(max_length=3)
    related_detection_ids: List[str] = Field(max_length=100)
    dentist_annotation_comparison: str = Field(max_length=240)


class ResearchNarrativePayload(BaseModel):
    findings: List[ResearchFindingNarrative]
    combined_clinical_interpretation: str = Field(max_length=1000)
    cross_finding_patterns: List[str] = Field(max_length=4)


class ResearchFindingAnalysis(ResearchFindingNarrative):
    finding_name: str
    model_confidence: float


class ResearchAnalysis(BaseModel):
    research_mode: str = "research"
    model: str
    generated_at: datetime = Field(default_factory=datetime.now)
    findings: List[ResearchFindingAnalysis]
    combined_clinical_interpretation: str
    cross_finding_patterns: List[str]
    source_scope: str = (
        "No external dental literature was retrieved; no citations are provided."
    )
    limitations: str = (
        "Exploratory AI-generated research hypotheses only. Not a diagnosis, "
        "treatment plan, or validated clinical protocol. Verify image findings "
        "and all clinical conclusions with a qualified dentist and patient context."
    )


class ResearchAnalysisResponse(BaseModel):
    analysis: ResearchAnalysis
    model_predictions: List[Detection]
