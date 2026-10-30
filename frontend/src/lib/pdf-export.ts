import jsPDF from "jspdf";
import type {
  DiagnosticReport,
  Detection,
  DicomMetadata,
  ImageInfo,
} from "./types";
import { getDetectionColor } from "./constants";

/**
 * Generate an annotated image with detection overlays as a data URL
 */
export const generateAnnotatedImage = async (
  originalImageSrc: string,
  detections: Detection[],
  originalWidth: number,
  originalHeight: number
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      // Set canvas dimensions to match original image
      canvas.width = originalWidth;
      canvas.height = originalHeight;

      // Draw the original image
      ctx.drawImage(img, 0, 0, originalWidth, originalHeight);

      // Draw detection overlays
      detections.forEach((detection, index) => {
        const boxColor = getDetectionColor(detection.class_id);
        const left = detection.x - detection.width / 2;
        const top = detection.y - detection.height / 2;

        // Draw bounding box
        ctx.strokeStyle = boxColor;
        ctx.lineWidth = 3;
        ctx.strokeRect(left, top, detection.width, detection.height);

        // Draw label background
        const label = String(index + 1).padStart(2, "0");
        ctx.font = "bold 14px Arial";
        const labelMetrics = ctx.measureText(label);
        const labelWidth = labelMetrics.width + 8;
        const labelHeight = 20;

        // Position label above the box, but ensure it stays within image bounds
        const labelX = Math.max(
          0,
          Math.min(left, originalWidth - labelWidth)
        );
        const labelY = Math.max(labelHeight, top - 2);

        // Draw label background
        ctx.fillStyle = boxColor;
        ctx.fillRect(labelX, labelY - labelHeight, labelWidth, labelHeight);

        // Draw label text
        ctx.fillStyle = "white";
        ctx.fillText(label, labelX + 4, labelY - 6);
      });

      // Convert canvas to data URL
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      resolve(dataUrl);
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    img.src = originalImageSrc;
  });
};

export interface PDFExportData {
  report: DiagnosticReport;
  detections: Detection[];
  metadata: DicomMetadata;
  imageInfo: ImageInfo;
  fileName: string;
  originalImageSrc?: string; // Add original image source for annotation
  finalImpressionDraft?: string;
}

