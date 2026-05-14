import { NextRequest, NextResponse } from 'next/server';

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

    // Build the Python script inline and run it
    const { execSync } = await import('child_process');
    const { writeFileSync, readFileSync, unlinkSync } = await import('fs');
    const { join } = await import('path');
    const tmpDir = '/tmp';
    const outPath = join(tmpDir, `runsheet_${Date.now()}.xlsx`);

    const sortLabel = sortField === 'recorded_date' ? 'Recorded Date' : 'Doc Date';

    const descLine1 = `Description: ${propertyDescription}`;
    const descLine2 = `Current Parcel Nos.: ${parcelNumber}     Current Acreage: ${acreage}     District: ${district}     County: ${county}     State: West Virginia`;

    const pythonScript = `
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import json

rows = json.loads(${JSON.stringify(JSON.stringify(rows))})
out_path = ${JSON.stringify(outPath)}

wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Chain of Title"

# ── Styles ────────────────────────────────────────────────────────────────
font_title   = Font(name="Calibri", size=18)
font_desc    = Font(name="Calibri", size=14)
font_header  = Font(name="Calibri", size=11)
font_data    = Font(name="Calibri", size=11)

fill_yellow  = PatternFill("solid", fgColor="FFFF00")
fill_none    = PatternFill(fill_type=None)

align_center_wrap = Alignment(horizontal="center", vertical="top", wrap_text=True)
align_center_mid  = Alignment(horizontal="center", vertical="center", wrap_text=True)
align_left_wrap   = Alignment(horizontal="left",   vertical="top",   wrap_text=True)

thick  = Side(border_style="thick")
medium = Side(border_style="medium")
thin   = Side(border_style="thin")
none   = Side(border_style=None)

border_title  = Border(top=thick,  bottom=thick,  left=thick,  right=thick)
border_header = Border(top=medium, bottom=medium, left=medium, right=medium)
border_data   = Border(top=none,   bottom=thin,   left=thin,   right=thin)
border_desc   = Border(top=thick,  bottom=none,   left=thick,  right=thick)
border_ab     = Border(top=thick,  bottom=thick,  left=thick,  right=thick)
border_due    = Border(top=thick,  bottom=none,   left=thick,  right=thick)

# ── Column widths (8 cols: A-H) ───────────────────────────────────────────
col_widths = [12, 18, 12, 12, 20.7, 20.7, 27, 36]
for i, w in enumerate(col_widths, 1):
    ws.column_dimensions[get_column_letter(i)].width = w

# ── Row 1: Title ──────────────────────────────────────────────────────────
ws.row_dimensions[1].height = 33
ws.merge_cells("A1:H1")
c = ws["A1"]
c.value = f"RUN SHEET - ${abstractorName} - CHAIN OF TITLE"
c.font = font_title
c.alignment = align_center_wrap
c.border = border_title

# ── Row 2: Abstractor / Due Date ──────────────────────────────────────────
ws.row_dimensions[2].height = 57
ws.merge_cells("A2:B2")
ws.merge_cells("C2:F2")
ws.merge_cells("G2:H2")

c = ws["A2"]
c.value = "Abstractor Name:  ${abstractorName}"
c.font = font_title
c.alignment = align_center_mid
c.border = border_ab

c = ws["G2"]
c.value = "Due Date:  ${today}"
c.font = font_title
c.alignment = align_center_mid
c.border = border_due

# fill merged middle cells with border
for col in ["C2","D2","E2","F2"]:
    ws[col].border = Border(top=thick, bottom=thick, left=none, right=none)

# ── Row 3: Description ────────────────────────────────────────────────────
ws.row_dimensions[3].height = 52
ws.merge_cells("A3:H3")
c = ws["A3"]
c.value = "${descLine1}\\n${descLine2}"
c.font = font_desc
c.alignment = align_center_wrap
c.border = border_desc

# ── Row 4: Column Headers ─────────────────────────────────────────────────
ws.row_dimensions[4].height = 43
headers = [
    "VOL/PAGE",
    "Instrument Type",
    f"Doc. Date\\n(sorted by ${sortLabel})",
    "Recorded Date",
    "Grantor",
    "Grantee",
    "Description",
    "Comments",
]
for col_idx, h in enumerate(headers, 1):
    c = ws.cell(row=4, column=col_idx, value=h)
    c.font = font_header
    c.fill = fill_yellow
    c.alignment = align_center_mid
    c.border = border_header

# ── Data rows ─────────────────────────────────────────────────────────────
for row_idx, row in enumerate(rows, 5):
    ws.row_dimensions[row_idx].height = None  # auto
    data = [
        row.get("vol_page", ""),
        row.get("instrument_type", ""),
        row.get("doc_date", ""),
        row.get("recorded_date", ""),
        row.get("grantor", ""),
        row.get("grantee", ""),
        row.get("description", ""),
        row.get("comments", ""),
    ]
    for col_idx, val in enumerate(data, 1):
        c = ws.cell(row=row_idx, column=col_idx, value=val)
        c.font = font_data
        c.border = border_data
        # center date and vol cols, left-align text cols
        if col_idx <= 4:
            c.alignment = Alignment(horizontal="center", vertical="top", wrap_text=True)
        else:
            c.alignment = align_left_wrap

wb.save(out_path)
print("OK")
`;

    const scriptPath = join(tmpDir, `build_${Date.now()}.py`);
    writeFileSync(scriptPath, pythonScript);

    try {
      execSync(`python3 ${scriptPath}`, { timeout: 20000 });
    } catch (e: any) {
      throw new Error(`Python error: ${e.stderr?.toString() || e.message}`);
    }

    const fileBuffer = readFileSync(outPath);

    try { unlinkSync(scriptPath); } catch {}
    try { unlinkSync(outPath); } catch {}

    const safeName = (abstractorName || 'Abstractor').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeName}_RunSheet_${parcelNumber || 'NoParcel'}_sortedBy${sortField === 'recorded_date' ? 'RecordedDate' : 'DocDate'}.xlsx`;

    return new NextResponse(fileBuffer, {
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
