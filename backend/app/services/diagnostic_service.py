from functools import lru_cache
from typing import List

from ..models.detection import Detection, DiagnosticReport, SuggestedClinicalAssessment


_CLASS_ASSESSMENT_GUIDANCE = {
    "abscess": (
        "Review the periapical region for radiolucency, periodontal-ligament "
        "widening, or loss of lamina dura, and note the relationship to the "
        "root apex and adjacent anatomy. Correlate with pulp sensibility "
        "testing, percussion and palpation, symptoms, and any swelling or "
        "sinus tract. A radiograph alone cannot establish an abscess or its "
        "cause."
    ),
    "attrition": (
        "Inspect occlusal and incisal surfaces for loss of tooth structure "
        "and wear facets. Correlate with the clinical wear pattern, occlusion, "
        "sensitivity, and history of parafunction or dietary acid exposure. "
        "A radiograph alone cannot establish the cause or activity of wear."
    ),
    "bone loss": (
        "Assess the alveolar crest relative to the cemento-enamel junction, "
        "the distribution and horizontal or angular pattern, and any "
        "furcation involvement. Correlate with periodontal probing, clinical "
        "attachment levels, and the periodontal chart. Do not assign a "
        "periodontitis stage or grade from this detection or image alone."
    ),
    "calculus": (
        "Inspect the marked root and interproximal surfaces for discrete "
        "radiopaque deposits, distinguishing them from restorations and "
        "superimposition. Correlate with clinical calculus detection, "
        "periodontal probing, and bleeding on probing. A negative or "
        "equivocal radiograph does not exclude calculus."
    ),
    "caries": (
        "Inspect the marked surface for a radiolucency and its apparent "
        "relationship to enamel, dentin, and the pulp; check for proximal "
        "overlap, cervical burnout, and restoration-related artifacts. "
        "Correlate with a clinical visual examination, symptoms, and caries "
        "risk. The image and model label alone cannot establish lesion "
        "activity, cavitation, or treatment need."
    ),
    "cavity": (
        "Inspect the marked surface for a radiolucency and its apparent "
        "relationship to enamel, dentin, and the pulp; check for proximal "
        "overlap, cervical burnout, and restoration-related artifacts. "
        "Correlate with a clinical visual examination, symptoms, and caries "
        "risk. The image and model label alone cannot establish lesion "
        "activity, cavitation, or treatment need."
    ),
    "cyst": (
        "Review the lesion's location, border, size, and relationship to "
        "tooth apices and adjacent structures; compare prior images when "
        "available. Correlate with pulp sensibility tests and clinical "
        "findings. Radiographic appearance alone cannot confirm a cyst or "
        "reliably distinguish it from other periapical radiolucencies."
    ),
    "fracture line": (
        "Inspect the suspected line in relation to the crown, root, and "
        "restorations, and check whether it is visible on the source image "
        "rather than caused by superimposition or an imaging artifact. "
        "Correlate with symptoms, bite testing, percussion, mobility, "
        "periodontal probing, and direct examination as indicated. A single "
        "2D image cannot confirm or exclude a fracture."
    ),
    "furcation": (
        "Inspect the inter-radicular area for radiolucency and assess it "
        "alongside the adjacent crestal bone and root anatomy. Correlate "
        "with clinical furcation probing and periodontal charting; do not "
        "grade furcation involvement from the model label or a single "
        "2D projection."
    ),
    "impacted": (
        "Next step: Confirm the marked region on the full-resolution image "
        "and identify the tooth clinically. Assess eruption status, "
        "angulation, depth, root development, and relationships to adjacent "
        "teeth and visible anatomy; correlate with examination and eruption "
        "history. Consider additional imaging only when clinically indicated "
        "and needed for management. This model label alone does not confirm "
        "impaction or establish surgical risk."
    ),
    "impaction": (
        "Next step: Confirm the marked region on the full-resolution image "
        "and identify the tooth clinically. Assess eruption status, "
        "angulation, depth, root development, and relationships to adjacent "
        "teeth and visible anatomy; correlate with examination and eruption "
        "history. Consider additional imaging only when clinically indicated "
        "and needed for management. This model label alone does not confirm "
        "impaction or establish surgical risk."
    ),
    "restoration": (
        "Next step: Confirm that the marked region corresponds to a "
        "restoration on the full-resolution image. Inspect its visible "
        "margins and contour and assess adjacent tooth structure for a "
        "separate radiolucency; correlate with clinical examination and "
        "prior images when available. A restoration label alone does not "
        "indicate recurrent caries or restoration failure."
    ),
    "root canal": (
        "Next step: Confirm the marked tooth and whether the image shows "
        "previous endodontic treatment. If treated, assess the visible canal "
        "filling, periapical tissues, and coronal seal; compare prior images "
        "and correlate with symptoms and clinical examination. This label "
        "alone cannot establish treatment success or failure, or a need for "
        "retreatment."
    ),
    "amalgam filling": (
        "Treat this as a possible restoration/material label, not a diagnosis. "
        "Inspect the restoration's extent, contour, and margins, and assess "
        "adjacent tooth structure for a separate radiolucency. Correlate "
        "with clinical examination; radiographic overlap or the material "
        "label alone does not establish recurrent caries or restoration "
        "failure."
    ),
    "composite filling": (
        "Treat this as a possible restoration/material label, not a diagnosis. "
        "Inspect the restoration's extent, contour, and margins, and assess "
        "adjacent tooth structure for a separate radiolucency. Correlate "
        "with clinical examination; radiographic overlap or the material "
        "label alone does not establish recurrent caries or restoration "
        "failure."
    ),
    "filling": (
        "Treat this as a possible restoration label, not a diagnosis. Inspect "
        "the restoration's extent, contour, and margins, and assess adjacent "
        "tooth structure for a separate radiolucency. Correlate with clinical "
        "examination; the label alone does not establish recurrent caries "
        "or restoration failure."
    ),
    "crown": (
        "Treat this as a possible crown/restoration label, not a diagnosis. "
        "Inspect the visible margins, contour, and adjacent tooth structure "
        "for a separate radiolucency or overhang, accounting for artifacts "
        "and superimposition. Correlate with clinical examination; the "
        "label alone does not establish recurrent caries or failure."
    ),
    "maxilla": (
        "This is an anatomical-region label, not a disease finding. Confirm "
        "the location on the full-resolution source image and interpret any "
        "separate abnormality independently; do not infer a diagnosis from "
        "this label."
    ),
    "mandible": (
        "This is an anatomical-region label, not a disease finding. Confirm "
        "the location on the full-resolution source image and interpret any "
        "separate abnormality independently; do not infer a diagnosis from "
        "this label."
    ),
    "nerve": (
        "Treat this as a possible anatomy annotation, not a disease finding. "
        "Verify the structure and its course on the full-resolution source "
        "image. Do not rely on the model box for nerve localization or "
        "surgical planning."
    ),
    "no image augmentation techniques were applied.": (
        "This label describes image processing, not a clinical finding. "
        "Exclude it from clinical interpretation and verify the model's "
        "class mapping before using it in a clinical workflow."
    ),
}


