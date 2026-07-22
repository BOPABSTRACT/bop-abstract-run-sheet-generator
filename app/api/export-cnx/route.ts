import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface InstrumentRow {
  vol_page: string;
  instrument_type: string;
  doc_date: string;
  recorded_date: string;
  grantor: string;
  grantee: string;
  description: string;
  comments: string;
  confidence: string;
  notes_for_reviewer: string;
  source_file: string;
}

// Classify instrument into CNX section
function getCnxSection(instrumentType: string): string {
  const t = instrumentType.toLowerCase();
  if (
    t.includes('oil and gas lease') ||
    t.includes('o&g lease') ||
    t.includes('memorandum of oil') ||
    t.includes('paid-up') ||
    t.includes('paid up')
  ) return 'LEASEHOLD';
  if (t.includes('mortgage') || t.includes('open-end mortgage')) return 'MORTGAGES';
  if (
    t.includes('right-of-way') || t.includes('right of way') ||
    t.includes('easement') || t.includes('row')
  ) return 'ROW';
  if (t.includes('outsale') || t.includes('out-conveyance') || t.includes('outconveyance')) return 'OUTSALES';
  if (
    t.includes('judgment') || t.includes('lien') || t.includes('affidavit') ||
    t.includes('certificate') || t.includes('miscellaneous') ||
    t.includes('plan') || t.includes('subdivision')
  ) return 'MISC';
  return 'SURFACE';
}

// Determine CNX instrument label
// Rules 5 & 6: estate docs → "Death", marriage docs → "Marriage"
function getCnxInstrumentLabel(instrumentType: string): string {
  const t = instrumentType.toLowerCase();
  if (
    t.includes('executor') || t.includes('administrator') ||
    t.includes('estate') || t.includes('will') ||
    t.includes('letters testamentary') || t.includes('letters of administration') ||
    t.includes('probate') || t.includes('fiduciary') ||
    t.includes('death') || t.includes('obituary')
  ) return 'Death';
  if (
    t.includes('marriage') || t.includes('spousal') ||
    t.includes('dower') || t.includes('prenuptial')
  ) return 'Marriage';
  return instrumentType;
}

