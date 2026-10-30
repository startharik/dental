"use client";
import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  useGenerateResearchAnalysis,
  useResearchModeStatus,
} from "@/hooks/use-research-analysis";
import { useResearchAutoPreference } from "@/hooks/use-research-auto-preference";
import { useDroppedFilesStore } from "@/lib/store";
import {
  DetectionProgress,
  DiagnosticReport,
  ResearchAnalysis,
} from "@/lib/types";
import { deduplicateDetections } from "@/lib/utils";
import { ResultTabs } from "./result-tabs";
import { ResultCard } from "./result-card";
import { StatusBadges } from "./status-indicator";

interface PredictionResultsProps {
  detectionProgress: DetectionProgress;
  onReportGenerated?: (fileId: string, report: DiagnosticReport) => void;
  onResearchAnalysisGenerated?: (
    fileId: string,
    analysis: ResearchAnalysis
  ) => void;
}

export function PredictionResults({
  detectionProgress,
  onReportGenerated,
  onResearchAnalysisGenerated,
}: PredictionResultsProps) {
  const { files } = useDroppedFilesStore();
  const { files: fileStates } = detectionProgress;
  const preference = useResearchAutoPreference();
  const researchModeStatus = useResearchModeStatus();
  const { mutateAsync: generateResearchAnalysis } =
    useGenerateResearchAnalysis();
  const [researchRuns, setResearchRuns] = useState<
    Record<string, { status: "pending" | "error"; error?: string }>
  >({});
  const [queueRevision, setQueueRevision] = useState(0);
  const attemptedResearchIds = useRef(new Set<string>());
  const researchRunning = useRef(false);

  const startResearchAnalysis = useCallback(
    async (fileId: string) => {
      const fileState = fileStates.find((file) => file.fileId === fileId);
      const fileData = files.find((file) => file.id === fileId);
      if (
        !fileState?.result ||
        fileState.status !== "success" ||
        !fileData ||
        fileState.researchAnalysis ||
        attemptedResearchIds.current.has(fileId) ||
        researchRunning.current
      ) {
        return;
      }

      const rawPredictions = fileState.result.predictions;
      const predictions = deduplicateDetections(rawPredictions).findings;
      if (predictions.length === 0) return;

      attemptedResearchIds.current.add(fileId);
      researchRunning.current = true;
      setResearchRuns((current) => ({
        ...current,
        [fileId]: { status: "pending" },
      }));

      try {
        const response = await generateResearchAnalysis({
          predictions,
          raw_predictions: rawPredictions,
          image_info: fileState.result.image_info,
          modality: fileState.result.metadata.modality,
          image_data_url: fileData.dataUrl,
          dentist_annotations: [],
          share_consent: true,
        });
        onResearchAnalysisGenerated?.(fileId, response.analysis);
        setResearchRuns((current) => {
          const next = { ...current };
          delete next[fileId];
          return next;
        });
      } catch (error) {
        const message =
          axios.isAxiosError<{ detail?: string }>(error) &&
          typeof error.response?.data.detail === "string"
            ? error.response.data.detail
            : "LePro AI analysis failed. You can retry.";
        setResearchRuns((current) => ({
          ...current,
          [fileId]: { status: "error", error: message },
        }));
      } finally {
        researchRunning.current = false;
        setQueueRevision((current) => current + 1);
      }
    },
    [
      fileStates,
      files,
      generateResearchAnalysis,
      onResearchAnalysisGenerated,
    ]
  );

  useEffect(() => {
    if (
      !preference.loaded ||
      !preference.enabled ||
      !researchModeStatus.data?.enabled ||
      researchRunning.current
    ) {
      return;
    }

    const nextFile = fileStates.find(
      (file) =>
        file.status === "success" &&
        file.result &&
        !file.researchAnalysis &&
        !attemptedResearchIds.current.has(file.fileId)
    );
    if (nextFile) {
      void startResearchAnalysis(nextFile.fileId);
    }
  }, [
    fileStates,
    preference.enabled,
    preference.loaded,
    queueRevision,
    researchModeStatus.data,
    startResearchAnalysis,
  ]);

  const retryResearchAnalysis = useCallback(
    (fileId: string) => {
      attemptedResearchIds.current.delete(fileId);
      setResearchRuns((current) => {
        const next = { ...current };
        delete next[fileId];
        return next;
      });
      void startResearchAnalysis(fileId);
    },
    [startResearchAnalysis]
  );

  if (fileStates.length === 0) {
    return null;
  }

  // Find the first available result or the first file as default
  const defaultTab =
    fileStates.find((f) => f.result)?.fileId || fileStates[0]?.fileId || "";
  const completedFiles = fileStates.filter((f) => f.status === "success");
  const errorFiles = fileStates.filter((f) => f.status === "error");
  const loadingFiles = fileStates.filter((f) => f.status === "loading");

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h3 className="text-base font-semibold tracking-tight text-[#142b4a] sm:text-lg">
          Study findings
        </h3>
        <StatusBadges
          completedCount={completedFiles.length}
          loadingCount={loadingFiles.length}
          errorCount={errorFiles.length}
        />
      </div>
      <ResultTabs fileStates={fileStates} defaultValue={defaultTab}>
        {fileStates.map((fileState) => {
          const fileData = files.find((f) => f.id === fileState.fileId);
          return (
            <ResultCard
              key={fileState.fileId}
              fileState={fileState}
              fileData={fileData}
              onReportGenerated={onReportGenerated}
              researchAnalysisStatus={
                fileState.researchAnalysis
                  ? "complete"
                  : researchRuns[fileState.fileId]?.status ?? "idle"
              }
              researchAnalysisError={
                researchRuns[fileState.fileId]?.error
              }
              onRetryResearchAnalysis={() =>
                retryResearchAnalysis(fileState.fileId)
              }
            />
          );
        })}
      </ResultTabs>
    </div>
  );
}
