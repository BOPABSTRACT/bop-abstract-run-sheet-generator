'use client';

import { useState } from 'react';

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

function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date(0);
  const cleaned = dateStr.trim();
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) return d;
  const parts = cleaned.split('/');
  if (parts.length === 3) {
    return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
  }
  return new Date(0);
}

function formatDate(dateStr: string): string {
  if (!dateStr || dateStr.trim() === '') return '';
  const d = parseDate(dateStr);
  if (!d || d.getTime() === new Date(0).getTime()) return dateStr;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  if (yyyy < 1600 || yyyy > 2100) return dateStr;
  return `${mm}-${dd}-${yyyy}`;
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
  const [isExporting, setIsExporting] = useState(false);
  const [rows, setRows] = useState<InstrumentRow[]>([]);
  const [errors, setErrors] = useState<ExtractError[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [sortField, setSortField] = useState<'recorded_date' | 'doc_date'>('recorded_date');
  const [tableSort, setTableSort] = useState<'recorded_date' | 'doc_date'>('recorded_date');

  function showStatus(message: string, type: 'success' | 'error' | 'info') {
    setStatus({ message, type });
  }

  function getSorted(data: InstrumentRow[], field: 'recorded_date' | 'doc_date') {
    return [...data].sort(
      (a, b) => parseDate(a[field]).getTime() - parseDate(b[field]).getTime()
    );
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
        doc_date: '08-08-2011',
        recorded_date: '08-23-2011',
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
    setProgress(null);

    try {
      const fileArray = Array.from(files);
      const total = fileArray.length;

      showStatus(`Uploading ${total} file(s)...`, 'info');

      const uploadResults = await Promise.all(
        fileArray.map(async (file) => {
          const formData = new FormData();
          formData.append('file', file);
          const uploadRes = await fetch('/api/upload-url', {
            method: 'POST',
            body: formData,
          });
          if (!uploadRes.ok) {
            const errText = await uploadRes.text();
            throw new Error(`Upload failed for ${file.name} (${uploadRes.status}): ${errText}`);
          }
          const { url, filename } = await uploadRes.json();
          return { url, filename: filename ?? file.name, originalName: file.name };
        })
      );

      showStatus(`Processing ${total} document(s) in parallel...`, 'info');
      setProgress({ done: 0, total });

      const allRows: InstrumentRow[] = [];
      const allErrors: ExtractError[] = [];

      await Promise.all(
        uploadResults.map(async ({ url, filename, originalName }) => {
          try {
            const res = await fetch('/api/extract', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url, filename }),
            });

            if (!res.ok) {
              const errText = await res.text();
              throw new Error(`Server error (${res.status}): ${errText}`);
            }

            const data = await res.json();

            if (data.rows && data.rows.length > 0) {
              const normalized = data.rows.map((r: InstrumentRow) => ({
                ...r,
                doc_date: formatDate(r.doc_date),
                recorded_date: formatDate(r.recorded_date),
              }));
              allRows.push(...normalized);
            }
            if (data.error) allErrors.push({ file: originalName, error: data.error });
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            allErrors.push({ file: originalName, error: message });
          } finally {
            setProgress((prev) =>
              prev ? { done: prev.done + 1, total: prev.total } : null
            );
          }
        })
      );

      setRows(allRows);
      setErrors(allErrors);

      const okCount = allRows.length;
      const errCount = allErrors.length;

      if (okCount > 0 && errCount === 0) {
        showStatus(`Extracted ${okCount} instrument(s) from ${total} file(s). Review and edit below.`, 'success');
      } else if (okCount > 0 && errCount > 0) {
        showStatus(`Extracted ${okCount} instrument(s). ${errCount} file(s) had errors.`, 'info');
      } else {
        showStatus(`No instruments extracted. ${errCount} error(s).`, 'error');
      }
    } catch (err: unknown) {
      showStatus(`Failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setIsProcessing(false);
      setProgress(null);
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

  async function exportToExcel() {
    if (rows.length === 0) {
      showStatus('No data to export', 'error');
      return;
    }

    setIsExporting(true);
    showStatus('Building formatted Excel file...', 'info');

    try {
      const sorted = getSorted(rows, sortField);

      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          abstractorName,
          propertyDescription,
          parcelNumber,
          acreage,
          district,
          county,
          sortField,
          rows: sorted,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Export failed (${res.status}): ${errText}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = (abstractorName || 'Abstractor').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${safeName}_RunSheet_${parcelNumber || 'NoParcel'}_sortedBy${sortField === 'recorded_date' ? 'RecordedDate' : 'DocDate'}.xlsx`;
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      const sortLabel = sortField === 'recorded_date' ? 'Recorded Date' : 'Doc Date';
      showStatus(`Exported ${filename} (sorted by ${sortLabel})`, 'success');
    } catch (err: unknown) {
      showStatus(`Export failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setIsExporting(false);
    }
  }

  const displayedRows = getSorted(rows, tableSort);

  return (
    <div className="container">

      
        href="/user-guide.html"
        target="_blank"
        rel="noopener noreferrer"
        title="Open User Guide"
        style={{
          position: 'fixed',
          top: '1.1rem',
          right: '1.25rem',
          zIndex: 1000,
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          background: '#1a1a2e',
          color: '#c9a84c',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Georgia, serif',
          fontWeight: '700',
          fontSize: '1.15rem',
          textDecoration: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.transform = 'scale(1.1)';
          (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(0,0,0,0.3)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
          (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)';
        }}
      >
        ?
      </a>

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

      {progress && (
        <div className="progress-bar-container">
          <div
            className="progress-bar"
            style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
          />
          <span className="progress-label">
            {progress.done} of {progress.total} files done
          </span>
        </div>
      )}

      {status && <div className={`status ${status.type}`}>{status.message}</div>}

      {errors.length > 0 && (
        <>
          <h2>Errors</h2>
          <ul>
            {errors.map((e, i) => (
              <li key={i}><strong>{e.file}</strong>: {e.error}</li>
            ))}
          </ul>
        </>
      )}

      {rows.length > 0 && (
        <>
          <h2>
            Review &amp; Edit Extracted Instruments
            <span style={{ fontSize: '0.85rem', fontWeight: 'normal', marginLeft: '1rem', color: '#555' }}>
              {rows.length} instrument(s) from {new Set(rows.map(r => r.source_file)).size} file(s)
              &nbsp;·&nbsp;
              <span style={{ color: '#2d6a2d' }}>■ High</span>&nbsp;
              <span style={{ color: '#8a6d00' }}>■ Medium</span>&nbsp;
              <span style={{ color: '#8a0000' }}>■ Low — review needed</span>
            </span>
          </h2>

          <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontWeight: 600 }}>Sort table by:</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
              <input type="radio" name="tableSort" value="recorded_date" checked={tableSort === 'recorded_date'} onChange={() => setTableSort('recorded_date')} />
              Recorded Date
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
              <input type="radio" name="tableSort" value="doc_date" checked={tableSort === 'doc_date'} onChange={() => setTableSort('doc_date')} />
              Doc Date
            </label>
          </div>

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
                  <th>⚠ Notes for Reviewer</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedRows.map((row, i) => (
                  <tr key={i} className={`conf-${row.confidence}`}>
                    <td>{row.source_file}</td>
                    <td><input value={row.vol_page} onChange={(e) => updateRow(rows.indexOf(row), 'vol_page', e.target.value)} /></td>
                    <td><input value={row.instrument_type} onChange={(e) => updateRow(rows.indexOf(row), 'instrument_type', e.target.value)} /></td>
                    <td><input value={row.doc_date} onChange={(e) => updateRow(rows.indexOf(row), 'doc_date', e.target.value)} /></td>
                    <td><input value={row.recorded_date} onChange={(e) => updateRow(rows.indexOf(row), 'recorded_date', e.target.value)} /></td>
                    <td><input value={row.grantor} onChange={(e) => updateRow(rows.indexOf(row), 'grantor', e.target.value)} /></td>
                    <td><input value={row.grantee} onChange={(e) => updateRow(rows.indexOf(row), 'grantee', e.target.value)} /></td>
                    <td><input value={row.description} onChange={(e) => updateRow(rows.indexOf(row), 'description', e.target.value)} /></td>
                    <td><input value={row.comments} onChange={(e) => updateRow(rows.indexOf(row), 'comments', e.target.value)} /></td>
                    <td>
                      <input
                        value={row.notes_for_reviewer}
                        onChange={(e) => updateRow(rows.indexOf(row), 'notes_for_reviewer', e.target.value)}
                        style={{ fontStyle: row.notes_for_reviewer ? 'italic' : 'normal', color: row.notes_for_reviewer ? '#8a0000' : 'inherit' }}
                        placeholder="—"
                      />
                    </td>
                    <td><button onClick={() => deleteRow(rows.indexOf(row))}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '1.5rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontWeight: 600 }}>Export sorted by:</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
              <input type="radio" name="exportSort" value="recorded_date" checked={sortField === 'recorded_date'} onChange={() => setSortField('recorded_date')} />
              Recorded Date
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
              <input type="radio" name="exportSort" value="doc_date" checked={sortField === 'doc_date'} onChange={() => setSortField('doc_date')} />
              Doc Date
            </label>
          </div>

          <button className="btn-export" onClick={exportToExcel} disabled={isProcessing || isExporting}>
            {isExporting ? 'Building Excel...' : 'Export to Excel'}
          </button>
        </>
      )}
    </div>
  );
}
