#!/usr/bin/env node
/**
 * Fetch latest BOM observations for Witchcliffe West (95641)
 * and emit the MOST RECENT row as compact JSON.
 *
 * Uses plain fetch() because BOM can 403 browser-ish UAs.
 */

const SOURCE_URL =
  process.env.BOM_WITCHCLIFFE_URL ??
  'https://www.bom.gov.au/products/IDW60801/IDW60801.95641.shtml';

function stripTags(s) {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function parseLatestRow(tableHtml) {
  const tbodyMatch = tableHtml.match(/<tbody[\s\S]*?<\/tbody>/i);
  const tbody = tbodyMatch ? tbodyMatch[0] : tableHtml;
  const rowMatch = tbody.match(/<tr[^>]*>\s*([\s\S]*?)\s*<\/tr>/i);
  if (!rowMatch) return null;
  const rowHtml = rowMatch[1];

  const cells = [...rowHtml.matchAll(/<td[^>]*headers="([^"]+)"[^>]*>\s*([\s\S]*?)\s*<\/td>/gi)].map(
    (m) => ({ headers: m[1], value: stripTags(m[2]) })
  );

  const get = (needle) => cells.find((c) => c.headers.includes(needle))?.value;
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  return {
    station: '95641',
    stationName: 'Witchcliffe West',
    observedAtWst: get('t1-datetime') ?? null,

    tempC: num(get('t1-tmp')),
    apparentTempC: num(get('t1-apptmp')),
    relHumidityPct: num(get('t1-relhum')),

    windDir: get('t1-wind-dir') ?? null,
    windSpeedKmh: num(get('t1-wind-spd-kmh')),
    windGustKmh: num(get('t1-wind-gust-kmh')),

    pressQnhHpa: num(get('t1-press-qnh')),
    pressMslHpa: num(get('t1-press-msl')),
    rainSince9amMm: num(get('t1-rainsince9am')),

    sourceUrl: SOURCE_URL,
  };
}

const html = await fetch(SOURCE_URL).then((r) => {
  if (!r.ok) throw new Error(`BOM fetch failed: ${r.status} ${r.statusText}`);
  return r.text();
});

const tableStart = html.indexOf('<table id="t1"');
if (tableStart < 0) throw new Error('BOM parse failed: table t1 not found');
const tableEnd = html.indexOf('</table>', tableStart);
if (tableEnd < 0) throw new Error('BOM parse failed: table t1 end not found');

const tableHtml = html.slice(tableStart, tableEnd + '</table>'.length);
const row = parseLatestRow(tableHtml);
if (!row) throw new Error('BOM parse failed: could not extract latest row');

process.stdout.write(JSON.stringify(row));
