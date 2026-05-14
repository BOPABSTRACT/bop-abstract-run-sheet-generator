import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Oil & Gas Run Sheet Generator',
  description: 'BOP Abstract internal tool for runsheet generation',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background: #0f1117;
            font-family: 'Georgia', serif;
            color: #e8e0d0;
            min-height: 100vh;
          }
          .help-btn {
            color: #c8a96e;
            font-size: 13px;
            text-decoration: none;
            border: 1px solid #333;
            padding: 6px 14px;
            border-radius: 4px;
            letter-spacing: 0.04em;
            font-family: 'Georgia', serif;
          }
          .help-btn:hover { border-color: #c8a96e; }
          .section-block { margin-bottom: 40px; }
          .section-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
          }
          .section-num {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: rgba(200,169,110,0.15);
            border: 1px solid #c8a96e;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            color: #c8a96e;
            font-weight: 600;
            flex-shrink: 0;
          }
          .section-title {
            margin: 0;
            font-size: 17px;
            font-weight: 500;
            color: #e8e0d0;
            letter-spacing: 0.01em;
          }
          input[type="text"], textarea, input[type="file"] {
            width: 100%;
            padding: 12px 16px;
            background: #0f1117;
            border: 1px solid #2a2a3a;
            border-radius: 6px;
            color: #e8e0d0;
            font-size: 14px;
            font-family: 'Georgia', serif;
            outline: none;
          }
          input[type="text"]:focus, textarea:focus {
            border-color: #c8a96e;
          }
          textarea {
            resize: vertical;
            min-height: 80px;
          }
          .form-group { margin-bottom: 16px; }
          label {
            display: block;
            margin-bottom: 6px;
            font-size: 13px;
            color: #888;
            letter-spacing: 0.06em;
            text-transform: uppercase;
          }
          .form-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
          }
          .button-group { display: flex; gap: 12px; }
          .btn-demo {
            flex: 1;
            padding: 14px 12px;
            border-radius: 6px;
            border: 1px solid #2a2a3a;
            background: #0d0f14;
            color: #888;
            cursor: pointer;
            font-size: 14px;
            font-family: 'Georgia', serif;
            letter-spacing: 0.04em;
          }
          .btn-demo:hover:not(:disabled) { border-color: #c8a96e; color: #c8a96e; }
          .btn-real {
            flex: 2;
            padding: 14px 32px;
            background: linear-gradient(135deg, #c8a96e, #8b6914);
            color: #fff;
            border: none;
            border-radius: 6px;
            font-size: 15px;
            font-family: 'Georgia', serif;
            letter-spacing: 0.04em;
            cursor: pointer;
          }
          .btn-real:disabled { background: #2a2a3a; color: #666; cursor: not-allowed; }
          .btn-export {
            width: 100%;
            padding: 16px 32px;
            background: linear-gradient(135deg, #c8a96e, #8b6914);
            color: #fff;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            font-family: 'Georgia', serif;
            letter-spacing: 0.04em;
            cursor: pointer;
            margin-top: 16px;
          }
          .btn-export:disabled { background: #2a2a3a; color: #666; cursor: not-allowed; }
          button:disabled { opacity: 0.6; cursor: not-allowed; }
          .status {
            margin-top: 16px;
            padding: 12px 16px;
            border-radius: 6px;
            font-size: 14px;
          }
          .status.success { background: rgba(60,180,100,0.1); border: 1px solid #2a6640; color: #70c090; }
          .status.error { background: rgba(200,60,60,0.1); border: 1px solid #8b2020; color: #e07070; }
          .status.info { background: rgba(200,169,110,0.08); border: 1px solid #4a3a1a; color: #c8a96e; }
          .progress-bar-container {
            margin-top: 12px;
            background: #1a1a2a;
            border-radius: 4px;
            height: 24px;
            position: relative;
            overflow: hidden;
          }
          .progress-bar {
            height: 100%;
            background: linear-gradient(135deg, #c8a96e, #8b6914);
            border-radius: 4px;
            transition: width 0.3s ease;
          }
          .progress-label {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 11px;
            font-weight: bold;
            color: #e8e0d0;
          }
          .results-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin-top: 16px;
          }
          .results-table th {
            background: #0d0f14;
            color: #c8a96e;
            padding: 8px 10px;
            text-align: left;
            font-weight: 500;
            font-size: 11px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            border-bottom: 1px solid #2a2a3a;
            white-space: nowrap;
          }
          .results-table td {
            border-bottom: 1px solid #1a1a2a;
            padding: 4px 2px;
            vertical-align: top;
          }
          .results-table input {
            width: 100%;
            border: none;
            background: transparent;
            font-size: 12px;
            padding: 4px 6px;
            font-family: 'Georgia', serif;
            color: #e8e0d0;
          }
          .results-table input:focus {
            background: rgba(200,169,110,0.08);
            outline: 1px solid #c8a96e;
            border-radius: 3px;
          }
          .conf-high { background: rgba(60,180,100,0.06); }
          .conf-medium { background: rgba(200,169,110,0.06); }
          .conf-low { background: rgba(200,60,60,0.06); }
          .results-table button {
            padding: 3px 8px;
            font-size: 11px;
            background: transparent;
            color: #e07070;
            border: 1px solid #8b2020;
            border-radius: 3px;
            cursor: pointer;
            font-family: 'Georgia', serif;
          }
          .results-table button:hover { background: rgba(200,60,60,0.1); }
          .upload-box {
            border: 2px dashed #2a2a3a;
            border-radius: 8px;
            padding: 24px;
            text-align: center;
            cursor: pointer;
            background: #0d0f14;
            transition: all 0.2s;
          }
          .upload-box:hover { border-color: #c8a96e; }
          .upload-box.has-file { border-color: #c8a96e; background: rgba(200,169,110,0.04); }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
