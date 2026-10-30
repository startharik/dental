import asyncio
import unittest

from app.models.detection import Detection
from app.services.diagnostic_service import DiagnosticReportService


class DiagnosticReportServiceTests(unittest.TestCase):
    def test_returns_short_actions_for_each_detection(self) -> None:
        detections = [
            Detection.model_validate(
                {
                    "x": 20,
                    "y": 30,
                    "width": 10,
                    "height": 12,
                    "confidence": 0.81,
                    "class": class_name,
                    "class_id": index,
                    "detection_id": f"finding-{index}",
                }
            )
            for index, class_name in enumerate(
                ["impaction", "restoration", "Root Canal"]
            )
        ]

        report = asyncio.run(
            DiagnosticReportService().generate_diagnostic_report(detections)
        )

        self.assertEqual(len(report.suggested_assessments), 3)
        actions = [
            assessment.suggestion
            for assessment in report.suggested_assessments
        ]
        self.assertIn("eruption status", actions[0])
        self.assertIn("restoration", actions[1])
        self.assertIn("canal filling", actions[2])
        self.assertTrue(all(len(action) < 150 for action in actions))
        self.assertTrue(
            all(
                "model label alone" not in action
                and "surgical risk" not in action
                for action in actions
            )
        )
