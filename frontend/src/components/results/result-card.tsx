"use client";

import { AlertCircle, ChevronDown, Clock } from "lucide-react";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { TabsContent, Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { DetectionImagePreview } from "../detection/detection-image-preview";
import { DicomMetadata } from "../dicom/dicom-metadata";
import { DiagnosticReportComponent } from "./diagnostic-report";
import type {
  ConvertedDicomData,
  Detection,
  DetectionProgress,
  DiagnosticReport,
} from "@/lib/types";
import { deduplicateDetections } from "@/lib/utils";
import { getDetectionColor } from "@/lib/constants";

interface ResultCardProps {
  fileState: DetectionProgress["files"][number];
  fileData?: ConvertedDicomData;
  onReportGenerated?: (fileId: string, report: DiagnosticReport) => void;
}

export function ResultCard({
  fileState,
  fileData,
  onReportGenerated,
}: ResultCardProps) {
  const [activeView, setActiveView] = useState("analysis");
  const [selectedDetectionId, setSelectedDetectionId] = useState<
    string | undefined
  >();
  const rawDetections = fileState.result?.predictions ?? [];
  const { findings, suppressed } = deduplicateDetections(rawDetections);

  const handleReportGenerated = (report: DiagnosticReport) => {
    onReportGenerated?.(fileState.fileId, report);
  };

  return (
    <TabsContent key={fileState.fileId} value={fileState.fileId}>
      <Card className="w-full gap-0 overflow-hidden rounded-2xl border-[#e3e9f0] bg-white py-0 shadow-[0_1px_3px_rgba(20,43,74,0.04)]">
        <CardHeader className="gap-3 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <CardTitle className="truncate text-sm font-semibold text-[#142b4a] sm:text-base">
              {fileState.fileName}
            </CardTitle>
          </div>
          <CardDescription>
            {fileState.status === "loading" && "Processing radiograph..."}
            {fileState.status === "success" && (
              <span className="text-xs text-[#64748b]">
                Analysis complete · Findings remain unconfirmed until reviewed
                by a dentist
              </span>
            )}
            {fileState.status === "error" &&
              `Error: ${fileState.error?.message || "Processing failed"}`}
            {fileState.status === "pending" && "Waiting to process..."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4 sm:px-5 sm:pb-5">
          {fileState.status === "loading" && (
            <div className="space-y-3">
              <Skeleton className="h-72 w-full rounded-md" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          )}

          {fileState.status === "error" && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-red-800">
                <AlertCircle className="size-4" aria-hidden="true" />
                Processing failed
              </div>
              <p className="mt-1 text-sm text-red-600">
                {fileState.error?.message ||
                  "An unknown error occurred during processing."}
              </p>
            </div>
          )}

          {fileState.status === "pending" && (
            <div className="rounded-xl border border-[#e3e9f0] bg-[#f8fafc] p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-[#52657d]">
                <Clock className="size-4" aria-hidden="true" />
                Waiting to process
              </div>
            </div>
          )}

          {fileState.status === "success" && fileState.result && (
            <Tabs value={activeView} onValueChange={setActiveView} className="w-full">
              <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl bg-[#f2f4f7] p-1">
                <TabsTrigger
                  value="analysis"
                  className="h-9 rounded-lg text-xs text-[#64748b] data-[state=active]:bg-white data-[state=active]:text-[#142b4a] data-[state=active]:shadow-sm sm:text-[13px]"
                >
                  Image & findings
                </TabsTrigger>
                <TabsTrigger
                  value="report"
                  className="h-9 rounded-lg text-xs text-[#64748b] data-[state=active]:bg-white data-[state=active]:text-[#142b4a] data-[state=active]:shadow-sm sm:text-[13px]"
                >
                  Clinical review
                </TabsTrigger>
              </TabsList>

                    <TabsContent value="analysis" className="mt-4 space-y-4">
                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(280px,0.75fr)]">
                        <section
                          aria-label="Radiograph viewer"
                          className="min-w-0 overflow-hidden rounded-xl border border-[#1e293b] bg-[#101622] p-3 sm:p-4"
                        >
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <h3 className="truncate text-xs font-semibold text-white">
                              {fileState.result!.metadata.series_description ||
                                fileState.result!.metadata.study_description ||
                                fileState.fileName}
                            </h3>
                            <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-medium text-[#d8e2ee]">
                              {findings.length} findings
                            </span>
                          </div>
                          {fileData ? (
                            <DetectionImagePreview
                              src={fileData.dataUrl}
                              alt={`Radiograph with numbered model findings - ${fileState.fileName}`}
                              width={fileState.result!.image_info.converted_size[0]}
                              height={fileState.result!.image_info.converted_size[1]}
                              detections={findings}
                              selectedDetectionId={selectedDetectionId}
                              onDetectionSelect={setSelectedDetectionId}
                            />
                          ) : (
                            <div className="flex min-h-96 items-center justify-center text-sm text-[#94a3b8]">
                              Radiograph preview unavailable
                            </div>
                          )}
                        </section>

                        <section
                          aria-label="Detected findings"
                          className="min-w-0 rounded-xl border border-[#e3e9f0] bg-white p-3 sm:p-4"
                        >
                          <div className="mb-3">
                            <h3 className="text-sm font-semibold text-[#142b4a]">
                              Detected findings
                            </h3>
                            <p className="mt-1 text-[11px] leading-5 text-[#8291a7]">
                              Select a finding or numbered image marker to
                              inspect its location. These are model predictions,
                              not confirmed diagnoses.
                            </p>
                          </div>
                          <div className="max-h-[min(68vh,720px)] space-y-2 overflow-y-auto pr-1">
                            {findings.length > 0 ? (
                              findings.map((detection, index) => (
                                <FindingButton
                                  key={detection.detection_id}
                                  detection={detection}
                                  index={index}
                                  selected={
                                    selectedDetectionId ===
                                    detection.detection_id
                                  }
                                  onClick={() =>
                                    setSelectedDetectionId(
                                      detection.detection_id
                                    )
                                  }
                                />
                              ))
                            ) : (
                              <p className="rounded-lg border border-[#e3e9f0] bg-[#f8fafc] p-4 text-xs leading-5 text-[#64748b]">
                                The model returned no findings for this image.
                                This does not rule out a dental condition;
                                clinical review is still required.
                              </p>
                            )}
                          </div>
                        </section>
                      </div>

                      <details className="group rounded-xl border border-[#e3e9f0] bg-white">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-xs font-semibold text-[#344861] [&::-webkit-details-marker]:hidden">
                          <span>Model Diagnostics</span>
                          <ChevronDown
                            className="size-4 text-[#8291a7] transition-transform group-open:rotate-180"
                            aria-hidden="true"
                          />
                        </summary>
                        <div className="border-t border-[#eef2f6] p-4">
                          <p className="mb-3 text-xs leading-5 text-[#64748b]">
                            Scores are model outputs, not calibrated diagnostic
                            probabilities. Near-identical overlapping boxes of
                            the same class are suppressed from the clinical
                            finding list; different classes and distinct
                            overlapping regions are retained.
                          </p>
                          <p className="mb-3 text-xs font-medium text-[#344861]">
                            {rawDetections.length} raw predictions ·{" "}
                            {suppressed.length} duplicate
                            {suppressed.length === 1 ? "" : "s"} suppressed ·{" "}
                            {findings.length} findings shown
                          </p>
                          <div className="overflow-x-auto rounded-lg border border-[#e3e9f0]">
                            <table className="w-full min-w-[620px] text-left text-xs">
                              <thead className="bg-[#f1f5f9] text-[#344861]">
                                <tr>
                                  {[
                                    "#",
                                    "Model label",
                                    "Model score",
                                    "Center (x, y)",
                                    "Box (w × h)",
                                    "Detection ID",
                                  ].map((heading) => (
                                    <th
                                      key={heading}
                                      className="px-3 py-2 font-semibold"
                                    >
                                      {heading}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#eef2f6]">
                                {rawDetections.map((detection, index) => (
                                  <tr key={detection.detection_id}>
                                    <td className="px-3 py-2">{index + 1}</td>
                                    <td className="px-3 py-2 capitalize">
                                      {detection.class}
                                    </td>
                                    <td className="px-3 py-2 tabular-nums">
                                      {(detection.confidence * 100).toFixed(1)}%
                                    </td>
                                    <td className="px-3 py-2 font-mono tabular-nums">
                                      {detection.x.toFixed(1)}, {detection.y.toFixed(1)}
                                    </td>
                                    <td className="px-3 py-2 font-mono tabular-nums">
                                      {detection.width} × {detection.height}
                                    </td>
                                    <td className="px-3 py-2 font-mono">
                                      {detection.detection_id}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </details>

                      <details className="group rounded-xl border border-[#e3e9f0] bg-white">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-xs font-semibold text-[#344861] [&::-webkit-details-marker]:hidden">
                          <span>Study metadata</span>
                          <ChevronDown
                            className="size-4 text-[#8291a7] transition-transform group-open:rotate-180"
                            aria-hidden="true"
                          />
                        </summary>
                        <div className="space-y-4 border-t border-[#eef2f6] p-4">
                          <DicomMetadata
                            metadata={fileState.result!.metadata}
                          />
                          <div className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                            <span className="font-medium text-[#64748b]">
                              Source file
                            </span>
                            <span className="break-all">
                              {fileData?.fileName ?? fileState.fileName}
                            </span>
                            <span className="font-medium text-[#64748b]">
                              Source file size
                            </span>
                            <span>
                              {fileData
                                ? `${(fileData.fileSize / (1024 * 1024)).toFixed(2)} MB`
                                : "Unavailable"}
                            </span>
                            <span className="font-medium text-[#64748b]">
                              Inference image
                            </span>
                            <span>
                              {fileState.result!.image_info.converted_format} ·{" "}
                              {fileState.result!.image_info.converted_size.join(" × ")}
                            </span>
                            <span className="font-medium text-[#64748b]">
                              Original pixel range
                            </span>
                            <span className="tabular-nums">
                              {fileState.result!.image_info.pixel_array_min.toFixed(1)}{" "}
                              – {fileState.result!.image_info.pixel_array_max.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      </details>
                  </TabsContent>

                  <TabsContent value="report" className="mt-4">
                    <DiagnosticReportComponent
                      predictions={findings}
                      metadata={fileState.result.metadata}
                      imageInfo={fileState.result.image_info}
                      report={fileState.diagnosticReport}
                      onReportGenerated={handleReportGenerated}
                      originalImageSrc={fileData?.dataUrl}
                      fileName={fileState.fileName}
                      onLocateFinding={(detectionId) => {
                        setSelectedDetectionId(detectionId);
                        setActiveView("analysis");
                      }}
                    />
                  </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}

interface FindingButtonProps {
  detection: Detection;
  index: number;
  selected: boolean;
  onClick: () => void;
}

function FindingButton({
  detection,
  index,
  selected,
  onClick,
}: FindingButtonProps) {
  const color = getDetectionColor(detection.class_id);

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0e7572] ${
        selected
          ? "border-[#0e7572] bg-[#f0faf9]"
          : "border-[#e3e9f0] bg-white hover:bg-[#f8fafc]"
      }`}
    >
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ backgroundColor: color }}
        aria-label={`Finding ${index + 1}`}
      >
        {String(index + 1).padStart(2, "0")}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-xs font-semibold capitalize text-[#172b45]">
          {detection.class}
        </span>
        <span className="mt-1 block text-[10px] text-[#8291a7]">
          Model-detected region · select to highlight
        </span>
      </span>
    </button>
  );
}
