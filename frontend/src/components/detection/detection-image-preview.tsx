"use client";

import Image from "next/image";
import {
  Maximize2,
  Minimize2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Detection } from "@/lib/types";
import { DetectionOverlay } from "./detection-overlay";

interface DetectionImagePreviewProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  detections?: Detection[];
  selectedDetectionId?: string;
  onDetectionSelect?: (detectionId: string) => void;
}

export function DetectionImagePreview({
  src,
  alt,
  width,
  height,
  detections = [],
  selectedDetectionId,
  onDetectionSelect,
}: DetectionImagePreviewProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [viewerSize, setViewerSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const updateViewerSize = useCallback(() => {
    if (!viewerRef.current) return;
    setViewerSize({
      width: viewerRef.current.clientWidth,
      height: viewerRef.current.clientHeight,
    });
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const resizeObserver = new ResizeObserver(updateViewerSize);
    resizeObserver.observe(viewer);
    updateViewerSize();
    return () => resizeObserver.disconnect();
  }, [updateViewerSize, isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  const fitScale =
    viewerSize.width > 0 && viewerSize.height > 0
      ? Math.min(viewerSize.width / width, viewerSize.height / height)
      : 0;
  const displayWidth = width * fitScale * zoom;
  const displayHeight = height * fitScale * zoom;

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-[100] flex flex-col bg-[#080d15] p-3 sm:p-5"
          : "w-full"
      }
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="truncate text-[11px] font-medium text-[#cbd5e1]">
          {width} × {height}px
          <span className="ml-2 text-[#8291a7]">· Model scores are not diagnostic probabilities</span>
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <ToolbarButton
            label="Zoom out"
            disabled={zoom <= 1}
            onClick={() => setZoom((current) => Math.max(1, current - 0.25))}
          >
            <ZoomOut />
          </ToolbarButton>
          <span className="w-11 text-center font-mono text-[10px] text-[#cbd5e1]">
            {Math.round(zoom * 100)}%
          </span>
          <ToolbarButton
            label="Zoom in"
            disabled={zoom >= 4}
            onClick={() => setZoom((current) => Math.min(4, current + 0.25))}
          >
            <ZoomIn />
          </ToolbarButton>
          <ToolbarButton
            label="Reset zoom"
            disabled={zoom === 1}
            onClick={() => setZoom(1)}
          >
            <RotateCcw />
          </ToolbarButton>
          <ToolbarButton
            label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            onClick={() => setIsFullscreen((current) => !current)}
          >
            {isFullscreen ? <Minimize2 /> : <Maximize2 />}
          </ToolbarButton>
        </div>
      </div>

      <div
        ref={viewerRef}
        className={`relative flex w-full items-center justify-center overflow-hidden rounded-lg bg-[#080d15] ${
          isFullscreen ? "min-h-0 flex-1" : "h-[min(68vh,720px)] min-h-[360px]"
        }`}
      >
        {fitScale > 0 && (
          <div
            className="relative shrink-0"
            style={{ width: displayWidth, height: displayHeight }}
          >
            <Image
              src={src}
              alt={alt}
              fill
              unoptimized
              priority
              className="select-none object-fill"
              draggable={false}
            />
            <div className="pointer-events-none absolute inset-0">
              <DetectionOverlay
                detections={detections}
                originalWidth={width}
                originalHeight={height}
                displayWidth={displayWidth}
                displayHeight={displayHeight}
                selectedDetectionId={selectedDetectionId}
                onDetectionSelect={onDetectionSelect}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ToolbarButtonProps {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function ToolbarButton({
  label,
  disabled = false,
  onClick,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-md text-[#d8e2ee] transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
