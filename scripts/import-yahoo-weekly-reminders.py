#!/usr/bin/env python3
"""Import narrowly recognized events from Melissa's weekly reminder PDFs.

Only fixed, public school-event labels leave this process. Unexpected PDF layouts,
changed documents, and unrecognized messages fail closed for manual handling.
"""

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
PDF_NAME = re.compile(r"^weekly reminders for week of (\d{1,2})[.]?(\d{1,2})[.](\d{2,4})[.]pdf$", re.I)
DATE_LINE = re.compile(
    r"^\s*(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b[, :\-]*"
    r"(?:(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s*)?"
    r"(\d{1,2})(?:/(\d{1,2}))?\b\s*[:.\-–]?\s*(.*)$", re.I
)
EVENTS = (
    (re.compile(r"\bno school\b", re.I), "No School", "holiday"),
    (re.compile(r"\b(?:12:00|noon)\s+dismissal\b", re.I), "12:00 dismissal", "schedule change"),
    (re.compile(r"\bmass\b", re.I), "Mass", "school event"),
    (re.compile(r"\bcommunication folders?\b", re.I), "Communication Folder", "school event"),
    (re.compile(r"\bpicture day\b", re.I), "Picture Day", "school event"),
    (re.compile(r"\bdress[- ]down day\b", re.I), "Dress Down Day", "school event"),
    (re.compile(r"\bprogress reports?\b", re.I), "Progress Reports", "school event"),
    (re.compile(r"\blego club\b", re.I), "Lego Club", "club"),
    (re.compile(r"\bflag football\b", re.I), "Flag football", "school event"),
    (re.compile(r"\bparent[- ]teacher conferences?\b", re.I), "Parent-Teacher Conferences", "conference"),
    (re.compile(r"\bpretzel delivery\b", re.I), "Pretzel delivery", "school event"),
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


def pdf_links(message):
    result = []
    for part in message.walk():
        if part.get_content_type() != "text/html":
            continue
        parser = Links()
        parser.feed(part.get_content())
        result.extend((week_from_name(label), url) for label, url in parser.links if week_from_name(label))
    return result


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


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return super().redirect_request(request, fp, code, msg, headers, safe_url(newurl))


def get_pdf(url):
    opener = urllib.request.build_opener(SafeRedirect())
    with opener.open(safe_url(url, first=True), timeout=20) as response:
        if response.url.startswith("http:"):
            raise ValueError("PDF download downgraded to HTTP")
        data = response.read(8_000_001)
    if not data.startswith(b"%PDF-") or len(data) > 8_000_000:
        raise ValueError("Weekly reminder link did not return a bounded PDF")
    return data


def extract_events(pdf, week):
    with tempfile.TemporaryDirectory() as folder:
        source = Path(folder) / "notice.pdf"
        source.write_bytes(pdf)
        result = subprocess.run(["pdftotext", "-layout", str(source), "-"], capture_output=True, text=True, check=True, timeout=15)
    return events_from_text(result.stdout, week)


def events_from_text(text, week):
    found = []
    for raw in text.splitlines():
        line = " ".join(raw.split())
        match = DATE_LINE.match(line)
        if not match:
            continue
        weekday, month, day, slash_month, rest = match.groups()
        month_number = dt.datetime.strptime(month[:3], "%b").month if month else (int(day) if slash_month else week.month)
        day_number = int(slash_month) if slash_month else int(day)
        year = week.year + (1 if month_number < week.month - 6 else -1 if month_number > week.month + 6 else 0)
        try:
            event_date = dt.date(year, month_number, day_number)
        except ValueError:
            continue
        if abs((event_date - week).days) > 90 or event_date.strftime("%A").lower() != weekday.lower():
            continue
        for pattern, label, kind in EVENTS:
            if pattern.search(rest):
                found.append({"date": f"{weekday.title()}, {event_date.strftime('%b')}. {event_date.day}", "label": label, "kind": kind})
    unique = {(item["date"], item["label"]): item for item in found}
    if not unique:
        raise ValueError("No recognized dated school events in a new weekly PDF; manual review required")
    return list(unique.values())


def access_token():
    required = ("YAHOO_MAIL_ACCOUNT", "YAHOO_OAUTH_CLIENT_ID", "YAHOO_OAUTH_CLIENT_SECRET", "YAHOO_OAUTH_REFRESH_TOKEN")
    missing = [name for name in required if not os.environ.get(name)]
    if missing:
        raise ValueError("Missing GitHub Actions secrets: " + ", ".join(missing))
    credentials = f"{os.environ['YAHOO_OAUTH_CLIENT_ID']}:{os.environ['YAHOO_OAUTH_CLIENT_SECRET']}"
    request = urllib.request.Request(
        "https://api.login.yahoo.com/oauth2/get_token",
        data=urllib.parse.urlencode({"grant_type": "refresh_token", "refresh_token": os.environ["YAHOO_OAUTH_REFRESH_TOKEN"]}).encode(),
        headers={"Authorization": "Basic " + base64.b64encode(credentials.encode()).decode(), "Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)["access_token"]


def messages(token):
    account = os.environ["YAHOO_MAIL_ACCOUNT"]
    since = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=45)).strftime("%d-%b-%Y")
    with imaplib.IMAP4_SSL("imap.mail.yahoo.com", 993) as inbox:
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
    uploaded = json.loads(DATA.read_text())
    known = {doc["id"]: doc for doc in uploaded["documents"]}
    added = 0
    for message in messages(access_token()):
        if parseaddr(message.get("From", ""))[1].lower() != SENDER or "weekly reminders" not in str(message.get("Subject", "")).lower():
            continue
        received = parsedate_to_datetime(message["Date"]).date().isoformat()
        for week, link in pdf_links(message):
            doc_id = f"weekly-reminders-{week.isoformat()}"
            if doc_id in known:
                continue
            pdf = get_pdf(link)
            events = extract_events(pdf, week)
            facts = [f"{item['date']}: {item['label']}." for item in events]
            stamp = dt.datetime.now(dt.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
            doc = {"id": doc_id, "label": f"Weekly reminders for week of {week.isoformat()}", "receivedAt": received,
                   "facts": facts, "provenance": {"factsHash": hashlib.sha256(json.dumps(facts, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest(),
                   "sourceContentHash": hashlib.sha256(pdf).hexdigest()},
                   "review": {"status": "reviewed", "piiReviewed": True, "reviewedBy": "automated-fixed-event-extraction-v1", "reviewedAt": stamp}}
            uploaded["documents"].append(doc)
            for item in events:
                uploaded["importantDates"].append({**item, "sourceDocument": doc_id})
            known[doc_id] = doc
            uploaded["lastIntegratedAt"] = stamp
            added += 1
    if added:
        DATA.write_text(json.dumps(uploaded, ensure_ascii=False, indent=2) + "\n")
    print(f"Imported {added} new weekly reminder PDFs")


if __name__ == "__main__":
    main()
