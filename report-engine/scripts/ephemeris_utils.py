"""Fail-closed Swiss Ephemeris configuration for Cosmic report rendering."""

from __future__ import annotations

import os
from pathlib import Path

import swisseph as swe


REQUIRED_EPHEMERIS_FILES = ("sepl_18.se1", "semo_18.se1")


def configure_ephemeris() -> str:
    default_path = Path(__file__).resolve().parents[2] / "public" / "ephe"
    ephemeris_path = Path(
        os.environ.get("SWE_EPHE_PATH") or default_path
    ).expanduser().resolve()

    if not ephemeris_path.is_dir():
        raise RuntimeError("Configured Swiss Ephemeris directory does not exist")

    for filename in REQUIRED_EPHEMERIS_FILES:
        file_path = ephemeris_path / filename
        if not file_path.is_file() or file_path.stat().st_size < 1024:
            raise RuntimeError(f"Required Swiss Ephemeris file is missing: {filename}")
        with file_path.open("rb") as handle:
            prefix = handle.read(64).lstrip().lower()
        if prefix.startswith((b"<!doctype html", b"<html")):
            raise RuntimeError(f"Invalid HTML file found in ephemeris path: {filename}")

    swe.set_ephe_path(str(ephemeris_path))
    return str(ephemeris_path)


def calc_ut_checked(julian_day: float, body: int, flags: int = swe.FLG_SWIEPH):
    result, return_flags = swe.calc_ut(julian_day, body, flags)
    if not return_flags & swe.FLG_SWIEPH:
        raise RuntimeError(
            "Swiss Ephemeris data were unavailable; refusing silent fallback"
        )
    return result, return_flags
