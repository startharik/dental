"use client";

import axios from "axios";
import {
  Activity,
  AlertCircle,
  Ban,
  BrainCircuit,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  EyeOff,
  Focus,
  Info,
  LocateFixed,
  Pencil,
  Printer,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DetectionImagePreview } from "@/components/detection/detection-image-preview";
import { useGenerateDiagnosticReport } from "@/hooks/use-diagnostic-report";
import {
  useResearchModeStatus,
} from "@/hooks/use-research-analysis";
import { getDetectionColor } from "@/lib/constants";
import { exportToPDF, type PDFExportData } from "@/lib/pdf-export";
import type {
  ClinicalFindingReview,
  ClinicalFindingReviewStatus,
  ClinicalReviewDraft,
  Detection,
  DiagnosticReport,
  ResearchAnalysis,
  ResearchAnalysisRunStatus,
  DicomMetadata,
  ImageInfo,
} from "@/lib/types";

interface DiagnosticReportComponentProps {
  predictions: Detection[];
  rawDetections?: Detection[];
  metadata: DicomMetadata;
  imageInfo: ImageInfo;
  report?: DiagnosticReport;
  onReportGenerated?: (report: DiagnosticReport) => void;
  researchAnalysis?: ResearchAnalysis;
  researchAnalysisStatus?: ResearchAnalysisRunStatus;
  researchAnalysisError?: string;
  onRetryResearchAnalysis?: () => void;
  onLocateFinding: (detectionId: string) => void;
  originalImageSrc?: string;
  fileName?: string;
}

const UPPER_TEETH = [
  18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28,
];
const LOWER_TEETH = [
  48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38,
];

const STATUS_LABELS: Record<ClinicalFindingReviewStatus, string> = {
  awaiting_review: "Awaiting review",
  confirmed: "Dentist confirmed",
  modified: "Modified by dentist",
  not_applicable: "Not applicable",
};

const STATUS_STYLES: Record<ClinicalFindingReviewStatus, string> = {
  awaiting_review: "border-[#ead9ad] bg-[#fff9e9] text-[#856010]",
  confirmed: "border-[#b8e3d3] bg-[#edf9f3] text-[#17694b]",
  modified: "border-[#b8dce2] bg-[#eef9fa] text-[#176b76]",
  not_applicable: "border-[#dfe5ec] bg-[#f3f5f8] text-[#627084]",
};

function createFindingReview(): ClinicalFindingReview {
  return { status: "awaiting_review", observations: "" };
}

function createEmptyReview(predictions: Detection[]): ClinicalReviewDraft {
  return {
    findings: Object.fromEntries(
      predictions.map((detection) => [
        detection.detection_id,
        createFindingReview(),
      ])
    ),
    finalImpression: "",
  };
}

function detectionReviewKey(detection: Detection) {
  return [
    detection.class_id,
    detection.class.trim().toLowerCase(),
    detection.x.toFixed(2),
    detection.y.toFixed(2),
    detection.width,
    detection.height,
  ].join(":");
}

function createStorageKey(
  fileName: string | undefined,
  studyDate: string | undefined,
  imageSize: number[],
  predictions: Detection[]
) {
  const identity = [
    fileName ?? "study",
    studyDate ?? "",
    ...imageSize,
    ...predictions.map(detectionReviewKey).sort(),
  ].join("|");
  let hash = 2166136261;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `dentra-review-v1-${(hash >>> 0).toString(16)}`;
}

function findingCategoryCount(predictions: Detection[]) {
  return new Set(predictions.map((detection) => detection.class.trim().toLowerCase()))
    .size;
}

