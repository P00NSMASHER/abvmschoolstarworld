import datetime as dt
from email.message import EmailMessage
import json
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

    def test_date_can_be_on_a_line_before_the_fixed_event_label(self):
        events = module.events_from_text(
            "Monday, October 5\nNo School\nTuesday, October 6\nMass\n",
            dt.date(2026, 10, 5),
        )
        self.assertEqual([(x["date"], x["label"]) for x in events],
                         [("Monday, Oct. 5", "No School"), ("Tuesday, Oct. 6", "Mass")])

    def test_three_observed_calendar_formats(self):
        fixtures = json.loads((Path(__file__).parent / "fixtures/yahoo-calendar-cells.json").read_text())
        for sample in fixtures:
            week = dt.date.fromisoformat(sample["week"])
            events = [event for block in sample["cells"] for event in module.events_from_text(block, week, required=False)]
            pairs = {(event["date"], event["label"]) for event in events}
            for expected in sample["expected"]:
                self.assertIn(tuple(expected), pairs, sample["week"])
            self.assertNotIn(("Tuesday, Oct. 6", "Mass"), pairs)
            self.assertNotIn(("Friday, Oct. 9", "Progress Reports"), pairs)

    def test_gym_body_change_does_not_move_picture_day(self):
        message = EmailMessage()
        message["Subject"] = "Change of date for Gym Classes"
        message.set_content("Due to picture day next Thursday, gym classes will be held on Monday, September\n28th.")
        self.assertEqual(module.body_events(message, dt.date(2026, 9, 25)),
                         [{"date": "Monday, Sep. 28", "label": "Gym classes moved to this date", "kind": "schedule change"}])

    def test_gym_html_only_email(self):
        message = EmailMessage()
        message["Subject"] = "Change of date for Gym Classes"
        message.set_content("<p>Due to&nbsp;picture&nbsp;day&nbsp;next Thursday, gym classes will be held on Monday, September 28th.</p>", subtype="html")
        self.assertEqual(module.body_events(message, dt.date(2026, 9, 25)),
                         [{"date": "Monday, Sep. 28", "label": "Gym classes moved to this date", "kind": "schedule change"}])

    def test_plain_and_html_document_links_are_deduplicated(self):
        message = EmailMessage()
        label = "Weekly Reminders for Week of 10.05.26.pdf"
        url = "https://track.spe.schoolmessenger.com/f/a/test"
        message.set_content(f"{label}\n[{url}]\nGift Card Winners.pdf\n[{url}/other]")
        message.add_alternative(f'<a href="{url}">{label}</a>', subtype="html")
        self.assertEqual(module.pdf_links(message), [(dt.date(2026, 10, 5), url)])

    def test_invalid_date_cannot_inherit_previous_day(self):
        events = module.events_from_text("Monday 10/5: No School\nTuesday 10/99: Mass", dt.date(2026, 10, 5))
        self.assertEqual([event["label"] for event in events], ["No School"])

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
