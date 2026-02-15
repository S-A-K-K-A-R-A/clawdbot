#!/usr/bin/env node
/**
 * Fetch latest BOM observations for Witchcliffe West (95641)
 * and emit the MOST RECENT row wind details as JSON.
 *
 * Output JSON:
 * {
 *   station: "95641",
 *   stationName: "Witchcliffe West",
 *   observedAtWst: "15/08:00pm",
 *   windDir: "SSW",
 *   windSpeedKmh: 11,
 *   windGustKmh: 15,
 *   sourceUrl: "..."
 * }
 */

const SOURCE_URL =
  process.env.BOM_WIND_URL ??
  'https://www.bom.gov.au/products/IDW60801/IDW60801.95641.shtml';

function pickFirstDataRow(tableHtml) {
  const tbodyMatch = tableHtml.match(/<tbody[\s\S]*?<\/tbody>/i);
  const tbody = tbodyMatch ? tbodyMatch[0] : tableHtml;
  const rowMatch = tbody.match(/<tr[^>]*>\s*([\s\S]*?)\s*<\/tr>/i);
  if (!rowMatch) return null;
  const rowHtml = rowMatch[1];

  const cells = [...rowHtml.matchAll(/<td[^>]*headers="([^"]+)"[^>]*>\s*([\s\S]*?)\s*<\/td>/gi)].map(
    (m) => ({ headers: m[1], value: m[2].replace(/<[^>]+>/g, '').trim() })
  );

  const get = (needle) => cells.find((c) => c.headers.includes(needle))?.value;

  const observedAtWst = get('t1-datetime');
  const windDir = get('t1-wind-dir');
  const windSpeedKmh = Number(get('t1-wind-spd-kmh'));
  const windGustKmh = Number(get('t1-wind-gust-kmh'));

  if (!observedAtWst || !windDir || !Number.isFinite(windSpeedKmh)) return null;

  return {
    station: '95641',
    stationName: 'Witchcliffe West',
    observedAtWst,
    windDir,
    windSpeedKmh,
    windGustKmh: Number.isFinite(windGustKmh) ? windGustKmh : null,
    sourceUrl: SOURCE_URL,
  };
}

// BOM sometimes 403s non-browser-y user agents; plain fetch works reliably here.
const html = await fetch(SOURCE_URL).then((r) => {
  if (!r.ok) throw new Error(`BOM fetch failed: ${r.status} ${r.statusText}`);
  return r.text();
});

const tableStart = html.indexOf('<table id="t1"');
if (tableStart < 0) throw new Error('BOM parse failed: table t1 not found');
const tableEnd = html.indexOf('</table>', tableStart);
if (tableEnd < 0) throw new Error('BOM parse failed: table t1 end not found');

const tableHtml = html.slice(tableStart, tableEnd + '</table>'.length);
const row = pickFirstDataRow(tableHtml);
if (!row) throw new Error('BOM parse failed: could not extract latest wind row');

process.stdout.write(JSON.stringify(row));
