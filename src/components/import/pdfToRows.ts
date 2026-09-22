import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Recover a table from a PDF, as well as a PDF allows.
 *
 * A PDF has no table in it. It has text runs with coordinates, so the rows and
 * columns have to be inferred: group runs that share a baseline into a row,
 * then split that row wherever the horizontal gap is wider than ordinary word
 * spacing. That works well on a PDF exported from a spreadsheet or a fleet
 * system, and less well on anything with wrapped cells or merged headers.
 *
 * Which is exactly why the result goes into the paste box rather than straight
 * to the importer: it is visible, editable, and still has to pass the preview
 * before a single row is written. A PDF that has been scanned carries no text
 * at all, and that case is reported rather than returning an empty grid that
 * looks like an empty spreadsheet.
 */

/** Runs whose baselines are within this many points are the same row. */
const ROW_TOLERANCE = 3;
/** A gap wider than this many points reads as a column break, not a space. */
const COLUMN_GAP = 12;

interface Run {
  text: string;
  x: number;
  y: number;
  width: number;
}

export class ScannedPdfError extends Error {
  constructor() {
    super('That PDF has no text in it — it looks scanned. Copy the rows out by hand, or export the list as Excel or CSV.');
    this.name = 'ScannedPdfError';
  }
}

export async function pdfToRows(file: File): Promise<string> {
  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;

  const lines: string[] = [];
  let sawAnyText = false;

  for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
    const page = await doc.getPage(pageNo);
    const content = await page.getTextContent();

    const runs: Run[] = content.items
      .map((item: any) => ({
        text: String(item.str ?? ''),
        // transform is [a, b, c, d, e, f]; e/f are the x/y of the run.
        x: item.transform?.[4] ?? 0,
        y: item.transform?.[5] ?? 0,
        width: item.width ?? 0,
      }))
      .filter(r => r.text.trim().length > 0);

    if (runs.length) sawAnyText = true;

    // Group into rows by baseline, top of the page first.
    const rows: Run[][] = [];
    for (const run of runs.sort((a, b) => b.y - a.y || a.x - b.x)) {
      const row = rows.find(r => Math.abs(r[0].y - run.y) <= ROW_TOLERANCE);
      if (row) row.push(run);
      else rows.push([run]);
    }

    for (const row of rows) {
      const ordered = row.sort((a, b) => a.x - b.x);
      let line = '';
      let prevEnd: number | null = null;
      for (const run of ordered) {
        if (prevEnd !== null) {
          // A wide gap is a column boundary; a narrow one is just a space.
          line += run.x - prevEnd > COLUMN_GAP ? '\t' : ' ';
        }
        line += run.text.trim();
        prevEnd = run.x + run.width;
      }
      if (line.trim()) lines.push(line.replace(/[ \t]+$/, ''));
    }
  }

  if (!sawAnyText) throw new ScannedPdfError();
  return lines.join('\n');
}
