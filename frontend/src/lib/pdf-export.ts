import jsPDF from "jspdf";
import type {
  ClinicalFindingReviewStatus,
  ClinicalReviewDraft,
  DiagnosticReport,
  Detection,
  DicomMetadata,
  ImageInfo,
  ResearchAnalysis,
} from "./types";
import { getDetectionColor } from "./constants";

export const generateAnnotatedImage = async (
  originalImageSrc: string,
  detections: Detection[],
  originalWidth: number,
  originalHeight: number
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";

    image.onload = () => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      canvas.width = originalWidth;
      canvas.height = originalHeight;
      context.drawImage(image, 0, 0, originalWidth, originalHeight);
      detections.forEach((detection, index) => {
        const color = getDetectionColor(detection.class_id);
        const left = detection.x - detection.width / 2;
        const top = detection.y - detection.height / 2;
        context.strokeStyle = color;
        context.lineWidth = Math.max(2, originalWidth / 500);
        context.strokeRect(left, top, detection.width, detection.height);

        const label = String(index + 1).padStart(2, "0");
        context.font = `bold ${Math.max(14, originalWidth / 80)}px Arial`;
        const labelWidth = context.measureText(label).width + 10;
        const labelHeight = Math.max(20, originalWidth / 60);
        const labelX = Math.max(0, Math.min(left, originalWidth - labelWidth));
        const labelY = Math.max(labelHeight, top - 2);
        context.fillStyle = color;
        context.fillRect(labelX, labelY - labelHeight, labelWidth, labelHeight);
        context.fillStyle = "white";
        context.fillText(
          label,
          labelX + 5,
          labelY - Math.max(5, labelHeight * 0.25)
        );
      });
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };

    image.onerror = () => reject(new Error("Failed to load radiograph"));
    image.src = originalImageSrc;
  });
};

export interface PDFExportData {
  report?: DiagnosticReport;
  researchAnalysis?: ResearchAnalysis;
  review: ClinicalReviewDraft;
  detections: Detection[];
  rawDetections?: Detection[];
  metadata: DicomMetadata;
  imageInfo: ImageInfo;
  fileName: string;
  originalImageSrc?: string;
}

const STATUS_LABELS: Record<ClinicalFindingReviewStatus, string> = {
  awaiting_review: "Awaiting review",
  confirmed: "Dentist confirmed locally",
  modified: "Modified by dentist",
  not_applicable: "Not applicable",
};

