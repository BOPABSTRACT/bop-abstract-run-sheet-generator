import React, { useState, useRef } from ‘react’;
import { Upload, FileText, Download, AlertCircle, Loader } from ‘lucide-react’;

const RunSheetGenerator = () => {
const [files, setFiles] = useState([]);
const [processing, setProcessing] = useState(false);
const [error, setError] = useState(’’);
const [success, setSuccess] = useState(’’);
const fileInputRef = useRef(null);
const [metadata, setMetadata] = useState({
abstractorName: ‘’,
dueDate: ‘’,
propertyDescription: ‘’,
currentParcelNo: ‘’,
acreage: ‘’,
district: ‘’,
county: ‘’,
state: ‘West Virginia’
});

const handleFileSelect = (event) => {
const selectedFiles = Array.from(event.target.files);
setFiles([…files, …selectedFiles]);
setError(’’);
};

const removeFile = (index) => {
setFiles(files.filter((_, i) => i !== index));
};

const handleMetadataChange = (field, value) => {
setMetadata(prev => ({
…prev,
[field]: value
}));
};

const processDocuments = async () => {
if (files.length === 0) {
setError(‘Please select at least one document’);
return;
}

```
if (!metadata.abstractorName || !metadata.propertyDescription) {
  setError('Please fill in Abstractor Name and Property Description');
  return;
}

setProcessing(true);
setError('');
setSuccess('');

try {
  // Convert files to base64
  const documentData = [];
  for (const file of files) {
    const base64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(file);
    });
    documentData.push({
      filename: file.name,
      base64: base64
    });
  }

  // Call Claude API to extract information
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are an expert oil and gas title abstractor. Extract information from these public records documents and return it in JSON format for creating a title opinion run sheet.
```

For each document found, extract:

- VOL/PAGE (recording volume and page)
- Instrument Type (e.g., General Warranty Deed, Special Warranty Deed, Mortgage, Assignment, etc.)
- Doc. Date (document date)
- Recorded Date (recording date)
- Grantor (person/entity conveying property)
- Grantee (person/entity receiving property)
- Description (property description from document)
- Comments (any reservations, exceptions, or important notes)

Return ONLY valid JSON in this exact format:
{
“documents”: [
{
“volPage”: “DB 1094/697”,
“instrumentType”: “General Warranty Deed”,
“docDate”: “8/8/2011”,
“recordedDate”: “8/23/2011”,
“grantor”: “Name”,
“grantee”: “Name”,
“description”: “Description text”,
“comments”: “Any notes”
}
]
}

If you cannot find information for a field, use null. Organize documents in chronological order (most recent first).`
},
…documentData.map(doc => ({
type: ‘document’,
source: {
type: ‘base64’,
media_type: ‘application/pdf’,
data: doc.base64
}
}))
]
}
]
})
});

```
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error?.message || 'API error');
  }

  // Parse Claude's response
  let extractedData;
  try {
    const jsonStr = data.content[0].text;
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    extractedData = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('Parse error:', e);
    throw new Error('Failed to parse extracted data');
  }

  // Generate Excel file
  await generateExcelFile(extractedData.documents);
  setSuccess('Run sheet generated successfully!');
  
} catch (err) {
  setError(err.message || 'Failed to process documents');
  console.error('Error:', err);
} finally {
  setProcessing(false);
}
```

};

const generateExcelFile = async (documents) => {
// Dynamically import ExcelJS
const script = document.createElement(‘script’);
script.src = ‘https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js’;
script.onload = async () => {
const ExcelJS = window.ExcelJS;
const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet(‘Run Sheet’);

```
  // Set column widths
  worksheet.columns = [
    { header: 'VOL/PAGE', key: 'volPage', width: 15 },
    { header: 'Instrument Type', key: 'instrumentType', width: 20 },
    { header: 'Doc. Date Recorded Date', key: 'dates', width: 25 },
    { header: 'Grantor', key: 'grantor', width: 35 },
    { header: 'Grantee', key: 'grantee', width: 35 },
    { header: 'Description', key: 'description', width: 50 },
    { header: 'Comments', key: 'comments', width: 40 }
  ];

  // Add title row
  const titleRow = worksheet.insertRow(1, {
    volPage: `RUN SHEET - ${metadata.abstractorName} - CHAIN OF TITLE`
  });
  titleRow.font = { bold: true, size: 14 };

  // Add metadata rows
  const metaRow2 = worksheet.insertRow(2, {
    volPage: 'Abstractor Name:',
    instrumentType: metadata.abstractorName,
    dates: 'Due Date:',
    grantor: metadata.dueDate
  });
  metaRow2.font = { bold: true };

  const descRow = worksheet.insertRow(
    3,
    {
      volPage: `Description: ${metadata.propertyDescription}\nCurrent Parcel Nos.: ${metadata.currentParcelNo}    Current Acreage: ${metadata.acreage}    District: ${metadata.district}    County: ${metadata.county}    State: ${metadata.state}`
    }
  );

  // Add document rows
  documents.forEach((doc, index) => {
    worksheet.insertRow(4 + index, {
      volPage: doc.volPage,
      instrumentType: doc.instrumentType,
      dates: `${doc.docDate}\n${doc.recordedDate}`,
      grantor: doc.grantor,
      grantee: doc.grantee,
      description: doc.description,
      comments: doc.comments
    });
  });

  // Format cells
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.alignment = { wrapText: true, vertical: 'top' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  });

  // Save file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${metadata.abstractorName}_RunSheet_${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
