#!/usr/bin/env python3
"""Import narrowly recognized events from Melissa's weekly reminder PDFs.

Only fixed, public school-event labels leave this process. Unexpected PDF layouts,
changed documents, and unrecognized messages fail closed for manual handling.
"""

import csv
import io
import base64
import datetime as dt
import email
import email.policy
from email.utils import parseaddr, parsedate_to_datetime
import hashlib
from html.parser import HTMLParser
import imaplib
import ipaddress
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import tempfile
import urllib.parse
import urllib.request


SENDER = "mthompson@assumptionbvmschool.net"
TRACK_HOST = "track.spe.schoolmessenger.com"
DATA = Path(__file__).resolve().parents[1] / "pages/data/uploaded-notices.json"
PDF_DOWNLOADER = Path(__file__).with_name("download-schoolmessenger-pdf.mjs")
PDF_NAME = re.compile(r"^weekly reminders for week of (\d{1,2})[.]?(\d{1,2})[.](\d{2,4})[.]pdf$", re.I)
DATE_LINE = re.compile(
    r"^\s*(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b[, :\-]*"
    r"(?:(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s*)?"
    r"(\d{1,2})(?:/(\d{1,2}))?\b\s*[:.\-–]?\s*(.*)$", re.I
)
EVENTS = (
    (re.compile(r"\bgym classes moved\b", re.I), "Gym classes moved to this date", "schedule change"),
    (re.compile(r"\bno school\b", re.I), "No School", "holiday"),
    (re.compile(r"\b(?:12(?::00)?|noon)\s+dismissal\b", re.I), "12:00 dismissal", "schedule change"),
    (re.compile(r"\bmass\b", re.I), "Mass", "school event"),
    (re.compile(r"\bcommunication\s+folders?\b", re.I), "Communication Folder", "school event"),
    (re.compile(r"\bpicture day\b", re.I), "Picture Day", "school event"),
    (re.compile(r"\b(?:dress[- ]down day|DDD)\b", re.I), "Dress Down Day", "school event"),
    (re.compile(r"\bprogress reports?\b", re.I), "Progress Reports", "school event"),
    (re.compile(r"\blego club\b", re.I), "Lego Club", "club"),
    (re.compile(r"\bflag football\b", re.I), "Flag football", "school event"),
    (re.compile(r"\bparent[- ]teacher conferences?\b", re.I), "Parent-Teacher Conferences", "conference"),
    (re.compile(r"\bpretzel[\s;|]+delivery\b", re.I), "Pretzel delivery", "school event"),
    (re.compile(r"\bSTAR testing\b", re.I), "STAR testing", "assessment"),
    (re.compile(r"\bChick[- ]fil[- ]A\b", re.I), "Chick-fil-A", "school event"),
)


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.href = None
        self.label = []
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.href = dict(attrs).get("href")
            self.label = []

    def handle_data(self, data):
        if self.href:
            self.label.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self.href:
            self.links.append(("".join(self.label).strip(), self.href))
            self.href = None


def week_from_name(name):
    match = PDF_NAME.fullmatch(name.strip())
    if not match:
        return None
    month, day, year = map(int, match.groups())
    return dt.date(year + (2000 if year < 100 else 0), month, day)


def document_links(message):
    result = []
    for part in message.walk():
        if part.get_content_disposition() == "attachment":
            continue
        if part.get_content_type() == "text/html":
            parser = Links()
            parser.feed(part.get_content())
            result.extend(parser.links)
        elif part.get_content_type() == "text/plain":
            result.extend(re.findall(r"(?m)^([^\n]+[.]pdf)\s*\n\[(https?://[^]\s]+)\]", part.get_content(), re.I))
    return list(dict.fromkeys(result))


def pdf_links(message):
    return [(week_from_name(label), url) for label, url in document_links(message) if week_from_name(label)]


def flyer_events(pdf, received):
    with tempfile.TemporaryDirectory() as folder:
        source = Path(folder) / "flyer.pdf"
        source.write_bytes(pdf)
        env = {"PATH": os.environ.get("PATH", "")}
        subprocess.run(["pdftoppm", "-f", "1", "-singlefile", "-scale-to", "2200", "-png",
                        str(source), str(Path(folder) / "page")], check=True, capture_output=True, timeout=30, env=env)
        result = subprocess.run(["tesseract", str(Path(folder) / "page.png"), "stdout", "--psm", "3"],
                                check=True, capture_output=True, text=True, timeout=30, env=env)
    if not re.search(r"Dress Down Day", result.stdout, re.I):
        raise ValueError("Dress down flyer layout changed; manual review required")
    dates = re.findall(r"(?:Monday|Tuesday|Wednesday|Thursday|Friday),?\s+[A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?", result.stdout, re.I)
    if len(dates) != 1:
        raise ValueError("Dress down flyer date is ambiguous; manual review required")
    return events_from_text(dates[0] + ": Dress Down Day", received)


