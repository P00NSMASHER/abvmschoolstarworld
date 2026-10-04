import datetime as dt
import importlib.util
from pathlib import Path
import unittest


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


if __name__ == "__main__":
    unittest.main()
