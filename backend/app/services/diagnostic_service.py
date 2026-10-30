from functools import lru_cache
from typing import List

from ..models.detection import Detection, DiagnosticReport, SuggestedClinicalAssessment


_CLASS_ASSESSMENT_GUIDANCE = {
    "abscess": "Assess the periapical area; correlate with pulp tests, percussion, palpation and symptoms.",
    "attrition": "Inspect wear facets and remaining tooth structure; correlate with occlusion, sensitivity and parafunction history.",
    "bone loss": "Assess crestal level and bone-loss pattern; correlate with probing depths, attachment levels and furcation findings.",
    "calculus": "Inspect interproximal roots for radiopaque deposits; correlate with periodontal probing and bleeding on probing.",
    "caries": "Assess lesion depth and proximity to the pulp; correlate with visual examination, symptoms and caries risk.",
    "cavity": "Assess lesion depth and proximity to the pulp; correlate with visual examination, symptoms and caries risk.",
    "cyst": "Review lesion borders, size and relation to tooth apices; compare prior images and correlate with pulp tests.",
    "fracture line": "Inspect the suspected line on the source image; correlate with bite testing, percussion, mobility and probing.",
    "furcation": "Assess inter-radicular bone; correlate with clinical furcation probing and periodontal charting.",
    "impacted": "Confirm tooth identity and eruption status; assess angulation, depth, root development and relation to adjacent anatomy.",
    "impaction": "Confirm tooth identity and eruption status; assess angulation, depth, root development and relation to adjacent anatomy.",
    "restoration": "Confirm the restoration; inspect its margins and contour, and assess adjacent tooth structure for caries.",
    "root canal": "Confirm prior endodontic treatment; assess canal filling, periapical tissues and coronal seal, comparing prior images.",
    "amalgam filling": "Inspect restoration margins and adjacent tooth structure; correlate with clinical examination.",
    "composite filling": "Inspect restoration margins and adjacent tooth structure; correlate with clinical examination.",
    "filling": "Inspect restoration margins and adjacent tooth structure; correlate with clinical examination.",
    "crown": "Inspect crown margins, contour and adjacent tooth structure; correlate with clinical examination.",
    "maxilla": "Confirm the marked anatomical region; assess any separate abnormality independently.",
    "mandible": "Confirm the marked anatomical region; assess any separate abnormality independently.",
    "nerve": "Verify the structure and course on the full-resolution image before clinical use.",
    "no image augmentation techniques were applied.": "Verify the model class mapping; exclude this processing label from clinical findings.",
}


def _assessment_guidance(class_label: str) -> str:
    normalized_label = " ".join(class_label.casefold().split())
    guidance = _CLASS_ASSESSMENT_GUIDANCE.get(normalized_label)
    if guidance is not None:
        return guidance

    if "implant" in normalized_label:
        return "Assess crestal bone and peri-implant tissues; correlate with probing and prior images."

    return (
        "Verify the model class; inspect the marked region on the full-resolution image and correlate with examination."
    )


class DiagnosticReportService:
    """Create class-specific, non-diagnostic next steps from detections."""

    async def generate_diagnostic_report(
        self, detections: List[Detection]
    ) -> DiagnosticReport:
        assessments = [
            SuggestedClinicalAssessment(
                detection_id=detection.detection_id,
                suggestion=_assessment_guidance(detection.class_),
            )
            for detection in detections
        ]

        return DiagnosticReport(
            uncertainty_and_limitations=(
                "Model findings are preliminary; a dentist must confirm them "
                "before documenting a conclusion."
            ),
            suggested_assessments=assessments,
        )


@lru_cache()
def get_diagnostic_report_service() -> DiagnosticReportService:
    """Dependency injection for diagnostic report generation."""
    return DiagnosticReportService()