export function DiagnosticReportComponent({
  predictions,
  rawDetections = predictions,
  metadata,
  imageInfo,
  report: externalReport,
  onReportGenerated,
  researchAnalysis,
  researchAnalysisStatus = "idle",
  researchAnalysisError,
  onRetryResearchAnalysis,
  onLocateFinding,
  originalImageSrc,
  fileName,
}: DiagnosticReportComponentProps) {
  const [report, setReport] = useState<DiagnosticReport | null>(
    externalReport ?? null
  );
  const [review, setReview] = useState<ClinicalReviewDraft>(() =>
    createEmptyReview(predictions)
  );
  const [reviewLoaded, setReviewLoaded] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [selectedDetectionId, setSelectedDetectionId] = useState<string>();
  const [selectedToothNumber, setSelectedToothNumber] = useState<string>();
  const [showOverlays, setShowOverlays] = useState(true);
  const [editingFindingId, setEditingFindingId] = useState<string>();
  const [editLabel, setEditLabel] = useState("");
  const [editToothNumber, setEditToothNumber] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const generateReport = useGenerateDiagnosticReport();
  const researchModeStatus = useResearchModeStatus();

  const storageKey = useMemo(
    () =>
      createStorageKey(
        fileName,
        metadata.study_date,
        imageInfo.converted_size,
        predictions
      ),
    [fileName, imageInfo.converted_size, metadata.study_date, predictions]
  );

  useEffect(() => {
    setReport(externalReport ?? null);
  }, [externalReport]);

  useEffect(() => {
    setReviewLoaded(false);
    const emptyReview = createEmptyReview(predictions);
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<ClinicalReviewDraft>;
        const savedFindings =
          parsed.findings && typeof parsed.findings === "object"
            ? parsed.findings
            : {};
        const findings = Object.fromEntries(
          predictions.map((detection) => {
            const value =
              savedFindings[detection.detection_id] ??
              savedFindings[detectionReviewKey(detection)];
            const status =
              value &&
              ["awaiting_review", "confirmed", "modified", "not_applicable"].includes(
                value.status
              )
                ? value.status
                : "awaiting_review";
            return [
              detection.detection_id,
              {
                ...createFindingReview(),
                ...value,
                status,
                observations:
                  typeof value?.observations === "string"
                    ? value.observations
                    : "",
              },
            ];
          })
        );
        setReview({
          ...emptyReview,
          ...parsed,
          findings,
          finalImpression:
            typeof parsed.finalImpression === "string"
              ? parsed.finalImpression
              : "",
        });
      } else {
        setReview(emptyReview);
      }
    } catch (error) {
      console.error("Failed to load local clinical review draft", error);
      setReview(emptyReview);
      toast.error("Saved review could not be loaded from this browser.");
    }
    setIsDirty(false);
    setReviewLoaded(true);
  }, [predictions, storageKey]);

  useEffect(() => {
    setSelectedDetectionId((current) =>
      current && predictions.some((item) => item.detection_id === current)
        ? current
        : predictions[0]?.detection_id
    );
  }, [predictions]);

  const currentReview = selectedDetectionId
    ? (review.findings[selectedDetectionId] ?? createFindingReview())
    : undefined;
  const selectedDetection = predictions.find(
    (detection) => detection.detection_id === selectedDetectionId
  );
  const selectedFindingIndex = selectedDetection
    ? predictions.findIndex(
        (detection) => detection.detection_id === selectedDetection.detection_id
      )
    : -1;

  const updateFinding = (
    detectionId: string,
    patch: Partial<ClinicalFindingReview>
  ) => {
    setReview((current) => ({
      ...current,
      findings: {
        ...current.findings,
        [detectionId]: {
          ...createFindingReview(),
          ...current.findings[detectionId],
          ...patch,
        },
      },
    }));
    setIsDirty(true);
  };

  const markFinding = (
    detectionId: string,
    status: ClinicalFindingReviewStatus
  ) => {
    updateFinding(detectionId, { status });
    setEditingFindingId(undefined);
  };

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
          : "Failed to generate clinical assessment guidance. Check the backend logs.";
      toast.error(message);
    }
  };

  const saveReview = () => {
    const savedAt = new Date().toISOString();
    const savedReview = { ...review, savedAt };
    const persistedFindings = Object.fromEntries(
      predictions.map((detection) => [
        detectionReviewKey(detection),
        review.findings[detection.detection_id] ?? createFindingReview(),
      ])
    );
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ ...savedReview, findings: persistedFindings })
      );
      setReview(savedReview);
      setIsDirty(false);
      toast.success("Review draft saved on this device.");
    } catch (error) {
      console.error("Failed to save local clinical review draft", error);
      toast.error("Review could not be saved in this browser.");
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const exportData: PDFExportData = {
        report: report ?? undefined,
        researchAnalysis,
        review,
        detections: predictions,
        rawDetections,
        metadata,
        imageInfo,
        fileName: metadata.patient_name || fileName || "clinical-review",
        originalImageSrc,
      };
      await exportToPDF(exportData);
    } catch (error) {
      toast.error("Failed to export clinical report");
      console.error("Failed to export clinical report", error);
    } finally {
      setIsExporting(false);
    }
  };

  const confirmedCount = predictions.filter(
    (detection) => review.findings[detection.detection_id]?.status === "confirmed"
  ).length;
  const awaitingCount = predictions.filter((detection) => {
    const status = review.findings[detection.detection_id]?.status;
    return !status || status === "awaiting_review";
  }).length;
  const categoryCount = findingCategoryCount(predictions);
  const localizedFindingCount = predictions.filter(
    (detection) => review.findings[detection.detection_id]?.toothNumber
  ).length;
  const findingsByTooth = new Map<string, Detection[]>();
  predictions.forEach((detection) => {
    const toothNumber = review.findings[detection.detection_id]?.toothNumber;
    if (!toothNumber) return;
    const toothFindings = findingsByTooth.get(toothNumber) ?? [];
    toothFindings.push(detection);
    findingsByTooth.set(toothNumber, toothFindings);
  });
  const confirmedFindingIds = new Set(
    predictions
      .filter(
        (detection) =>
          review.findings[detection.detection_id]?.status === "confirmed"
      )
      .map((detection) => detection.detection_id)
  );
  const chartCategories = Array.from(
    new Map(
      Array.from(findingsByTooth.values())
        .flat()
        .map((detection) => [
          detection.class.trim().toLowerCase(),
          detection,
        ])
    ).values()
  );
  const selectedToothFindings = selectedToothNumber
    ? predictions.filter(
        (detection) =>
          review.findings[detection.detection_id]?.toothNumber ===
          selectedToothNumber
      )
    : [];
  const assessmentByDetection = new Map(
    report?.suggested_assessments.map((assessment) => [
      assessment.detection_id,
      assessment,
    ]) ?? []
  );
  const validAssessments = report?.suggested_assessments.filter((assessment) =>
    predictions.some(
      (detection) => detection.detection_id === assessment.detection_id
    )
  ) ?? [];
  const invalidAssessmentCount =
    (report?.suggested_assessments.length ?? 0) - validAssessments.length;

  const selectTooth = (toothNumber: number) => {
    const tooth = String(toothNumber);
    setSelectedToothNumber(tooth);
    if (editingFindingId) {
      setEditToothNumber(tooth);
      return;
    }
    const linkedFinding = predictions.find(
      (detection) =>
        review.findings[detection.detection_id]?.toothNumber === tooth
    );
    setSelectedDetectionId(linkedFinding?.detection_id);
  };

  return (
    <Card
      id="clinical-report"
      className="clinical-report-print w-full gap-0 overflow-hidden rounded-[14px] border-[#dfe6ed] bg-[#f5f7fa] py-0 shadow-[0_2px_8px_rgba(20,43,74,0.05)]"
    >
      <CardContent className="space-y-4 p-3 sm:p-5">
        <header className="flex flex-col gap-3 rounded-xl border border-[#dfe6ed] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#142b4a] text-white">
              <Activity className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-[#142b4a]">
                  Clinical review workspace
                </h2>
                <Badge className="border border-[#b8e3d3] bg-[#edf9f3] text-[#17694b] hover:bg-[#edf9f3]">
                  Analysis complete
                </Badge>
              </div>
              <p className="truncate text-xs text-[#73839a]">
                {fileName || metadata.study_description || "Dental radiograph"}
                {metadata.study_date ? ` · ${metadata.study_date}` : ""}
                {metadata.modality ? ` · ${metadata.modality}` : ""}
              </p>
            </div>
          </div>

          <div className="clinical-report-no-print flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isExporting}
              onClick={() => void handleExportPDF()}
            >
              {isExporting ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {isExporting ? "Preparing..." : "Export report"}
            </Button>
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
              size="sm"
              className="bg-[#142b4a] text-white hover:bg-[#203d60]"
              disabled={generateReport.isPending}
              onClick={() => void handleGenerateReport()}
            >
              {generateReport.isPending ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {generateReport.isPending
                ? "Preparing guidance..."
                : report
                  ? "Refresh assessment guidance"
                  : "Generate assessment guidance"}
            </Button>
          </div>
        </header>

        <section
          aria-label="Clinical overview"
          className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5"
        >
          <MetricCard
            label="AI detections"
            value={rawDetections.length}
            note={`${predictions.length} shown after duplicate review`}
            color="#142b4a"
            icon={<Focus className="size-4" />}
          />
          <MetricCard
            label="Finding categories"
            value={categoryCount}
            note="Distinct model labels"
            color="#2366a5"
            icon={<Activity className="size-4" />}
          />
          <MetricCard
            label="Awaiting review"
            value={awaitingCount}
            note="Dentist review status"
            color="#9b6b10"
            icon={<Clock3 className="size-4" />}
          />
          <MetricCard
            label="Dentist confirmed"
            value={confirmedCount}
            note="Locally marked; identity not verified"
            color="#168263"
            icon={<CheckCircle2 className="size-4" />}
          />
          <MetricCard
            label="Analysis status"
            value="Complete"
            note="Model output is preliminary"
            color="#168263"
            icon={<Check className="size-4" />}
          />
        </section>

        <section
          aria-labelledby="study-information-heading"
          className="grid gap-3 rounded-xl border border-[#dfe6ed] bg-white p-4 sm:grid-cols-[1fr_auto]"
        >
          <div>
            <h3
              id="study-information-heading"
              className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#52657d]"
            >
              Study information
            </h3>
            <div className="mt-2 grid gap-x-5 gap-y-1.5 text-xs sm:grid-cols-2 lg:grid-cols-4">
              <StudyDatum label="Study" value={metadata.study_description || fileName} />
              <StudyDatum label="Series" value={metadata.series_description} />
              <StudyDatum label="Modality" value={metadata.modality || "Not provided"} />
              <StudyDatum
                label="Image"
                value={`${imageInfo.converted_size[0] ?? "—"} × ${imageInfo.converted_size[1] ?? "—"} px`}
              />
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-[#f4f8fb] px-3 py-2 text-[10px] leading-4 text-[#61758d] sm:max-w-[235px]">
            <Info className="mt-0.5 size-3.5 shrink-0 text-[#198a8b]" />
            {imageInfo.converted_format} preview · image quality is not
            independently graded by this workspace.
          </div>
        </section>

        <div className="grid items-start gap-4 2xl:grid-cols-[minmax(330px,0.8fr)_minmax(0,1.5fr)]">
          <section
            aria-labelledby="odontogram-heading"
            className="rounded-xl border border-[#dfe6ed] bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3
                  id="odontogram-heading"
                  className="text-sm font-bold text-[#142b4a]"
                >
                  Dental chart · FDI
                </h3>
                <p className="mt-1 text-[10px] leading-4 text-[#78889c]">
                  AI has not localized teeth. Assign a tooth only during dentist
                  review.
                </p>
              </div>
              {selectedToothNumber && (
                <button
                  type="button"
                  className="clinical-report-no-print text-[10px] font-semibold text-[#168a86] hover:underline"
                  onClick={() => setSelectedToothNumber(undefined)}
                >
                  Clear selection
                </button>
              )}
            </div>

            <Odontogram
              upperTeeth={UPPER_TEETH}
              lowerTeeth={LOWER_TEETH}
              selectedTooth={selectedToothNumber}
              findingsByTooth={findingsByTooth}
              confirmedFindingIds={confirmedFindingIds}
              onSelect={selectTooth}
            />

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-[#edf1f5] pt-3 text-[10px] text-[#708197]">
              <LegendDot color="#dce4ec" label="Tooth not localized by AI" />
              {chartCategories.map((detection) => (
                <LegendDot
                  key={`${detection.class_id}-${detection.class}`}
                  color={getDetectionColor(detection.class_id)}
                  label={`${detection.class} · dentist-located`}
                />
              ))}
            </div>
            {selectedToothNumber && (
              <div className="mt-3 rounded-lg bg-[#f5f8fb] p-3">
                <p className="text-xs font-semibold text-[#142b4a]">
                  Tooth {selectedToothNumber}
                  {editingFindingId ? " · assigning to edited finding" : ""}
                </p>
                {selectedToothFindings.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {selectedToothFindings.map((detection) => (
                      <li key={detection.detection_id}>
                        <button
                          type="button"
                          className="text-left text-[11px] text-[#147e7d] hover:underline"
                          onClick={() =>
                            setSelectedDetectionId(detection.detection_id)
                          }
                        >
                          Finding{" "}
                          {String(
                            predictions.findIndex(
                              (item) =>
                                item.detection_id === detection.detection_id
                            ) + 1
                          ).padStart(2, "0")}{" "}
                          ·{" "}
                          {review.findings[detection.detection_id]
                            ?.modifiedLabel || detection.class}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-[10px] leading-4 text-[#708197]">
                    No dentist-located findings are assigned. AI detections
                    remain “Tooth not identified.”
                  </p>
                )}
              </div>
            )}
          </section>

          <section
            aria-labelledby="evidence-viewer-heading"
            className="min-w-0 overflow-hidden rounded-xl border border-[#24344a] bg-[#101a28] p-3 shadow-sm sm:p-4"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3
                  id="evidence-viewer-heading"
                  className="text-sm font-bold text-white"
                >
                  Radiographic evidence
                </h3>
                <p className="mt-1 text-[10px] text-[#aebdcd]">
                  {selectedDetection
                    ? `Finding ${String(selectedFindingIndex + 1).padStart(2, "0")} · ${selectedDetection.class} · Tooth ${
                        currentReview?.toothNumber || "not identified"
                      }`
                    : selectedToothNumber
                      ? `FDI tooth ${selectedToothNumber} · no dentist-located finding`
                    : "Complete study"}
                </p>
              </div>
              <div className="clinical-report-no-print flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                  onClick={() => setShowOverlays((current) => !current)}
                  disabled={!originalImageSrc}
                >
                  {showOverlays ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                  {showOverlays ? "Hide overlays" : "Show overlays"}
                </Button>
                {selectedDetectionId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                    onClick={() => {
                      setSelectedDetectionId(undefined);
                      setSelectedToothNumber(undefined);
                    }}
                  >
                    <Focus className="size-3.5" />
                    Full image
                  </Button>
                )}
              </div>
            </div>
            {originalImageSrc ? (
              <DetectionImagePreview
                src={originalImageSrc}
                alt={`Dental radiograph evidence for ${fileName ?? "study"}`}
                width={
                  imageInfo.converted_size[0] ??
                  imageInfo.original_shape[1] ??
                  1
                }
                height={
                  imageInfo.converted_size[1] ??
                  imageInfo.original_shape[0] ??
                  1
                }
                detections={predictions}
                selectedDetectionId={selectedDetectionId}
                onDetectionSelect={(detectionId) => {
                  setSelectedDetectionId(detectionId);
                  const assignedTooth =
                    review.findings[detectionId]?.toothNumber;
                  setSelectedToothNumber(assignedTooth);
                }}
                showOverlays={showOverlays}
              />
            ) : (
              <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-white/10 bg-[#0a111b] px-6 text-center text-xs text-[#aebdcd]">
                Radiograph preview is unavailable. Detection coordinates and
                review actions remain available below.
              </div>
            )}
            {selectedDetection && (
              <div className="mt-3 grid gap-2 rounded-lg border border-white/10 bg-white/5 p-3 text-[10px] text-[#d3deea] sm:grid-cols-3">
                <span>
                  Center: {selectedDetection.x.toFixed(1)},{" "}
                  {selectedDetection.y.toFixed(1)} px
                </span>
                <span>
                  Box: {selectedDetection.width} × {selectedDetection.height} px
                </span>
                <span>
                  Model score: {(selectedDetection.confidence * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </section>
        </div>

        <section
          aria-labelledby="findings-gallery-heading"
          className="space-y-3"
        >
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3
                id="findings-gallery-heading"
                className="text-sm font-bold text-[#142b4a]"
              >
                Visual findings
              </h3>
              <p className="mt-1 text-[10px] text-[#78889c]">
                Crops are previews of the source image; boxes and labels are
                display-only overlays.
              </p>
            </div>
            <span className="text-[10px] font-medium text-[#78889c]">
              {predictions.length} finding{predictions.length === 1 ? "" : "s"}
            </span>
          </div>
          {predictions.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {predictions.map((detection, index) => {
                const findingReview =
                  review.findings[detection.detection_id] ??
                  createFindingReview();
                return (
                  <FindingGalleryCard
                    key={detection.detection_id}
                    detection={detection}
                    index={index}
                    imageSrc={originalImageSrc}
                    imageWidth={
                      imageInfo.converted_size[0] ??
                      imageInfo.original_shape[1] ??
                      1
                    }
                    imageHeight={
                      imageInfo.converted_size[1] ??
                      imageInfo.original_shape[0] ??
                      1
                    }
                    review={findingReview}
                    clinicalDescription={
                      assessmentByDetection.get(detection.detection_id)
                        ?.suggestion
                    }
                    selected={selectedDetectionId === detection.detection_id}
                    onSelect={() => {
                      setSelectedDetectionId(detection.detection_id);
                      setSelectedToothNumber(findingReview.toothNumber);
                      onLocateFinding(detection.detection_id);
                    }}
                  />
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#cbd6e2] bg-white p-6 text-center">
              <Focus className="mx-auto size-5 text-[#7890a6]" />
              <p className="mt-2 text-xs font-semibold text-[#344861]">
                No model findings returned
              </p>
              <p className="mt-1 text-[10px] text-[#78889c]">
                This does not exclude disease; review the full radiograph and
                clinical context.
              </p>
            </div>
          )}
        </section>

        <section
          aria-labelledby="research-mode-heading"
          className="overflow-hidden rounded-xl border border-[#bed7e5] bg-white shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7eef4] bg-[#f7fbfd] p-4">
            <div className="flex items-start gap-2.5">
              <BrainCircuit className="mt-0.5 size-4 shrink-0 text-[#147e88]" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3
                    id="research-mode-heading"
                    className="text-sm font-bold text-[#142b4a]"
                  >
                    Research Mode
                  </h3>
                  <Badge className="border border-[#b8dce2] bg-[#eef9fa] text-[#176b76]">
                    Exploratory AI
                  </Badge>
                </div>
                <p className="mt-1 text-[10px] leading-4 text-[#61758b]">
                  AI-generated research hypotheses for dentist review.
                </p>
              </div>
            </div>
            {researchAnalysis && (
              <span className="text-[9px] text-[#718198]">
                {researchAnalysis.model} ·{" "}
                {new Date(researchAnalysis.generated_at).toLocaleString()}
              </span>
            )}
          </div>

          <div className="space-y-3 p-4">
            {researchModeStatus.isLoading && (
              <p className="text-[10px] text-[#718198]">
                Checking Research Mode configuration...
              </p>
            )}
            {researchModeStatus.isError && (
              <p role="alert" className="text-[10px] text-[#9f3434]">
                Research Mode configuration could not be checked. Verify the
                backend connection before trying again.
              </p>
            )}
            {researchModeStatus.data &&
              !researchModeStatus.data.enabled && (
                <p className="text-[10px] text-[#718198]">
                  {researchModeStatus.data.provider === "gemini"
                    ? "Gemini is"
                    : "Groq is"}{" "}
                  not configured. Set{" "}
                  {researchModeStatus.data.provider === "gemini"
                    ? "GOOGLE_API_KEY"
                    : "GROQ_API_KEY"}{" "}
                  in the backend environment to enable this optional feature.
                </p>
              )}
            {!originalImageSrc && (
              <p className="text-[10px] text-[#9f3434]">
                The original image preview is unavailable, so Research Mode
                cannot analyze this study.
              </p>
            )}

            {!researchAnalysis && researchAnalysisStatus === "pending" && (
              <p
                role="status"
                className="flex items-center gap-2 text-[10px] text-[#61758b]"
              >
                <RefreshCw className="size-3.5 animate-spin" />
                {researchModeStatus.data?.provider === "groq"
                  ? "Groq"
                  : "Gemini"}{" "}
                is analyzing this radiograph and its findings...
              </p>
            )}
            {!researchAnalysis && researchAnalysisStatus === "idle" && (
              <p className="text-[10px] text-[#61758b]">
                Enable automatic research analysis in the workspace to generate
                this interpretation when detection completes.
              </p>
            )}
            {!researchAnalysis && researchAnalysisStatus === "error" && (
              <div
                role="alert"
                className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#9f3434]"
              >
                <span>
                  {researchAnalysisError ?? "Research analysis failed."}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!originalImageSrc}
                  onClick={onRetryResearchAnalysis}
                >
                  Retry analysis
                </Button>
              </div>
            )}

            {researchAnalysis && (
              <div className="space-y-3 border-t border-[#e7eef4] pt-4">
                <div className="rounded-lg border border-[#d9e7ee] bg-[#f7fbfd] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-[#142b4a]">
                      Overall interpretation
                    </h4>
                    <span className="rounded-full bg-[#e7f5f4] px-2 py-0.5 text-[9px] font-semibold text-[#176b76]">
                      AI hypothesis
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-3 whitespace-pre-line text-[10px] leading-5 text-[#465b72]">
                    {researchAnalysis.combined_clinical_interpretation}
                  </p>
                  {researchAnalysis.cross_finding_patterns.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {researchAnalysis.cross_finding_patterns.map(
                        (pattern, patternIndex) => (
                          <span
                            key={`pattern-${patternIndex}`}
                            className="max-w-full rounded-full border border-[#d9e7ee] bg-white px-2.5 py-1 text-[9px] leading-4 text-[#53677e]"
                          >
                            {pattern}
                          </span>
                        )
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  {researchAnalysis.findings.map((finding, index) => {
                    const detection = predictions.find(
                      (item) => item.detection_id === finding.detection_id
                    );
                    if (!detection) return null;
                    const findingReview =
                      review.findings[detection.detection_id] ??
                      createFindingReview();
                    return (
                      <ResearchFindingCard
                        key={finding.detection_id}
                        finding={finding}
                        detection={detection}
                        index={index}
                        imageSrc={originalImageSrc}
                        imageWidth={
                          imageInfo.converted_size[0] ??
                          imageInfo.original_shape[1] ??
                          1
                        }
                        imageHeight={
                          imageInfo.converted_size[1] ??
                          imageInfo.original_shape[0] ??
                          1
                        }
                        review={findingReview}
                        onLocate={() => {
                          setSelectedDetectionId(detection.detection_id);
                          onLocateFinding(detection.detection_id);
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        <section
          aria-labelledby="assessment-matrix-heading"
          className="overflow-hidden rounded-xl border border-[#dfe6ed] bg-white shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e9eef3] p-4">
            <div>
              <h3
                id="assessment-matrix-heading"
                className="text-sm font-bold text-[#142b4a]"
              >
                Clinical assessment matrix
              </h3>
              <p className="mt-1 text-[10px] text-[#78889c]">
                Recommended next steps for reviewing each model finding.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              className="clinical-report-no-print bg-[#16a6a1] text-white hover:bg-[#118c88]"
              disabled={generateReport.isPending}
              onClick={() => void handleGenerateReport()}
            >
              {generateReport.isPending ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              {report ? "Refresh guidance" : "Generate guidance"}
            </Button>
          </div>
          {generateReport.isError && !report && (
            <div
              role="alert"
              className="m-4 flex items-start gap-2 rounded-lg border border-[#f1c5c5] bg-[#fff3f3] p-3 text-[11px] text-[#9f3434]"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {axios.isAxiosError<{ detail?: string }>(generateReport.error) &&
              typeof generateReport.error.response?.data.detail === "string"
                ? generateReport.error.response.data.detail
                : "Assessment guidance could not be loaded. Check the backend logs and try again."}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] table-fixed text-left">
              <thead className="bg-[#f5f7fa] text-[10px] uppercase tracking-wide text-[#607187]">
                <tr>
                  <th className="w-[18%] px-4 py-3 font-semibold">Finding</th>
                  <th className="w-[24%] px-4 py-3 font-semibold">
                    Supporting evidence
                  </th>
                  <th className="w-[40%] px-4 py-3 font-semibold">
                    Recommended dentist action
                  </th>
                  <th className="w-[18%] px-4 py-3 font-semibold">
                    Dentist review
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf1f5]">
                {predictions.map((detection, index) => {
                  const findingReview =
                    review.findings[detection.detection_id] ??
                    createFindingReview();
                  const assessment = assessmentByDetection.get(
                    detection.detection_id
                  );
                  return (
                    <tr
                      key={detection.detection_id}
                      className={
                        selectedDetectionId === detection.detection_id
                          ? "bg-[#f3fbfa]"
                          : "bg-white"
                      }
                    >
                      <td className="px-4 py-3 align-top">
                        <button
                          type="button"
                          className="text-left"
                          onClick={() => {
                            setSelectedDetectionId(detection.detection_id);
                            setSelectedToothNumber(findingReview.toothNumber);
                            onLocateFinding(detection.detection_id);
                          }}
                        >
                          <span className="flex items-center gap-2 text-xs font-semibold capitalize text-[#142b4a]">
                            <span
                              className="size-2.5 rounded-full"
                              style={{
                                backgroundColor: getDetectionColor(
                                  detection.class_id
                                ),
                              }}
                            />
                            {String(index + 1).padStart(2, "0")} ·{" "}
                            {findingReview.modifiedLabel || detection.class}
                          </span>
                          <span className="mt-1 block text-[10px] text-[#78889c]">
                            Tooth {findingReview.toothNumber || "not identified"}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3 align-top text-[10px] leading-4 text-[#53677e]">
                        Center {detection.x.toFixed(1)}, {detection.y.toFixed(1)}
                        px · {detection.width} × {detection.height}px
                        <span className="mt-1 block">
                          Model score {(detection.confidence * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-[10px] leading-5 text-[#53677e]">
                        {assessment ? (
                          <p className="whitespace-pre-line">
                            {assessment.suggestion.replace(
                              /^Finding \d+ \([^)]*\):\s*/i,
                              ""
                            )}
                          </p>
                        ) : (
                          <span className="text-[#8291a7]">
                            No recommended action is available for this finding.
                          </span>
                        )}
                        {assessment && (
                          <button
                            type="button"
                            className="clinical-report-no-print mt-1 flex items-center gap-1 font-semibold text-[#13817e] hover:underline"
                            onClick={() => {
                              setSelectedDetectionId(detection.detection_id);
                              setSelectedToothNumber(
                                findingReview.toothNumber
                              );
                            }}
                          >
                            <LocateFixed className="size-3" />
                            Locate evidence
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <ReviewStatusBadge status={findingReview.status} />
                        <div className="clinical-report-no-print mt-2 flex flex-wrap gap-1">
                          <button
                            type="button"
                            title="Confirm this finding"
                            aria-label={`Confirm finding ${index + 1}`}
                            className="rounded-md border border-[#cfe7dc] p-1.5 text-[#19724f] hover:bg-[#edf9f3]"
                            onClick={() =>
                              markFinding(
                                detection.detection_id,
                                "confirmed"
                              )
                            }
                          >
                            <CheckCircle2 className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Modify this finding"
                            aria-label={`Modify finding ${index + 1}`}
                            className="rounded-md border border-[#d7e4ea] p-1.5 text-[#376c78] hover:bg-[#eef9fa]"
                            onClick={() => {
                              setSelectedDetectionId(detection.detection_id);
                              setSelectedToothNumber(
                                findingReview.toothNumber
                              );
                              setEditingFindingId(detection.detection_id);
                              setEditLabel(
                                findingReview.modifiedLabel ?? detection.class
                              );
                              setEditToothNumber(
                                findingReview.toothNumber ?? ""
                              );
                            }}
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Mark not applicable"
                            aria-label={`Mark finding ${index + 1} not applicable`}
                            className="rounded-md border border-[#dfe5ec] p-1.5 text-[#65768b] hover:bg-[#f3f5f8]"
                            onClick={() =>
                              markFinding(
                                detection.detection_id,
                                "not_applicable"
                              )
                            }
                          >
                            <Ban className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {predictions.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-xs text-[#78889c]"
                    >
                      No findings to assess. An empty detection result does not
                      rule out disease.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {invalidAssessmentCount > 0 && (
            <p
              role="alert"
              className="border-t border-[#f1c5c5] bg-[#fff3f3] px-4 py-2 text-[10px] text-[#9f3434]"
            >
              {invalidAssessmentCount} assessment prompt
              {invalidAssessmentCount === 1 ? " was" : "s were"} hidden because
              they did not reference an actual detection.
            </p>
          )}
        </section>

        {selectedDetection && currentReview && (
          <section
            aria-labelledby="finding-review-heading"
            className="rounded-xl border border-[#dfe6ed] bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#78889c]">
                  Finding {String(selectedFindingIndex + 1).padStart(2, "0")}
                </p>
                <h3
                  id="finding-review-heading"
                  className="mt-1 text-sm font-bold capitalize text-[#142b4a]"
                >
                  {currentReview.modifiedLabel || selectedDetection.class}
                </h3>
              </div>
              <ReviewStatusBadge status={currentReview.status} />
            </div>

            {editingFindingId === selectedDetection.detection_id ? (
              <div className="clinical-report-no-print mt-4 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
                <label className="text-[10px] font-semibold text-[#53677e]">
                  Dentist-modified description
                  <input
                    value={editLabel}
                    onChange={(event) => setEditLabel(event.target.value)}
                    className="mt-1 block h-9 w-full rounded-lg border border-[#cbd6e2] px-3 text-xs font-normal text-[#172b45] outline-none focus:border-[#16a6a1]"
                    maxLength={120}
                  />
                </label>
                <label className="text-[10px] font-semibold text-[#53677e]">
                  Dentist-located FDI tooth
                  <select
                    value={editToothNumber}
                    onChange={(event) => setEditToothNumber(event.target.value)}
                    className="mt-1 block h-9 w-full rounded-lg border border-[#cbd6e2] bg-white px-2 text-xs font-normal text-[#172b45] outline-none focus:border-[#16a6a1]"
                  >
                    <option value="">Tooth not identified</option>
                    {[...UPPER_TEETH, ...LOWER_TEETH].map((tooth) => (
                      <option key={tooth} value={String(tooth)}>
                        FDI {tooth}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="bg-[#168263] text-white hover:bg-[#11694f]"
                    onClick={() => {
                      const trimmedLabel = editLabel.trim();
                      updateFinding(selectedDetection.detection_id, {
                        status: "modified",
                        modifiedLabel:
                          trimmedLabel &&
                          trimmedLabel !== selectedDetection.class
                            ? trimmedLabel
                            : undefined,
                        toothNumber: editToothNumber || undefined,
                      });
                      setEditingFindingId(undefined);
                    }}
                  >
                    <Check className="size-3.5" />
                    Apply changes
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingFindingId(undefined)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="clinical-report-no-print mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="bg-[#168263] text-white hover:bg-[#11694f]"
                  onClick={() =>
                    markFinding(selectedDetection.detection_id, "confirmed")
                  }
                >
                  <CheckCircle2 className="size-3.5" />
                  Confirm finding
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingFindingId(selectedDetection.detection_id);
                    setEditLabel(
                      currentReview.modifiedLabel || selectedDetection.class
                    );
                    setEditToothNumber(currentReview.toothNumber ?? "");
                  }}
                >
                  <Pencil className="size-3.5" />
                  Modify finding
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    markFinding(
                      selectedDetection.detection_id,
                      "not_applicable"
                    )
                  }
                >
                  <Ban className="size-3.5" />
                  Not applicable
                </Button>
              </div>
            )}

            <label className="mt-4 block text-[10px] font-semibold text-[#53677e]">
              Clinical observations
              <textarea
                value={currentReview.observations}
                onChange={(event) =>
                  updateFinding(selectedDetection.detection_id, {
                    observations: event.target.value,
                  })
                }
                rows={2}
                placeholder="Record dentist-entered clinical observations."
                className="mt-1 block w-full resize-y rounded-lg border border-[#cbd6e2] bg-white p-3 text-xs font-normal text-[#172b45] outline-none placeholder:text-[#94a3b8] focus:border-[#16a6a1]"
              />
            </label>
          </section>
        )}

        <section
          aria-labelledby="limitations-heading"
          className="rounded-xl border border-[#dfe6ed] bg-white p-4"
        >
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#168a86]" />
            <div>
              <h3
                id="limitations-heading"
                className="text-xs font-bold text-[#142b4a]"
              >
                Limitations and uncertainty
              </h3>
              <p className="mt-1 text-[10px] leading-5 text-[#53677e]">
                {report?.uncertainty_and_limitations ??
                  "AI detections are preliminary model outputs, not diagnoses. Model scores are not calibrated diagnostic probabilities. This system does not determine tooth numbers, image quality, lesion activity, or treatment need. Review the source radiograph and clinical context before documenting a conclusion."}
              </p>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="dentist-final-review-heading"
          className="rounded-xl border border-[#cddce8] bg-white p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3
                id="dentist-final-review-heading"
                className="text-sm font-bold text-[#142b4a]"
              >
                Dentist review and final impression
              </h3>
              <p className="mt-1 text-[10px] text-[#78889c]">
                Keep this clinician-entered conclusion separate from model
                predictions.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              className="clinical-report-no-print bg-[#142b4a] text-white hover:bg-[#203d60]"
              disabled={!reviewLoaded}
              onClick={saveReview}
            >
              <Save className="size-3.5" />
              {isDirty ? "Save review draft" : "Save review"}
            </Button>
          </div>

          <label className="mt-4 block text-[10px] font-semibold text-[#53677e]">
            Final clinical impression
            <textarea
              value={review.finalImpression}
              onChange={(event) => {
                setReview((current) => ({
                  ...current,
                  finalImpression: event.target.value,
                }));
                setIsDirty(true);
              }}
              rows={4}
              placeholder="Dentist-entered impression after review of image and clinical context."
              className="mt-1 block w-full resize-y rounded-lg border border-[#cbd6e2] bg-white p-3 text-xs font-normal text-[#172b45] outline-none placeholder:text-[#94a3b8] focus:border-[#16a6a1]"
            />
          </label>

          <div className="mt-3 flex flex-col gap-2 border-t border-[#edf1f5] pt-3 text-[10px] text-[#78889c] sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-1.5">
              <Clock3 className="size-3.5" />
              {review.savedAt
                ? `Saved locally ${new Date(review.savedAt).toLocaleString()}`
                : "Not saved"}
              {isDirty ? " · unsaved changes" : ""}
            </p>
            <p>
              Local browser draft only · no dentist authentication · not a
              server-side clinical record
            </p>
          </div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-[#dfe6ed] pt-3 text-[10px] text-[#78889c] sm:flex-row sm:items-center sm:justify-between">
          <p>
            Report generated{" "}
            {report?.generated_at
              ? new Date(report.generated_at).toLocaleString()
              : "when assessment guidance is requested"}
          </p>
          <p>
            Model output is preliminary · {localizedFindingCount} dentist-
            localized finding{localizedFindingCount === 1 ? "" : "s"} localized ·{" "}
            {confirmedCount} dentist-confirmed finding
            {confirmedCount === 1 ? "" : "s"}
          </p>
        </footer>
      </CardContent>
    </Card>
  );
}

function ResearchFindingCard({
  finding,
  detection,
  index,
  imageSrc,
  imageWidth,
  imageHeight,
  review,
  onLocate,
}: {
  finding: ResearchAnalysis["findings"][number];
  detection: Detection;
  index: number;
  imageSrc?: string;
  imageWidth: number;
  imageHeight: number;
  review: ClinicalFindingReview;
  onLocate: () => void;
}) {
  return (
    <details className="group rounded-xl border border-[#dfe6ed] bg-white shadow-[0_1px_2px_rgba(20,43,74,0.03)]">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 p-3 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2 text-[11px] font-semibold text-[#142b4a]">
          <span
            className="flex size-5 items-center justify-center rounded-full text-[8px] font-bold text-white"
            style={{ backgroundColor: getDetectionColor(detection.class_id) }}
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="min-w-0">
            <span className="block truncate">{finding.finding_name}</span>
            <span className="mt-0.5 block truncate text-[10px] font-normal text-[#61758b]">
              {finding.possible_diagnosis}
            </span>
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#f1f5f9] px-2 py-1 text-[9px] font-medium tabular-nums text-[#52657a]">
            {(detection.confidence * 100).toFixed(1)}% model score
          </span>
          <span
            className={`rounded-full border px-2 py-1 text-[9px] font-medium ${STATUS_STYLES[review.status]}`}
          >
            {STATUS_LABELS[review.status]}
          </span>
          <span className="text-[9px] text-[#718198]">
            {review.toothNumber ? `FDI ${review.toothNumber}` : "Tooth unknown"}
          </span>
          <span className="text-[9px] font-semibold text-[#13817e]">
            <span className="group-open:hidden">View</span>
            <span className="hidden group-open:inline">Close</span>
          </span>
        </span>
      </summary>
      <div className="grid gap-3 border-t border-[#edf1f5] bg-[#fbfcfd] p-3 sm:grid-cols-[150px_minmax(0,1fr)]">
        <div className="space-y-1">
          <FindingCrop
            src={imageSrc}
            detection={detection}
            imageWidth={imageWidth}
            imageHeight={imageHeight}
          />
          <button
            type="button"
            className="clinical-report-no-print text-[9px] font-semibold text-[#13817e] hover:underline"
            onClick={onLocate}
          >
            View on radiograph
          </button>
        </div>
        <div className="min-w-0 space-y-3 text-[10px] leading-4 text-[#53677e]">
          <div className="grid gap-2 sm:grid-cols-2">
            <ResearchSummaryItem
              label="Location"
              value={finding.anatomical_location}
            />
            <ResearchSummaryItem
              label="Clinical significance"
              value={finding.clinical_significance}
            />
          </div>
          <ResearchSummaryItem
            label="Interpretation"
            value={finding.ai_interpretation}
            clamp
          />
          <details className="group/details rounded-lg border border-[#e5ebf1] bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[10px] font-semibold text-[#344861] [&::-webkit-details-marker]:hidden">
              <span>More clinical details</span>
              <span className="text-[9px] font-medium text-[#13817e]">
                <span className="group-open/details:hidden">Expand</span>
                <span className="hidden group-open/details:inline">Collapse</span>
              </span>
            </summary>
            <div className="space-y-3 border-t border-[#edf1f5] p-3">
          {finding.differential_diagnoses.length > 0 && (
            <div>
              <h5 className="font-semibold text-[#344861]">Differentials</h5>
              <ul className="mt-1 space-y-1">
                {finding.differential_diagnoses.map((item, differentialIndex) => (
                  <li
                    key={`${finding.detection_id}-diff-${differentialIndex}`}
                    className="rounded-md bg-[#f7f9fb] px-2.5 py-2"
                  >
                    <span className="font-semibold">{item.diagnosis}</span>
                    <span className="mt-0.5 block text-[#63768a]">
                      {item.supporting_evidence}
                    </span>
                    <span className="mt-0.5 block text-[#8291a3]">
                      To clarify: {item.evidence_against_or_missing}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <ResearchTextList
            title="Investigations"
            items={finding.recommended_investigations}
          />
          <ResearchTextList
            title="Potential care pathways"
            items={finding.potential_treatment_options}
          />
          <ResearchTextList title="Follow-up" items={[finding.follow_up]} />
          <ResearchTextList
            title="Evidence"
            items={finding.evidence_and_limitations}
          />
          <ResearchTextList
            title="Dentist annotation comparison"
            items={[finding.dentist_annotation_comparison]}
          />
          {finding.related_detection_ids.length > 0 && (
            <ResearchTextList
              title="Related findings"
              items={finding.related_detection_ids}
            />
          )}
            </div>
          </details>
        </div>
      </div>
    </details>
  );
}

function ResearchSummaryItem({
  label,
  value,
  clamp = false,
}: {
  label: string;
  value: string;
  clamp?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-white px-3 py-2">
      <h5 className="text-[9px] font-semibold uppercase tracking-wide text-[#8492a3]">
        {label}
      </h5>
      <p
        className={`mt-1 whitespace-pre-line text-[10px] leading-4 text-[#53677e] ${clamp ? "line-clamp-2" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function ResearchTextList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h5 className="font-semibold text-[#344861]">{title}</h5>
      {items.length === 1 ? (
        <p className="mt-0.5 whitespace-pre-line">{items[0]}</p>
      ) : (
        <ul className="mt-0.5 list-inside list-disc space-y-0.5">
          {items.map((item, index) => (
            <li key={`${title}-${index}`}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
  color,
  icon,
}: {
  label: string;
  value: number | string;
  note: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-[#dfe6ed] bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-[#65778e]">{label}</span>
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}12`, color }}
        >
          {icon}
        </span>
      </div>
      <p className="mt-1.5 truncate text-xl font-bold leading-6 text-[#142b4a]">
        {value}
      </p>
      <p className="mt-1 line-clamp-2 min-h-7 text-[9px] leading-3.5 text-[#8190a3]">
        {note}
      </p>
    </div>
  );
}

function StudyDatum({ label, value }: { label: string; value?: string }) {
  return (
    <p className="min-w-0 truncate">
      <span className="text-[#8190a3]">{label}: </span>
      <span className="font-medium text-[#344861]">{value || "Not provided"}</span>
    </p>
  );
}

function Odontogram({
  upperTeeth,
  lowerTeeth,
  selectedTooth,
  findingsByTooth,
  confirmedFindingIds,
  onSelect,
}: {
  upperTeeth: number[];
  lowerTeeth: number[];
  selectedTooth?: string;
  findingsByTooth: Map<string, Detection[]>;
  confirmedFindingIds: Set<string>;
  onSelect: (tooth: number) => void;
}) {
  return (
    <div className="mt-4 space-y-2">
      <p className="text-center text-[9px] font-semibold uppercase tracking-[0.15em] text-[#9aa8b7]">
        Maxillary arch
      </p>
      <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-0.5">
        {upperTeeth.map((tooth, index) => (
          <ToothButton
            key={tooth}
            tooth={tooth}
            archOffset={Math.round(Math.abs(index - 7.5) * 1.15)}
            selected={selectedTooth === String(tooth)}
            findings={findingsByTooth.get(String(tooth)) ?? []}
            hasConfirmedFinding={(findingsByTooth.get(String(tooth)) ?? []).some(
              (detection) => confirmedFindingIds.has(detection.detection_id)
            )}
            onSelect={onSelect}
          />
        ))}
      </div>
      <div className="flex justify-center">
        <span className="h-px w-full bg-[#e6ebf0]" />
      </div>
      <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-0.5">
        {lowerTeeth.map((tooth, index) => (
          <ToothButton
            key={tooth}
            tooth={tooth}
            archOffset={-Math.round(Math.abs(index - 7.5) * 1.15)}
            selected={selectedTooth === String(tooth)}
            findings={findingsByTooth.get(String(tooth)) ?? []}
            hasConfirmedFinding={(findingsByTooth.get(String(tooth)) ?? []).some(
              (detection) => confirmedFindingIds.has(detection.detection_id)
            )}
            onSelect={onSelect}
          />
        ))}
      </div>
      <p className="text-center text-[9px] font-semibold uppercase tracking-[0.15em] text-[#9aa8b7]">
        Mandibular arch
      </p>
    </div>
  );
}

function ToothButton({
  tooth,
  archOffset,
  selected,
  findings,
  hasConfirmedFinding,
  onSelect,
}: {
  tooth: number;
  archOffset: number;
  selected: boolean;
  findings: Detection[];
  hasConfirmedFinding: boolean;
  onSelect: (tooth: number) => void;
}) {
  const assigned = findings.length > 0;
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`Select FDI tooth ${tooth}${
        assigned
          ? `, dentist-located findings: ${findings
              .map((detection) => detection.class)
              .join(", ")}`
          : ""
      }`}
      onClick={() => onSelect(tooth)}
      style={{ transform: `translateY(${archOffset}px)` }}
      className={`group flex min-w-0 flex-col items-center gap-1 rounded-md px-0.5 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#16a6a1] ${
        selected ? "bg-[#e6f6f5]" : "hover:bg-[#f4f7f9]"
      }`}
    >
      <span
        className={`relative flex h-7 w-[min(100%,24px)] items-center justify-center rounded-[42%_42%_35%_35%] border ${
          assigned
            ? "border-[#16a6a1] bg-[#d7f0ed]"
            : "border-[#ccd6df] bg-[#fffef9]"
        } ${selected ? "ring-2 ring-[#16a6a1]/35" : ""}`}
      >
        {assigned && (
          <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full border border-white bg-[#16a6a1]" />
        )}
        {hasConfirmedFinding && (
          <span
            className="absolute -left-1 -top-1 flex size-3 items-center justify-center rounded-full border border-white bg-[#168263] text-white"
            title="Contains a dentist-confirmed finding"
          >
            <Check className="size-2" />
          </span>
        )}
        <span className="h-3 w-1.5 rounded-full bg-[#e5e9e9]" />
        {findings.length > 0 && (
          <span className="absolute -bottom-1 flex max-w-full justify-center gap-px">
            {findings.slice(0, 3).map((detection) => (
              <span
                key={detection.detection_id}
                className="size-1.5 rounded-full border border-white"
                style={{
                  backgroundColor: getDetectionColor(detection.class_id),
                }}
              />
            ))}
          </span>
        )}
      </span>
      <span
        className={`text-[8px] font-semibold tabular-nums ${
          selected ? "text-[#087c78]" : "text-[#687b90]"
        }`}
      >
        {tooth}
      </span>
    </button>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="size-2 rounded-full border border-[#cbd5df]"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function ReviewStatusBadge({
  status,
}: {
  status: ClinicalFindingReviewStatus;
}) {
  return (
    <Badge
      className={`whitespace-nowrap border text-[9px] hover:bg-inherit ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}

function FindingGalleryCard({
  detection,
  index,
  imageSrc,
  imageWidth,
  imageHeight,
  review,
  clinicalDescription,
  selected,
  onSelect,
}: {
  detection: Detection;
  index: number;
  imageSrc?: string;
  imageWidth: number;
  imageHeight: number;
  review: ClinicalFindingReview;
  clinicalDescription?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const label = review.modifiedLabel || detection.class;
  const clinicalSummary = clinicalDescription?.replace(
    /^Finding \d+ \([^)]*\):\s*/i,
    ""
  );
  return (
    <article
      className={`overflow-hidden rounded-xl border bg-white shadow-sm ${
        selected ? "border-[#16a6a1] ring-1 ring-[#16a6a1]/20" : "border-[#dfe6ed]"
      }`}
    >
      <div className="grid grid-cols-[128px_1fr] gap-3 p-3">
        <FindingCrop
          src={imageSrc}
          detection={detection}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
        />
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                style={{ backgroundColor: getDetectionColor(detection.class_id) }}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <h4 className="truncate text-xs font-bold capitalize text-[#142b4a]">
                {label}
              </h4>
            </div>
            <ReviewStatusBadge status={review.status} />
          </div>
          <p className="mt-2 text-[9px] leading-4 text-[#718198]">
            Tooth {review.toothNumber || "not identified"}
          </p>
          <p className="mt-1 text-[9px] leading-4 tabular-nums text-[#718198]">
            Center {detection.x.toFixed(1)}, {detection.y.toFixed(1)} px
          </p>
          <p className="mt-1 line-clamp-2 text-[9px] leading-4 text-[#53677e]">
            {clinicalSummary
              ? clinicalSummary.length > 130
                ? `${clinicalSummary.slice(0, 127).trimEnd()}...`
                : clinicalSummary
              : "Clinical assessment guidance has not been generated."}
          </p>
          <p className="mt-1 text-[9px] leading-4 text-[#53677e]">
            Model score{" "}
            <span className="font-semibold tabular-nums">
              {(detection.confidence * 100).toFixed(1)}%
            </span>
          </p>
          <button
            type="button"
            className="clinical-report-no-print mt-2 inline-flex items-center gap-1 text-[9px] font-semibold text-[#0b817c] hover:underline"
            onClick={onSelect}
          >
            <LocateFixed className="size-3" />
            View on full image
          </button>
        </div>
      </div>
      {review.observations && (
        <p className="border-t border-[#edf1f5] px-3 py-2 text-[9px] leading-4 text-[#53677e]">
          Dentist observation: {review.observations}
        </p>
      )}
    </article>
  );
}

function FindingCrop({
  src,
  detection,
  imageWidth,
  imageHeight,
}: {
  src?: string;
  detection: Detection;
  imageWidth: number;
  imageHeight: number;
}) {
  const [cropError, setCropError] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!src || imageWidth <= 0 || imageHeight <= 0) {
      setCropError(true);
      return;
    }
    let active = true;
    const image = new window.Image();
    image.onload = () => {
      if (!active) return;
      const canvas = canvasRef.current;
      if (!canvas) {
        setCropError(true);
        return;
      }
      const context = canvas.getContext("2d");
      if (!context) {
        setCropError(true);
        return;
      }
      const padding = Math.max(
        detection.width,
        detection.height,
        Math.min(imageWidth, imageHeight) * 0.06
      );
      const cropWidth = Math.max(
        1,
        Math.min(
          imageWidth,
          detection.width + padding * 2,
          imageWidth
        )
      );
      const cropHeight = Math.max(
        1,
        Math.min(
          imageHeight,
          detection.height + padding * 2,
          imageHeight
        )
      );
      const cropLeft = Math.max(
        0,
        Math.min(imageWidth - cropWidth, detection.x - cropWidth / 2)
      );
      const cropTop = Math.max(
        0,
        Math.min(imageHeight - cropHeight, detection.y - cropHeight / 2)
      );
      canvas.width = 256;
      canvas.height = 144;
      context.drawImage(
        image,
        cropLeft,
        cropTop,
        cropWidth,
        cropHeight,
        0,
        0,
        canvas.width,
        canvas.height
      );
      context.strokeStyle = getDetectionColor(detection.class_id);
      context.lineWidth = 3;
      context.strokeRect(
        ((detection.x - detection.width / 2 - cropLeft) / cropWidth) *
          canvas.width,
        ((detection.y - detection.height / 2 - cropTop) / cropHeight) *
          canvas.height,
        (detection.width / cropWidth) * canvas.width,
        (detection.height / cropHeight) * canvas.height
      );
      setCropError(false);
    };
    image.onerror = () => {
      if (active) setCropError(true);
    };
    image.src = src;
    return () => {
      active = false;
    };
  }, [detection, imageHeight, imageWidth, src]);

  return (
    <div className="relative flex h-[72px] w-32 items-center justify-center overflow-hidden rounded-lg bg-[#101a28]">
      <canvas
        ref={canvasRef}
        aria-label={`Radiograph crop of model finding ${detection.detection_id.slice(0, 8)}`}
        className={`h-full w-full object-contain ${cropError ? "hidden" : ""}`}
      />
      {cropError && (
        <span className="px-2 text-center text-[9px] text-[#aebdcd]">
          Evidence crop unavailable
        </span>
      )}
    </div>
  );
}
