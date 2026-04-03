import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileUp, 
  CheckCircle2, 
  Loader2, 
  Play, 
  Download, 
  AlertCircle, 
  ArrowLeft,
  FileSpreadsheet,
  Type
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const splitPossibleNextStep = (value: string): string[] => {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
      current += char;
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false;
      current += char;
    } else if (char === ',' && !inQuotes) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts;
};

const transformPossibleNextStep = (value: string, option: 'quotes' | 'capitalize' | 'both'): string => {
  const parts = splitPossibleNextStep(value);

  const transformedParts = parts.map((part, index) => {
    let newPart = part;

    // 1. Handle Quote Normalization (Option 1 or 3)
    if (option === 'quotes' || option === 'both') {
      const trimmed = newPart.trim();
      if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
        newPart = newPart.replace(trimmed, `"${trimmed.slice(1, -1)}"`);
      }
    }

    // 2. Handle Capitalization (Option 2 or 3)
    if (index === 3 && (option === 'capitalize' || option === 'both')) {
      const trimmed = newPart.trim();
      if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        const content = trimmed.slice(1, -1).toUpperCase();
        newPart = newPart.replace(trimmed, `"${content}"`);
      } else if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
        const content = trimmed.slice(1, -1).toUpperCase();
        newPart = newPart.replace(trimmed, `'${content}'`);
      } else {
        newPart = newPart.toUpperCase();
      }
    }

    return newPart;
  });

  return transformedParts.join(',');
};

interface CapitalizeRefIDsToolProps {
  onBack: () => void;
}

