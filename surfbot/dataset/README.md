# Surfbot dataset

Purpose: keep an auditable history of (a) raw inputs, (b) extracted structured data, and (c) the final daily briefing we sent.

This enables:
- QA: compare extracted buoy values vs the source charts
- Debugging: reproduce failures
- Long-term analysis: surf conditions vs wind/swell

## Layout

- `dataset/buoy/YYYY-MM-DD/`
  - `DWN_POLD.GIF`
  - `DWN_WAVE.GIF`
  - `DWN_WDIR.GIF`
  - `buoy-extract.json` (the extracted values + notes)

- `dataset/briefs/YYYY-MM-DD/`
  - `swellnet-eyewitness.json` (raw + any parse/meta)
  - `bom-wind.json`
  - `bom-weather.json`
  - `buoy-latest.json` (copied snapshot used for the report)
  - `report.txt` (exact text used for Telegram + TTS)
  - `send-log.json` (what we attempted to send: text/voice/images)

## Notes
- Do not store secrets.
- Prefer ISO timestamps.
- Keep JSON compact and stable.
