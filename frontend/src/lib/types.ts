// Shared types for the application
export interface Detection {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  class: string;
  class_id: number;
  detection_id: string;
}

export interface DicomMetadata {
  patient_id?: string;
  patient_name?: string;
  patient_birth_date?: string;
  patient_sex?: string;
  study_date?: string;
  study_time?: string;
  study_description?: string;
  series_description?: string;
  modality?: string;
  manufacturer?: string;
  manufacturer_model_name?: string;
  rows?: number;
  columns?: number;
  pixel_spacing?: number[];
  bits_allocated?: number;
  bits_stored?: number;
  photometric_interpretation?: string;
  acquisition_date?: string;
  acquisition_time?: string;
  institution_name?: string;
  referring_physician_name?: string;
}

export interface ImageInfo {
  original_shape: number[];
  converted_format: string;
  converted_size: number[];
  original_dtype: string;
  pixel_array_min: number;
  pixel_array_max: number;
  photometric_interpretation?: string;
  transfer_syntax?: string;
}

export interface DicomDetectionResponse {
  predictions: Detection[];
  metadata: DicomMetadata;
  image_info: ImageInfo;
}

export interface DicomDetectionResult extends DicomDetectionResponse {
  fileId: string;
  fileName: string;
}

// Type for the converted DICOM data
export interface ConvertedDicomData {
  id: string;
  dataUrl: string;
  width: number;
  height: number;
  originalFile: File;
  fileName: string;
  fileSize: number;
}

// Types for individual file detection states
export interface FileDetectionState {
  fileId: string;
  fileName: string;
  status: "pending" | "loading" | "success" | "error";
  result?: DicomDetectionResult;
  error?: Error;
  diagnosticReport?: DiagnosticReport;
  researchAnalysis?: ResearchAnalysis;
}

export interface DetectionProgress {
  files: FileDetectionState[];
  isAllComplete: boolean;
  hasAnyResults: boolean;
  hasAnyErrors: boolean;
}

export interface SuggestedClinicalAssessment {
  detection_id: string;
  suggestion: string;
}

// Diagnostic Report Types
export interface DiagnosticReport {
  uncertainty_and_limitations: string;
  suggested_assessments: SuggestedClinicalAssessment[];
  generated_at: string;
}

export interface ResearchDifferential {
  diagnosis: string;
  supporting_evidence: string;
  evidence_against_or_missing: string;
}

export interface ResearchDentistAnnotation {
  detection_id: string;
  review_status: ClinicalFindingReviewStatus;
  dentist_label?: string;
  assigned_tooth?: string;
}

export interface ResearchFindingAnalysis {
  detection_id: string;
  finding_name: string;
  model_confidence: number;
  anatomical_location: string;
  possible_diagnosis: string;
  differential_diagnoses: ResearchDifferential[];
  ai_interpretation: string;
  clinical_significance: string;
  recommended_investigations: string[];
  potential_treatment_options: string[];
  follow_up: string;
  evidence_and_limitations: string[];
  related_detection_ids: string[];
  dentist_annotation_comparison: string;
}

export interface ResearchAnalysis {
  research_mode: string;
  model: string;
  generated_at: string;
  findings: ResearchFindingAnalysis[];
  combined_clinical_interpretation: string;
  cross_finding_patterns: string[];
  source_scope: string;
  limitations: string;
}

export interface ResearchModeStatus {
  enabled: boolean;
  provider: string;
  model: string;
}

export interface ResearchAnalysisRequest {
  predictions: Detection[];
  raw_predictions: Detection[];
  image_info: ImageInfo;
  modality?: string;
  image_data_url: string;
  dentist_annotations: ResearchDentistAnnotation[];
  share_consent: boolean;
}

export interface ResearchAnalysisResponse {
  analysis: ResearchAnalysis;
  model_predictions: Detection[];
}

export type ClinicalFindingReviewStatus =
  | "awaiting_review"
  | "confirmed"
  | "modified"
  | "not_applicable";

export interface ClinicalFindingReview {
  status: ClinicalFindingReviewStatus;
  modifiedLabel?: string;
  toothNumber?: string;
  observations: string;
}

export interface ClinicalReviewDraft {
  findings: Record<string, ClinicalFindingReview>;
  finalImpression: string;
  savedAt?: string;
}

export type DiagnosticReportRequest = DicomDetectionResponse;

export interface DiagnosticReportResponse {
  diagnostic_report: DiagnosticReport;
  detections_used: Detection[];
  metadata?: DicomMetadata;
}
