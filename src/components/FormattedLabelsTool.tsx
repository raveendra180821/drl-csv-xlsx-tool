import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, 
  FileUp, 
  AlertCircle, 
  Play, 
  CheckCircle2, 
  Loader2, 
  ArrowLeft,
  RefreshCw,
  Search,
  Hash,
  FileText,
  Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FormattedLabelData {
  referenceID: string;
  state: string;
  formattedLabel: string;
}

interface FormattedLabelsToolProps {
  onBack: () => void;
  onReset: () => void;
}

export const FormattedLabelsTool: React.FC<FormattedLabelsToolProps> = ({ onBack, onReset }) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileStats, setFileStats] = useState<{ rows: number; cols: number } | null>(null);
  const workbookRef = useRef<XLSX.WorkBook | null>(null);
  const [referenceIDsInput, setReferenceIDsInput] = useState('');
  const [results, setResults] = useState<FormattedLabelData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSimpleFormat, setShowSimpleFormat] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith('.xlsx')) {
      setError('Invalid file type. Please upload an .xlsx file.');
      setFile(null);
      return;
    }

    setFile(selectedFile);
    setError(null);
    setResults([]);
    setFileStats(null);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      // Use timeout to allow UI to show loading state
      setTimeout(() => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          
          // Optimize reading: skip unnecessary features
          const workbook = XLSX.read(data, { 
            type: 'array', 
            cellStyles: false, 
            cellHTML: false, 
            cellText: false,
            cellFormula: false,
            bookVBA: false,
            bookDeps: false
          });
          
          workbookRef.current = workbook;
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          if (!worksheet) {
            throw new Error('The Excel file appears to be empty.');
          }

          // Efficiently find the max row/col by iterating over keys
          let maxRow = 0;
          let maxCol = 0;
          for (const key in worksheet) {
            if (key[0] === '!') continue;
            const cell = XLSX.utils.decode_cell(key);
            if (cell.r > maxRow) maxRow = cell.r;
            if (cell.c > maxCol) maxCol = cell.c;
          }

          const dataRows = Math.max(0, maxRow - 8); // Row 9 is header (index 8)
          setFileStats({ rows: dataRows, cols: maxCol + 1 });
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to read Excel file.');
          console.error(err);
          setFile(null);
        } finally {
          setIsProcessing(false);
        }
      }, 50);
    };
    reader.onerror = () => {
      setError('Failed to read file.');
      setIsProcessing(false);
    };
    reader.readAsArrayBuffer(selectedFile);
    e.target.value = '';
  };

  const processLabels = async () => {
    if (!file || !workbookRef.current) {
      setError('Please upload an XLSX file first.');
      return;
    }

    const targetIDs = referenceIDsInput
      .split('\n')
      .map(id => id.trim())
      .filter(id => id.length > 0);

    if (targetIDs.length === 0) {
      setError('Please enter at least one Reference ID.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResults([]);

    // Use setTimeout to allow UI to update before heavy processing
    setTimeout(() => {
      try {
        const workbook = workbookRef.current!;
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Find column indices at Row 9 (index 8)
        const headerRow = 8;
        const colMap: { [key: string]: number } = {};
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cell = worksheet[XLSX.utils.encode_cell({ r: headerRow, c })];
          if (cell && cell.v !== undefined && cell.v !== null) {
            const headerName = String(cell.v).trim();
            if (['NAME', 'CURRENT STATE', 'POSSIBLE NEXT STEP'].includes(headerName)) {
              colMap[headerName] = c;
            }
          }
        }

        const requiredCols = ['NAME', 'CURRENT STATE', 'POSSIBLE NEXT STEP'];
        const missingCols = requiredCols.filter(col => colMap[col] === undefined);

        if (missingCols.length > 0) {
          setError(`Missing required columns at row 9: ${missingCols.join(', ')}`);
          setIsProcessing(false);
          return;
        }

        // Efficiently find the max row
        let maxRow = 0;
        for (const key in worksheet) {
          if (key[0] === '!') continue;
          const cell = XLSX.utils.decode_cell(key);
          if (cell.r > maxRow) maxRow = cell.r;
        }

        const extractedResults: FormattedLabelData[] = [];
        const targetIDsSet = new Set(targetIDs);

        // Process rows manually instead of using sheet_to_json for better performance
        for (let r = 9; r <= maxRow; r++) {
          const stateCell = worksheet[XLSX.utils.encode_cell({ r, c: colMap['CURRENT STATE'] })];
          const nextStepCell = worksheet[XLSX.utils.encode_cell({ r, c: colMap['POSSIBLE NEXT STEP'] })];

          const currentState = String(stateCell?.v || '').trim();
          const possibleNextStep = String(nextStepCell?.v || '').trim();

          // If critical columns are empty, ignore the row
          if (!currentState || !possibleNextStep) continue;

          // Parse POSSIBLE NEXT STEP
          try {
            const parts: string[] = [];
            const regex = /"([^"]*)"|([^,]+)/g;
            let m;
            while ((m = regex.exec(possibleNextStep)) !== null) {
              parts.push(m[1] !== undefined ? m[1] : m[2].trim());
            }

            if (parts.length >= 4) {
              const stateFromStep = parts[0];
              const stepFromStep = parts[1];
              const refID = parts[3];

              if (targetIDsSet.has(refID)) {
                extractedResults.push({
                  referenceID: refID,
                  state: currentState,
                  formattedLabel: `${stateFromStep} | ${stepFromStep}`
                });
              }
            }
          } catch (e) {
            // Skip malformed rows
          }
        }

        if (extractedResults.length === 0) {
          setError('No matching referenceIDs found.');
        } else {
          setResults(extractedResults);
          setTimeout(() => {
            resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);
        }
      } catch (err) {
        setError('An error occurred while processing the file.');
        console.error(err);
      } finally {
        setIsProcessing(false);
      }
    }, 100);
  };

  const getSimpleFormatText = () => {
    const grouped: { [key: string]: string[] } = results.reduce((acc, item) => {
      if (!acc[item.state]) acc[item.state] = [];
      acc[item.state].push(item.formattedLabel);
      return acc;
    }, {} as { [key: string]: string[] });

    return Object.entries(grouped).map(([state, labels], index, array) => {
      const stateHeader = `in ${state}:`;
      const labelsList = labels.map(label => `\t${label}`).join('\n');
      const separator = index < array.length - 1 ? '\n\n-----------------------------------------\n\n' : '';
      return `${stateHeader}\n${labelsList}${separator}`;
    }).join('');
  };

  const copySimpleFormat = () => {
    navigator.clipboard.writeText(getSimpleFormatText());
  };

  return (
    <div className="space-y-8">
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center justify-between"
      >
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
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
          onClick={onReset}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all shadow-sm cursor-pointer bg-red-50 border border-red-100 text-red-600 hover:bg-red-100"
        >
          <RefreshCw size={18} className="text-red-600" /> 
          <span>Reset Tool</span>
        </motion.button>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Section */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-8 relative overflow-hidden transition-all duration-500 bg-white rounded-[2.5rem] border border-gray-100 shadow-xl shadow-black/[0.02]"
        >
          <h3 className="font-black uppercase tracking-[0.2em] mb-6 text-xs text-gray-400">
            Upload XLSX
          </h3>

          <label className={`
            w-full cursor-pointer flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-[2rem] transition-all duration-500
            ${file 
              ? 'border-green-200 bg-green-50/30' 
              : 'border-gray-200 bg-gray-50/50 hover:bg-gray-50 hover:border-gray-300'}
          `}>
            <input type="file" className="hidden" accept=".xlsx" onChange={handleFileUpload} />
            {file ? (
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-inner bg-green-100 text-green-600">
                  <CheckCircle2 size={32} />
                </div>
                <span className="text-lg font-bold text-gray-800">{file.name}</span>
                {fileStats && (
                  <div className="mt-3 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full border shadow-sm text-gray-400 bg-white/50 border-green-100">
                    <span>{fileStats.rows} Rows</span>
                    <div className="w-px h-2 bg-gray-200" />
                    <span>{fileStats.cols} Columns</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-sm border bg-white text-gray-400 border-gray-100">
                  <FileUp size={32} />
                </div>
                <span className="text-lg font-bold text-gray-800">Choose .xlsx file</span>
                <span className="text-sm mt-1 text-gray-400">Drag and drop or click to browse</span>
              </div>
            )}
          </label>
        </motion.section>

        {/* Reference IDs Section */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-8 relative overflow-hidden transition-all duration-500 bg-white rounded-[2.5rem] border border-gray-100 shadow-xl shadow-black/[0.02]"
        >
          <h3 className="font-black uppercase tracking-[0.2em] mb-6 text-xs text-gray-400">
            Reference IDs
          </h3>

          <div className="space-y-4">
            <textarea
              value={referenceIDsInput}
              onChange={(e) => setReferenceIDsInput(e.target.value)}
              placeholder="Paste referenceIDs line by line..."
              className="w-full h-48 p-6 rounded-[2rem] font-mono text-sm resize-none focus:outline-none focus:ring-2 transition-all bg-gray-50 border border-gray-200 text-gray-800 focus:ring-black/5"
            />
            <button
              onClick={processLabels}
              disabled={!file || !referenceIDsInput.trim() || isProcessing}
              className={`
                w-full flex items-center justify-center gap-3 px-8 py-5 rounded-[2rem] font-black text-lg transition-all active:scale-95 cursor-pointer
                ${!file || !referenceIDsInput.trim() || isProcessing 
                  ? 'bg-gray-100 text-gray-300 cursor-not-allowed' 
                  : 'bg-black text-white hover:bg-gray-800'}
              `}
            >
              {isProcessing ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <Play size={24} fill="currentColor" />
              )}
              {isProcessing ? 'Processing...' : 'Proceed'}
            </button>
          </div>
        </motion.section>
      </div>

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
              <h4 className="font-bold">Error</h4>
              <p className="text-sm opacity-80">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Table */}
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
                <h2 className="text-xs font-black uppercase tracking-[0.2em] mb-2 text-gray-400">Formatted Results</h2>
                <h3 className="text-2xl font-bold">{results.length} Matches Found</h3>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowSimpleFormat(!showSimpleFormat)}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 cursor-pointer bg-gray-50 border border-gray-100 hover:bg-gray-100"
                >
                  <FileText size={18} className="text-blue-600" />
                  {showSimpleFormat ? 'Show Table' : 'Simple Format'}
                </button>
              </div>
            </div>

            {showSimpleFormat ? (
              <div className="p-8">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-sm font-black uppercase tracking-widest text-gray-400">
                    Plain Text Output
                  </h4>
                  <button 
                    onClick={copySimpleFormat}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer bg-gray-100 text-gray-600 hover:bg-gray-200"
                  >
                    <Copy size={14} /> Copy Text
                  </button>
                </div>
                <pre className="p-8 rounded-3xl font-mono text-sm overflow-x-auto whitespace-pre-wrap leading-relaxed border bg-gray-50 border-gray-100 text-gray-700">
                  {getSimpleFormatText()}
                </pre>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse table-fixed">
                <thead className="sticky top-0 backdrop-blur-md z-10 bg-gray-50/50">
                  <tr>
                    <th className="w-[45%] px-8 py-5 text-[10px] font-black uppercase tracking-widest border-b text-gray-400 border-gray-100">
                      <div className="flex items-center gap-2"><FileSpreadsheet size={12} /> formatted label</div>
                    </th>
                    <th className="w-[25%] px-8 py-5 text-[10px] font-black uppercase tracking-widest border-b text-gray-400 border-gray-100">
                      <div className="flex items-center gap-2"><Search size={12} /> state</div>
                    </th>
                    <th className="w-[30%] px-8 py-5 text-[10px] font-black uppercase tracking-widest border-b text-gray-400 border-gray-100">
                      <div className="flex items-center gap-2"><Hash size={12} /> referenceID</div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {results.map((item, idx) => (
                    <tr key={idx} className="group transition-colors hover:bg-gray-50/30">
                      <td className="px-8 py-5 break-words">
                        <span className="inline-block px-4 py-2 rounded-xl text-xs font-bold transition-all bg-blue-50 text-blue-700 border border-blue-100 shadow-sm">
                          {item.formattedLabel}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-sm font-bold transition-colors break-words text-gray-800 group-hover:text-black">
                        {item.state}
                      </td>
                      <td className="px-8 py-5 text-sm font-mono transition-colors break-all text-gray-500 group-hover:text-gray-700">
                        {item.referenceID}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
};
