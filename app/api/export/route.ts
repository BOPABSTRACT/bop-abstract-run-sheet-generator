import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      abstractorName,
      propertyDescription,
      parcelNumber,
      acreage,
      district,
      county,
      sortField,
      rows,
    } = body;

    const today = new Date().toLocaleDateString('en-US');
    const sortLabel = sortField === 'recorded_date' ? 'Recorded Date' : 'Doc Date';

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Chain of Title');

    // ── Column widths ─────────────────────────────────────────────────────
    ws.columns = [
      { key: 'a', width: 14 },   // A VOL/PAGE
      { key: 'b', width: 20 },   // B Instrument Type
      { key: 'c', width: 13 },   // C Doc Date
      { key: 'd', width: 13 },   // D Recorded Date
      { key: 'e', width: 24 },   // E Grantor
      { key: 'f', width: 24 },   // F Grantee
      { key: 'g', width: 32 },   // G Description
      { key: 'h', width: 38 },   // H Comments
    ];

    // ── Shared style helpers ──────────────────────────────────────────────
    const thickBorder: Partial<ExcelJS.Borders> = {
      top:    { style: 'thick' },
      bottom: { style: 'thick' },
      left:   { style: 'thick' },
      right:  { style: 'thick' },
    };
    const mediumBorder: Partial<ExcelJS.Borders> = {
      top:    { style: 'medium' },
      bottom: { style: 'medium' },
      left:   { style: 'medium' },
      right:  { style: 'medium' },
    };
    const dataBorder: Partial<ExcelJS.Borders> = {
      top:    { style: 'thin' },
      bottom: { style: 'thin' },
      left:   { style: 'thin' },
      right:  { style: 'thin' },
    };
    const yellowFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF00' },
    };
    const centerWrap: Partial<ExcelJS.Alignment> = {
      horizontal: 'center',
      vertical: 'top',
      wrapText: true,
    };
    const centerMiddle: Partial<ExcelJS.Alignment> = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    };
    const leftWrap: Partial<ExcelJS.Alignment> = {
      horizontal: 'left',
      vertical: 'top',
      wrapText: true,
    };

    // ── ROW 1: Title ──────────────────────────────────────────────────────
    const row1 = ws.getRow(1);
    row1.height = 33;
    ws.mergeCells('A1:H1');
    const titleCell = ws.getCell('A1');
    titleCell.value = `RUN SHEET - ${abstractorName} - CHAIN OF TITLE`;
    titleCell.font = { name: 'Calibri', size: 18 };
    titleCell.alignment = centerWrap;
    titleCell.border = thickBorder;

    // ── ROW 2: Abstractor / Due Date ──────────────────────────────────────
    const row2 = ws.getRow(2);
    row2.height = 57;
    ws.mergeCells('A2:B2');
    ws.mergeCells('C2:F2');
    ws.mergeCells('G2:H2');

    const abCell = ws.getCell('A2');
    abCell.value = `Abstractor Name:  ${abstractorName}`;
    abCell.font = { name: 'Calibri', size: 18 };
    abCell.alignment = centerMiddle;
    abCell.border = thickBorder;

    // blank middle merge — just border
    const midCell = ws.getCell('C2');
    midCell.border = {
      top: { style: 'thick' },
      bottom: { style: 'thick' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };

    const dueCell = ws.getCell('G2');
    dueCell.value = `Due Date:  ${today}`;
    dueCell.font = { name: 'Calibri', size: 18 };
    dueCell.alignment = centerMiddle;
    dueCell.border = thickBorder;

    // ── ROW 3: Description ────────────────────────────────────────────────
    const row3 = ws.getRow(3);
    row3.height = 52;
    ws.mergeCells('A3:H3');
    const descCell = ws.getCell('A3');
    descCell.value = `Description: ${propertyDescription}\nCurrent Parcel Nos.: ${parcelNumber}     Current Acreage: ${acreage}     District: ${district}     County: ${county}     State: West Virginia`;
    descCell.font = { name: 'Calibri', size: 14 };
    descCell.alignment = centerWrap;
    descCell.border = thickBorder;

    // ── ROW 4: Column Headers ─────────────────────────────────────────────
    const row4 = ws.getRow(4);
    row4.height = 43;
    const headers = [
      'VOL/PAGE',
      'Instrument Type',
      `Doc. Date\n(sorted by ${sortLabel})`,
      'Recorded Date',
      'Grantor',
      'Grantee',
      'Description',
      'Comments',
    ];
    const colLetters = ['A','B','C','D','E','F','G','H'];
    headers.forEach((h, i) => {
      const cell = ws.getCell(`${colLetters[i]}4`);
      cell.value = h;
      cell.font = { name: 'Calibri', size: 11, bold: true };
      cell.fill = yellowFill;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = mediumBorder;
    });

    // ── DATA ROWS ─────────────────────────────────────────────────────────
    rows.forEach((r: any, idx: number) => {
      const rowNum = idx + 5;
      const exRow = ws.getRow(rowNum);
      exRow.height = 60; // base height — Excel expands further if text wraps more

      const data = [
        r.vol_page       || '',
        r.instrument_type|| '',
        r.doc_date       || '',
        r.recorded_date  || '',
        r.grantor        || '',
        r.grantee        || '',
        r.description    || '',
        r.comments       || '',
      ];

      data.forEach((val, ci) => {
        const cell = ws.getCell(rowNum, ci + 1);
        cell.value = val;
        cell.font = { name: 'Calibri', size: 11 };
        cell.border = dataBorder;
        // center for vol/page, instrument, dates; left for names and text
        cell.alignment = ci <= 3 ? centerWrap : leftWrap;
      });
    });

    // ── Write to buffer and return ────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer();

    const safeName = (abstractorName || 'Abstractor').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeName}_RunSheet_${parcelNumber || 'NoParcel'}_sortedBy${sortField === 'recorded_date' ? 'RecordedDate' : 'DocDate'}.xlsx`;

    return new NextResponse(buffer as Buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('Export route error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
