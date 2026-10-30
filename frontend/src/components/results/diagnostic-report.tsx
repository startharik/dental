"use client";

import axios from "axios";
import {
  AlertCircle,
  Brain,
  Clock,
  Download,
  FileText,
  LocateFixed,
  Printer,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useGenerateDiagnosticReport } from "@/hooks/use-diagnostic-report";
import { exportToPDF, type PDFExportData } from "@/lib/pdf-export";
import type {
  Detection,
  DiagnosticReport,
  DicomMetadata,
  ImageInfo,
} from "@/lib/types";

interface DiagnosticReportComponentProps {
  predictions: Detection[];
  metadata: DicomMetadata;
  imageInfo: ImageInfo;
  report?: DiagnosticReport;
  onReportGenerated?: (report: DiagnosticReport) => void;
  onLocateFinding: (detectionId: string) => void;
  originalImageSrc?: string;
  fileName?: string;
}

export function DiagnosticReportComponent({
  predictions,
  metadata,
  imageInfo,
  report: externalReport,
  onReportGenerated,
  onLocateFinding,
  originalImageSrc,
  fileName,
}: DiagnosticReportComponentProps) {
  const [report, setReport] = useState<DiagnosticReport | null>(
    externalReport || null
  );
  const [finalImpressionDraft, setFinalImpressionDraft] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const generateReport = useGenerateDiagnosticReport();

  useEffect(() => {
    setReport(externalReport || null);
  }, [externalReport]);

  const handleGenerateReport = async () => {
    try {
      const response = await generateReport.mutateAsync({
        predictions,
        metadata,
        image_info: imageInfo,
      });
      setReport(response.diagnostic_report);
      onReportGenerated?.(response.diagnostic_report);
    } catch (error) {
      const message =
        axios.isAxiosError<{ detail?: string }>(error) &&
        typeof error.response?.data.detail === "string"
          ? error.response.data.detail
          : "Failed to generate the clinical review aid. Check the backend logs.";
      toast.error(message);
    }
  };

  const handleExportPDF = async () => {
    if (!report) return;

    setIsExporting(true);
    try {
      const exportData: PDFExportData = {
        report,
        detections: predictions,
        metadata,
        imageInfo,
        fileName: metadata.patient_name || fileName || "clinical-review",
        originalImageSrc,
        finalImpressionDraft,
      };
      await exportToPDF(exportData);
    } catch (error) {
      toast.error("Failed to export PDF");
      console.error("Failed to export diagnostic report", error);
    } finally {
      setIsExporting(false);
    }
  };

  const validAssessments =
    report?.suggested_assessments.filter((assessment) =>
      predictions.some(
        (detection) => detection.detection_id === assessment.detection_id
      )
    ) ?? [];
  const invalidAssessmentCount =
    (report?.suggested_assessments.length ?? 0) - validAssessments.length;

  return (
    <Card
      id="clinical-report"
      className="clinical-report-print w-full gap-0 overflow-hidden rounded-xl border-[#e3e9f0] bg-white py-0 shadow-[0_1px_3px_rgba(20,43,74,0.04)]"
    >
      <CardContent className="space-y-5 p-4 sm:p-6">
        <header className="flex flex-col gap-3 border-b border-[#e3e9f0] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#142b4a] text-white">
              <FileText className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[#142b4a]">
                Clinical review
              </h2>
              <p className="truncate text-xs text-[#8291a7]">
                {fileName || metadata.study_description || "Dental radiograph"}
              </p>
            </div>
          </div>

          <div className="clinical-report-no-print flex flex-wrap gap-2">
            {report && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.print()}
                >
                  <Printer className="size-4" />
                  Print
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isExporting}
                  onClick={handleExportPDF}
                >
                  {isExporting ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  {isExporting ? "Exporting..." : "Export PDF"}
                </Button>
              </>
            )}
            <Button
              type="button"
              size="sm"
              className="bg-[#0e7572] text-white hover:bg-[#095f5d]"
              disabled={generateReport.isPending}
              onClick={handleGenerateReport}
            >
              {generateReport.isPending ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : report ? (
                <Sparkles className="size-4" />
              ) : (
                <Brain className="size-4" />
              )}
              {generateReport.isPending
                ? "Generating..."
                : report
                  ? "Regenerate review"
                  : "Generate clinical review"}
            </Button>
          </div>
        </header>

        <div className="rounded-xl border border-[#f1ddb4] bg-[#fffbf2] p-3.5">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#9a650b]" />
            <p className="text-xs leading-5 text-[#73551e]">
              <strong>Draft only — not a final clinical record.</strong> Model
              findings are unconfirmed. A dentist must review the image and
              clinical examination, edit the final impression, and confirm it
              in the clinic&apos;s clinical record.
            </p>
          </div>
        </div>

        {report ? (
          <div className="space-y-5">
            <section
              aria-labelledby="evidence-heading"
              className="space-y-3"
            >
              <SectionHeading
                id="evidence-heading"
                number="01"
                title="Detected findings and supporting image evidence"
              />
              {predictions.length > 0 ? (
                <ol className="space-y-2">
                  {predictions.map((detection, index) => (
                    <li
                      key={detection.detection_id}
                      className="flex flex-col gap-2 rounded-xl border border-[#e3e9f0] bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#142b4a] text-[10px] font-bold text-white">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0">
                          <p className="break-words text-xs font-semibold capitalize text-[#172b45]">
                            {detection.class}
                          </p>
                          <p className="mt-1 text-[10px] text-[#8291a7]">
                            Supporting evidence: numbered model region{" "}
                            {String(index + 1).padStart(2, "0")} on the
                            radiograph. Tooth number is not inferred.
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="clinical-report-no-print w-fit"
                        onClick={() =>
                          onLocateFinding(detection.detection_id)
                        }
                      >
                        <LocateFixed className="size-4" />
                        Locate on image
                      </Button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="rounded-xl border border-[#e3e9f0] bg-[#f8fafc] p-4 text-xs leading-5 text-[#64748b]">
                  No model findings were returned. This does not exclude
                  disease; review the radiograph and clinical examination.
                </p>
              )}
            </section>

            <section
              aria-labelledby="uncertainty-heading"
              className="space-y-3"
            >
              <SectionHeading
                id="uncertainty-heading"
                number="02"
                title="Uncertainty and limitations"
              />
              <p className="rounded-xl border border-[#e3e9f0] bg-[#f8fafc] p-4 text-xs leading-6 text-[#52657d]">
                {report.uncertainty_and_limitations}
              </p>
              {invalidAssessmentCount > 0 && (
                <p
                  role="alert"
                  className="rounded-lg border border-[#f1c5c5] bg-[#fff1f1] p-3 text-xs text-[#a82c2c]"
                >
                  {invalidAssessmentCount} generated assessment
                  {invalidAssessmentCount === 1 ? " was" : "s were"} excluded
                  because it did not reference an actual finding in this image.
                </p>
              )}
            </section>

            <section
              aria-labelledby="assessment-heading"
              className="space-y-3"
            >
              <SectionHeading
                id="assessment-heading"
                number="03"
                title="Suggested clinical assessments"
              />
              {validAssessments.length > 0 ? (
                <ol className="space-y-2">
                  {validAssessments.map((assessment) => {
                    const findingIndex = predictions.findIndex(
                      (detection) =>
                        detection.detection_id === assessment.detection_id
                    );
                    const detection = predictions[findingIndex];

                    return (
                      <li
                        key={assessment.detection_id}
                        className="rounded-xl border border-[#e3e9f0] bg-white p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748b]">
                            Finding {String(findingIndex + 1).padStart(2, "0")}{" "}
                            · {detection.class}
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="clinical-report-no-print h-7 px-2 text-[#0e7572]"
                            onClick={() =>
                              onLocateFinding(assessment.detection_id)
                            }
                          >
                            <LocateFixed className="size-3.5" />
                            Locate
                          </Button>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-[#52657d]">
                          {assessment.suggestion}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="rounded-xl border border-[#e3e9f0] bg-[#f8fafc] p-4 text-xs leading-5 text-[#64748b]">
                  No finding-linked assessment prompts were generated. The
                  dentist should determine appropriate examination based on
                  the image and clinical context.
                </p>
              )}
            </section>

            <section
              aria-labelledby="dentist-review-heading"
              className="space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SectionHeading
                  id="dentist-review-heading"
                  number="04"
                  title="Dentist’s review and final impression"
                />
                <Badge className="border border-[#f1ddb4] bg-[#fffbf2] text-[#8a5a08] hover:bg-[#fffbf2]">
                  Not confirmed
                </Badge>
              </div>
              <label
                htmlFor="final-impression-draft"
                className="block text-xs leading-5 text-[#64748b]"
              >
                Draft final impression
                <textarea
                  id="final-impression-draft"
                  value={finalImpressionDraft}
                  onChange={(event) =>
                    setFinalImpressionDraft(event.target.value)
                  }
                  rows={5}
                  placeholder="For dentist review. This text is not saved or identity-verified."
                  className="mt-2 block w-full resize-y rounded-xl border border-[#cbd6e2] bg-white p-3 text-sm text-[#172b45] outline-none placeholder:text-[#94a3b8] focus:border-[#0e7572] focus:ring-2 focus:ring-[#0e7572]/15"
                />
              </label>
              <p className="flex items-start gap-2 text-[11px] leading-5 text-[#8291a7]">
                <Clock className="mt-0.5 size-3.5 shrink-0" />
                This workspace does not authenticate a dentist or save an
                approval. The draft must be reviewed and confirmed in your
                clinic record system before it is treated as final.
              </p>
            </section>

            <footer className="flex flex-col gap-2 border-t border-[#e3e9f0] pt-4 text-[10px] text-[#8291a7] sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-1.5">
                <Clock className="size-3.5" aria-hidden="true" />
                Review aid generated{" "}
                {new Date(report.generated_at).toLocaleString()}
              </p>
              <p>AI-assisted · dentist review required · not confirmed</p>
            </footer>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[#d7e1eb] bg-[#f8fafc] px-4 py-8 text-center">
            <FileText className="mx-auto size-6 text-[#0e7572]" />
            <p className="mt-3 text-sm font-semibold text-[#142b4a]">
              Generate a finding-linked clinical review aid
            </p>
            <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-[#64748b]">
              The report will use class-specific review prompts for the actual
              model detections shown here. Prompts are not a validated clinical
              protocol; the dentist makes the final interpretation.
            </p>
          </div>
        )}

        {generateReport.isError && !report && (
          <div
            role="alert"
            className="rounded-xl border border-[#f1c5c5] bg-[#fff1f1] p-4"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-[#a82c2c]">
              <AlertCircle className="size-4" aria-hidden="true" />
              Report generation failed
            </div>
            <p className="mt-1 text-xs leading-5 text-[#8b3a3a]">
              {axios.isAxiosError<{ detail?: string }>(generateReport.error) &&
              typeof generateReport.error.response?.data.detail === "string"
                ? generateReport.error.response.data.detail
                : generateReport.error.message ||
                "Check the backend logs, then try again."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SectionHeading({
  id,
  number,
  title,
}: {
  id: string;
  number: string;
  title: string;
}) {
  return (
    <h3
      id={id}
      className="flex items-center gap-2 text-sm font-semibold text-[#142b4a]"
    >
      <span className="font-mono text-[10px] font-semibold text-[#0e7572]">
        {number}
      </span>
      {title}
    </h3>
  );
}
