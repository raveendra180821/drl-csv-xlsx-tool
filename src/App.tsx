/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileText, 
  Download, 
  Copy, 
  RefreshCw, 
  Check, 
  FileUp,
  AlertCircle,
  Play,
  CheckCircle2,
  XCircle,
  X,
  FileSpreadsheet,
  Loader2,
  FileCode
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---

interface RuleData {
  workflowStep: string;
  label: string;
  referenceID: string;
  state: string;
  step: string;
  rejected: string;
}

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDownload: (filename: string, format: 'csv' | 'xlsx') => void;
  initialFilename: string;
}

// --- Components ---

const DownloadModal: React.FC<DownloadModalProps> = ({ isOpen, onClose, onDownload, initialFilename }) => {
  const [filename, setFilename] = useState(initialFilename);
  const [format, setFormat] = useState<'csv' | 'xlsx'>('csv');

  useEffect(() => {
    if (isOpen) setFilename(initialFilename);
  }, [isOpen, initialFilename]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-xl font-bold">Download Results</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Filename</label>
            <div className="relative">
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 pr-16"
                placeholder="Enter filename"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">.{format}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Select Format</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setFormat('csv')}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all font-bold ${format === 'csv' ? 'border-black bg-black text-white' : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200'}`}
              >
                <FileText size={18} /> CSV
              </button>
              <button
                onClick={() => setFormat('xlsx')}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all font-bold ${format === 'xlsx' ? 'border-black bg-black text-white' : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200'}`}
              >
                <FileSpreadsheet size={18} /> Excel
              </button>
            </div>
          </div>
        </div>
        <div className="p-6 bg-gray-50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl font-bold hover:bg-gray-100 transition-all active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={() => onDownload(filename, format)}
            className="flex-1 px-4 py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg active:scale-95"
          >
            Download
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [fileStats, setFileStats] = useState<{ size: string; count: number } | null>(null);
  const [input, setInput] = useState('');
  const [results, setResults] = useState<RuleData[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  // --- Logic ---

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith('.drl')) {
      setError('Invalid file type. Please upload a .drl file.');
      setFile(null);
      setInput('');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setResults([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setInput(content);

      // Count rule blocks to show in upload stage
      const ruleBlockRegex = /rule\s+"([^"]+)"[\s\S]*?globalList\.add\(RuleUtil\.getMap\("([\s\S]*?)"\)\);[\s\S]*?end/g;
      const count = (content.match(ruleBlockRegex) || []).length;
      
      // Format file size
      const sizeStr = selectedFile.size > 1024 * 1024 
        ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB` 
        : `${(selectedFile.size / 1024).toFixed(2)} KB`;

      setFileStats({ size: sizeStr, count });
    };
    reader.readAsText(selectedFile);
    
    // Reset input value to allow re-uploading the same file
    e.target.value = '';
  };

  const parseDRL = () => {
    if (!input.trim()) {
      setError('No content to parse.');
      return;
    }

    setIsConverting(true);
    setError(null);

    // Simulate processing time
    setTimeout(() => {
      try {
        const extractedData: RuleData[] = [];
        
        // Regex to find rule blocks: rule "..." ... end
        const ruleBlockRegex = /rule\s+"([^"]+)"[\s\S]*?globalList\.add\(RuleUtil\.getMap\("([\s\S]*?)"\)\);[\s\S]*?end/g;
        let match;

        while ((match = ruleBlockRegex.exec(input)) !== null) {
          const ruleName = match[1];
          let jsonString = match[2];

          try {
            // Unescape the JSON string (it's escaped in the DRL)
            // Replace \" with "
            const unescapedJson = jsonString.replace(/\\"/g, '"');
            const jsonData = JSON.parse(unescapedJson);

            const step = jsonData.step || '';
            const state = jsonData.state || '';
            const workflowStepId = jsonData.workflowStepId || '';
            const rejected = jsonData.rejected !== undefined ? String(jsonData.rejected) : '';

            // Concatenate state and step as "state | step"
            let label = '';
            if (state && step) {
              label = `${state} | ${step}`;
            } else {
              label = state || step;
            }

            extractedData.push({
              workflowStep: ruleName,
              label: label,
              referenceID: workflowStepId,
              state: state,
              step: step,
              rejected: rejected
            });
          } catch (jsonErr) {
            console.warn(`Failed to parse JSON for rule: ${ruleName}`, jsonErr);
            // Skip invalid rules
          }
        }

        if (extractedData.length === 0) {
          setError('No valid rule data found in the uploaded file.');
        } else {
          setResults(extractedData);
          // Auto-scroll to results
          setTimeout(() => {
            resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);
        }
      } catch (err) {
        setError('An unexpected error occurred during parsing.');
        console.error(err);
      } finally {
        setIsConverting(false);
      }
    }, 800);
  };

  const generateCSV = () => {
    const header = 'Workflow_step,label,referenceID\n';
    const rows = results.map(r => {
      const escape = (str: string) => `"${str.replace(/"/g, '""')}"`;
      return `${escape(r.workflowStep)},${escape(r.label)},${escape(r.referenceID)}`;
    }).join('\n');
    return header + rows;
  };

  const handleDownload = (filename: string, format: 'csv' | 'xlsx') => {
    if (format === 'csv') {
      const csv = generateCSV();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // Create an array of arrays (AOA) with 8 empty rows, then headers, then data
      const data = [
        [], [], [], [], [], [], [], [], // Rows 1-8: Empty
        ["NAME", "POSSIBLE NEXT STEP"], // Row 9: Header
        ...results.map(r => [
          r.workflowStep, 
          `"${r.state}","${r.step}","${r.rejected}","${r.referenceID}"`
        ]) // Row 10 onwards: Data
      ];
      
      const worksheet = XLSX.utils.aoa_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Rules");
      XLSX.writeFile(workbook, `${filename}.xlsx`);
    }
    setIsModalOpen(false);
  };

  const copyToClipboard = () => {
    const csv = generateCSV();
    navigator.clipboard.writeText(csv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => {
    setFile(null);
    setFileStats(null);
    setInput('');
    setResults([]);
    setError(null);
    setIsModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#1a1a1a] font-sans p-4 md:p-8 selection:bg-black selection:text-white">
      <div className="max-w-5xl mx-auto">
        {/* Header Section */}
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-2 bg-black text-white rounded-full text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">
              <FileSpreadsheet size={11} /> <span className="pt-1">Tool</span>
            </div>
            <h1 className="text-5xl font-black tracking-tighter">DRL <span className="text-gray-300">to</span> CSV</h1>
            <p className="text-gray-500 font-small mt-4">Extract workflow_step, Label & referenceID with precision.</p>
          </div>
          <button 
            onClick={reset}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-bold hover:bg-gray-50 transition-all active:scale-95 shadow-sm"
          >
            <RefreshCw size={18} className="text-red-500" /> Reset Tool
          </button>
        </header>

        <main className="space-y-8">
          {/* Upload Card */}
          <section className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-black/[0.02] relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <FileUp size={120} />
            </div>
            
            <div className="relative z-10">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-6 ml-2">Upload Source</h2>
              
              <div className="flex flex-col md:flex-row items-center gap-6">
                <label className={`
                  flex-1 w-full cursor-pointer flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-[2rem] transition-all
                  ${file ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-gray-50/50 hover:bg-gray-50 hover:border-gray-300'}
                `}>
                  <input type="file" className="hidden" accept=".drl" onChange={handleFileUpload} />
                  {file ? (
                    <div className="flex flex-col items-center text-center">
                      <div className="w-16 h-16 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
                        <CheckCircle2 size={32} />
                      </div>
                      <span className="text-lg font-bold text-gray-800">{file.name}</span>
                      <span className="text-xs text-green-600 font-bold mt-1 uppercase tracking-wider">File Ready</span>
                      {fileStats && (
                        <div className="mt-3 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-gray-400 bg-white/50 px-4 py-2 rounded-full border border-green-100 shadow-sm">
                          <span className="flex items-center gap-1.5">
                            <div className="w-1 h-1 bg-green-400 rounded-full" />
                            {fileStats.size}
                          </span>
                          <div className="w-px h-2 bg-gray-200" />
                          <span className="flex items-center gap-1.5">
                            <div className="w-1 h-1 bg-green-400 rounded-full" />
                            {fileStats.count} Steps Found
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center">
                      <div className="w-16 h-16 bg-white text-gray-400 rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-gray-100">
                        <FileUp size={32} />
                      </div>
                      <span className="text-lg font-bold text-gray-800">Choose .drl file</span>
                      <span className="text-sm text-gray-400 mt-1">Drag and drop or click to browse</span>
                    </div>
                  )}
                </label>

                <div className="hidden md:flex flex-col items-center gap-2 text-gray-300">
                  <div className="w-px h-12 bg-gray-200" />
                  <span className="text-[10px] font-black uppercase">OR</span>
                  <div className="w-px h-12 bg-gray-200" />
                </div>

                <div className="w-full md:w-auto">
                  <button
                    onClick={parseDRL}
                    disabled={!file || isConverting}
                    className={`
                      w-full md:w-auto flex items-center justify-center gap-3 px-12 py-6 rounded-[2rem] font-black text-lg transition-all shadow-2xl active:scale-95
                      ${!file || isConverting 
                        ? 'bg-gray-100 text-gray-300 cursor-not-allowed shadow-none' 
                        : 'bg-black text-white hover:bg-gray-800 shadow-black/20 hover:shadow-black/40'}
                    `}
                  >
                    {isConverting ? (
                      <Loader2 size={24} className="animate-spin" />
                    ) : (
                      <Play size={24} fill="currentColor" />
                    )}
                    {isConverting ? 'Parsing...' : 'Convert to CSV'}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Error Alert */}
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-red-50 border border-red-100 p-6 rounded-3xl flex items-center gap-4 text-red-800"
              >
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <h4 className="font-bold">Parsing Error</h4>
                  <p className="text-sm opacity-80">{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results Section */}
          <AnimatePresence>
            {results.length > 0 && (
              <motion.section 
                ref={resultsRef}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-black/[0.03] overflow-hidden"
              >
                <div className="p-8 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Step 02: Output Preview</h2>
                    <h3 className="text-2xl font-bold">{results.length} Rules Extracted</h3>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={copyToClipboard}
                      className="flex items-center gap-2 px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold hover:bg-gray-100 transition-all active:scale-95"
                    >
                      {copied ? <Check size={18} className="text-green-600" /> : <Copy size={18} />}
                      {copied ? 'Copied' : 'Copy CSV'}
                    </button>
                    <button 
                      onClick={() => setIsModalOpen(true)}
                      className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-2xl text-sm font-bold hover:bg-gray-800 transition-all shadow-lg active:scale-95"
                    >
                      <Download size={18} /> Download
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50/50 sticky top-0 backdrop-blur-md z-10">
                      <tr>
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">Workflow_step</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">label</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">referenceID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {results.map((rule, idx) => (
                        <tr key={idx} className="group hover:bg-gray-50/30 transition-colors">
                          <td className="px-8 py-5 text-sm font-bold text-gray-800 max-w-md truncate group-hover:text-black">
                            {rule.workflowStep}
                          </td>
                          <td className="px-8 py-5 text-sm font-medium text-gray-500">
                            <span className="px-3 py-1 bg-gray-100 rounded-lg text-[11px] font-bold uppercase tracking-wider text-gray-600">
                              {rule.label}
                            </span>
                          </td>
                          <td className="px-8 py-5 text-sm font-mono text-gray-400 group-hover:text-gray-600 transition-colors">
                            {rule.referenceID}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </main>

        <footer className="mt-20 pb-12 border-t border-gray-100 pt-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3 text-gray-400">
            <FileSpreadsheet size={20} />
            <span className="text-xs font-bold uppercase tracking-widest">DRL to CSV Professional v1.2</span>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300">
            Secure Local Processing &bull; No Data Leaves Your Browser
          </p>
        </footer>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <DownloadModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onDownload={handleDownload}
            initialFilename={file ? file.name.replace('.drl', '') : 'converted_rules'}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
