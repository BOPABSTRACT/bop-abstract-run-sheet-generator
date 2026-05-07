'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { upload } from '@vercel/blob/client';

interface InstrumentRow {
  vol_page: string;
  instrument_type: string;
  doc_date: string;
  recorded_date: string;
  grantor: string;
  grantee: string;
  description: string;
  comments: string;
  confidence: 'high' | 'medium' | 'low';
  notes_for_reviewer: string;
  source_file: string;
}

interface ExtractError {
  file: string;
  error: string;
}

export default function Home() {
  const [abstractorName, setAbstractorName] = useState('');
  const [propertyDescription, setPropertyDescription] = useState('');
  const [parcelNumber, setParcelNumber] = useState('');
  const [acreage, setAcreage] = useState('');
  const [district, setDistrict] = useState('');
  const [county, setCounty] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rows, setRows] = useState<InstrumentRow[]>([]);
  const [errors, setErrors] = useState<ExtractError[]>([]);

  function showStatus(message: string, type: 'success' | 'error' | 'info') {
    setStatus({ message, type });
  }

  function generateDemo() {
    if (!abstractorName || !propertyDescription) {
      showStatus('Please fill in Abstractor Name and Property Description', 'error');
      return;
    }
    const demoRows: InstrumentRow[] = [
      {
        vol_page: 'DB 1094/697',
        instrument_type: 'General Warranty Deed',
        doc_date: '8/8/2011',
        recorded_date: '8/23/2011',
        grantor: 'George R. Freeland, widower',
        grantee: 'Kevin D. Moore or Kelley Moore, his wife, as joint tenants with the right of survivorship and not as tenants in common',
        description: 'All that certain tract or parcel of real estate, situate on Pyles Fork of Buffalo Creek, in Mannington District, Marion County, West Virginia, containing 16.4 acres, more or less',
        comments: 'Prior Deed Reference: DB 359/390; WB 68/766; WB 70/804; DB 956/387',
        confidence: 'high',
        notes_for_reviewer: '',
        source_file: 'DEMO_SAMPLE.pdf',
      },
    ];
    setRows(demoRows);
    setErrors([]);
    showStatus('Demo row loaded. Click "Export to Excel" to download.', 'success');
  }

  async function generateWithAPI() {
    if (!abstractorName) {
      showStatus('Please fill in Abstractor Name', 'error');
      return;
    }
    if (!files || files.length === 0) {
      showStatus('Please upload at least one PDF file', 'error');
      return;
    }

    setIsProcessing(true);
    setRows([]);
    setErrors([]);

    try {
      const fileArray = Array.from(files);

      // ── Step 1: Upload each PDF directly to Vercel Blob ──────────────────
      showStatus(`Uploading ${fileArray.length} file(s)...`, 'info');

      const uploadedFiles: { url: string; filename: string }[] = [];
      const uploadErrors: ExtractError[] = [];

      await Promise.all(
        fileArray.map(async (file) => {
          try {
            const blob = await upload(file.name, file, {
              access: 'public',
              handleUploadUrl: '/api/upload-url',
            });
            uploadedFiles.push({ url: blob.url, filename: file.name });
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            uploadErrors.push({ file: file.name, error: message });
          }
        })
      );

      if (uploadErrors.length > 0) {
        setErrors(uploadErrors);
      }

      if (uploadedFiles.length === 0) {
        showStatus('All uploads failed. Check errors below.', 'error');
        return;
      }

      // ── Step 2: Send blob URLs to /api/extract for OCR + Claude ──────────
      showStatus(
        `Processing ${uploadedFiles.length} document(s)... This typically takes 10–30 seconds per file.`,
        'info'
      );

      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: uploadedFiles }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Server error (${res.status}): ${errText}`);
      }

      const data = await res.json();

      if (data.rows && data.rows.length > 0) setRows(data.rows);

      const allErrors = [...uploadErrors, ...(data.errors ?? [])];
      if (allErrors.length > 0) setErrors(allErrors);

      const okCount = (data.rows ?? []).length;
      const errCount = allErrors.length;

      if (okCount > 0 && errCount === 0) {
        showStatus(`Extracted ${okCount} instrument(s). Review and edit below.`, 'success');
      } else if (okCount > 0 && errCount > 0) {
        showStatus(`Extracted ${okCount} instrument(s). ${errCount} file(s) had errors.`, 'info');
      } else {
        showStatus(`No instruments extracted. ${errCount} error(s).`, 'error');
      }
    } catch (err: unknown) {
      showStatus(`Failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  }

  function updateRow(index: number, field: keyof InstrumentRow, value: string) {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function deleteRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function exportToExcel() {
    if (rows.length === 0) {
      showStatus('No data to export', 'error');
      return;
    }

    const headerRows: any[][] = [
      [`RUN SHEET - ${abstractorName} - CHAIN OF TITLE`],
      [],
      ['Abstractor Name:', abstractorName, '', 'Due Date:', 'N/A'],
      [
        'Description:',
        `${propertyDescription}     Current Parcel Nos.: ${parcelNumber}    Current Acreage: ${acreage}    District: ${district}    County: ${county}     State: West Virginia`,
      ],
      [],
      ['VOL/PAGE', 'Instrument Type', 'Doc. Date / Recorded Date', 'Grantor', 'Grantee', 'Description', 'Comments'],
    ];

    const dataRows = rows.map((r) => [
      r.vol_page,
      r.instrument_type,
      `${r.doc_date}  ${r.recorded_date}`.trim(),
      r.grantor,
      r.grantee,
      r.description,
      r.comments,
    ]);

    const allRows = [...headerRows, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(allRows);
    ws['!cols'] = [
      { wch: 18 }, { wch: 22 }, { wch: 22 },
      { wch: 35 }, { wch: 35 }, { wch: 50 }, { wch: 40 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Chain of Title');

    const safeName = (abstractorName || 'Abstractor').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeName}_RunSheet_${parcelNumber || 'NoParcel'}.xlsx`;
    XLSX.writeFile(wb, filename);
    showStatus(`Exported ${filename}`, 'success');
  }

  return (
    <div className="container">
      <h1>Oil &amp; Gas Run Sheet Generator</h1>

      <div className="form-group">
        <label>Abstractor Name *</label>
        <input type="text" value={abstractorName} onChange={(e) => setAbstractorName(e.target.value)} placeholder="Enter your name" />
      </div>

      <div className="form-group">
        <label>Property Description *</label>
        <textarea value={propertyDescription} onChange={(e) => setPropertyDescription(e.target.value)} placeholder="Enter property description" />
      </div>

      <div className="form-group">
        <label>Parcel Number</label>
        <input type="text" value={parcelNumber} onChange={(e) => setParcelNumber(e.target.value)} placeholder="e.g., 12-22-7" />
      </div>

      <div className="form-group">
        <label>Acreage</label>
        <input type="text" value={acreage} onChange={(e) => setAcreage(e.target.value)} placeholder="e.g., 16.4" />
      </div>

      <div className="form-group">
        <label>District</label>
        <input type="text" value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="e.g., Mannington District" />
      </div>

      <div className="form-group">
        <label>County</label>
        <input type="text" value={county} onChange={(e) => setCounty(e.target.value)} placeholder="e.g., Marion" />
      </div>

      <div className="form-group">
        <label>Upload PDFs</label>
        <input type="file" multiple accept=".pdf" onChange={(e) => setFiles(e.target.files)} />
      </div>

      <div className="button-group">
        <button className="btn-demo" onClick={generateDemo} disabled={isProcessing}>
          Generate Demo Sample
        </button>
        <button className="btn-real" onClick={generateWithAPI} disabled={isProcessing}>
          {isProcessing ? 'Processing...' : 'Generate with Real Data'}
        </button>
      </div>

      {status && <div className={`status ${status.type}`}>{status.message}</div>}

      {errors.length > 0 && (
        <>
          <h2>Errors</h2>
          <ul>
            {errors.map((e, i) => (
              <li key={i}>
                <strong>{e.file}</strong>: {e.error}
              </li>
            ))}
          </ul>
        </>
      )}

      {rows.length > 0 && (
        <>
          <h2>Review &amp; Edit Extracted Instruments</h2>
          <div style={{ overflowX: 'auto' }}>
            <table className="results-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>VOL/PAGE</th>
                  <th>Instrument Type</th>
                  <th>Doc Date</th>
                  <th>Recorded Date</th>
                  <th>Grantor</th>
                  <th>Grantee</th>
                  <th>Description</th>
                  <th>Comments</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className={`conf-${row.confidence}`}>
                    <td>{row.source_file}</td>
                    <td><input value={row.vol_page} onChange={(e) => updateRow(i, 'vol_page', e.target.value)} /></td>
                    <td><input value={row.instrument_type} onChange={(e) => updateRow(i, 'instrument_type', e.target.value)} /></td>
                    <td><input value={row.doc_date} onChange={(e) => updateRow(i, 'doc_date', e.target.value)} /></td>
                    <td><input value={row.recorded_date} onChange={(e) => updateRow(i, 'recorded_date', e.target.value)} /></td>
                    <td><input value={row.grantor} onChange={(e) => updateRow(i, 'grantor', e.target.value)} /></td>
                    <td><input value={row.grantee} onChange={(e) => updateRow(i, 'grantee', e.target.value)} /></td>
                    <td><input value={row.description} onChange={(e) => updateRow(i, 'description', e.target.value)} /></td>
                    <td><input value={row.comments} onChange={(e) => updateRow(i, 'comments', e.target.value)} /></td>
                    <td><button onClick={() => deleteRow(i)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn-export" onClick={exportToExcel}>
            Export to Excel
          </button>
        </>
      )}
    </div>
  );
}
