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
  ) {
    return 'LEASEHOLD';
  }
  if (t.includes('mortgage') || t.includes('open-end mortgage')) {
    return 'MORTGAGES';
  }
  if (
    t.includes('right-of-way') ||
    t.includes('right of way') ||
    t.includes('easement') ||
    t.includes('row')
  ) {
    return 'ROW';
  }
  if (
    t.includes('outsale') ||
    t.includes('out-conveyance') ||
    t.includes('outconveyance')
  ) {
    return 'OUTSALES';
  }
  if (
    t.includes('judgment') ||
    t.includes('lien') ||
    t.includes('affidavit') ||
    t.includes('certificate') ||
    t.includes('miscellaneous') ||
    t.includes('will') ||
    t.includes('plan') ||
    t.includes('subdivision')
  ) {
    return 'MISC';
  }
  // Default: surface chain of title (deeds, assignments, etc.)
  return 'SURFACE';
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
      dueDate,
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

    // Column widths — matching CNX template
    ws.getColumn('A').width = 4.43;
    ws.getColumn('B').width = 15.43;
    ws.getColumn('C').width = 15.43;
    ws.getColumn('D').width = 15.43;
    ws.getColumn('E').width = 15.43;
    ws.getColumn('F').width = 15.43;
    ws.getColumn('G').width = 39.29;
    ws.getColumn('H').width = 25;
    ws.getColumn('I').width = 12.43;
    ws.getColumn('J').width = 42;
    ws.getColumn('K').width = 30;
    ws.getColumn('L').width = 8;

    const LIGHT_BLUE = 'FFD9E1F2'; // Theme 9 tint 0.8 approximate
    const BORDER_COLOR = 'FF000000';

    const thinBorder: ExcelJS.Border = { style: 'thin', color: { argb: BORDER_COLOR } };
    const allBorders: Partial<ExcelJS.Borders> = {
      top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder,
    };

    // ── ROW 1 — Header block ──────────────────────────────────────────
    ws.mergeCells('A1:L1');
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
      '#', 'INSTRUMENT', 'RECORD TYPE', 'VOL/PG',
      'INSTRUMENT DATE', 'FILE DATE', 'GRANTOR', 'GRANTEE',
      'NET ACRES', 'DESCRIPTION', 'NOTES AND REFERENCES', 'PLAT',
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

    // Helper — write a section divider row
    function writeSectionHeader(rowNum: number, label: string) {
      ws.mergeCells(`A${rowNum}:L${rowNum}`);
      const cell = ws.getCell(`A${rowNum}`);
      cell.value = label;
      cell.font = { name: 'Arial', size: 10, bold: true };
      cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } };
      cell.border = allBorders;
      ws.getRow(rowNum).height = 12.75;
    }

    // Helper — write a data row
    function writeDataRow(
      rowNum: number,
      num: number,
      row: InstrumentRow,
    ) {
      const cells = [
        num,                    // A — #
        row.instrument_type,    // B — INSTRUMENT
        '',                     // C — RECORD TYPE (blank — user fills)
        row.vol_page,           // D — VOL/PG
        row.doc_date,           // E — INSTRUMENT DATE
        row.recorded_date,      // F — FILE DATE
        row.grantor,            // G — GRANTOR
        row.grantee,            // H — GRANTEE
        acreage,                // I — NET ACRES
        row.description,        // J — DESCRIPTION
        row.comments + (row.notes_for_reviewer ? '\n' + row.notes_for_reviewer : ''), // K — NOTES
        '',                     // L — PLAT (blank)
      ];
      cells.forEach((val, i) => {
        const cell = ws.getCell(rowNum, i + 1);
        cell.value = val ?? '';
        cell.font = { name: 'Arial Narrow', size: 10 };
        cell.alignment = {
          wrapText: true,
          vertical: 'top',
          horizontal: i === 0 ? 'center' : 'left',
        };
        cell.border = allBorders;
      });
      ws.getRow(rowNum).height = 54;
    }

    // Sort rows into sections
    const sections: Record<string, InstrumentRow[]> = {
      SURFACE: [],
      LEASEHOLD: [],
      MORTGAGES: [],
      ROW: [],
      OUTSALES: [],
      MISC: [],
    };
    for (const row of rows) {
      const section = getCnxSection(row.instrument_type);
      sections[section].push(row);
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
        // Write one blank placeholder row
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

    // Build and return the file
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