def safe_url(url, first=False):
    parsed = urllib.parse.urlparse(url)
    if first and parsed.hostname == TRACK_HOST and parsed.scheme == "http":
        parsed = parsed._replace(scheme="https")
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("PDF link is not a safe HTTPS URL")
    if first and parsed.hostname != TRACK_HOST:
        raise ValueError("PDF link is not from SchoolMessenger")
    addresses = socket.getaddrinfo(parsed.hostname, 443, type=socket.SOCK_STREAM)
    if not addresses or any(not ipaddress.ip_address(a[4][0]).is_global for a in addresses):
        raise ValueError("PDF link resolves outside public addresses")
    return urllib.parse.urlunparse(parsed)


def get_pdf(url, week, filename=None):
    filename = filename or f"Weekly Reminders for Week of {week.month:02d}.{week.day:02d}.{str(week.year)[-2:]}.pdf"
    env = {
        "PATH": os.environ.get("PATH", ""),
        "HOME": os.environ.get("HOME", ""),
        "CI": "true",
    }
    if os.environ.get("PLAYWRIGHT_BROWSERS_PATH"):
        env["PLAYWRIGHT_BROWSERS_PATH"] = os.environ["PLAYWRIGHT_BROWSERS_PATH"]
    env["SCHOOLMESSENGER_DOCUMENT_URL"] = safe_url(url, first=True)
    env["SCHOOLMESSENGER_EXPECTED_FILENAME"] = filename
    result = subprocess.run(
        ["node", str(PDF_DOWNLOADER)], capture_output=True, timeout=100, env=env
    )
    if result.returncode:
        raise ValueError("SchoolMessenger did not deliver the expected weekly reminder PDF")
    data = result.stdout
    if not data.startswith(b"%PDF-") or len(data) > 8_000_000:
        raise ValueError("Weekly reminder link did not return a bounded PDF")
    return data


def ocr_blocks(pdf):
    """Read detected calendar cells separately; never join adjacent day cells."""
    from PIL import Image
    import numpy as np
    from scipy import ndimage

    with tempfile.TemporaryDirectory() as folder:
        source = Path(folder) / "notice.pdf"
        source.write_bytes(pdf)
        env = {"PATH": os.environ.get("PATH", "")}
        subprocess.run(["pdftoppm", "-f", "1", "-singlefile", "-scale-to", "2200", "-png",
                        str(source), str(Path(folder) / "page")], check=True, capture_output=True,
                       timeout=30, env=env)
        image_path = Path(folder) / "page.png"
        image = Image.open(image_path)
        # Rounded calendar cells form separate light connected regions. This also
        # handles the four-column bottom row in the September reminder template.
        labels, _ = ndimage.label(np.asarray(image.convert("L")) > 180)
        regions = []
        for region in ndimage.find_objects(labels):
            if region is None:
                continue
            vertical, horizontal = region
            width, height = horizontal.stop - horizontal.start, vertical.stop - vertical.start
            if image.width * .12 < width < image.width * .55 and image.height * .035 < height < image.height * .65:
                regions.append((horizontal.start, vertical.start, horizontal.stop, vertical.stop))
        anchors = []
        result = subprocess.run(["tesseract", str(image_path), "stdout", "--psm", "6", "tsv"],
                                check=True, capture_output=True, text=True, timeout=30, env=env)
        for row in csv.DictReader(io.StringIO(result.stdout), delimiter="\t"):
            if row["text"].lower() in ("monday", "tuesday", "wednesday", "thursday", "friday") and float(row["conf"]) >= 60:
                anchors.append((int(row["left"]) + int(row["width"]) / 2, int(row["top"])))
        if not 5 <= len(regions) <= 15:
            raise ValueError("Unrecognized calendar cells; manual review required")
        blocks = []
        for index, (left, top, right, bottom) in enumerate(regions):
            nearby = [y for x, y in anchors if left <= x <= right and 0 < top - y < image.height * .2]
            # Templates with a separate date heading and event card need both.
            if nearby:
                top = max(0, max(nearby) - 10)
            crop = Path(folder) / f"cell-{index}.png"
            image.crop((left, top, right, bottom)).save(crop)
            result = subprocess.run(["tesseract", str(crop), "stdout", "--psm", "6"], check=True,
                                    capture_output=True, text=True, timeout=30, env=env)
            blocks.append(result.stdout)
        return blocks


def extract_events(pdf, week):
    events = []
    for block in ocr_blocks(pdf):
        events.extend(events_from_text(block, week, required=False))
    unique = {(item["date"], item["label"]): item for item in events}
    if not unique:
        raise ValueError("No recognized dated school events in a new weekly PDF; manual review required")
    return list(unique.values())


