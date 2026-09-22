import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Recover a table from a PDF, as well as a PDF allows.
 *
 * A PDF has no table in it — only text runs with coordinates — so rows and
 * columns have to be inferred. Rows are easy: runs sharing a baseline belong
 * together. Columns are the hard part.
 *
 * Splitting a row wherever the horizontal gap looks "wide enough" does not
 * work, and failed on a real fleet list: "Registration" and "Vehicle Type" sat
 * close enough to merge into one heading, every column after it shifted, and
 * vehicle types ended up under Make.
 *
 * What actually identifies a column is that its values share a left edge down
 * the page. So collect the x of every run in the document, cluster those, and
 * keep the clusters that appear on most rows — a real column has a value on
 * nearly every line, while "Type" in a two-word heading appears once. Each run
 * then snaps to its column, and runs landing in the same one are joined with a
 * space rather than splitting the table.
 *
 * The result still goes into the paste box rather than straight to the
 * importer: it is visible, editable, and has to pass the preview first.
 */

/** Runs whose baselines are within this many points share a row. */
const ROW_TOLERANCE = 3;
/** Left edges within this many points are the same column. */
const COLUMN_TOLERANCE = 10;

interface Run {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Rejoin runs that are only a word-space apart.
 *
 * pdf.js hands back "Vehicle" and "Type" as separate runs for one heading, and
 * "TGX" and "26.480" for one model. Left alone, each fragment votes for its own
 * column: the table gains a phantom column and headings land one cell to the
 * right of what they label. A gap under ~0.8 of the line height is a space
 * inside a value; anything wider is the space between columns.
 */
function joinWords(row: Run[]): Run[] {
  const out: Run[] = [];
  for (const run of row) {
    const prev = out[out.length - 1];
    const gap = prev ? run.x - (prev.x + prev.width) : Infinity;
    if (prev && gap < Math.max(prev.height, run.height) * 0.8) {
      prev.text = `${prev.text} ${run.text}`;
      prev.width = run.x + run.width - prev.x;
    } else {
      out.push({ ...run });
    }
  }
  return out;
}

export class ScannedPdfError extends Error {
  constructor() {
    super('That PDF has no text in it — it looks scanned. Copy the rows out by hand, or export the list as Excel or CSV.');
    this.name = 'ScannedPdfError';
  }
}

/** Group runs into visual rows, top of the page first. */
function toRows(runs: Run[]): Run[][] {
  const rows: Run[][] = [];
  for (const run of [...runs].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const row = rows.find(r => Math.abs(r[0].y - run.y) <= ROW_TOLERANCE);
    if (row) row.push(run);
    else rows.push([run]);
  }
  return rows.map(r => joinWords(r.sort((a, b) => a.x - b.x)));
}

/**
 * The x positions the table's columns start at.
 *
 * Every run votes for its own left edge; edges within COLUMN_TOLERANCE are the
 * same column. A column carrying a value on most rows is real — that threshold
 * is what separates a genuine column from a stray fragment that lines up by
 * coincidence on one or two rows.
 */
function findColumns(rows: Run[][]): number[] {
  const clusters: { x: number; hits: number }[] = [];
  for (const row of rows) {
    for (const run of row) {
      const c = clusters.find(k => Math.abs(k.x - run.x) <= COLUMN_TOLERANCE);
      if (c) {
        c.x = (c.x * c.hits + run.x) / (c.hits + 1);   // running mean
        c.hits += 1;
      } else {
        clusters.push({ x: run.x, hits: 1 });
      }
    }
  }
  // A real column carries a value on most rows. Biased towards fewer columns
  // on purpose: a missed split merges two values into one cell, which is
  // visible and easy to fix, while a phantom column shifts every heading after
  // it and quietly mis-maps the lot.
  const threshold = Math.max(2, Math.ceil(rows.length * 0.6));
  const kept = clusters.filter(c => c.hits >= threshold).sort((a, b) => a.x - b.x);
  // A one-row table, or something too irregular to read as columns: fall back
  // to every distinct edge rather than returning nothing.
  return (kept.length ? kept : clusters.sort((a, b) => a.x - b.x)).map(c => c.x);
}

function nearestColumn(x: number, columns: number[]): number {
  let best = 0;
  for (let i = 1; i < columns.length; i++) {
    if (Math.abs(columns[i] - x) < Math.abs(columns[best] - x)) best = i;
  }
  return best;
}

export async function pdfToRows(file: File): Promise<string> {
  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;

  const pages: Run[][][] = [];
  let sawAnyText = false;

  for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
    const page = await doc.getPage(pageNo);
    const content = await page.getTextContent();
    const runs: Run[] = content.items
      .map((item: any) => ({
        text: String(item.str ?? ''),
        // transform is [a, b, c, d, e, f]; e and f are the run's x and y.
        x: item.transform?.[4] ?? 0,
        y: item.transform?.[5] ?? 0,
        width: item.width ?? 0,
        height: item.height || 8,
      }))
      .filter(r => r.text.trim().length > 0);
    if (runs.length) sawAnyText = true;
    pages.push(toRows(runs));
  }

  if (!sawAnyText) throw new ScannedPdfError();

  // Columns are worked out per page: a second page can be laid out differently,
  // and forcing one page's grid onto another is how a continuation sheet ends
  // up shifted by a column.
  const lines: string[] = [];
  for (const rows of pages) {
    if (!rows.length) continue;
    const columns = findColumns(rows);
    for (const row of rows) {
      const cells: string[] = Array(columns.length).fill('');
      for (const run of row) {
        const i = nearestColumn(run.x, columns);
        cells[i] = cells[i] ? `${cells[i]} ${run.text.trim()}` : run.text.trim();
      }
      // Trailing empties carry no information; interior ones are real gaps and
      // must stay, or every column after a blank cell shifts left.
      while (cells.length && cells[cells.length - 1] === '') cells.pop();
      if (cells.some(c => c !== '')) lines.push(cells.join('\t'));
    }
  }

  return lines.join('\n');
}