export const CapitalizeRefIDsTool: React.FC<CapitalizeRefIDsToolProps> = ({ onBack }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedWorkbook, setProcessedWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isAlreadyNormalized, setIsAlreadyNormalized] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{ count: number; description: string; totalRows: number } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  const [downloadFilename, setDownloadFilename] = useState('');

  const workbookRef = useRef<XLSX.WorkBook | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    if (!uploadedFile.name.endsWith('.xlsx')) {
      setError('Please upload a valid .xlsx file.');
      return;
    }

    setError(null);
    setSuccess(false);
    setIsAlreadyNormalized(false);
    setUpdateInfo(null);
    setProcessedWorkbook(null);
    setFile(uploadedFile);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { 
          type: 'array',
          cellStyles: true,
          cellNF: true,
          cellDates: true
        });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Efficiently find the max row/col by iterating over keys
        let maxCol = 0;
        let maxDataRow = 8; // Header is Row 9 (index 8)
        for (const key in worksheet) {
          if (key[0] === '!') continue;
          const cell = XLSX.utils.decode_cell(key);
          if (cell.c > maxCol) maxCol = cell.c;
          
          const cellData = worksheet[key];
          if (cellData && cellData.v !== undefined && cellData.v !== null && String(cellData.v).trim() !== '') {
            if (cell.r > maxDataRow) maxDataRow = cell.r;
          }
        }

        // Find POSSIBLE NEXT STEP column in Row 9 (index 8)
        let possibleNextStepCol = -1;
        const headerRow = 8;
        for (let c = 0; c <= maxCol; c++) {
          const cellAddress = XLSX.utils.encode_cell({ r: headerRow, c });
          const cell = worksheet[cellAddress];
          if (cell && cell.v && String(cell.v).trim().toUpperCase() === 'POSSIBLE NEXT STEP') {
            possibleNextStepCol = c;
            break;
          }
        }
        
        const dataRows = Math.max(0, maxDataRow - 8); // Row 9 is header (index 8)
        
        // Pre-validation: Check if file is already in expected state
        if (possibleNextStepCol !== -1 && dataRows > 0) {
          let needsAnyUpdate = false;
          for (let r = headerRow + 1; r <= maxDataRow; r++) {
            const cellAddress = XLSX.utils.encode_cell({ r, c: possibleNextStepCol });
            const cell = worksheet[cellAddress];
            if (cell && cell.v) {
              const val = String(cell.v);
              // Check if 'both' transformation would change anything
              if (transformPossibleNextStep(val, 'both') !== val) {
                needsAnyUpdate = true;
                break;
              }
            }
          }
          if (!needsAnyUpdate) {
            setIsAlreadyNormalized(true);
          }
        }
        workbookRef.current = workbook;
      } catch (err) {
        setError('Failed to read the Excel file.');
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(uploadedFile);
  };

  const processFile = (option: 'quotes' | 'capitalize' | 'both') => {
    if (!workbookRef.current || !file) return;

    setIsProcessing(true);
    setError(null);
    setIsSelectionModalOpen(false);

    setTimeout(() => {
      try {
        const originalWorkbook = workbookRef.current!;
        // Deep clone the workbook to avoid modifying the original reference
        const workbook = XLSX.read(XLSX.write(originalWorkbook, { bookType: 'xlsx', type: 'array' }), { 
          type: 'array',
          cellStyles: true,
          cellNF: true,
          cellDates: true
        });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        
        // Find header row (Row 9, which is index 8)
        const headerRow = 8;
        if (range.e.r < headerRow) {
          throw new Error('File does not have enough rows. Row 9 must be the header.');
        }

        // Find POSSIBLE NEXT STEP column
        let possibleNextStepCol = -1;
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cellAddress = XLSX.utils.encode_cell({ r: headerRow, c });
          const cell = worksheet[cellAddress];
          if (cell && cell.v && String(cell.v).trim().toUpperCase() === 'POSSIBLE NEXT STEP') {
            possibleNextStepCol = c;
            break;
          }
        }

        if (possibleNextStepCol === -1) {
          throw new Error('Column "POSSIBLE NEXT STEP" not found in Row 9.');
        }

        let updatedRowsCount = 0;
        
        // Find the last non-empty row in the sheet
        let maxDataRow = headerRow;
        for (const key in worksheet) {
          if (key[0] === '!') continue;
          const cell = XLSX.utils.decode_cell(key);
          if (cell.r > maxDataRow) {
            const cellData = worksheet[key];
            if (cellData && cellData.v !== undefined && cellData.v !== null && String(cellData.v).trim() !== '') {
              maxDataRow = cell.r;
            }
          }
        }
        const totalRowsCount = Math.max(0, maxDataRow - headerRow);
        
        // Process rows from Row 10 (index 9) onwards
        for (let r = headerRow + 1; r <= maxDataRow; r++) {
          const cellAddress = XLSX.utils.encode_cell({ r, c: possibleNextStepCol });
          const cell = worksheet[cellAddress];
          
          if (cell && cell.v) {
            const originalValue = String(cell.v);
            const transformedValue = transformPossibleNextStep(originalValue, option);
            if (transformedValue !== originalValue) {
              cell.v = transformedValue;
              updatedRowsCount++;
              // If it's a rich text or has other properties, we might need to update them too
              if (cell.w) cell.w = transformedValue;
            }
          }
        }

        setProcessedWorkbook(workbook);
        setSuccess(true);
        
        let description = '';
        if (option === 'quotes') description = 'Normalized single quotes to double quotes.';
        else if (option === 'capitalize') description = 'Capitalized reference IDs (4th value).';
        else if (option === 'both') description = 'Normalized quotes and capitalized reference IDs.';

        setUpdateInfo({ count: updatedRowsCount, description, totalRows: totalRowsCount });
        
        let suffix = '_PROCESSED';
        if (option === 'quotes') suffix = '_QUOTES_NORMALIZED';
        else if (option === 'capitalize') suffix = '_CAPITALIZED';
        else if (option === 'both') suffix = '_NORMALIZED';

        setDownloadFilename(file.name.replace('.xlsx', `${suffix}.xlsx`));
      } catch (err: any) {
        setError(err.message || 'An error occurred during processing.');
      } finally {
        setIsProcessing(false);
      }
    }, 100);
  };

  const downloadFile = () => {
    if (!processedWorkbook) return;

    const wbout = XLSX.write(processedWorkbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadFilename || 'processed_file.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setIsModalOpen(false);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-4 mb-12"
      >
        <button 
          onClick={onBack}
          className="p-3 rounded-2xl transition-all active:scale-95 cursor-pointer bg-white border border-gray-200 hover:bg-gray-50"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
          <div>
            <h2 className="text-3xl font-black tracking-tight text-gray-900">
              Reference ID & Quote Tool
            </h2>
            <p className="text-sm font-medium text-gray-500">
              Normalize quotes and capitalize reference IDs in the POSSIBLE NEXT STEP column.
            </p>
          </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-8">
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

        {/* Process Section */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-8 relative overflow-hidden transition-all duration-500 bg-white rounded-[2.5rem] border border-gray-100 shadow-xl shadow-black/[0.02]"
        >
          <h3 className="font-black uppercase tracking-[0.2em] mb-6 text-xs text-gray-400">
            Process & Transform
          </h3>

          <div className="flex flex-col items-center gap-6">
            {isAlreadyNormalized ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md p-6 rounded-[2rem] bg-blue-50 border border-blue-100 text-blue-800 flex flex-col items-center text-center gap-3"
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-blue-100 text-blue-600">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h4 className="font-black text-lg">Nothing need to be changed</h4>
                  <p className="text-sm font-medium opacity-80">
                    This file is already in the expected state. All quotes are normalized and Reference IDs are capitalized.
                  </p>
                </div>
              </motion.div>
            ) : (
              <button
                onClick={() => setIsSelectionModalOpen(true)}
                disabled={!file || isProcessing}
                className={`
                  w-full md:w-auto flex items-center justify-center gap-3 px-12 py-6 rounded-[2rem] font-black text-lg transition-all active:scale-95 cursor-pointer
                  ${!file || isProcessing 
                    ? 'bg-gray-100 text-gray-300 cursor-not-allowed shadow-none' 
                    : 'bg-black text-white hover:bg-gray-800 shadow-black/20 hover:shadow-black/40'}
                `}
              >
                {isProcessing ? (
                  <Loader2 size={24} className="animate-spin" />
                ) : (
                  <Play size={24} fill="currentColor" />
                )}
                {isProcessing ? 'Processing...' : 'Process File'}
              </button>
            )}

            {success && updateInfo && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-4 w-full max-w-md"
              >
                <div className="w-full p-6 rounded-[2rem] bg-green-50 border border-green-100 text-green-800">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-100 text-green-600">
                      <CheckCircle2 size={20} />
                    </div>
                    <h4 className="font-black text-lg">Transformation Complete!</h4>
                  </div>
                  <div className="space-y-2 text-sm font-medium opacity-90">
                    <p className="flex justify-between">
                      <span>Total Rows Identified:</span>
                      <span className="font-black">{updateInfo.totalRows}</span>
                    </p>
                    <p className="flex justify-between">
                      <span>Rows Updated:</span>
                      <span className="font-black">{updateInfo.count}</span>
                    </p>
                    <p className="pt-2 border-t border-green-200/50">
                      {updateInfo.description}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="w-full flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-black text-lg transition-all shadow-lg active:scale-95 cursor-pointer bg-black text-white hover:bg-gray-800"
                >
                  <Download size={20} /> Download Processed File
                </button>
              </motion.div>
            )}
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
            className="mt-8 p-6 rounded-3xl flex items-center gap-4 transition-colors duration-500 bg-red-50 border border-red-100 text-red-800"
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

      {/* Download Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md overflow-hidden rounded-[2.5rem] shadow-2xl bg-white"
            >
              <div className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-blue-50 text-blue-600">
                    <FileSpreadsheet size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-900">Download File</h3>
                    <p className="text-sm text-gray-500">Save your processed Excel file.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-gray-400">Filename</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={downloadFilename}
                        onChange={(e) => setDownloadFilename(e.target.value)}
                        className="w-full px-5 py-4 rounded-2xl font-bold focus:outline-none transition-all bg-gray-50 border border-gray-200 text-gray-900 focus:border-black"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 flex gap-3 bg-gray-50">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-4 rounded-2xl font-bold transition-all active:scale-95 cursor-pointer bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={downloadFile}
                  className="flex-1 px-4 py-4 rounded-2xl font-black transition-all shadow-lg active:scale-95 cursor-pointer bg-black text-white hover:bg-gray-800"
                >
                  Download
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Selection Modal */}
      <AnimatePresence>
        {isSelectionModalOpen && (
          <SelectionModal 
            isOpen={isSelectionModalOpen}
            onClose={() => setIsSelectionModalOpen(false)}
            onProceed={processFile}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

interface SelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: (option: 'quotes' | 'capitalize' | 'both') => void;
}

const SelectionModal: React.FC<SelectionModalProps> = ({ isOpen, onClose, onProceed }) => {
  const [option, setOption] = useState<'quotes' | 'capitalize' | 'both' | null>(null);
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const handleProceed = () => {
    if (!option) {
      setError(true);
      return;
    }
    onProceed(option);
  };

  const options = [
    { id: 'quotes', title: 'Single Quotes → Double Quotes', desc: 'Replace all \' with " in the POSSIBLE NEXT STEP column.' },
    { id: 'capitalize', title: 'Capitalize Reference IDs', desc: 'Convert the 4th value (referenceID) to uppercase.' },
    { id: 'both', title: 'Both', desc: 'Apply both quote normalization and capitalization.' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-lg overflow-hidden rounded-[2.5rem] shadow-2xl bg-white"
      >
        <div className="p-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-black text-white">
              <Play size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900">Select Processing Options</h3>
              <p className="text-sm text-gray-500">Choose how you want to transform the data.</p>
            </div>
          </div>

          <div className="space-y-3">
            {options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => {
                  setOption(opt.id as any);
                  setError(false);
                }}
                className={`w-full text-left p-5 rounded-3xl border-2 transition-all duration-300 ${
                  option === opt.id 
                    ? 'border-black bg-black/5 shadow-md' 
                    : 'border-gray-100 hover:border-gray-200 bg-gray-50/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-bold ${option === opt.id ? 'text-black' : 'text-gray-700'}`}>
                    {opt.title}
                  </span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    option === opt.id ? 'border-black bg-black' : 'border-gray-300'
                  }`}>
                    {option === opt.id && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{opt.desc}</p>
              </button>
            ))}
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center gap-2 text-red-600 text-xs font-bold"
            >
              <AlertCircle size={14} />
              Please select an option to proceed.
            </motion.div>
          )}
        </div>

        <div className="p-6 flex gap-3 bg-gray-50">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-4 rounded-2xl font-bold transition-all active:scale-95 cursor-pointer bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleProceed}
            className="flex-1 px-4 py-4 rounded-2xl font-black transition-all shadow-lg active:scale-95 cursor-pointer bg-black text-white hover:bg-gray-800"
          >
            Proceed
          </button>
        </div>
      </motion.div>
    </div>
  );
};
