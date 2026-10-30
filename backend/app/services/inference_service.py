from inference_sdk import InferenceHTTPClient
from functools import lru_cache
from fastapi import HTTPException
import logging
import pydicom
import numpy as np
from PIL import Image, ImageOps
import tempfile
import os
from typing import Dict, Any, Tuple
from ..core.config import get_settings
from ..models.detection import DicomMetadata, ImageInfo

logger = logging.getLogger(__name__)


@lru_cache
def get_roboflow_client(api_key: str):
    """Create and cache Roboflow client"""
    client = InferenceHTTPClient(
        api_url="https://serverless.roboflow.com", api_key=api_key
    )
    return client


class InferenceService:
    """Service for handling dental condition detection inference"""

    def __init__(self):
        self.settings = get_settings()

    async def detect_dental_conditions(
        self, image_path: str, model_id: str = "p_fase_1_v2/4"
    ) -> dict:
        """
        Run inference on dental image to detect cavities and periapical lesions

        Args:
            image_path: Path to the image file
            model_id: Model ID to use for inference

        Returns:
            dict: Inference results from Roboflow

        Raises:
            HTTPException: If inference fails
        """
        try:
            client = get_roboflow_client(self.settings.roboflow_api_key)
            result = client.infer(image_path, model_id=model_id)
            return result
        except Exception as e:
            status_code = getattr(e, "status_code", None)
            logger.error(
                "Roboflow inference failed for model %s (HTTP %s)",
                model_id,
                status_code or "unknown",
            )
            detail = (
                "Roboflow model was not found or is inaccessible. Check the model ID "
                "and API key permissions."
                if status_code == 404
                else "Roboflow inference failed. Check the API key, model access, and backend logs."
            )
            raise HTTPException(status_code=502, detail=detail) from None

    def parse_dicom_metadata(self, dicom_file_path: str) -> DicomMetadata:
        """
        Parse DICOM metadata from file

        Args:
            dicom_file_path: Path to the DICOM file

        Returns:
            DicomMetadata: Parsed metadata

        Raises:
            HTTPException: If DICOM parsing fails
        """
        try:
            dicom_data = pydicom.dcmread(dicom_file_path)

            # Extract pixel spacing if available
            pixel_spacing = None
            if hasattr(dicom_data, "PixelSpacing"):
                pixel_spacing = [float(x) for x in dicom_data.PixelSpacing]

            metadata = DicomMetadata(
                patient_id=getattr(dicom_data, "PatientID", None),
                patient_name=(
                    str(getattr(dicom_data, "PatientName", None))
                    if hasattr(dicom_data, "PatientName")
                    else None
                ),
                patient_birth_date=getattr(dicom_data, "PatientBirthDate", None),
                patient_sex=getattr(dicom_data, "PatientSex", None),
                study_date=getattr(dicom_data, "StudyDate", None),
                study_time=getattr(dicom_data, "StudyTime", None),
                study_description=getattr(dicom_data, "StudyDescription", None),
                series_description=getattr(dicom_data, "SeriesDescription", None),
                modality=getattr(dicom_data, "Modality", None),
                manufacturer=getattr(dicom_data, "Manufacturer", None),
                manufacturer_model_name=getattr(
                    dicom_data, "ManufacturerModelName", None
                ),
                rows=getattr(dicom_data, "Rows", None),
                columns=getattr(dicom_data, "Columns", None),
                pixel_spacing=pixel_spacing,
                bits_allocated=getattr(dicom_data, "BitsAllocated", None),
                bits_stored=getattr(dicom_data, "BitsStored", None),
                photometric_interpretation=getattr(
                    dicom_data, "PhotometricInterpretation", None
                ),
                acquisition_date=getattr(dicom_data, "AcquisitionDate", None),
                acquisition_time=getattr(dicom_data, "AcquisitionTime", None),
                institution_name=getattr(dicom_data, "InstitutionName", None),
                referring_physician_name=(
                    str(getattr(dicom_data, "ReferringPhysicianName", None))
                    if hasattr(dicom_data, "ReferringPhysicianName")
                    else None
                ),
            )

            return metadata

        except Exception as e:
            logger.error(f"Failed to parse DICOM metadata: {str(e)}")
            raise HTTPException(
                status_code=400, detail=f"Failed to parse DICOM file: {str(e)}"
            )

    def convert_dicom_to_image(self, dicom_file_path: str) -> Tuple[str, ImageInfo]:
        """
        Convert DICOM file to a standard image format for inference

        Args:
            dicom_file_path: Path to the DICOM file

        Returns:
            Tuple of (converted_image_path, image_info)

        Raises:
            HTTPException: If conversion fails
        """
        try:
            dicom_data = pydicom.dcmread(dicom_file_path)

            # Apply modality LUT if present
            if (
                hasattr(dicom_data, "ModalityLUTSequence")
                and dicom_data.ModalityLUTSequence
            ):
                try:
                    from pydicom.pixel_data_handlers.util import apply_modality_lut

                    pixel_array = apply_modality_lut(dicom_data.pixel_array, dicom_data)
                except Exception as e:
                    logger.warning(f"Failed to apply modality LUT: {e}")
                    pixel_array = dicom_data.pixel_array
            else:
                pixel_array = dicom_data.pixel_array

            # Apply VOI LUT if present (windowing)
            if hasattr(dicom_data, "VOILUTSequence") and dicom_data.VOILUTSequence:
                try:
                    from pydicom.pixel_data_handlers.util import apply_voi_lut

                    pixel_array = apply_voi_lut(pixel_array, dicom_data)
                except Exception as e:
                    logger.warning(f"Failed to apply VOI LUT: {e}")
            elif hasattr(dicom_data, "WindowCenter") and hasattr(
                dicom_data, "WindowWidth"
            ):
                # Apply windowing manually
                try:
                    window_center = float(
                        dicom_data.WindowCenter[0]
                        if isinstance(dicom_data.WindowCenter, list)
                        else dicom_data.WindowCenter
                    )
                    window_width = float(
                        dicom_data.WindowWidth[0]
                        if isinstance(dicom_data.WindowWidth, list)
                        else dicom_data.WindowWidth
                    )

                    # Apply windowing
                    pixel_array = np.clip(
                        (pixel_array - (window_center - window_width / 2))
                        / window_width
                        * 255,
                        0,
                        255,
                    )
                except Exception as e:
                    logger.warning(f"Failed to apply windowing: {e}")

            # Handle photometric interpretation
            if hasattr(dicom_data, "PhotometricInterpretation"):
                if dicom_data.PhotometricInterpretation == "MONOCHROME1":
                    # Invert for MONOCHROME1 (0 = white, max = black)
                    pixel_array = pixel_array.max() - pixel_array

            # Normalize pixel values to 0-255 range
            if pixel_array.dtype != np.uint8:
                # Get the min and max values
                min_val = pixel_array.min()
                max_val = pixel_array.max()

                if max_val > min_val:
                    # Normalize to 0-255
                    pixel_array = (
                        (pixel_array - min_val) / (max_val - min_val) * 255
                    ).astype(np.uint8)
                else:
                    # Handle case where all pixels have the same value
                    pixel_array = np.full(pixel_array.shape, 128, dtype=np.uint8)

            # Handle different image dimensions
            if len(pixel_array.shape) == 2:
                # Grayscale - convert to RGB
                rgb_array = np.stack([pixel_array] * 3, axis=-1)
            elif len(pixel_array.shape) == 3:
                if pixel_array.shape[2] == 1:
                    # Single channel - convert to RGB
                    rgb_array = np.repeat(pixel_array, 3, axis=2)
                elif pixel_array.shape[2] == 3:
                    # Already RGB
                    rgb_array = pixel_array
                else:
                    # Multi-channel - use first 3 channels or convert first channel to RGB
                    if pixel_array.shape[2] >= 3:
                        rgb_array = pixel_array[:, :, :3]
                    else:
                        rgb_array = np.stack([pixel_array[:, :, 0]] * 3, axis=-1)
            else:
                raise ValueError(f"Unsupported pixel array shape: {pixel_array.shape}")

            # Create PIL Image
            image = Image.fromarray(rgb_array.astype(np.uint8))

            # Save a lossless PNG for inference; DICOM metadata is returned separately.
            temp_image_fd, temp_image_path = tempfile.mkstemp(suffix=".png")
            os.close(temp_image_fd)

            image.save(temp_image_path, "PNG")

            # Create type-safe image info
            image_info = ImageInfo(
                original_shape=list(dicom_data.pixel_array.shape),
                converted_format="PNG",
                converted_size=list(image.size),
                original_dtype=str(dicom_data.pixel_array.dtype),
                pixel_array_min=float(dicom_data.pixel_array.min()),
                pixel_array_max=float(dicom_data.pixel_array.max()),
                photometric_interpretation=getattr(
                    dicom_data, "PhotometricInterpretation", None
                ),
                transfer_syntax=(
                    str(dicom_data.file_meta.TransferSyntaxUID)
                    if hasattr(dicom_data, "file_meta")
                    and hasattr(dicom_data.file_meta, "TransferSyntaxUID")
                    else None
                ),
            )

            return temp_image_path, image_info

        except Exception as e:
            logger.error(f"Failed to convert DICOM to image: {str(e)}")
            raise HTTPException(
                status_code=400,
                detail=f"Failed to convert DICOM file to image: {str(e)}",
            )

    async def detect_dental_conditions_from_png(
        self, png_file_path: str, model_id: str = "p_fase_1_v2/4"
    ) -> Tuple[dict, DicomMetadata, ImageInfo]:
        """Normalize a PNG to RGB and run inference without DICOM metadata."""
        converted_image_path = None
        try:
            with Image.open(png_file_path) as source_image:
                source_image.load()
                source_image = ImageOps.exif_transpose(source_image)
                source_pixels = np.asarray(source_image)

                if source_pixels.ndim == 2 and source_pixels.dtype != np.uint8:
                    pixel_min = float(source_pixels.min())
                    pixel_max = float(source_pixels.max())
                    if pixel_max > pixel_min:
                        normalized_pixels = (
                            (source_pixels.astype(np.float32) - pixel_min)
                            / (pixel_max - pixel_min)
                            * 255
                        ).astype(np.uint8)
                    else:
                        normalized_pixels = np.full(
                            source_pixels.shape, 128, dtype=np.uint8
                        )
                    image = Image.fromarray(normalized_pixels).convert("RGB")
                else:
                    image = source_image.convert("RGB")

                temp_image_fd, converted_image_path = tempfile.mkstemp(suffix=".png")
                os.close(temp_image_fd)
                image.save(converted_image_path, "PNG")

            image_info = ImageInfo(
                original_shape=list(source_pixels.shape),
                converted_format="PNG",
                converted_size=list(image.size),
                original_dtype=str(source_pixels.dtype),
                pixel_array_min=float(source_pixels.min()),
                pixel_array_max=float(source_pixels.max()),
            )
            inference_results = await self.detect_dental_conditions(
                converted_image_path, model_id
            )
            return inference_results, DicomMetadata(), image_info
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to process PNG image: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=400, detail="Failed to read or process PNG image"
            )
        finally:
            if converted_image_path and os.path.exists(converted_image_path):
                try:
                    os.unlink(converted_image_path)
                except OSError as e:
                    logger.warning(
                        f"Failed to delete converted PNG file {converted_image_path}: {e}"
                    )

    async def detect_dental_conditions_from_dicom(
        self, dicom_file_path: str, model_id: str = "p_fase_1_v2/4"
    ) -> Tuple[dict, DicomMetadata, ImageInfo]:
        """
        Process DICOM file: extract metadata, convert to image, and run inference

        Args:
            dicom_file_path: Path to the DICOM file
            model_id: Model ID to use for inference

        Returns:
            Tuple of (inference_results, metadata, image_info)

        Raises:
            HTTPException: If processing fails
        """
        converted_image_path = None
        try:
            # Parse DICOM metadata
            metadata = self.parse_dicom_metadata(dicom_file_path)

            # Convert DICOM to image
            converted_image_path, image_info = self.convert_dicom_to_image(
                dicom_file_path
            )

            # Run inference on converted image
            inference_results = await self.detect_dental_conditions(
                converted_image_path, model_id
            )

            return inference_results, metadata, image_info

        finally:
            # Clean up converted image file
            if converted_image_path and os.path.exists(converted_image_path):
                try:
                    os.unlink(converted_image_path)
                except OSError as e:
                    logger.warning(
                        f"Failed to delete converted image file {converted_image_path}: {e}"
                    )


# Dependency function to get inference service
def get_inference_service() -> InferenceService:
    return InferenceService()
