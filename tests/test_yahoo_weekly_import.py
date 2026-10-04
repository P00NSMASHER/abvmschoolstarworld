import datetime as dt
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "scripts/import-yahoo-weekly-reminders.py"
spec = importlib.util.spec_from_file_location("yahoo_weekly_import", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class YahooWeeklyImportTests(unittest.TestCase):
    def test_only_matching_weekly_pdf_name_is_accepted(self):
        self.assertEqual(module.week_from_name("Weekly Reminders for Week of 10.05.26.pdf"), dt.date(2026, 10, 5))
        self.assertIsNone(module.week_from_name("Gift Card Winners.pdf"))

    def test_only_fixed_event_labels_leave_pdf(self):
        events = module.events_from_text(
            "Wednesday, October 7: Mass with a named guest\n"
            "Friday 10/9: 12:00 dismissal\n"
            "Friday 10/9: Personal birthday party for a student\n",
            dt.date(2026, 10, 5),
        )
        self.assertEqual([(x["label"], x["kind"]) for x in events],
                         [("Mass", "school event"), ("12:00 dismissal", "schedule change")])
        self.assertNotIn("named guest", str(events))
        self.assertNotIn("birthday", str(events))

    def test_unrecognized_pdf_fails_closed(self):
        with self.assertRaisesRegex(ValueError, "manual review required"):
            module.events_from_text("Monday, October 5: Private classroom note", dt.date(2026, 10, 5))

    def test_pdf_download_uses_bounded_schoolmessenger_browser_handoff(self):
        week = dt.date(2026, 10, 5)
        result = type("Result", (), {"returncode": 0, "stdout": b"%PDF-test"})()
        with patch.object(module.socket, "getaddrinfo", return_value=[(None, None, None, None, ("93.184.216.34", 443))]), \
             patch.object(module.subprocess, "run", return_value=result) as run:
            self.assertEqual(module.get_pdf("http://track.spe.schoolmessenger.com/f/a/test", week), b"%PDF-test")
        command, = run.call_args.args
        self.assertEqual(command[0], "node")
        self.assertEqual(Path(command[1]), module.PDF_DOWNLOADER)
        env = run.call_args.kwargs["env"]
        self.assertEqual(env["SCHOOLMESSENGER_DOCUMENT_URL"], "https://track.spe.schoolmessenger.com/f/a/test")
        self.assertEqual(env["SCHOOLMESSENGER_EXPECTED_FILENAME"], "Weekly Reminders for Week of 10.05.26.pdf")

    def test_pdf_download_rejects_unbounded_or_non_pdf_bytes(self):
        for payload in (b"HTML", b"%PDF-" + b"x" * 8_000_000):
            result = type("Result", (), {"returncode": 0, "stdout": payload})()
            with self.subTest(length=len(payload)), \
                 patch.object(module.socket, "getaddrinfo", return_value=[(None, None, None, None, ("93.184.216.34", 443))]), \
                 patch.object(module.subprocess, "run", return_value=result):
                with self.assertRaisesRegex(ValueError, "bounded PDF"):
                    module.get_pdf("https://track.spe.schoolmessenger.com/f/a/test", dt.date(2026, 10, 5))


if __name__ == "__main__":
    unittest.main()