export const exportToPDF = async (data: PDFExportData): Promise<void> => {
  try {
    // Generate annotated image if we have the original image source and detections
    let annotatedImageDataUrl: string | null = null;
    if (
      data.originalImageSrc &&
      data.detections.length > 0 &&
      data.imageInfo.original_shape
    ) {
      try {
        annotatedImageDataUrl = await generateAnnotatedImage(
          data.originalImageSrc,
          data.detections,
          data.imageInfo.original_shape[1], // width
          data.imageInfo.original_shape[0] // height
        );
      } catch (error) {
        console.warn("Failed to generate annotated image for PDF:", error);
      }
    }

    // Create a new jsPDF instance
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let yPosition = margin;

    // Add title
    pdf.setFontSize(20);
    pdf.setFont("helvetica", "bold");
    pdf.text("X-Ray Diagnostic Report", margin, yPosition);
    yPosition += 15;

    // Add a line separator
    pdf.setLineWidth(0.5);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    // Add patient information
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Patient Information", margin, yPosition);
    yPosition += 8;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");

    if (data.metadata.patient_name) {
      pdf.text(
        `Patient Name: ${data.metadata.patient_name}`,
        margin,
        yPosition
      );
      yPosition += 6;
    }

    if (data.metadata.patient_id) {
      pdf.text(`Patient ID: ${data.metadata.patient_id}`, margin, yPosition);
      yPosition += 6;
    }

    if (data.metadata.study_date) {
      pdf.text(`Study Date: ${data.metadata.study_date}`, margin, yPosition);
      yPosition += 6;
    }

    if (data.metadata.modality) {
      pdf.text(`Modality: ${data.metadata.modality}`, margin, yPosition);
      yPosition += 6;
    }

    yPosition += 5;

    // Add annotated image if available
    if (annotatedImageDataUrl) {
      // Check if we need a new page for the image
      const imageMaxHeight = 100; // mm
      if (yPosition + imageMaxHeight + 20 > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }

      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Annotated X-Ray Image", margin, yPosition);
      yPosition += 10;

      // Calculate image dimensions to fit within content area
      const originalWidth = data.imageInfo.original_shape?.[1] || 1;
      const originalHeight = data.imageInfo.original_shape?.[0] || 1;
      const aspectRatio = originalWidth / originalHeight;

      let imageWidth = contentWidth;
      let imageHeight = imageWidth / aspectRatio;

      // If image is too tall, scale by height instead
      if (imageHeight > imageMaxHeight) {
        imageHeight = imageMaxHeight;
        imageWidth = imageHeight * aspectRatio;
      }

      // Center the image horizontally
      const imageX = margin + (contentWidth - imageWidth) / 2;

      try {
        pdf.addImage(
          annotatedImageDataUrl,
          "JPEG",
          imageX,
          yPosition,
          imageWidth,
          imageHeight
        );
        yPosition += imageHeight + 15;
      } catch (error) {
        console.warn("Failed to add image to PDF:", error);
        // Continue without the image
      }
    }

    // Add model limitations
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Uncertainty and Limitations", margin, yPosition);
    yPosition += 8;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    const limitationLines = pdf.splitTextToSize(
      data.report.uncertainty_and_limitations,
      contentWidth
    );

    if (yPosition + limitationLines.length * 5 > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
    }

    pdf.text(limitationLines, margin, yPosition);
    yPosition += limitationLines.length * 5 + 10;

    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    if (yPosition + 20 > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
    }

    pdf.text("Suggested Clinical Assessments", margin, yPosition);
    yPosition += 8;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");

    data.report.suggested_assessments.forEach((assessment, index) => {
      const findingIndex = data.detections.findIndex(
        (detection) => detection.detection_id === assessment.detection_id
      );
      if (findingIndex < 0) return;

      const assessmentLines = pdf.splitTextToSize(
        `${index + 1}. Finding ${findingIndex + 1} (${data.detections[findingIndex].class}): ${assessment.suggestion}`,
        contentWidth - 5
      );
      if (yPosition + assessmentLines.length * 5 > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }
      pdf.text(assessmentLines, margin + 5, yPosition);
      yPosition += assessmentLines.length * 5 + 2;
    });

    yPosition += 5;

    if (data.finalImpressionDraft?.trim()) {
      if (yPosition + 20 > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }

      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Dentist's Review and Final Impression — Draft", margin, yPosition);
      yPosition += 8;

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "italic");
      pdf.text(
        "Not saved, identity-verified, or confirmed as a final clinical record.",
        margin,
        yPosition
      );
      yPosition += 8;

      pdf.setFont("helvetica", "normal");
      const impressionLines = pdf.splitTextToSize(
        data.finalImpressionDraft,
        contentWidth
      );
      if (yPosition + impressionLines.length * 5 > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }
      pdf.text(impressionLines, margin, yPosition);
      yPosition += impressionLines.length * 5 + 5;
    }

    yPosition += 5;

    // Add detections summary
    if (data.detections.length > 0) {
      // Check if we need a new page
      if (yPosition + 30 > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }

      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Detection Summary", margin, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");

      data.detections.forEach((detection, index) => {
        // Check if we need a new page
        if (yPosition + 15 > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }

        pdf.text(
          `${index + 1}. ${detection.class} (Model score: ${(
            detection.confidence * 100
          ).toFixed(1)}%)`,
          margin,
          yPosition
        );
        yPosition += 6;

        const bboxText = `   Model box center: x=${detection.x}, y=${detection.y}; size: ${detection.width} × ${detection.height}px`;
        pdf.text(bboxText, margin, yPosition);
        yPosition += 6;

        yPosition += 2;
      });
    }

    // Add metadata
    yPosition += 10;

    // Check if we need a new page
    if (yPosition + 30 > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
    }

    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Technical Information", margin, yPosition);
    yPosition += 8;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");

    pdf.text(`File: ${data.fileName}`, margin, yPosition);
    yPosition += 6;

    if (data.imageInfo.original_shape) {
      pdf.text(
        `Original Image Size: ${data.imageInfo.original_shape.join("×")}`,
        margin,
        yPosition
      );
      yPosition += 6;
    }

    if (data.imageInfo.converted_size) {
      pdf.text(
        `Processed Size: ${data.imageInfo.converted_size.join("×")}`,
        margin,
        yPosition
      );
      yPosition += 6;
    }

    if (data.metadata.manufacturer) {
      pdf.text(`Equipment: ${data.metadata.manufacturer}`, margin, yPosition);
      yPosition += 6;
    }

    yPosition += 10;

    // Add footer with generation info
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "italic");
    const footerText = `Report generated on ${new Date(
      data.report.generated_at
    ).toLocaleString()}`;
    pdf.text(footerText, margin, pageHeight - 10);

    // Save the PDF
    const pdfFileName = `diagnostic-report-${data.fileName.replace(
      /\.[^/.]+$/,
      ""
    )}-${new Date().toISOString().split("T")[0]}.pdf`;
    pdf.save(pdfFileName);
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw new Error("Failed to generate PDF report");
  }
};