def events_from_text(text, week, required=True):
    # Ignore decorative OCR prefixes around validated weekday headings.
    text = re.sub(r"(?im)^.*?\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b", r"\1", text)
    text = re.sub(r"(?m)(\d{1,2}/\d)!", r"\g<1>1", text)
    text = re.sub(r"(?im)^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s*\n\s*[: ]*(?=\d)", r"\1 ", text)
    text = re.sub(r"(?i)(\d)(?:st|nd|rd|th)\b", r"\1", text)
    lines = [" ".join(raw.split()).lstrip("|: ") for raw in text.splitlines()]
    starts = []
    numeric = re.compile(r"^(?:(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s*[, :]?\s*)?(\d{1,2})/(\d{1,2})(?:/(\d{4}))?(?:-(\d{1,2})/(\d{1,2}))?\b\s*(.*)$", re.I)
    for index, line in enumerate(lines):
        match = numeric.match(line)
        dates = []
        if match:
            weekday, month, day, year, end_month, end_day, rest = match.groups()
            year = int(year) if year else week.year + (1 if int(month) < week.month - 6 else -1 if int(month) > week.month + 6 else 0)
            try:
                start = dt.date(year, int(month), int(day))
                end = dt.date(year, int(end_month), int(end_day)) if end_month else start
                if 0 <= (end - start).days <= 7:
                    dates = [start + dt.timedelta(days=offset) for offset in range((end - start).days + 1)]
            except ValueError:
                pass
        else:
            match = DATE_LINE.match(line)
            if not match:
                continue
            weekday, month, day, slash_month, rest = match.groups()
            month_number = dt.datetime.strptime(month[:3], "%b").month if month else week.month
            year = week.year + (1 if month_number < week.month - 6 else -1 if month_number > week.month + 6 else 0)
            try:
                dates = [dt.date(year, month_number, int(day))]
            except ValueError:
                pass
        # Even an invalid date terminates the preceding event block.
        dates = [date for date in dates if abs((date - week).days) <= 90 and
                 (not weekday or date.strftime("%A").lower() == weekday.lower())]
        starts.append((index, dates, rest))
    found = []
    for offset, (index, dates, rest) in enumerate(starts):
        stop = starts[offset + 1][0] if offset + 1 < len(starts) else len(lines)
        context = " ".join([rest] + lines[index + 1:stop])
        for date in dates:
            for pattern, label, kind in EVENTS:
                if pattern.search(context):
                    found.append({"date": f"{date.strftime('%A')}, {date.strftime('%b')}. {date.day}", "label": label, "kind": kind})
    unique = {(item["date"], item["label"]): item for item in found}
    if required and not unique:
        raise ValueError("No recognized dated school events in a new weekly PDF; manual review required")
    return list(unique.values())


def body_events(message, received):
    """Recognize an explicit gym change without assigning the nearby relative picture date."""
    if "gym" not in str(message.get("Subject", "")).lower():
        return []
    for part in message.walk():
        if part.get_content_type() != "text/plain" or part.get_content_disposition() == "attachment":
            continue
        text = " ".join(part.get_content().split()).split("SchoolMessenger ABVM would like")[0]
        match = re.search(r"gym classes will be held on ((?:Monday|Tuesday|Wednesday|Thursday|Friday),? [A-Za-z]+ \d{1,2}(?:st|nd|rd|th)?)", text, re.I)
        if match:
            items = events_from_text(match[1] + ": Gym classes moved", received)
            return [{**item, "label": "Gym classes moved to this date", "kind": "schedule change"} for item in items]
    return []


