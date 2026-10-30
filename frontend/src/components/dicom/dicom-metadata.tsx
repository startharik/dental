"use client";
import { Button } from "../ui/button";
import { CopyIcon } from "lucide-react";
import { DicomDetectionResult } from "@/lib/types";

interface DicomMetadataProps {
  metadata: DicomDetectionResult["metadata"];
}

export function DicomMetadata({ metadata }: DicomMetadataProps) {
  const rows = ([
    ["Patient", metadata.patient_name],
    ["Patient ID", metadata.patient_id],
    ["Birth date", metadata.patient_birth_date],
    ["Sex", metadata.patient_sex],
    ["Modality", metadata.modality],
    ["Study date", metadata.study_date],
    ["Study time", metadata.study_time],
    ["Study description", metadata.study_description],
    ["Series description", metadata.series_description],
    ["Acquisition date", metadata.acquisition_date],
    ["Acquisition time", metadata.acquisition_time],
    ["Manufacturer", metadata.manufacturer],
    ["Equipment model", metadata.manufacturer_model_name],
    ["Institution", metadata.institution_name],
    ["Referring physician", metadata.referring_physician_name],
    [
      "Dimensions",
      metadata.rows && metadata.columns
        ? `${metadata.columns} × ${metadata.rows}`
        : undefined,
    ],
    [
      "Pixel spacing",
      metadata.pixel_spacing?.length
        ? metadata.pixel_spacing.join(" × ")
        : undefined,
    ],
    [
      "Pixel depth",
      metadata.bits_stored
        ? `${metadata.bits_stored} stored / ${metadata.bits_allocated ?? "?"} allocated bits`
        : undefined,
    ],
    ["Photometric interpretation", metadata.photometric_interpretation],
  ] satisfies [string, string | undefined][]).filter(
    (row): row is [string, string] =>
      typeof row[1] === "string" && row[1].length > 0
  );

  return (
    <div>
      <h4 className="text-sm font-medium mb-2">DICOM Metadata</h4>
      {rows.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs sm:text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <span className="text-muted-foreground font-medium">
                {label}:
              </span>
              <div className="flex min-w-0 items-center">
                <span className="break-words">{value}</span>
                {label === "Patient ID" && value && (
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label="Copy patient ID"
                    className="ml-1 shrink-0 cursor-pointer focus-within:text-muted-foreground"
                    onClick={() => navigator.clipboard.writeText(value)}
                  >
                    <CopyIcon size={8} className="size-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No DICOM metadata is available for this image.
        </p>
      )}
    </div>
  );
}