export const exportToPDF = async (data: PDFExportData): Promise<void> => {
  try {
    let annotatedImage: string | undefined;
    const imageWidth =
      data.imageInfo.converted_size[0] ??
      data.imageInfo.original_shape[1] ??
      1;
    const imageHeight =
      data.imageInfo.converted_size[1] ??
      data.imageInfo.original_shape[0] ??
      1;
    if (data.originalImageSrc && imageWidth > 0 && imageHeight > 0) {
      annotatedImage = await generateAnnotatedImage(
        data.originalImageSrc,
        data.detections,
        imageWidth,
        imageHeight
      );
    }

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 16;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    const ensureRoom = (height: number) => {
      if (y + height > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }
    };

    const addHeading = (title: string) => {
      ensureRoom(14);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor("#142b4a");
      pdf.text(title, margin, y);
      y += 6;
      pdf.setDrawColor("#dfe6ed");
      pdf.setLineWidth(0.25);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 5;
    };

    const addText = (
      text: string,
      options: { size?: number; color?: string; indent?: number } = {}
    ) => {
      const size = options.size ?? 9;
      const lineHeight = size * 0.48;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(size);
      pdf.setTextColor(options.color ?? "#344861");
      const lines = pdf.splitTextToSize(
        text || "Not provided",
        contentWidth - (options.indent ?? 0)
      ) as string[];
      lines.forEach((line) => {
        ensureRoom(lineHeight + 1);
        pdf.text(line, margin + (options.indent ?? 0), y);
        y += lineHeight;
      });
      y += 1.5;
    };

    const addLabelValue = (label: string, value?: string) => {
      addText(`${label}: ${value || "Not provided"}`, { size: 9 });
    };

    const addResearchItems = (label: string, items: string[]) => {
      items.forEach((item) => addText(`${label}: ${item}`, { size: 8, indent: 2 }));
    };

    const rawCount = (data.rawDetections ?? data.detections).length;
    const categoryCount = new Set(
      data.detections.map((detection) => detection.class.trim().toLowerCase())
    ).size;
    const reviewEntries = data.detections.map((detection) => ({
      detection,
      review: data.review.findings[detection.detection_id] ?? {
        status: "awaiting_review" as const,
        observations: "",
      },
    }));
    const confirmedCount = reviewEntries.filter(
      ({ review }) => review.status === "confirmed"
    ).length;
    const awaitingCount = reviewEntries.filter(
      ({ review }) => review.status === "awaiting_review"
    ).length;
    const localizedTeeth = new Set(
      reviewEntries
        .map(({ review }) => review.toothNumber)
        .filter((tooth): tooth is string => Boolean(tooth))
    );

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(20);
    pdf.setTextColor("#142b4a");
    pdf.text("Dentra AI · Clinical Review", margin, y);
    y += 8;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor("#65778e");
    pdf.text("AI findings are preliminary until reviewed by a dentist.", margin, y);
    y += 8;

    addHeading("1. Study information");
    addLabelValue("Patient", data.metadata.patient_name);
    addLabelValue("Patient ID", data.metadata.patient_id);
    addLabelValue("Study date", data.metadata.study_date);
    addLabelValue("Study", data.metadata.study_description || data.fileName);
    addLabelValue("Series", data.metadata.series_description);
    addLabelValue("Modality", data.metadata.modality);

    addHeading("2. Image modality and quality");
    addLabelValue(
      "Image dimensions",
      `${imageWidth ?? "—"} × ${imageHeight ?? "—"} px`
    );
    addLabelValue("Preview format", data.imageInfo.converted_format);
    addLabelValue(
      "Image quality",
      "Not independently assessed by this application"
    );
    addLabelValue("Manufacturer", data.metadata.manufacturer);

    addHeading("3. Visual findings summary");
    addLabelValue("Raw model detections", String(rawCount));
    addLabelValue("Findings shown after duplicate review", String(data.detections.length));
    addLabelValue("Distinct model labels", String(categoryCount));
    addLabelValue("Dentist-confirmed locally", String(confirmedCount));
    addLabelValue("Awaiting review", String(awaitingCount));

    addHeading("4. Dental chart · FDI");
    addText(
      "Tooth locations shown here were explicitly assigned during dentist review. The AI did not infer tooth numbers.",
      { size: 8, color: "#65778e" }
    );
    const chartRows = [
      [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
      [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
    ];
    chartRows.forEach((teeth) => {
      ensureRoom(10);
      const cellWidth = contentWidth / teeth.length;
      teeth.forEach((tooth, index) => {
        const x = margin + index * cellWidth;
        const toothKey = String(tooth);
        const toothFindings = reviewEntries.filter(
          ({ review }) => review.toothNumber === toothKey
        );
        const assigned = toothFindings.length > 0;
        pdf.setFillColor(assigned ? "#d7f0ed" : "#f7f8fa");
        pdf.setDrawColor(assigned ? "#16a6a1" : "#dfe6ed");
        pdf.roundedRect(x + 0.5, y, cellWidth - 1, 7, 1, 1, "FD");
        pdf.setFont("helvetica", assigned ? "bold" : "normal");
        pdf.setFontSize(6);
        pdf.setTextColor(assigned ? "#0c706c" : "#64748b");
        pdf.text(String(tooth), x + cellWidth / 2, y + 4.5, {
          align: "center",
        });
        toothFindings.slice(0, 3).forEach(({ detection }, markerIndex) => {
          const color = getDetectionColor(detection.class_id);
          pdf.setFillColor(
            parseInt(color.slice(1, 3), 16),
            parseInt(color.slice(3, 5), 16),
            parseInt(color.slice(5, 7), 16)
          );
          pdf.circle(
            x + cellWidth / 2 + (markerIndex - (Math.min(toothFindings.length, 3) - 1) / 2) * 1.8,
            y + 6,
            0.65,
            "F"
          );
        });
      });
      y += 9;
    });
    addText(
      localizedTeeth.size
        ? `Dentist-located FDI teeth: ${Array.from(localizedTeeth).join(", ")}`
        : "No tooth numbers identified or assigned.",
      { size: 8 }
    );

    addHeading("5. Annotated radiographic evidence");
    if (annotatedImage) {
      const maxHeight = 100;
      const ratio = imageWidth / imageHeight;
      const imageDrawWidth = Math.min(contentWidth, maxHeight * ratio);
      const imageDrawHeight = imageDrawWidth / ratio;
      ensureRoom(imageDrawHeight + 3);
      pdf.addImage(
        annotatedImage,
        "JPEG",
        margin + (contentWidth - imageDrawWidth) / 2,
        y,
        imageDrawWidth,
        imageDrawHeight
      );
      y += imageDrawHeight + 4;
      addText(
        "Display-only numbered boxes indicate model detections. The original source image is unchanged.",
        { size: 8, color: "#65778e" }
      );
    } else {
      addText("Radiograph preview was unavailable for export.", { size: 8 });
    }

    addHeading("6. Detailed findings");
    if (reviewEntries.length === 0) {
      addText("No model detections were returned. This does not exclude disease.");
    }
    reviewEntries.forEach(({ detection, review }, index) => {
      ensureRoom(15);
      const label = review.modifiedLabel || detection.class;
      const tooth = review.toothNumber
        ? `FDI ${review.toothNumber} · dentist-located`
        : "Tooth not identified";
      addText(
        `${String(index + 1).padStart(2, "0")} · ${label} · ${tooth} · ${STATUS_LABELS[review.status]}`,
        { size: 9, color: "#142b4a" }
      );
      addText(
        `Model score: ${(detection.confidence * 100).toFixed(1)}% (not a diagnostic probability). Center: ${detection.x.toFixed(1)}, ${detection.y.toFixed(1)} px. Bounding box: ${detection.width} × ${detection.height} px.`,
        { size: 8, indent: 2 }
      );
      if (review.observations.trim()) {
        addText(`Dentist observation: ${review.observations}`, {
          size: 8,
          indent: 2,
        });
      }
      y += 1;
    });

    const researchAnalysis = data.researchAnalysis;
    if (researchAnalysis) {
      addHeading("AI Research Mode · exploratory and unverified");
      addText(
        `LePro AI · Generated: ${new Date(researchAnalysis.generated_at).toLocaleString()}`
      );
      addText(
        `Combined interpretation: ${researchAnalysis.combined_clinical_interpretation}`,
        { size: 8 }
      );
      researchAnalysis.cross_finding_patterns.forEach((pattern) =>
        addText(`Cross-finding pattern: ${pattern}`, { size: 8, indent: 2 })
      );
      researchAnalysis.findings.forEach((finding) => {
        const detectionIndex = data.detections.findIndex(
          (detection) => detection.detection_id === finding.detection_id
        );
        if (detectionIndex < 0) return;
        addText(
          `Finding ${detectionIndex + 1} · ${finding.finding_name} · model score ${(finding.model_confidence * 100).toFixed(1)}%`,
          { size: 9, color: "#142b4a" }
        );
        addText(`Possible diagnosis (unconfirmed): ${finding.possible_diagnosis}`, {
          size: 8,
          indent: 2,
        });
        addText(`Location: ${finding.anatomical_location}`, {
          size: 8,
          indent: 2,
        });
        addText(`Interpretation: ${finding.ai_interpretation}`, {
          size: 8,
          indent: 2,
        });
        finding.differential_diagnoses.forEach((differential) =>
          addText(
            `Differential: ${differential.diagnosis}. Supporting: ${differential.supporting_evidence}. Missing/against: ${differential.evidence_against_or_missing}`,
            { size: 8, indent: 2 }
          )
        );
        addText(`Clinical significance: ${finding.clinical_significance}`, {
          size: 8,
          indent: 2,
        });
        addResearchItems("Investigations", finding.recommended_investigations);
        addResearchItems(
          "Potential care pathways for dentist discussion",
          finding.potential_treatment_options
        );
        addResearchItems("Follow-up", [finding.follow_up]);
        addResearchItems("Evidence and limitations", finding.evidence_and_limitations);
        addResearchItems("Manual annotation comparison (unverified)", [
          finding.dentist_annotation_comparison,
        ]);
        y += 1;
      });
      addText(
        `${researchAnalysis.source_scope} ${researchAnalysis.limitations}`,
        { size: 8, color: "#65778e" }
      );
    }

    addHeading("7. Assistant preparation");
    const assessments = data.report?.suggested_assessments ?? [];
    const validAssessments = assessments.filter((assessment) =>
      data.detections.some(
        (detection) => detection.detection_id === assessment.detection_id
      )
    );
    if (validAssessments.length === 0) {
      addText(
        "No configured next steps are available. Model labels alone do not provide a clinical diagnosis."
      );
    } else {
      validAssessments.forEach((assessment, index) => {
        const findingIndex = data.detections.findIndex(
          (detection) => detection.detection_id === assessment.detection_id
        );
        const finding = data.detections[findingIndex];
        addText(
          `${String(index + 1).padStart(2, "0")} · Finding ${findingIndex + 1} (${finding.class}): ${assessment.suggestion.replace(/^Finding \d+ \([^)]*\):\s*/i, "")}`,
          { size: 8 }
        );
      });
    }

    addHeading("8. Limitations and uncertainty");
    addText(
      data.report?.uncertainty_and_limitations ??
        "AI detections are preliminary model outputs, not diagnoses. Model scores are not calibrated diagnostic probabilities. This system does not determine tooth numbers, image quality, lesion activity, or treatment need. Review the source radiograph and clinical context before documenting a conclusion.",
      { size: 8 }
    );

    addHeading("9. Dentist's final impression");
    addText(
      data.review.finalImpression.trim() || "No final impression entered.",
      { size: 9 }
    );
    addText(
      "Dentist-entered review draft. This browser-only application does not authenticate the reviewer or save to a clinical record system.",
      { size: 8, color: "#65778e" }
    );

    addHeading("10. Review status and timestamp");
    addLabelValue(
      "Review status",
      awaitingCount === 0 && data.detections.length > 0
        ? "All findings reviewed locally"
        : `${awaitingCount} finding(s) awaiting review`
    );
    addLabelValue(
      "Saved locally",
      data.review.savedAt
        ? new Date(data.review.savedAt).toLocaleString()
        : "Not saved"
    );
    addLabelValue(
      "Assessment guidance generated",
      data.report?.generated_at
        ? new Date(data.report.generated_at).toLocaleString()
        : "Not generated"
    );
    addLabelValue("Report exported", new Date().toLocaleString());
    addText(
      "This export is a review aid and is not a signed, identity-verified, or final clinical record.",
      { size: 8, color: "#65778e" }
    );

    const pageCount = pdf.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      pdf.setPage(page);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor("#718198");
      pdf.text(
        `Dentra AI · Preliminary AI output · Page ${page} of ${pageCount}`,
        margin,
        pageHeight - 7
      );
    }

    const safeFileName = data.fileName.replace(/[<>:"/\\|?*\x00-\x1F]/g, "-");
    pdf.save(
      `clinical-review-${safeFileName.replace(/\.[^/.]+$/, "")}-${new Date()
        .toISOString()
        .split("T")[0]}.pdf`
    );
  } catch (error) {
    console.error("Error generating clinical report PDF", error);
    throw new Error("Failed to generate clinical report PDF");
  }
};
