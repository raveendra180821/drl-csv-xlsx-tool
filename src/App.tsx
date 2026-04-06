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
  Trash2, 
  Check, 
  FileUp,
  AlertCircle,
  Play,
  CheckCircle2,
  XCircle,
  X,
  FileSpreadsheet,
  Loader2,
  FileCode,
  Tags,
  ArrowLeft,
  RotateCcw,
  RefreshCw,
  Type
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FormattedLabelsTool } from './components/FormattedLabelsTool';
import { CapitalizeRefIDsTool } from './components/CapitalizeRefIDsTool';

// --- Types ---

interface RuleData {
  workflowStep: string;
  label: string;
  referenceID: string;
  state: string;
  step: string;
  rejected: boolean | string;
  extractedCurrentState?: string;
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
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100"
      >
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-900">Download Results</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 cursor-pointer">
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
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 text-gray-900 pr-16"
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
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all font-bold cursor-pointer ${format === 'csv' ? 'border-blue-700 bg-blue-700 text-white' : 'border-gray-100 bg-blue-50 text-gray-400 hover:border-gray-200 hover:bg-gray-100 hover:text-gray-600'}`}
              >
                <FileText size={18} /> CSV
              </button>
              <button
                onClick={() => setFormat('xlsx')}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all font-bold cursor-pointer ${format === 'xlsx' ? 'border-blue-700 bg-blue-700 text-white' : 'border-gray-100 bg-blue-50 text-gray-400 hover:border-gray-200 hover:bg-gray-100 hover:text-gray-600'}`}
              >
                <FileSpreadsheet size={18} /> Excel
              </button>
            </div>
          </div>
        </div>
        <div className="p-6 bg-gray-50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-transparent text-gray-400 rounded-xl font-bold hover:bg-gray-100 hover:text-gray-600 transition-all active:scale-95 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => onDownload(filename, format)}
            className="flex-1 px-4 py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-all shadow-xl active:scale-95 cursor-pointer"
          >
            Download
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default function App() {
  const [view, setView] = useState<'home' | 'drl-to-csv' | 'formatted-labels' | 'capitalize-ref-ids'>('home');
  const [file, setFile] = useState<File | null>(null);
  const [fileStats, setFileStats] = useState<{ size: string; count: number } | null>(null);
  const [input, setInput] = useState('');
  const [results, setResults] = useState<RuleData[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formattedLabelsResetCounter, setFormattedLabelsResetCounter] = useState(0);
  const [capitalizeRefIdsResetCounter, setCapitalizeRefIdsResetCounter] = useState(0);

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
      // Capture rule name, content between name and globalList.add (includes 'when' block), and the JSON string
      const ruleBlockRegex = /rule\s+"([^"]+)"([\s\S]*?)globalList\.add\(RuleUtil\.getMap\("([\s\S]*?)"\)\);[\s\S]*?end/g;
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
        // Capture rule name, content between name and globalList.add (includes 'when' block), and the JSON string
        const ruleBlockRegex = /rule\s+"([^"]+)"([\s\S]*?)globalList\.add\(RuleUtil\.getMap\("([\s\S]*?)"\)\);[\s\S]*?end/g;
        let match;

        while ((match = ruleBlockRegex.exec(input)) !== null) {
          const ruleName = match[1];
          const ruleContent = match[2];
          let jsonString = match[3];

          try {
            // Extract currentState from the 'when' block (ruleContent)
            const currentStateMatch = ruleContent.match(/currentState\s*==\s*"([^"]+)"/);
            const extractedCurrentState = currentStateMatch ? currentStateMatch[1] : '';

            // Unescape the JSON string (it's escaped in the DRL)
            // Replace \" with "
            const unescapedJson = jsonString.replace(/\\"/g, '"');
            const jsonData = JSON.parse(unescapedJson);

            const step = jsonData.step || '';
            const state = jsonData.state || '';
            const workflowStepId = jsonData.workflowStepId || '';
            const rejected = jsonData.rejected !== undefined ? jsonData.rejected : '';

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
              rejected: rejected,
              extractedCurrentState: extractedCurrentState
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
        ["NAME", "CURRENT STATE", "POSSIBLE NEXT STEP"], // Row 9: Header
        ...results.map(r => [
          r.workflowStep, 
          r.extractedCurrentState || '',
          `"${r.state}","${r.step}",${r.rejected},"${r.referenceID}"`
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

  const resetApp = () => {
    window.location.reload();
  };

  const resetTool = () => {
    if (view === 'drl-to-csv') {
      setFile(null);
      setFileStats(null);
      setInput('');
      setResults([]);
      setError(null);
      setIsModalOpen(false);
    } else if (view === 'formatted-labels') {
      setFormattedLabelsResetCounter(prev => prev + 1);
    } else if (view === 'capitalize-ref-ids') {
      setCapitalizeRefIdsResetCounter(prev => prev + 1);
    }
  };

  const handleBackToHome = () => {
    setView('home');
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen font-sans p-4 md:p-8 bg-[#f8f9fa] text-[#1a1a1a] selection:bg-black selection:text-white"
    >
      <div className="max-w-5xl mx-auto relative">
        {/* Header Section */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12"
        >
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 bg-black text-white">
              {view === 'home' ? <RefreshCw className='mb-0.5' size={12} /> : view === 'drl-to-csv' ? <FileSpreadsheet className='mb-0.5' size={12} /> : view === 'formatted-labels' ? <Tags className='mb-0.5' size={12} /> : <Type className='mb-0.5' size={12} />}
              <span className='mt-0.5'>{view === 'home' ? 'Tool Selection' : view === 'drl-to-csv' ? 'DRL Tool' : view === 'formatted-labels' ? 'Labels Tool' : 'Capitalize Tool'}</span>
            </div>
            <h1 className="tracking-tighter leading-none text-5xl font-black">
              {view === 'home' ? (
                <>Select <span className="text-gray-300">a</span> Tool</>
              ) : view === 'drl-to-csv' ? (
                <>DRL <span className="text-gray-300">to</span> <span className="text-4xl">CSV<span className="text-gray-300">{' '}∕{' '}</span>XML</span></>
              ) : view === 'formatted-labels' ? (
                <>Formatted <span className="text-gray-300">Labels</span></>
              ) : (
                <>Capitalize <span className="text-gray-300">IDs</span></>
              )}
            </h1>
            <p className="font-medium text-gray-500">
              {view === 'home'
                ? 'Choose the specialized tool you need for your workflow.'
                : view === 'drl-to-csv' 
                  ? 'Extract workflow steps and metadata with precision.' 
                  : view === 'formatted-labels' 
                    ? 'Extract and format labels based on Reference IDs.' 
                    : 'Normalize quotes and capitalize Reference IDs in Excel.'}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setView('drl-to-csv')}
              className={`flex items-center gap-2 px-4 py-3 rounded-2xl transition-all shadow-sm cursor-pointer ${
                view === 'drl-to-csv' 
                  ? 'bg-black text-white'
                  : 'bg-white border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <FileSpreadsheet size={18} className={view === 'drl-to-csv' ? '' : 'text-blue-600'} />
              <span className={`text-xs font-bold ${view === 'drl-to-csv' ? '' : 'text-gray-600'}`}>
                DRL Tool
              </span>
            </motion.button>

            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setView('formatted-labels')}
              className={`flex items-center gap-2 px-4 py-3 rounded-2xl transition-all shadow-sm cursor-pointer ${
                view === 'formatted-labels' 
                  ? 'bg-black text-white'
                  : 'bg-white border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Tags size={18} className={view === 'formatted-labels' ? '' : 'text-blue-600'} />
              <span className={`text-xs font-bold ${view === 'formatted-labels' ? '' : 'text-gray-600'}`}>
                Labels Tool
              </span>
            </motion.button>

            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setView('capitalize-ref-ids')}
              className={`flex items-center gap-2 px-4 py-3 rounded-2xl transition-all shadow-sm cursor-pointer ${
                view === 'capitalize-ref-ids' 
                  ? 'bg-black text-white'
                  : 'bg-white border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Type size={15} className={view === 'capitalize-ref-ids' ? '' : 'text-blue-600'} />
              <span className={`text-xs font-bold pt-0.5 ${view === 'capitalize-ref-ids' ? '' : 'text-gray-600'}`}>
                Capitalize Tool
              </span>
            </motion.button>

            <div className="w-px h-8 mx-1 bg-gray-200" />

            <AnimatePresence>
              {view === 'home' && (
                <motion.button 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={resetApp}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all shadow-sm cursor-pointer bg-red-50 border border-red-100 text-red-600 hover:bg-red-100"
                >
                  <RefreshCw size={18} className="text-red-600" /> 
                  <span>Reset</span>
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </motion.header>

        <main className="space-y-8">
          {view === 'home' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-12">
              <motion.button
                whileHover={{ y: -10, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setView('drl-to-csv')}
                className="p-8 bg-white rounded-[2.5rem] border border-gray-100 shadow-xl shadow-black/[0.02] text-left group transition-all hover:border-black/10 cursor-pointer"
              >
                <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6 group-hover:bg-black group-hover:text-white transition-colors">
                  <FileSpreadsheet size={32} />
                </div>
                <h3 className="text-2xl font-bold mb-2">DRL to CSV⧸ XML</h3>
                <p className="text-sm text-gray-500 leading-relaxed">Extract workflow steps and metadata from DRL files with precision.</p>
              </motion.button>

              <motion.button
                whileHover={{ y: -10, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setView('formatted-labels')}
                className="p-8 bg-white rounded-[2.5rem] border border-gray-100 shadow-xl shadow-black/[0.02] text-left group transition-all hover:border-black/10 cursor-pointer"
              >
                <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-6 group-hover:bg-black group-hover:text-white transition-colors">
                  <Tags size={32} />
                </div>
                <h3 className="text-2xl font-bold mb-2">Formatted Labels</h3>
                <p className="text-sm text-gray-500 leading-relaxed">Extract and format labels based on Reference IDs from Excel files.</p>
              </motion.button>

              <motion.button
                whileHover={{ y: -10, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setView('capitalize-ref-ids')}
                className="p-8 bg-white rounded-[2.5rem] border border-gray-100 shadow-xl shadow-black/[0.02] text-left group transition-all hover:border-black/10 cursor-pointer"
              >
                <div className="w-16 h-16 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center mb-6 group-hover:bg-black group-hover:text-white transition-colors">
                  <Type size={32} />
                </div>
                <h3 className="text-2xl font-bold mb-2">Capitalize IDs</h3>
                <p className="text-sm text-gray-500 leading-relaxed">Normalize quotes and capitalize Reference IDs in Excel files.</p>
              </motion.button>
            </div>
          ) : view === 'drl-to-csv' ? (
            <>
              {/* Tool Header */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between mb-8"
              >
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleBackToHome}
                  className="group flex items-center gap-3 px-5 py-3 rounded-2xl transition-all cursor-pointer bg-white border border-blue-900 hover:bg-blue-50 hover:shadow-md"
                >
                  <ArrowLeft size={18} className="text-blue-900 transition-colors" />
                  <span className="text-sm font-bold text-blue-900 transition-colors">
                    Go back to Home
                  </span>
                </motion.button>

                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={resetTool}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all shadow-sm cursor-pointer bg-red-50 border border-red-100 text-red-600 hover:bg-red-100"
                >
                  <RefreshCw size={18} className="text-red-600" /> 
                  <span>Reset Tool</span>
                </motion.button>
              </motion.div>

              {/* Upload Card */}
              <motion.section 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 relative overflow-hidden transition-all duration-500 bg-white rounded-[2.5rem] border border-gray-100 shadow-xl shadow-black/[0.02]"
              >
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <FileUp size={120} />
                </div>
                
                <div className="relative z-10">
                  <h2 className="font-black uppercase tracking-[0.2em] mb-6 text-xs text-gray-400">
                   Upload Source
                  </h2>
                  
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <label className={`
                      flex-1 w-full cursor-pointer flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-[2rem] transition-all duration-500
                      ${file 
                        ? 'border-green-200 bg-green-50/30' 
                        : 'border-gray-200 bg-gray-50/50 hover:bg-gray-50 hover:border-gray-300'}
                    `}>
                      <input type="file" className="hidden" accept=".drl" onChange={handleFileUpload} />
                      {file ? (
                        <div className="flex flex-col items-center text-center">
                          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-inner bg-green-100 text-green-600">
                            <CheckCircle2 size={32} />
                          </div>
                          <span className="text-lg font-bold text-gray-800">{file.name}</span>
                          <span className="text-xs font-bold mt-1 uppercase tracking-wider text-green-600">File Ready</span>
                          {fileStats && (
                            <div className="mt-3 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full border shadow-sm text-gray-400 bg-white/50 border-green-100">
                              <span className="flex items-center gap-1.5">
                                <div className="w-1 h-1 rounded-full bg-green-400" />
                                <span className='mt-0.5'>{fileStats.size}</span>
                              </span>
                              <div className="w-px h-2 bg-gray-200" />
                              <span className="flex items-center gap-1.5">
                                <div className="w-1 h-1 rounded-full bg-green-400" />
                                <span className='mt-0.5'>{fileStats.count} Steps Found</span>
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-center">
                          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-sm border bg-white text-gray-400 border-gray-100">
                            <FileUp size={32} />
                          </div>
                          <span className="text-lg font-bold text-gray-800">Choose .drl file</span>
                          <span className="text-sm mt-1 text-gray-400">Drag and drop or click to browse</span>
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
                          w-full md:w-auto flex items-center justify-center gap-3 px-12 py-6 rounded-[2rem] font-black text-lg transition-all active:scale-95 cursor-pointer
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
              </motion.section>
    
              {/* Error Alert */}
              <AnimatePresence>
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-6 rounded-3xl flex items-center gap-4 transition-colors duration-500 bg-red-50 border border-red-100 text-red-800"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-red-100">
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
                    className="rounded-[2.5rem] border overflow-hidden transition-all duration-500 bg-white border-gray-100 shadow-2xl shadow-black/[0.03]"
                  >
                    <div className="p-8 border-b flex flex-col md:flex-row md:items-center justify-between gap-6 border-gray-50">
                      <div>
                        <h2 className="text-xs font-black uppercase tracking-[0.2em] mb-2 text-gray-400">Output Preview</h2>
                        <h3 className="text-2xl font-bold">{results.length} Rules Extracted</h3>
                      </div>
                      <div className="flex gap-3">
                        <button 
                          onClick={copyToClipboard}
                          className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 cursor-pointer bg-gray-50 border border-gray-100 hover:bg-gray-100"
                        >
                          {copied ? <Check size={18} className="text-green-600" /> : <Copy size={18} />}
                          {copied ? 'Copied' : 'Copy CSV'}
                        </button>
                        <button 
                          onClick={() => setIsModalOpen(true)}
                          className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all shadow-lg active:scale-95 cursor-pointer bg-black text-white hover:bg-gray-800"
                        >
                          <Download size={18} /> Download
                        </button>
                      </div>
                    </div>
    
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 backdrop-blur-md z-10 bg-gray-50/50">
                          <tr>
                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest border-b text-gray-400 border-gray-100">Workflow_step</th>
                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest border-b text-gray-400 border-gray-100">Current State</th>
                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest border-b text-gray-400 border-gray-100">label</th>
                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest border-b text-gray-400 border-gray-100">referenceID</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {results.map((rule, idx) => (
                            <tr key={idx} className="group transition-colors hover:bg-gray-50/30">
                              <td className="px-8 py-5 text-sm font-bold max-w-md truncate transition-colors text-gray-800 group-hover:text-black">
                                {rule.workflowStep}
                              </td>
                              <td className="px-8 py-5 text-sm font-medium text-gray-500">
                                {rule.extractedCurrentState || '-'}
                              </td>
                              <td className="px-8 py-5">
                                <span className="px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all bg-gray-100 text-gray-600">
                                  {rule.label}
                                </span>
                              </td>
                              <td className="px-8 py-5 text-sm font-mono transition-colors text-gray-400 group-hover:text-gray-600">
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
            </>
          ) : view === 'formatted-labels' ? (
            <FormattedLabelsTool key={`formatted-${formattedLabelsResetCounter}`} onBack={handleBackToHome} onReset={resetTool} />
          ) : (
            <CapitalizeRefIDsTool key={`capitalize-${capitalizeRefIdsResetCounter}`} onBack={handleBackToHome} onReset={resetTool} />
          )}
        </main>

        <motion.footer 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-20 pb-12 border-t pt-8 flex flex-col md:flex-row justify-between items-center gap-6 transition-colors duration-500 border-gray-100"
        >
          <div className="flex items-center gap-3 text-gray-400">
            <FileSpreadsheet size={20} />
            <span className="text-xs font-bold uppercase tracking-widest pt-2">DRL Tool v2.0</span>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300">
              Secure Local Processing &bull; No Data Leaves Your Browser
            </p>
          </div>
        </motion.footer>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <DownloadModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onDownload={handleDownload}
            initialFilename={file ? `${file.name.replace('.drl', '')} (Converted from DRL)` : 'converted_rules'}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
