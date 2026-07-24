import os
import sys
import unittest
from pathlib import Path


REPORT_ENGINE_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = REPORT_ENGINE_DIR.parent
os.environ.setdefault("SWE_EPHE_PATH", str(REPO_ROOT / "public" / "ephe"))
sys.path.insert(0, str(REPORT_ENGINE_DIR / "scripts"))

import generate_snapshot_page as snapshot  # noqa: E402


class SnapshotConjunctionSequenceTests(unittest.TestCase):
    def test_1980_1981_sequence_contains_all_three_exact_passes(self):
        conjunctions = snapshot.find_sj_conjunction_sequence(2444605.39)

        self.assertEqual(len(conjunctions), 3)
        dates = [
            snapshot.swe.revjul(jd)[:3]
            for jd, _sign, _longitude, _orb in conjunctions
        ]
        self.assertEqual(
            dates,
            [
                (1980, 12, 31),
                (1981, 3, 4),
                (1981, 7, 24),
            ],
        )
        self.assertTrue(all(sign == "Libra" for _jd, sign, _lon, _orb in conjunctions))
        self.assertTrue(all(orb < 1e-6 for _jd, _sign, _lon, orb in conjunctions))

    def test_snapshot_renders_cross_year_triple_pass_in_both_languages(self):
        common = {
            "birth_date": "June 1, 1982",
            "birth_time": "12:00 PM UTC",
            "birth_location": "London, United Kingdom",
            "lat": 51.5074,
            "lon": -0.1278,
            "year": 1982,
            "month": 6,
            "day": 1,
            "hour": 12,
            "minute": 0,
            "tz_offset": 0,
            "tz_label": "UTC",
            "recipient_name": "Regression Test",
        }

        english = snapshot.build_snapshot_html(**common, lang="en")
        spanish = snapshot.build_snapshot_html(**common, lang="es")

        self.assertIn(
            "Triple pass from retrograde "
            "(Dec 31, 1980 · Mar 4, 1981 · Jul 24, 1981)",
            english,
        )
        self.assertIn(
            "Tres pasos por retrogradación "
            "(dic 31, 1980 · mar 4, 1981 · jul 24, 1981)",
            spanish,
        )


if __name__ == "__main__":
    unittest.main()
