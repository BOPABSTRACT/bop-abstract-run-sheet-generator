import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Oil & Gas Run Sheet Generator',
  description: 'BOP Abstract internal tool for runsheet generation',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <style>{`
          * { box-sizing: border-box; }
          body {
            background: linear-gradient(135deg, #D97706 0%, #1F2937 100%);
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            min-height: 100vh;
          }
          .container {
            max-width: 1100px;
            margin: 0 auto;
            background: #F3F4F6;
            padding: 30px;
            border-radius: 8px;
          }
          h1 {
            color: #D97706;
            text-align: center;
            margin-bottom: 30px;
          }
          h2 {
            color: #1F2937;
            margin-top: 30px;
            margin-bottom: 15px;
          }
          .form-group {
            margin-bottom: 20px;
          }
          label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
            color: #1F2937;
          }
          input[type="text"], textarea, input[type="file"] {
            width: 100%;
            padding: 10px;
            border: 1px solid #D97706;
            border-radius: 4px;
            font-size: 14px;
            font-family: Arial, sans-serif;
          }
          textarea {
            resize: vertical;
            min-height: 80px;
          }
          .button-group {
            display: flex;
            gap: 10px;
            margin-top: 30px;
          }
          button {
            flex: 1;
            padding: 12px;
            font-size: 16px;
            font-weight: bold;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-family: Arial, sans-serif;
          }
          button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          .btn-demo { background: #D97706; color: white; }
          .btn-demo:hover:not(:disabled) { background: #B45309; }
          .btn-real { background: #1F2937; color: white; }
          .btn-real:hover:not(:disabled) { background: #111827; }
          .btn-export { background: #059669; color: white; }
          .btn-export:hover:not(:disabled) { background: #047857; }
          .status {
            margin-top: 20px;
            padding: 15px;
            border-radius: 4px;
          }
          .status.success { background: #D1FAE5; color: #065F46; }
          .status.error { background: #FEE2E2; color: #991B1B; }
          .status.info { background: #DBEAFE; color: #1E40AF; }
          .results-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            font-size: 12px;
          }
          .results-table th {
            background: #1F2937;
            color: white;
            padding: 8px;
            text-align: left;
            font-weight: bold;
          }
          .results-table td {
            border: 1px solid #D1D5DB;
            padding: 4px;
            vertical-align: top;
          }
          .results-table textarea {
            width: 100%;
            border: none;
            background: transparent;
            font-size: 12px;
            min-height: 30px;
            padding: 4px;
          }
          .results-table textarea:focus {
            background: #FEF3C7;
            outline: 1px solid #D97706;
          }
          .conf-high { background: #D1FAE5; }
          .conf-medium { background: #FEF3C7; }
          .conf-low { background: #FEE2E2; }
          .row-actions {
            white-space: nowrap;
          }
          .btn-small {
            padding: 4px 8px;
            font-size: 11px;
            background: #DC2626;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
