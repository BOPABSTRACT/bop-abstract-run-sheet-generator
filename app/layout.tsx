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
          .results-table input {
            width: 100%;
            border: none;
            background: transparent;
            font-size: 12px;
            padding: 4px;
            font-family: Arial, sans-serif;
          }
          .results-table input:focus {
            background: #FEF3C7;
            outline: 1px solid #D97706;
          }
          .conf-high { background: #D1FAE5; }
          .conf-medium { background: #FEF3C7; }
          .conf-low { background: #FEE2E2; }
          .btn-small {
            padding: 4px 8px;
            font-size: 11px;
            background: #DC2626;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
          }
          .progress-bar-container {
            margin-top: 15px;
            background: #E5E7EB;
            border-radius: 4px;
            height: 24px;
            position: relative;
            overflow: hidden;
          }
          .progress-bar {
            height: 100%;
            background: #D97706;
            border-radius: 4px;
            transition: width 0.3s ease;
          }
          .progress-label {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 12px;
            font-weight: bold;
            color: #1F2937;
          }
          .help-btn {
            position: fixed;
            top: 1.1rem;
            right: 1.25rem;
            z-index: 1000;
            width: 42px;
            height: 42px;
            border-radius: 50%;
            background: #1F2937;
            color: #D97706;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: Georgia, serif;
            font-weight: 700;
            font-size: 1.2rem;
            text-decoration: none;
            box-shadow: 0 2px 8px rgba(0,0,0,0.25);
            transition: transform 0.15s, box-shadow 0.15s;
          }
          .help-btn:hover {
            transform: scale(1.1);
            box-shadow: 0 4px 14px rgba(0,0,0,0.35);
            background: #D97706;
            color: #1F2937;
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
