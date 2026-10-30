"use client";
import { CheckCircle2, FileImage, Trash2Icon } from "lucide-react";
import { ImagePreview } from "../image-preview";
import {
  DropzoneFileListItem,
  DropzoneRemoveFile,
  FileStatus,
} from "../ui/dropzone";
import { formatFileSize } from "@/lib/constants";
import { ConvertedDicomData } from "@/lib/types";

interface DicomFileItemProps {
  file: FileStatus<ConvertedDicomData, string>;
  onRemove: (fileId: string, dropzoneFileId: string) => void;
}

export function DicomFileItem({ file, onRemove }: DicomFileItemProps) {
  return (
    <DropzoneFileListItem
      className="w-full flex-row items-center gap-3 overflow-hidden rounded-xl border border-[#e3e9f0] bg-white p-3 shadow-none sm:px-4"
      key={file.id}
      file={file}
    >
      {file.status === "pending" && (
        <div className="flex size-14 shrink-0 animate-pulse items-center justify-center rounded-lg bg-[#eef2f6] text-[#94a3b8]">
          <FileImage className="size-5" />
        </div>
      )}
      {file.status === "success" && (
        <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-[#101622]">
          <ImagePreview
            src={file.result.dataUrl}
            alt={`Study preview - ${file.fileName}`}
            width={file.result.width}
            height={file.result.height}
            fileName={file.fileName}
            fileSize={file.file.size}
          />
        </div>
      )}
      {file.status === "error" && (
        <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500">
          <FileImage className="size-5" />
        </div>
      )}
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-[#263b55] sm:text-[13px]">
            {file.fileName}
          </p>
          <p className="mt-1 text-[11px] text-[#8291a7]">
            {formatFileSize(file.file.size)} ·{" "}
            {file.status === "success"
              ? `${file.result.width} × ${file.result.height}px`
              : file.status === "error"
                ? file.error
                : "Preparing preview"}
          </p>
        </div>
        {file.status === "success" && (
          <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-[#e8f7f5] px-2.5 py-1 text-[10px] font-semibold text-[#0e7572] sm:inline-flex">
            <CheckCircle2 className="size-3" />
            Ready
          </span>
        )}
        <DropzoneRemoveFile
          variant="ghost"
          size="sm"
          className="shrink-0 hover:outline ml-2"
          onClick={() =>
            file.status === "success" && onRemove(file.result.id, file.id)
          }
        >
          <Trash2Icon className="size-3 sm:size-4" />
        </DropzoneRemoveFile>
      </div>
    </DropzoneFileListItem>
  );
}