def _assessment_guidance(class_label: str) -> str:
    normalized_label = " ".join(class_label.casefold().split())
    guidance = _CLASS_ASSESSMENT_GUIDANCE.get(normalized_label)
    if guidance is not None:
        return guidance

    if "implant" in normalized_label:
        return (
            "Treat this as a possible implant/device label, not a diagnosis "
            "or a finding of implant health. Inspect crestal bone levels and "
            "any peri-implant radiolucency, comparing with prior images when "
            "available. Correlate with peri-implant probing, bleeding or "
            "suppuration, soft-tissue findings, and mobility. This detection "
            "alone cannot establish osseointegration or peri-implant disease."
        )

    return (
        "No class-specific assessment guidance is configured for this label. "
        "Next step: Verify the model's class definition, confirm the marked "
        "region on the full-resolution image, and have a dentist interpret "
        "the finding with clinical context. Do not infer a diagnosis or "
        "management plan from this label."
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
                "These class-specific next steps are for clinician review, "
                "not diagnoses or treatment recommendations, and have not been "
                "independently validated as a clinical protocol. Model scores "
                "are not calibrated diagnostic probabilities; detections may "
                "be false, missed, or duplicated, and no tooth number is "
                "inferred. A dentist must review the source radiograph and "
                "clinical context before documenting a conclusion."
            ),
            suggested_assessments=assessments,
        )


@lru_cache()
def get_diagnostic_report_service() -> DiagnosticReportService:
    """Dependency injection for diagnostic report generation."""
    return DiagnosticReportService()