def access_token():
    required = ("YAHOO_OAUTH_CLIENT_ID", "YAHOO_OAUTH_CLIENT_SECRET", "YAHOO_OAUTH_REFRESH_TOKEN", "YAHOO_OAUTH_REDIRECT_URI")
    missing = [name for name in required if not os.environ.get(name)]
    if missing:
        raise ValueError("Missing GitHub Actions secrets: " + ", ".join(missing))
    credentials = f"{os.environ['YAHOO_OAUTH_CLIENT_ID']}:{os.environ['YAHOO_OAUTH_CLIENT_SECRET']}"
    body = {"grant_type": "refresh_token", "refresh_token": os.environ["YAHOO_OAUTH_REFRESH_TOKEN"]}
    body["redirect_uri"] = os.environ["YAHOO_OAUTH_REDIRECT_URI"]
    request = urllib.request.Request(
        "https://api.login.yahoo.com/oauth2/get_token",
        data=urllib.parse.urlencode(body).encode(),
        headers={"Authorization": "Basic " + base64.b64encode(credentials.encode()).decode(), "Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        payload = json.load(response)
    if payload.get("refresh_token") and payload["refresh_token"] != os.environ["YAHOO_OAUTH_REFRESH_TOKEN"]:
        raise RuntimeError("Yahoo rotated the refresh token; update the GitHub secret before another scheduled run")
    return payload["access_token"]


def messages():
    account = os.environ["YAHOO_MAIL_ACCOUNT"]
    since = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=45)).strftime("%d-%b-%Y")
    with imaplib.IMAP4_SSL("imap.mail.yahoo.com", 993) as inbox:
        if os.environ.get("YAHOO_APP_PASSWORD"):
            inbox.login(account, os.environ["YAHOO_APP_PASSWORD"])
        else:
            token = access_token()
            bearer = f"n,a={account},\x01host=imap.mail.yahoo.com\x01port=993\x01auth=Bearer {token}\x01\x01"
            inbox.authenticate("OAUTHBEARER", lambda _: bearer.encode())
        inbox.select("INBOX", readonly=True)
        status, uids = inbox.uid("SEARCH", None, "FROM", f'"{SENDER}"', "SINCE", since)
        if status != "OK":
            raise RuntimeError("Yahoo IMAP search failed")
        for uid in uids[0].split()[-150:]:
            status, parts = inbox.uid("FETCH", uid, "(BODY.PEEK[])")
            if status == "OK":
                for part in parts:
                    if isinstance(part, tuple):
                        yield email.message_from_bytes(part[1], policy=email.policy.default)


def main():
    if not os.environ.get("YAHOO_MAIL_ACCOUNT"):
        raise ValueError("Missing YAHOO_MAIL_ACCOUNT secret")
    uploaded = json.loads(DATA.read_text())
    known = {doc["id"]: doc for doc in uploaded["documents"]}
    added = 0
    for message in messages():
        if parseaddr(message.get("From", ""))[1].lower() != SENDER :
            continue
        received_date = parsedate_to_datetime(message["Date"]).date()
        received = received_date.isoformat()
        sources = []
        gym = body_events(message, received_date)
        if gym:
            sources.append(("school-email-" + hashlib.sha256(message.as_bytes()).hexdigest()[:20],
                            "Gym schedule update", gym, message.as_bytes()))
        for label, link in document_links(message):
            if label not in ("CO-ED CYO Basketball Flyer.pdf", "Joyful Dress Down Day Flyer for Kids.pdf"):
                continue
            doc_id = "school-flyer-" + hashlib.sha256(label.encode() + received.encode()).hexdigest()[:20]
            if doc_id in known:
                continue
            pdf = get_pdf(link, received_date, filename=label)
            events = flyer_events(pdf, received_date) if label.startswith("Joyful") else []
            title = "Dress Down Day flyer" if events else "CYO Basketball flyer"
            sources.append((doc_id, title, events, pdf))
        for part in message.iter_attachments():
            week = week_from_name(part.get_filename() or "")
            if not week or f"weekly-reminders-{week.isoformat()}" in known:
                continue
            pdf = part.get_payload(decode=True)
            if not pdf or len(pdf) > 8_000_000 or not pdf.startswith(b"%PDF-"):
                raise ValueError("Invalid weekly reminder attachment")
            sources.append((f"weekly-reminders-{week.isoformat()}",
                            f"Weekly reminders for week of {week.isoformat()}", extract_events(pdf, week), pdf))
        for week, link in pdf_links(message):
            doc_id = f"weekly-reminders-{week.isoformat()}"
            if doc_id in known:
                continue
            try:
                pdf = get_pdf(link, week)
                events = extract_events(pdf, week)
            except ValueError:
                print("::warning::A weekly reminder could not be safely extracted; manual review required.")
                continue
            sources.append((doc_id, f"Weekly reminders for week of {week.isoformat()}", events, pdf))
        for doc_id, title, events, source_bytes in sources:
            if doc_id in known:
                continue
            facts = [f"{item['date']}: {item['label']}." for item in events]
            if not facts and title == "CYO Basketball flyer":
                facts = ["CYO Basketball flyer received."]
            stamp = dt.datetime.now(dt.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
            doc = {"id": doc_id, "label": title, "receivedAt": received,
                   "facts": facts, "provenance": {"factsHash": hashlib.sha256(json.dumps(facts, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest(),
                   "sourceContentHash": hashlib.sha256(source_bytes).hexdigest()},
                   "review": {"status": "reviewed", "piiReviewed": True, "reviewedBy": "automated-fixed-event-extraction-v1", "reviewedAt": stamp}}
            uploaded["documents"].append(doc)
            for item in events:
                uploaded["importantDates"].append({**item, "sourceDocument": doc_id})
            known[doc_id] = doc
            uploaded["lastIntegratedAt"] = stamp
            added += 1
    if added:
        DATA.write_text(json.dumps(uploaded, ensure_ascii=False, indent=2) + "\n")
    print(f"Imported {added} new school notices")


if __name__ == "__main__":
    main()
