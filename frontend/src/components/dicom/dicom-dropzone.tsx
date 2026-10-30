"use client";
import {
  Dropzone,
  DropZoneArea,
  DropzoneDescription,
  DropzoneFileList,
  DropzoneMessage,
  DropzoneTrigger,
  useDropzone,
} from "@/components/ui/dropzone";
import { CloudUploadIcon, RotateCcw, Sparkles, X } from "lucide-react";
import { convertStudyToImageUrl } from "@/lib/utils";
import { Button } from "../ui/button";
import { useDroppedFilesStore } from "@/lib/store";
import { UseMutationResult } from "@tanstack/react-query";
import { ConvertedDicomData, DicomDetectionResult } from "@/lib/types";
import { FILE_SIZE_LIMITS, SUPPORTED_STUDY_EXTENSIONS } from "@/lib/constants";
import { DicomFileItem } from "./dicom-file-item";

interface DicomDropzoneProps {
  dicomDetectionMutation: UseMutationResult<
    DicomDetectionResult[],
    Error,
    { files: ConvertedDicomData[] },
    unknown
  >;
  onPredict: () => void;
}

export function DicomDropzone({
  dicomDetectionMutation,
  onPredict,
}: DicomDropzoneProps) {
  const { files, addFile, removeFile } = useDroppedFilesStore();

  const dropzone = useDropzone({
    onDropFile: async (file: File) => {
      try {
        const convertedData = await convertStudyToImageUrl(file, "jpeg", 0.9);

        const fileData: ConvertedDicomData = {
          id: `${file.name}-${Date.now()}`, // Generate unique ID
          ...convertedData,
          originalFile: file,
          fileName: file.name,
          fileSize: file.size,
        };

        // Add to zustand store
        addFile(fileData);

        return {
          status: "success" as const,
          result: fileData,
        };
      } catch (error) {
        console.error("Failed to prepare study image:", error);
        return {
          status: "error" as const,
          error:
            error instanceof Error
              ? error.message
              : "Failed to prepare study image",
        };
      }
    },
    validation: {
      accept: SUPPORTED_STUDY_EXTENSIONS,
      maxSize: FILE_SIZE_LIMITS.MAX_SIZE,
    },
  });

  // Handle file removal
  const handleRemoveFile = (fileId: string, dropzoneFileId: string) => {
    removeFile(fileId);
    dropzone.onRemoveFile(dropzoneFileId);
    // Reset mutation state when files change
    dicomDetectionMutation.reset();
  };

  return (
    <div className="not-prose flex flex-col gap-3 sm:gap-4">
      <Dropzone {...dropzone}>
        <div className="space-y-3">
          <div className="flex flex-col">
            <DropzoneDescription className="text-xs leading-5 text-[#64748b]">
              Select DICOM (.dcm/.dicom/.rvg) or PNG (.png) files to add them
              to your worklist.
            </DropzoneDescription>
            <DropzoneMessage className="h-auto min-h-0 pt-1 text-xs" />
          </div>
          <DropZoneArea className="group min-h-[210px] rounded-xl border-2 border-dashed border-[#cbd6e2] bg-[#fbfdff] transition-colors hover:border-[#54b9b1] hover:bg-[#f6fbfb] sm:min-h-[250px]">
            <DropzoneTrigger className="flex h-full w-full flex-col items-center justify-center gap-4 rounded-xl bg-transparent px-5 py-8 text-center text-sm hover:bg-transparent sm:py-10">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-[#e8f7f5] text-[#0e7572] transition-transform group-hover:scale-105">
                <CloudUploadIcon className="size-7" />
              </span>
              <div className="space-y-1.5">
                <p className="text-base font-semibold text-[#142b4a] sm:text-lg">
                  Drag and drop dental X-rays
                </p>
                <p className="text-xs text-[#8291a7] sm:text-[13px]">
                  Drop DICOM or PNG studies here, or browse files from your
                  device
                </p>
              </div>
              <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#0e7572] px-4 text-xs font-semibold text-white transition-colors group-hover:bg-[#095f5d]">
                <CloudUploadIcon className="size-4" />
                Choose files
              </span>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  "DICOM · .dcm",
                  "RVG · .rvg",
                  "PNG · .png",
                  "Max 10 MB",
                ].map((item) => (
                  <span
                    key={item}
                    className="rounded-md border border-[#e3e9f0] bg-white px-2.5 py-1 font-mono text-[10px] text-[#64748b]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </DropzoneTrigger>
          </DropZoneArea>
        </div>

        {dropzone.fileStatuses.length > 0 && (
          <div className="flex items-center justify-between pt-2">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#52657d]">
              Upload queue
              <span className="ml-2 rounded-full bg-[#eef3f8] px-2 py-0.5 font-mono text-[10px] font-medium normal-case tracking-normal text-[#64748b]">
                {dropzone.fileStatuses.length}
              </span>
            </h3>
          </div>
        )}
        <DropzoneFileList className="gap-2 p-0">
          {dropzone.fileStatuses.map((file) => (
            <DicomFileItem
              key={file.id}
              file={file}
              onRemove={handleRemoveFile}
            />
          ))}
        </DropzoneFileList>
      </Dropzone>

      <div className="flex flex-col gap-2 border-t border-[#eef2f6] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-[#8291a7]">
          {files.length === 0
            ? "Add one or more studies to start the analysis."
            : `${files.length} ${files.length === 1 ? "study" : "studies"} ready to analyze`}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            size="lg"
            className="w-full bg-[#142b4a] text-white hover:bg-[#203d63] sm:w-auto"
            disabled={files.length === 0 || dicomDetectionMutation.isPending}
            onClick={onPredict}
          >
            {dicomDetectionMutation.isPending ? (
              <>
                <RotateCcw className="size-4 animate-spin" />
                Analyzing studies...
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Analyze studies
              </>
            )}
          </Button>

          {dicomDetectionMutation.data &&
            dicomDetectionMutation.data.length > 0 && (
            <Button
              variant="outline"
              size="lg"
              className="w-full border-[#dbe3eb] bg-white text-[#52657d] hover:bg-[#f5f7fa] sm:w-auto"
              onClick={() => dicomDetectionMutation.reset()}
            >
              <X className="size-4" />
              Clear Results
            </Button>
            )}
        </div>
      </div>
    </div>
  );
}
