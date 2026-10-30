from functools import lru_cache
from typing import List

from ..models.detection import Detection, DiagnosticReport, SuggestedClinicalAssessment


_CLASS_ASSESSMENT_GUIDANCE = {
    "abscess": "Flag the marked area for dentist review; record reported symptoms using clinic protocol and have relevant history ready.",
    "attrition": "Have the patient's sensitivity and wear history ready; flag the marked teeth for the dentist.",
    "bone loss": "Have prior radiographs and existing periodontal charting ready for dentist comparison.",
    "calculus": "Have existing periodontal charting ready; flag the marked area for the dentist.",
    "caries": "Record any reported pain or sensitivity and flag the marked area before the dentist's review.",
    "cavity": "Record any reported pain or sensitivity and flag the marked area before the dentist's review.",
    "cyst": "Have prior radiographs and relevant dental history ready for the dentist to compare.",
    "fracture line": "Flag the area for dentist review; have symptom history and prior images ready.",
    "furcation": "Have existing periodontal charting and prior radiographs ready for dentist review.",
    "impacted": "Confirm the tooth with the dentist; have prior images and relevant symptom history ready.",
    "impaction": "Confirm the tooth with the dentist; have prior images and relevant symptom history ready.",
    "restoration": "Check the chart for restoration history; flag the marked area for dentist review.",
    "root canal": "Check prior root-canal notes and pull earlier X-rays; ask the dentist whether follow-up is needed.",
    "amalgam filling": "Check the chart for restoration history; have prior images ready for the dentist.",
    "composite filling": "Check the chart for restoration history; have prior images ready for the dentist.",
    "filling": "Check the chart for restoration history; have prior images ready for the dentist.",
    "crown": "Check the chart for crown history; have prior radiographs ready for dentist review.",
    "maxilla": "Have the full radiograph ready and ask the dentist to confirm the marked region.",
    "mandible": "Have the full radiograph ready and ask the dentist to confirm the marked region.",
    "nerve": "Flag the marked area for the dentist and have the full-resolution radiograph ready.",
    "no image augmentation techniques were applied.": "Exclude this processing label from the handoff and flag it for model review.",
}


def _assessment_guidance(class_label: str) -> str:
    normalized_label = " ".join(class_label.casefold().split())
    guidance = _CLASS_ASSESSMENT_GUIDANCE.get(normalized_label)
    if guidance is not None:
        return guidance

    if "implant" in normalized_label:
        return "Have prior implant radiographs and existing periodontal charting ready for dentist review."

    return (
        "Have the marked radiograph and relevant chart history ready; ask the dentist to confirm the finding."
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
