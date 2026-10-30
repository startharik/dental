"use client";
import { getDetectionColor } from "@/lib/constants";
import { Detection } from "@/lib/types";

interface DetectionOverlayProps {
  detections: Detection[];
  originalWidth: number;
  originalHeight: number;
  displayWidth: number;
  displayHeight: number;
  selectedDetectionId?: string;
  onDetectionSelect?: (detectionId: string) => void;
}

export function DetectionOverlay({
  detections,
  originalWidth,
  originalHeight,
  displayWidth,
  displayHeight,
  selectedDetectionId,
  onDetectionSelect,
}: DetectionOverlayProps) {
  const scaleX = displayWidth / originalWidth;
  const scaleY = displayHeight / originalHeight;

  return (
    <>
      {detections.map((detection, index) => {
        const boxColor = getDetectionColor(detection.class_id);
        const isSelected = detection.detection_id === selectedDetectionId;

        return (
          <button
            type="button"
            key={detection.detection_id}
            className="pointer-events-auto absolute border-2 transition-shadow focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            aria-label={`Select finding ${index + 1}: ${detection.class}`}
            aria-pressed={isSelected}
            onClick={() => onDetectionSelect?.(detection.detection_id)}
            style={{
              left: (detection.x - detection.width / 2) * scaleX,
              top: (detection.y - detection.height / 2) * scaleY,
              width: detection.width * scaleX,
              height: detection.height * scaleY,
              borderColor: boxColor,
              borderWidth: isSelected ? 4 : 2,
              boxShadow: isSelected ? `0 0 0 3px ${boxColor}66` : undefined,
            }}
          >
            <div
              className="absolute -left-1 -top-7 flex size-6 items-center justify-center rounded-full border-2 border-[#101622] text-[10px] font-bold leading-none text-white shadow"
              style={{ backgroundColor: boxColor }}
            >
              {String(index + 1).padStart(2, "0")}
            </div>
          </button>
        );
      })}
    </>
  );
}