// Format a date string as "Month Day, Year" e.g. "January 13, 1892"
// Handles: MM/DD/YYYY, YYYY-MM-DD, "May 13, 1997", "MAY 2, 1951", "August 30, 1957", etc.
// If already in a written-out format, normalizes it. Pass-through if unparseable.
function formatCnxDate(raw: string): string {
  if (!raw || raw.trim() === '') return '';
  const s = raw.trim();

  const MONTHS = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];

  // Try MM/DD/YYYY or M/D/YYYY
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const m = parseInt(slashMatch[1]);
    const d = parseInt(slashMatch[2]);
    const y = slashMatch[3];
    if (m >= 1 && m <= 12) return `${MONTHS[m-1]} ${d}, ${y}`;
  }

  // Try YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const m = parseInt(isoMatch[2]);
    const d = parseInt(isoMatch[3]);
    const y = isoMatch[1];
    if (m >= 1 && m <= 12) return `${MONTHS[m-1]} ${d}, ${y}`;
  }

  // Try MM-DD-YYYY
  const dashMatch = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const m = parseInt(dashMatch[1]);
    const d = parseInt(dashMatch[2]);
    const y = dashMatch[3];
    if (m >= 1 && m <= 12) return `${MONTHS[m-1]} ${d}, ${y}`;
  }

  // Try already-written formats: "May 13, 1997", "MAY 2, 1951", "August 30, 1957"
  // Also handles "24th day of January, 1997", "8th day of October, 1980"
  const writtenMatch = s.match(
    /(\d{1,2})(?:st|nd|rd|th)?\s+day\s+of\s+([A-Za-z]+)[,.]?\s+(\d{4})/i
  );
  if (writtenMatch) {
    const d = parseInt(writtenMatch[1]);
    const monthStr = writtenMatch[2];
    const y = writtenMatch[3];
    const mIdx = MONTHS.findIndex(m => m.toLowerCase() === monthStr.toLowerCase());
    if (mIdx >= 0) return `${MONTHS[mIdx]} ${d}, ${y}`;
  }

  const namedMatch = s.match(/^([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?[,.]?\s+(\d{4})$/i);
  if (namedMatch) {
    const monthStr = namedMatch[1];
    const d = parseInt(namedMatch[2]);
    const y = namedMatch[3];
    const mIdx = MONTHS.findIndex(m => m.toLowerCase() === monthStr.toLowerCase());
    if (mIdx >= 0) return `${MONTHS[mIdx]} ${d}, ${y}`;
  }

  // Already looks like "January 13, 1892" — return as-is
  const alreadyGood = s.match(/^[A-Za-z]+ \d{1,2}, \d{4}$/);
  if (alreadyGood) return s;

  // Unparseable — return original
  return s;
}

// Strip metes-and-bounds calls and boundary descriptions from text
// Removes: "thence N 45° E 200 feet", "bearing S30W", degree/minute/second patterns,
// "perches", "chains", "links", "poles", directional calls, etc.
function stripBoundaryDescriptions(text: string): string {
  if (!text) return text;

  const lines = text.split('\n');
  const kept: string[] = [];

  for (const line of lines) {
    const l = line.trim();

    // Skip lines that are primarily metes-and-bounds calls
    const isBoundaryLine =
      // Directional bearing patterns: N 45° E, S30W, North 45 degrees East
      /\b[NS]\s*\d+[°º]?\s*\d*[''']?\s*\d*["""]?\s*[EW]\b/i.test(l) ||
      // "thence" lines
      /^\s*thence\b/i.test(l) ||
      // Lines with chains/perches/links/poles/rods as primary content
      /\b\d+[\s.]*(?:chains?|perches?|links?|poles?|rods?|feet|ft\.?)\b.*\b(?:chains?|perches?|links?|poles?|rods?|feet|ft\.?)\b/i.test(l) ||
      // Lines that are just a bearing and distance and nothing else meaningful
      /^[NS]\s*\d+\s*[°º]?\s*[EW]\s*\d/i.test(l) ||
      // "beginning at a point" / "beginning at an iron pin" standalone lines
      /^beginning at (?:a|an) /i.test(l) ||
      // Pure coordinate lines
      /^\s*\d+[°º]\s*\d+'\s*\d+"\s*[NSEW]\b/i.test(l);

    if (!isBoundaryLine) {
      kept.push(line);
    }
  }

  // Also strip inline bearing patterns from remaining lines
  let result = kept.join('\n');

  // Remove inline "thence [bearing] [distance]" phrases
  result = result.replace(/[,;]?\s*thence\s+[^,;.\n]+(?:[,;.]|$)/gi, ' ');

  // Remove standalone degree-bearing fragments
  result = result.replace(/\b[NS]\s*\d+[°º]?\s*\d*['']?\s*\d*[""]?\s*[EW]\s+\d+[\s.]*(?:chains?|perches?|links?|poles?|rods?|feet|ft\.?)/gi, '');

  // Clean up extra whitespace and punctuation artifacts
  result = result.replace(/\s{2,}/g, ' ').replace(/,\s*,/g, ',').trim();

  return result;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      abstractorName,
      surfaceOwner,
      propertyDescription,
      parcelNumber,
      acreage,
      district,
      county,
      state,
      rows,
    } = body as {
      abstractorName: string;
      surfaceOwner: string;
      propertyDescription: string;
      parcelNumber: string;
      acreage: string;
      district: string;
      county: string;
      state: string;
      dueDate: string;
      rows: InstrumentRow[];
    };

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Title Chain');

    // 10 columns: A=# B=INSTRUMENT C=VOL/PG D=INSTRUMENT DATE E=FILE DATE
    //             F=GRANTOR G=GRANTEE H=DESCRIPTION I=NOTES AND REFERENCES J=PLAT
    // (Record Type col C and Net Acres col I from original template removed)
    ws.getColumn('A').width = 4.43;
    ws.getColumn('B').width = 18;
    ws.getColumn('C').width = 15.43;
    ws.getColumn('D').width = 18;
    ws.getColumn('E').width = 18;
    ws.getColumn('F').width = 39.29;
    ws.getColumn('G').width = 30;
    ws.getColumn('H').width = 42;
    ws.getColumn('I').width = 35;
    ws.getColumn('J').width = 8;

    const LIGHT_BLUE = 'FFD9E1F2';
    const BORDER_COLOR = 'FF000000';
    const thinBorder: ExcelJS.Border = { style: 'thin', color: { argb: BORDER_COLOR } };
    const allBorders: Partial<ExcelJS.Borders> = {
      top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder,
    };

    // ── ROW 1 — Header block ──────────────────────────────────────────
    ws.mergeCells('A1:J1');
    const headerCell = ws.getCell('A1');
    const searchDate = new Date().toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });
    headerCell.value =
      `QLA/QLS #: \nParcel: ${parcelNumber}\nAcres: ${acreage}\nTownship: ${district}\nCounty: ${county}\nState: ${state}\n` +
      `Limited to all instruments of record through ${searchDate} in ${county} County, ${state}`;
    headerCell.font = { name: 'Arial', size: 12 };
    headerCell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
    headerCell.border = allBorders;
    ws.getRow(1).height = 100;

    // ── ROW 2 — Column headers ────────────────────────────────────────
    const headers = [
      '#', 'INSTRUMENT', 'VOL/PG',
      'INSTRUMENT DATE', 'FILE DATE',
      'GRANTOR', 'GRANTEE',
      'DESCRIPTION', 'NOTES AND REFERENCES', 'PLAT',
    ];
    headers.forEach((h, i) => {
      const cell = ws.getCell(2, i + 1);
      cell.value = h;
      cell.font = { name: 'Arial Narrow', size: 10, bold: i > 0 };
      cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
      cell.border = allBorders;
    });
    ws.getRow(2).height = 45;

    // ── ROW 3 — Thin spacer ───────────────────────────────────────────
    ws.getRow(3).height = 2.25;

    function writeSectionHeader(rowNum: number, label: string) {
      ws.mergeCells(`A${rowNum}:J${rowNum}`);
      const cell = ws.getCell(`A${rowNum}`);
      cell.value = label;
      cell.font = { name: 'Arial', size: 10, bold: true };
      cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } };
      cell.border = allBorders;
      ws.getRow(rowNum).height = 12.75;
    }

    function writeDataRow(rowNum: number, num: number, row: InstrumentRow) {
      const cleanDesc = stripBoundaryDescriptions(row.description);
      const cleanNotes = stripBoundaryDescriptions(
        row.comments + (row.notes_for_reviewer ? '\n' + row.notes_for_reviewer : '')
      );

      const cells = [
        num,                                        // A — #
        getCnxInstrumentLabel(row.instrument_type), // B — INSTRUMENT (Death/Marriage/type)
        row.vol_page,                               // C — VOL/PG
        formatCnxDate(row.doc_date),                // D — INSTRUMENT DATE
        formatCnxDate(row.recorded_date),           // E — FILE DATE
        row.grantor,                                // F — GRANTOR
        row.grantee,                                // G — GRANTEE
        cleanDesc,                                  // H — DESCRIPTION (no boundary calls)
        cleanNotes,                                 // I — NOTES AND REFERENCES (no boundary calls)
        '',                                         // J — PLAT (blank)
      ];

      cells.forEach((val, i) => {
        const cell = ws.getCell(rowNum, i + 1);
        cell.value = val ?? '';
        cell.font = { name: 'Arial Narrow', size: 10 };
        cell.alignment = {
          wrapText: true, vertical: 'top',
          horizontal: i === 0 ? 'center' : 'left',
        };
        cell.border = allBorders;
      });
      ws.getRow(rowNum).height = 54;
    }

    // Sort rows into sections
    const sections: Record<string, InstrumentRow[]> = {
      SURFACE: [], LEASEHOLD: [], MORTGAGES: [], ROW: [], OUTSALES: [], MISC: [],
    };
    for (const row of rows) {
      sections[getCnxSection(row.instrument_type)].push(row);
    }

    const sectionDefs = [
      { key: 'SURFACE',   label: 'SURFACE, OIL & GAS CHAIN OF TITLE' },
      { key: 'LEASEHOLD', label: 'CURRENT OIL & GAS LEASEHOLD CHAIN OF TITLE' },
      { key: 'MORTGAGES', label: 'MORTGAGES' },
      { key: 'ROW',       label: 'RIGHTS OF WAY & EASEMENTS' },
      { key: 'OUTSALES',  label: 'OUTSALES' },
      { key: 'MISC',      label: 'MISCELLANEOUS & ADDITIONAL INFORMATION' },
    ];

    let currentRow = 4;
    let instrumentNum = 1;

    for (const { key, label } of sectionDefs) {
      writeSectionHeader(currentRow, label);
      currentRow++;

      const sectionRows = sections[key];
      if (sectionRows.length === 0) {
        writeDataRow(currentRow, instrumentNum, {
          vol_page: '', instrument_type: '', doc_date: '', recorded_date: '',
          grantor: '', grantee: '', description: '', comments: '',
          confidence: 'high', notes_for_reviewer: '', source_file: '',
        });
        currentRow++;
      } else {
        for (const row of sectionRows) {
          writeDataRow(currentRow, instrumentNum, row);
          instrumentNum++;
          currentRow++;
        }
      }
    }

    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="CNX_RunSheet_${parcelNumber || 'export'}.xlsx"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('CNX export error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
