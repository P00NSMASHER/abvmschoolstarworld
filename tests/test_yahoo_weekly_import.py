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

    def test_touching_friday_and_reminder_cards_are_isolated_without_cutting_words(self):
        # Geometry observed in the Oct 19 planner; no private PDF or mail URL.
        region=(880,1029,1958,1669)
        anchors=[(588.5,392),(1132.5,401),(1672.5,402),(591.5,992),(1130,994)]
        words=[(1260,1250,1345,1280),(1388,1080,1445,1110)]
        pieces=module.isolated_calendar_regions([region],anchors,words,2200)
        self.assertEqual(len(pieces),2)
        left,right=pieces
        self.assertEqual((left[0],right[2]),(region[0],region[2]))
        self.assertEqual(left[2],right[0])
        self.assertGreater(left[2],1345)
        self.assertLess(left[2],1388)
        self.assertEqual(module.isolated_calendar_regions([(884,576,1376,928)],anchors,words,2200),[(884,576,1376,928)])

    def test_merged_card_without_a_safe_word_seam_fails_closed(self):
        anchors=[(588.5,392),(1132.5,401),(1672.5,402),(591.5,992),(1130,994)]
        with self.assertRaisesRegex(ValueError,'isolate'):
            module.isolated_calendar_regions([(880,1029,1958,1669)],anchors,[(1280,1200,1530,1240)],2200)

    def test_an_upper_grade_closure_is_not_published_as_grade_two_no_school(self):
        events=module.events_from_text('Monday 10/19/2026: No School for students in 5th-8th grade\nTuesday 10/20/2026: No School for students in grades K-4',dt.date(2026,10,19))
        self.assertEqual([(row['date'],row['label']) for row in events],[('Tuesday, Oct. 20','No School')])

    def test_reminder_date_prefix_and_printed_football_scope_stay_explicit(self):
        rows=module.events_from_text('s 10/26 DDD Flag football K-4\n10/29 DDD Flag football for 5-8',dt.date(2026,10,19))
        pairs={(row['date'],row['label']) for row in rows}
        self.assertIn(('Monday, Oct. 26','K–4 Flag football'),pairs)
        self.assertIn(('Thursday, Oct. 29','Flag football (for 5–8)'),pairs)
        self.assertIn(('Thursday, Oct. 29','Dress Down Day (Flag football for 5–8)'),pairs)
        self.assertNotIn(('Thursday, Oct. 29','Flag football'),pairs)
        self.assertNotIn(('Thursday, Oct. 29','Dress Down Day'),pairs)

    def test_unscoped_no_school_and_football_hours_are_not_inferred_grade_ranges(self):
        for hours in ['5-8 pm','5-8 p.m.','5-8 AM','5-8 a.m.']:
            rows=module.events_from_text('Monday 10/19/2026: No School\nTuesday 10/20/2026: Flag football '+hours,dt.date(2026,10,19))
            self.assertIn({'date':'Monday, Oct. 19','label':'No School','kind':'holiday'},rows)
            self.assertIn({'date':'Tuesday, Oct. 20','label':'Flag football','kind':'school event'},rows)
            self.assertFalse(any('for 5' in row['label'] for row in rows))

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
