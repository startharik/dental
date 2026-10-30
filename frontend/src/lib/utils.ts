import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { DicomImage, NativePixelDecoder } from "dcmjs-imaging";
import type { Detection } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function intersectionOverUnion(first: Detection, second: Detection): number {
  const firstLeft = first.x - first.width / 2;
  const firstTop = first.y - first.height / 2;
  const secondLeft = second.x - second.width / 2;
  const secondTop = second.y - second.height / 2;
  const intersectionWidth = Math.max(
    0,
    Math.min(firstLeft + first.width, secondLeft + second.width) -
      Math.max(firstLeft, secondLeft)
  );
  const intersectionHeight = Math.max(
    0,
    Math.min(firstTop + first.height, secondTop + second.height) -
      Math.max(firstTop, secondTop)
  );
  const intersection = intersectionWidth * intersectionHeight;
  const union =
    first.width * first.height + second.width * second.height - intersection;

  return union > 0 ? intersection / union : 0;
}

export function deduplicateDetections(
  detections: Detection[],
  overlapThreshold = 0.85
): { findings: Detection[]; suppressed: Detection[] } {
  const rankedDetections = detections
    .map((detection, index) => ({ detection, index }))
    .sort(
      (first, second) =>
        second.detection.confidence - first.detection.confidence ||
        first.index - second.index
    );
  const retained: typeof rankedDetections = [];
  const suppressed: typeof rankedDetections = [];

  for (const candidate of rankedDetections) {
    const isDuplicate = retained.some(
      ({ detection }) =>
        detection.class_id === candidate.detection.class_id &&
        intersectionOverUnion(detection, candidate.detection) >=
          overlapThreshold
    );

    if (isDuplicate) {
      suppressed.push(candidate);
    } else {
      retained.push(candidate);
    }
  }

  return {
    findings: retained
      .sort((first, second) => first.index - second.index)
      .map(({ detection }) => detection),
    suppressed: suppressed
      .sort((first, second) => first.index - second.index)
      .map(({ detection }) => detection),
  };
}

/**
 * Convert a DICOM or PNG study to an image data URL for display
 * @param file - The DICOM file to convert
 * @param format - Output format ('jpeg' | 'png')
 * @param quality - JPEG quality (0-1, only applies to JPEG)
 * @returns Promise<string> - Data URL of the converted image
 */
export async function convertStudyToImageUrl(
  file: File,
  format: "jpeg" | "png" = "jpeg",
  quality: number = 0.8
): Promise<{
  dataUrl: string;
  width: number;
  height: number;
}> {
  if (file.type === "image/png" || /\.png$/i.test(file.name)) {
    const bitmap = await createImageBitmap(file);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Failed to get canvas context");
      }

      ctx.drawImage(bitmap, 0, 0);
      return {
        dataUrl: canvas.toDataURL("image/png"),
        width: bitmap.width,
        height: bitmap.height,
      };
    } finally {
      bitmap.close();
    }
  }

  // Ensure native decoders are initialized
  try {
    await NativePixelDecoder.initializeAsync({
      webAssemblyModulePathOrUrl: "/dcmjs-native-codecs.wasm",
    });
  } catch {
    // If already initialized, this will throw but we can continue
    console.log("Native decoders already initialized or failed to initialize");
  }

  // Read file as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();

  // Create DICOM image instance
  const image = new DicomImage(arrayBuffer);

  // Render the image
  const renderingResult = image.render();

  // Create a temporary canvas
  const canvas = document.createElement("canvas");
  canvas.width = renderingResult.width;
  canvas.height = renderingResult.height;

  // Get 2D context
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  // Create ImageData from rendered pixels (RGBA format)
  const imageData = new ImageData(
    new Uint8ClampedArray(renderingResult.pixels),
    renderingResult.width,
    renderingResult.height
  );

  // Draw the image data to canvas
  ctx.putImageData(imageData, 0, 0);

  // Convert canvas to data URL
  const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";
  const dataUrl = canvas.toDataURL(mimeType, quality);

  return {
    dataUrl,
    width: renderingResult.width,
    height: renderingResult.height,
  };
}

/**
 * Convert a DICOM or PNG study to Blob for download or further processing
 * @param file - The study file to convert
 * @param format - Output format ('jpeg' | 'png')
 * @param quality - JPEG quality (0-1, only applies to JPEG)
 * @returns Promise<Blob> - Blob of the converted image
 */
export async function convertDicomToBlob(
  file: File,
  format: "jpeg" | "png" = "jpeg",
  quality: number = 0.8
): Promise<Blob> {
  const { dataUrl } = await convertStudyToImageUrl(file, format, quality);

  // Convert data URL to blob
  const response = await fetch(dataUrl);
  return response.blob();
}
