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
  Sun,
  Moon,
  Tags,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FormattedLabelsTool } from './components/FormattedLabelsTool';

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
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border dark:border-slate-800"
      >
        <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-xl font-bold dark:text-white">Download Results</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors dark:text-gray-400 cursor-pointer">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Filename</label>
            <div className="relative">
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white pr-16"
                placeholder="Enter filename"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 font-medium">.{format}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Select Format</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setFormat('csv')}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all font-bold cursor-pointer ${format === 'csv' ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black' : 'border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 text-gray-400 dark:text-slate-500 hover:border-gray-200 dark:hover:border-slate-700'}`}
              >
                <FileText size={18} /> CSV
              </button>
              <button
                onClick={() => setFormat('xlsx')}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all font-bold cursor-pointer ${format === 'xlsx' ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black' : 'border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 text-gray-400 dark:text-slate-500 hover:border-gray-200 dark:hover:border-slate-700'}`}
              >
                <FileSpreadsheet size={18} /> Excel
              </button>
            </div>
          </div>
        </div>
        <div className="p-6 bg-gray-50 dark:bg-slate-800/50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl font-bold hover:bg-gray-100 dark:hover:bg-slate-700 dark:text-white transition-all active:scale-95 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => onDownload(filename, format)}
            className="flex-1 px-4 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold hover:bg-gray-800 dark:hover:bg-gray-100 transition-all shadow-lg active:scale-95 cursor-pointer"
          >
            Download
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default function App() {
  const [view, setView] = useState<'drl-to-csv' | 'formatted-labels'>('drl-to-csv');
  const [file, setFile] = useState<File | null>(null);
  const [fileStats, setFileStats] = useState<{ size: string; count: number } | null>(null);
  const [input, setInput] = useState('');
  const [results, setResults] = useState<RuleData[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark' || saved === 'light') return saved;
      // Default to dark as requested
      return 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };
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
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`min-h-screen font-sans p-4 md:p-8 transition-colors duration-500 ${
      theme === 'dark' 
        ? 'bg-slate-950 text-white selection:bg-accent selection:text-black' 
        : 'bg-[#f8f9fa] text-[#1a1a1a] selection:bg-black selection:text-white'
    }`}>
      {theme === 'dark' && (
        <>
          <div className="bg-mesh" />
          <div className="bg-grid" />
        </>
      )}
      
      <div className="max-w-5xl mx-auto relative">
        {/* Header Section */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex flex-col md:flex-row md:items-end justify-between gap-6 transition-all duration-500 ${
          theme === 'dark' ? 'glass-header' : 'mb-12'
        }`}>
          <div className="space-y-2">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 ${
              theme === 'dark' ? 'bg-accent text-black accent-glow' : 'bg-black text-white'
            }`}>
              <FileSpreadsheet size={12} /> DRL Tool
            </div>
            <h1 className={`tracking-tighter leading-none ${
              theme === 'dark' ? 'text-6xl font-black' : 'text-5xl font-black'
            }`}>
              DRL <span className={theme === 'dark' ? 'text-white/20' : 'text-gray-300'}>to</span> CSV
            </h1>
            <p className={`font-medium ${
              theme === 'dark' ? 'text-white/40 text-lg' : 'text-gray-500'
            }`}>
              Extract workflow steps and metadata with precision.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setView(view === 'drl-to-csv' ? 'formatted-labels' : 'drl-to-csv')}
              className={`flex items-center gap-2 px-4 py-3 rounded-2xl transition-all shadow-sm cursor-pointer ${
                theme === 'dark' ? 'glass-button' : 'bg-white border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Tags size={18} className={theme === 'dark' ? 'text-accent' : 'text-blue-600'} />
              <span className={`text-xs font-bold ${theme === 'dark' ? 'text-white/80' : 'text-gray-600'}`}>
                {view === 'drl-to-csv' ? 'Get Formatted Labels' : 'DRL to CSV'}
              </span>
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleTheme}
              className={`flex items-center gap-2 px-4 py-3 rounded-2xl transition-all shadow-sm cursor-pointer ${
                theme === 'dark' ? 'glass-button' : 'bg-white border border-gray-200 hover:bg-gray-50'
              }`}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? (
                <>
                  <Moon size={18} className="text-slate-600" />
                  <span className="text-xs font-bold text-slate-600">Dark Mode</span>
                </>
              ) : (
                <>
                  <Sun size={18} className="text-amber-400" />
                  <span className="text-xs font-bold text-white/80">Light Mode</span>
                </>
              )}
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={reset}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all shadow-sm cursor-pointer ${
                theme === 'dark' 
                  ? 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20' 
                  : 'bg-red-50 border border-red-100 text-red-600 hover:bg-red-100'
              }`}
            >
              <RefreshCw size={18} className={theme === 'dark' ? 'text-red-400' : 'text-red-600'} /> 
              <span>Reset Tool</span>
            </motion.button>
          </div>
        </motion.header>

        <main className="space-y-8">
          {view === 'drl-to-csv' ? (
            <>
              {/* Upload Card */}
              <motion.section 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-8 relative overflow-hidden transition-all duration-500 ${
                theme === 'dark' ? 'glass-card group' : 'bg-white rounded-[2.5rem] border border-gray-100 shadow-xl shadow-black/[0.02]'
              }`}>
                {theme === 'dark' && (
                  <div className="absolute -top-24 -right-24 w-64 h-64 bg-accent/5 rounded-full blur-3xl group-hover:bg-accent/10 transition-colors duration-700" />
                )}
                {theme === 'light' && (
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <FileUp size={120} />
                  </div>
                )}
                
                <div className="relative z-10">
                  <h2 className={`font-black uppercase tracking-[0.2em] mb-6 ${
                    theme === 'dark' ? 'text-[10px] text-white/30 flex items-center gap-3' : 'text-xs text-gray-400'
                  }`}>
                    {theme === 'dark' && <div className="w-8 h-px bg-white/10" />}
                    Step 01: Upload Source
                  </h2>
                  
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <label className={`
                      flex-1 w-full cursor-pointer flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-[2rem] transition-all duration-500
                      ${file 
                        ? (theme === 'dark' ? 'border-accent/40 bg-accent/5' : 'border-green-200 bg-green-50/30') 
                        : (theme === 'dark' ? 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20' : 'border-gray-200 bg-gray-50/50 hover:bg-gray-50 hover:border-gray-300')}
                    `}>
                      <input type="file" className="hidden" accept=".drl" onChange={handleFileUpload} />
                      {file ? (
                        <div className="flex flex-col items-center text-center">
                          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-inner ${
                            theme === 'dark' ? 'bg-accent/10 text-accent accent-glow' : 'bg-green-100 text-green-600'
                          }`}>
                            <CheckCircle2 size={32} />
                          </div>
                          <span className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>{file.name}</span>
                          <span className={`text-xs font-bold mt-1 uppercase tracking-wider ${
                            theme === 'dark' ? 'text-accent' : 'text-green-600'
                          }`}>File Ready</span>
                          {fileStats && (
                            <div className={`mt-3 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full border shadow-sm ${
                              theme === 'dark' ? 'text-white/40 bg-white/5 border-white/10' : 'text-gray-400 bg-white/50 border-green-100'
                            }`}>
                              <span className="flex items-center gap-1.5 mt-1">
                                <div className={`w-1 h-1 rounded-full ${theme === 'dark' ? 'bg-accent accent-glow' : 'bg-green-400'} mb-1`} />
                                {fileStats.size}
                              </span>
                              <div className={`w-px h-2 ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`} />
                              <span className="flex items-center gap-1.5 mt-1">
                                <div className={`w-1 h-1 rounded-full ${theme === 'dark' ? 'bg-accent accent-glow' : 'bg-green-400'} mb-1`} />
                                {fileStats.count} Steps Found
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-center">
                          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-sm border ${
                            theme === 'dark' ? 'bg-white/5 text-white/20 border-white/10' : 'bg-white text-gray-400 border-gray-100'
                          }`}>
                            <FileUp size={32} />
                          </div>
                          <span className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>Choose .drl file</span>
                          <span className={`text-sm mt-1 ${theme === 'dark' ? 'text-white/30' : 'text-gray-400'}`}>Drag and drop or click to browse</span>
                        </div>
                      )}
                    </label>
    
                    <div className={`hidden md:flex flex-col items-center gap-2 ${theme === 'dark' ? 'text-white/10' : 'text-gray-300'}`}>
                      <div className={`w-px h-12 ${theme === 'dark' ? 'bg-gradient-to-b from-transparent via-white/20 to-transparent' : 'bg-gray-200'}`} />
                      <span className="text-[10px] font-black uppercase">OR</span>
                      <div className={`w-px h-12 ${theme === 'dark' ? 'bg-gradient-to-b from-transparent via-white/20 to-transparent' : 'bg-gray-200'}`} />
                    </div>
    
                    <div className="w-full md:w-auto">
                      <button
                        onClick={parseDRL}
                        disabled={!file || isConverting}
                        className={`
                          w-full md:w-auto flex items-center justify-center gap-3 px-12 py-6 rounded-[2rem] font-black text-lg transition-all active:scale-95 cursor-pointer
                          ${!file || isConverting 
                            ? (theme === 'dark' ? 'bg-white/5 text-white/10 cursor-not-allowed' : 'bg-gray-100 text-gray-300 cursor-not-allowed shadow-none') 
                            : (theme === 'dark' ? 'bg-accent text-black hover:bg-white accent-glow' : 'bg-black text-white hover:bg-gray-800 shadow-black/20 hover:shadow-black/40')}
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
                    className={`p-6 rounded-3xl flex items-center gap-4 transition-colors duration-500 ${
                      theme === 'dark' ? 'bg-red-500/10 border border-red-500/20 text-red-400 backdrop-blur-md' : 'bg-red-50 border border-red-100 text-red-800'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      theme === 'dark' ? 'bg-red-500/20' : 'bg-red-100'
                    }`}>
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
                    className={`rounded-[2.5rem] border overflow-hidden transition-all duration-500 ${
                      theme === 'dark' ? 'glass-card' : 'bg-white border-gray-100 shadow-2xl shadow-black/[0.03]'
                    }`}
                  >
                    <div className={`p-8 border-b flex flex-col md:flex-row md:items-center justify-between gap-6 ${
                      theme === 'dark' ? 'border-white/5' : 'border-gray-50'
                    }`}>
                      <div>
                        <h2 className={`text-xs font-black uppercase tracking-[0.2em] mb-2 ${
                          theme === 'dark' ? 'text-white/30' : 'text-gray-400'
                        }`}>Step 02: Output Preview</h2>
                        <h3 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : ''}`}>{results.length} Rules Extracted</h3>
                      </div>
                      <div className="flex gap-3">
                        <button 
                          onClick={copyToClipboard}
                          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 cursor-pointer ${
                            theme === 'dark' ? 'glass-button' : 'bg-gray-50 border border-gray-100 hover:bg-gray-100'
                          }`}
                        >
                          {copied ? <Check size={18} className={theme === 'dark' ? 'text-accent' : 'text-green-600'} /> : <Copy size={18} className={theme === 'dark' ? 'text-white/40' : ''} />}
                          {copied ? 'Copied' : 'Copy CSV'}
                        </button>
                        <button 
                          onClick={() => setIsModalOpen(true)}
                          className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all shadow-lg active:scale-95 cursor-pointer ${
                            theme === 'dark' ? 'bg-accent text-black hover:bg-white accent-glow' : 'bg-black text-white hover:bg-gray-800'
                          }`}
                        >
                          <Download size={18} /> Download
                        </button>
                      </div>
                    </div>
    
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className={`sticky top-0 backdrop-blur-md z-10 ${
                          theme === 'dark' ? 'bg-white/[0.02]' : 'bg-gray-50/50'
                        }`}>
                          <tr>
                            <th className={`px-8 py-5 text-[10px] font-black uppercase tracking-widest border-b ${
                              theme === 'dark' ? 'text-white/30 border-white/5' : 'text-gray-400 border-gray-100'
                            }`}>Workflow_step</th>
                            <th className={`px-8 py-5 text-[10px] font-black uppercase tracking-widest border-b ${
                              theme === 'dark' ? 'text-white/30 border-white/5' : 'text-gray-400 border-gray-100'
                            }`}>label</th>
                            <th className={`px-8 py-5 text-[10px] font-black uppercase tracking-widest border-b ${
                              theme === 'dark' ? 'text-white/30 border-white/5' : 'text-gray-400 border-gray-100'
                            }`}>referenceID</th>
                          </tr>
                        </thead>
                        <tbody className={`divide-y ${theme === 'dark' ? 'divide-white/[0.03]' : 'divide-gray-50'}`}>
                          {results.map((rule, idx) => (
                            <tr key={idx} className={`group transition-colors ${
                              theme === 'dark' ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50/30'
                            }`}>
                              <td className={`px-8 py-5 text-sm font-bold max-w-md truncate transition-colors ${
                                theme === 'dark' ? 'text-white/80 group-hover:text-white' : 'text-gray-800 group-hover:text-black'
                              }`}>
                                {rule.workflowStep}
                              </td>
                              <td className="px-8 py-5">
                                <span className={`px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
                                  theme === 'dark' 
                                    ? 'bg-white/5 text-white/40 border border-white/5 group-hover:border-accent/20 group-hover:text-accent' 
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {rule.label}
                                </span>
                              </td>
                              <td className={`px-8 py-5 text-sm font-mono transition-colors ${
                                theme === 'dark' ? 'text-white/20 group-hover:text-white/40' : 'text-gray-400 group-hover:text-gray-600'
                              }`}>
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
          ) : (
            <FormattedLabelsTool onBack={() => setView('drl-to-csv')} theme={theme} />
          )}
        </main>

        <motion.footer 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className={`mt-20 pb-12 border-t pt-8 flex flex-col md:flex-row justify-between items-center gap-6 transition-colors duration-500 ${
          theme === 'dark' ? 'border-white/5' : 'border-gray-100'
        }`}>
          <div className={`flex items-center gap-3 ${theme === 'dark' ? 'text-white/20' : 'text-gray-400'}`}>
            <FileSpreadsheet size={20} />
            <span className="text-xs font-bold uppercase tracking-widest">DRL Tool v2.0</span>
          </div>
          <div className="flex items-center gap-3">
            {theme === 'dark' && <div className="w-2 h-2 bg-accent rounded-full animate-pulse accent-glow" />}
            <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${
              theme === 'dark' ? 'text-white/20' : 'text-gray-300'
            }`}>
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
            initialFilename={file ? file.name.replace('.drl', '') : 'converted_rules'}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
