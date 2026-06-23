#!/usr/bin/env python3
"""Print accumulated elapsed times for entries in city-load-history.txt."""

from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path
from typing import NamedTuple


class HistoryEntry(NamedTuple):
    timestamp: datetime
    title: str


def parse_entry(line: str) -> HistoryEntry | None:
    parts = line.split("\t")
    if len(parts) < 3:
        return None

    timestamp = parts[0].strip()
    if not timestamp:
        return None
    try:
        parsed_timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    except ValueError:
        return None

    return HistoryEntry(parsed_timestamp, parts[1].strip())


def format_elapsed(total_seconds: int) -> str:
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    if hours:
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    return f"{minutes:02d}:{seconds:02d}"


def read_entries(path: Path) -> list[HistoryEntry]:
    text = path.read_text(encoding="utf-8", errors="replace").replace("\0", "")
    entries = []
    for line in text.splitlines():
        entry = parse_entry(line)
        if entry is not None:
            entries.append(entry)
    return entries


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Report elapsed times from the first city history entry."
    )
    parser.add_argument(
        "history_file",
        nargs="?",
        default="city-load-history.txt",
        help="Path to the city play history file.",
    )
    args = parser.parse_args()

    entries = read_entries(Path(args.history_file))
    if not entries:
        raise SystemExit("No timestamped city history entries found.")

    first_timestamp = entries[0].timestamp
    for entry in entries:
        elapsed = entry.timestamp - first_timestamp
        print(f"{format_elapsed(round(elapsed.total_seconds()))} {entry.title}")


if __name__ == "__main__":
    main()