document.head.appendChild(script);
```

};

return (
<div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
<div className="max-w-4xl mx-auto">
{/* Header */}
<div className="text-center mb-8">
<h1 className="text-4xl font-bold text-white mb-2">Oil & Gas Title Run Sheet Generator</h1>
<p className="text-slate-400">Automatically extract document data and generate professional run sheets</p>
</div>

```
    <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl overflow-hidden">
      {/* Metadata Section */}
      <div className="bg-slate-750 border-b border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Run Sheet Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Abstractor Name *</label>
            <input
              type="text"
              value={metadata.abstractorName}
              onChange={(e) => handleMetadataChange('abstractorName', e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              placeholder="e.g., Joseph Orlando"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Due Date</label>
            <input
              type="text"
              value={metadata.dueDate}
              onChange={(e) => handleMetadataChange('dueDate', e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              placeholder="e.g., N/A"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-1">Property Description *</label>
            <input
              type="text"
              value={metadata.propertyDescription}
              onChange={(e) => handleMetadataChange('propertyDescription', e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              placeholder="e.g., Tract of land situated in Mannington District"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Parcel No.</label>
            <input
              type="text"
              value={metadata.currentParcelNo}
              onChange={(e) => handleMetadataChange('currentParcelNo', e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              placeholder="e.g., 12-22-7"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Acreage</label>
            <input
              type="text"
              value={metadata.acreage}
              onChange={(e) => handleMetadataChange('acreage', e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              placeholder="e.g., 16.4"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">District</label>
            <input
              type="text"
              value={metadata.district}
              onChange={(e) => handleMetadataChange('district', e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              placeholder="e.g., Mannington District"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">County</label>
            <input
              type="text"
              value={metadata.county}
              onChange={(e) => handleMetadataChange('county', e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              placeholder="e.g., Marion"
            />
          </div>
        </div>
      </div>

      {/* File Upload Section */}
      <div className="p-6 border-b border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">Upload Documents</h2>
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
        >
          <Upload className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-white font-medium">Click to upload PDF documents</p>
          <p className="text-slate-400 text-sm mt-1">or drag and drop them here</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-slate-300 mb-2">Selected Files ({files.length})</h3>
            <div className="space-y-2">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-slate-700 p-3 rounded"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-white">{file.name}</span>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-900/20 border border-red-700 rounded flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Success Alert */}
      {success && (
        <div className="mx-6 mt-4 p-4 bg-green-900/20 border border-green-700 rounded flex gap-3">
          <Download className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          <p className="text-green-300 text-sm">{success}</p>
        </div>
      )}

      {/* Action Button */}
      <div className="p-6 bg-slate-750">
        <button
          onClick={processDocuments}
          disabled={processing || files.length === 0}
          className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
        >
          {processing ? (
            <>
              <Loader className="w-5 h-5 animate-spin" />
              Processing Documents...
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              Generate Run Sheet
            </>
          )}
        </button>
        <p className="text-center text-slate-400 text-xs mt-3">
          {processing && 'Extracting document data using AI...'}
          {!processing && files.length === 0 && 'Select documents to begin'}
        </p>
      </div>
    </div>

    {/* Instructions */}
    <div className="mt-8 bg-slate-800 border border-slate-700 rounded-lg p-6">
      <h3 className="text-white font-semibold mb-3">How to Use</h3>
      <ol className="text-slate-300 text-sm space-y-2 list-decimal list-inside">
        <li>Fill in the run sheet information (Abstractor Name, Property Description, etc.)</li>
        <li>Upload all public records documents as PDFs (deeds, assignments, mortgages, etc.)</li>
        <li>Click "Generate Run Sheet" to process documents with AI extraction</li>
        <li>The system will create a properly formatted Excel run sheet and download automatically</li>
        <li>Review the extracted information and make any necessary edits before sending to the attorney</li>
      </ol>
    </div>
  </div>
</div>
```

);
};

export default RunSheetGenerator;
