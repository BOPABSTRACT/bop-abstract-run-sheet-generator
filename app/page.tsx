'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';

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
    showStatus(
      `Processing ${files.length} document(s)... This typically takes 10-30 seconds per file.`,
      'info'
    );

    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      const res = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Server error (${res.status}): ${errText}`);
      }

      const data = await res.json();

      if (data.rows && data.rows.length > 0) {
        setRows(data.rows);
      }
      if (data.errors && data.errors.length > 0) {
        setErrors(data.errors);
      }

      const okCount = (data.rows ?? []).length;
      const errCount = (data.errors ?? []).length;

      if (okCount > 0 && errCount === 0) {
        showStatus(`Extracted ${okCount} instrument(s). Review and edit below.`, 'success');
      } else if (okCount > 0 && errCount > 0) {
        showStatus(
          `Extracted ${okCount} instrument(s). ${errCount} file(s) had errors — see below.`,
          'info'
        );
      } else {
        showStatus(`No instruments extracted. ${errCount} error(s) — see below.`, 'error');
      }
    } catch (err: any) {
      showStatus(`Failed: ${err.message ?? String(err)}`, 'error');
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
      { wch: 18 },
      { wch: 22 },
      { wch: 22 },
      { wch: 35 },
      { wch: 35 },
      { wch: 50 },
      { wch: 40 },
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
      <h1>Oil & Gas Run Sheet Generator</h1>

      <div className="form-group">
        <label>Abstractor Name *</label>
        <input
          type="text"
          value={abstractorName}
          onChange={(e) => setAbstractorName(e.target.value)}
          placeholder="Enter your name"
        />
      </div>

      <div className="form-group">
        <label>Property Description *</label>
        <textarea
          value={propertyDescription}
          onChange={(e) => setPropertyDescription(e.target.value)}
          placeholder="Enter property description"
        />
      </div>

      <div className="form-group">
        <label>Parcel Number</label>
        <input
          type="text"
          value={parcelNumber}
          onChange={(e) => setParcelNumber(e.target.value)}
          placeholder="e.g., 12-22-7"
        />
      </div>

      <div className="form-group">
        <label>Acreage</label>
        <input
          type="text"
          value={acreage}
          onChange={(e) => setAcreage(e.target.value)}
          placeholder="e.g., 16.4"
        />
      </div>

      <div className="form-group">
        <label>District</label>
        <input
          type="text"
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          placeholder="e.g., Mannington District"
        />
      </div>

      <div className="form-group">
        <label>County</label>
        <input
          type="text"
          value={county}
          onChange={(e) => setCounty(e.target.value)}
          placeholder="e.g., Marion"
        />
      </div>

      <div className="form-group">
        <label>Upload PDFs</label>
        <input
          type="file"
          multiple
          accept=".pdf"
          onChange={(e) => setFiles(e.target.files)}
        />
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
          <p style={{ fontSize: 13, color: '#374151' }}>
            Confidence color: <span className="conf-high" style={{ padding: '2px 6px' }}>high</span>{' '}
            <span className="conf-medium" style={{ padding: '2px 6px' }}>medium</span>{' '}
            <span className="conf-low" style={{ padding: '2px 6px' }}>low — verify carefully</span>
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table className="results-table">
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Source</th>
                  <th style={{ width: 110 }}>VOL/PAGE</th>
                  <th style={{ width: 130 }}>Instrument Type</th>
                  <th style={{ width: 90 }}>Doc Date</th>
                  <th style
