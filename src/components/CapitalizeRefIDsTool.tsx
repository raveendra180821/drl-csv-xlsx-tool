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
  RefreshCw,
  FileSpreadsheet,
  Type
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const splitPossibleNextStep = (value: string): string[] => {
  if (!value) return [''];
  // Optimization: If no comma and no quotes, it's a single part
  if (!value.includes(',') && !value.includes('"') && !value.includes("'")) {
    return [value];
  }

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
      // Handle escaped quotes (e.g., "")
      if (i + 1 < value.length && value[i + 1] === quoteChar) {
        current += char + value[i + 1];
        i++; // Skip the next quote
      } else {
        inQuotes = false;
        current += char;
      }
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

const transformPossibleNextStep = (value: string, option: 'quotes' | 'capitalize' | 'both'): { 
  newValue: string; 
  quotesChanged: boolean; 
  capChanged: boolean; 
} => {
  const parts = splitPossibleNextStep(value);
  let quotesChanged = false;
  let capChanged = false;

  const transformedParts = parts.map((part, index) => {
    let newPart = part;
    const trimmed = newPart.trim();
    if (trimmed.length === 0) return newPart;

    const getContent = (s: string) => {
      if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        return s.slice(1, -1);
      }
      return s;
    };

    const content = getContent(trimmed);

    // 1. Handle Quote Normalization (Option 1 or 3)
    if (option === 'quotes' || option === 'both') {
      let targetPart = newPart;
      if (index === 2) {
        // 3rd value (boolean) must NOT be quoted
        targetPart = newPart.replace(trimmed, content);
      } else {
        // 1st, 2nd, and 4th values must be double quoted
        targetPart = newPart.replace(trimmed, `"${content}"`);
      }
      if (targetPart !== newPart) {
        quotesChanged = true;
        newPart = targetPart;
      }
    }

    // 2. Handle Capitalization (Option 2 or 3)
    if (index === 3 && (option === 'capitalize' || option === 'both')) {
      const currentTrimmed = newPart.trim();
      const currentContent = getContent(currentTrimmed);
      const upperContent = currentContent.toUpperCase();
      
      if (upperContent !== currentContent) {
        capChanged = true;
        // Ensure double quotes for 4th value as per requirement
        newPart = newPart.replace(currentTrimmed, `"${upperContent}"`);
      }
    }

    return newPart;
  });

  return { 
    newValue: transformedParts.join(','), 
    quotesChanged, 
    capChanged 
  };
};

interface CapitalizeRefIDsToolProps {
  onBack: () => void;
  onReset: () => void;
}

export const CapitalizeRefIDsTool: React.FC<CapitalizeRefIDsToolProps> = ({ onBack, onReset }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('Processing...');
  const [processedWorkbook, setProcessedWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isAlreadyNormalized, setIsAlreadyNormalized] = useState(false);
  const [columnNotFound, setColumnNotFound] = useState(false);
  const [validationResults, setValidationResults] = useState<{
    needsQuoteFix: boolean;
    needsCapitalization: boolean;
  }>({ needsQuoteFix: false, needsCapitalization: false });
  const [analysisResult, setAnalysisResult] = useState<{
    totalRows: number;
    quoteFixRows: number[];
    capitalizeRows: number[];
    bothFixRows: number[];
  } | null>(null);
  const [updateInfo, setUpdateInfo] = useState<{ 
    count: number; 
    quotesCount?: number;
    capCount?: number;
    description: string; 
    totalRows: number;
    selectedOption: 'quotes' | 'capitalize' | 'both';
  } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  const [downloadFilename, setDownloadFilename] = useState('');
  const workbookRef = useRef<XLSX.WorkBook | null>(null);
  const processedWorkbookRef = useRef<XLSX.WorkBook | null>(null);

  const formatRowNumbers = (rows: number[]) => {
    if (rows.length === 0) return '';
    const sortedRows = [...rows].sort((a, b) => a - b);
    const ranges: string[] = [];
    let start = sortedRows[0];
    let end = sortedRows[0];

    for (let i = 1; i < sortedRows.length; i++) {
      if (sortedRows[i] === end + 1) {
        end = sortedRows[i];
      } else {
        ranges.push(start === end ? `${start}` : `${start}–${end}`);
        start = sortedRows[i];
        end = sortedRows[i];
      }
    }
    ranges.push(start === end ? `${start}` : `${start}–${end}`);
    return ranges.join(', ');
  };

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
    setColumnNotFound(false);
    setAnalysisResult(null);
    setUpdateInfo(null);
    setProcessedWorkbook(null);
    setFile(uploadedFile);
    setIsProcessing(true);
    setProcessingMessage('Reading file...');

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
        
        // Optimization: Use decode_range instead of iterating over keys
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        const headerRow = 8;
        
        // Find POSSIBLE NEXT STEP column in Row 9 (index 8)
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
          setColumnNotFound(true);
          workbookRef.current = workbook;
          setIsProcessing(false);
          return;
        }

        setColumnNotFound(false);
        setProcessingMessage('Analyzing data...');

        // CRITICAL: Detect actual data range to avoid processing 1M empty rows
        let actualMaxRow = headerRow;
        let emptyRowCount = 0;
        const scanLimit = 100; // Stop after 100 consecutive empty rows

        for (let r = headerRow + 1; r <= range.e.r; r++) {
          const cellAddress = XLSX.utils.encode_cell({ r, c: possibleNextStepCol });
          const cell = worksheet[cellAddress];
          const cellValue = cell && cell.v !== undefined && cell.v !== null ? String(cell.v).trim() : '';

          if (cellValue !== '') {
            actualMaxRow = r;
            emptyRowCount = 0;
          } else {
            emptyRowCount++;
          }

          if (emptyRowCount >= scanLimit) break;
        }

        let totalValidRows = 0;
        let needsQuoteFix = false;
        let needsCapitalization = false;
        const quoteFixRows: number[] = [];
        const capitalizeRows: number[] = [];
        const bothFixRows: number[] = [];
        
        let currentRow = headerRow + 1;
        const chunkSize = 2000;

        const validateChunk = () => {
          try {
            const endRow = Math.min(currentRow + chunkSize, actualMaxRow + 1);
            
            for (let r = currentRow; r < endRow; r++) {
              const cellAddress = XLSX.utils.encode_cell({ r, c: possibleNextStepCol });
              const cell = worksheet[cellAddress];
              
              // Skip empty cells early
              if (!cell || cell.v === undefined || cell.v === null) continue;
              const cellValue = String(cell.v).trim();
              if (cellValue === '') continue;

              totalValidRows++;
              
              let rowNeedsQuoteFix = false;
              let rowNeedsCapitalization = false;

              const parts = splitPossibleNextStep(cellValue);
              
              parts.forEach((part, index) => {
                const trimmed = part.trim();
                if (trimmed.length > 0) {
                  // Check quotes
                  if (index === 2) {
                    // Boolean: must NOT be quoted
                    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
                      rowNeedsQuoteFix = true;
                      needsQuoteFix = true;
                    }
                  } else {
                    // 1st, 2nd, 4th: must be double quoted
                    if (!(trimmed.startsWith('"') && trimmed.endsWith('"'))) {
                      rowNeedsQuoteFix = true;
                      needsQuoteFix = true;
                    }
                  }

                  // Check capitalization for 4th part
                  if (index === 3) {
                    const content = (trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'") )
                      ? trimmed.slice(1, -1) 
                      : trimmed;
                    if (content !== content.toUpperCase()) {
                      rowNeedsCapitalization = true;
                      needsCapitalization = true;
                    }
                  }
                }
              });

              const excelRowNumber = r + 1;
              if (rowNeedsQuoteFix && rowNeedsCapitalization) {
                bothFixRows.push(excelRowNumber);
              } else if (rowNeedsQuoteFix) {
                quoteFixRows.push(excelRowNumber);
              } else if (rowNeedsCapitalization) {
                capitalizeRows.push(excelRowNumber);
              }
            }

            currentRow = endRow;
            if (currentRow <= actualMaxRow) {
              const progress = Math.round(((currentRow - headerRow) / (actualMaxRow - headerRow || 1)) * 100);
              setProcessingMessage(`Analyzing data (${progress}%)...`);
              setTimeout(validateChunk, 0);
            } else {
              setAnalysisResult({
                totalRows: totalValidRows,
                quoteFixRows,
                capitalizeRows,
                bothFixRows
              });
              
              setValidationResults({ needsQuoteFix, needsCapitalization });
              if (!needsQuoteFix && !needsCapitalization && totalValidRows > 0) {
                setIsAlreadyNormalized(true);
              }
              workbookRef.current = workbook;
              setIsProcessing(false);
            }
          } catch (err) {
            setError('Error during data analysis.');
            console.error(err);
            setIsProcessing(false);
          }
        };

        validateChunk();
      } catch (err) {
        setError('Failed to read the Excel file.');
        console.error(err);
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(uploadedFile);
  };

  const processFile = (option: 'quotes' | 'capitalize' | 'both') => {
    if (!workbookRef.current || !file) return;

    setIsProcessing(true);
    setProcessingMessage('Transforming data...');
    setError(null);
    setIsSelectionModalOpen(false);

    setTimeout(() => {
      try {
        const originalWorkbook = workbookRef.current!;
        // Efficiently clone the workbook structure
        const workbook = XLSX.utils.book_new();
        workbook.Props = { ...originalWorkbook.Props };
        workbook.Custprops = { ...originalWorkbook.Custprops };
        
        const firstSheetName = originalWorkbook.SheetNames[0];
        const firstSheet = originalWorkbook.Sheets[firstSheetName];
        const range = XLSX.utils.decode_range(firstSheet['!ref'] || 'A1');
        const headerRow = 8;

        // Find POSSIBLE NEXT STEP column
        let possibleNextStepCol = -1;
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cellAddress = XLSX.utils.encode_cell({ r: headerRow, c });
          const cell = firstSheet[cellAddress];
          if (cell && cell.v && String(cell.v).trim().toUpperCase() === 'POSSIBLE NEXT STEP') {
            possibleNextStepCol = c;
            break;
          }
        }

        if (possibleNextStepCol === -1) {
          throw new Error('Column "POSSIBLE NEXT STEP" not found in Row 9.');
        }

        // CRITICAL: Detect actual data range to avoid processing 1M empty rows
        let actualMaxRow = headerRow;
        let emptyRowCount = 0;
        const scanLimit = 100;

        for (let r = headerRow + 1; r <= range.e.r; r++) {
          const cellAddress = XLSX.utils.encode_cell({ r, c: possibleNextStepCol });
          const cell = firstSheet[cellAddress];
          const cellValue = cell && cell.v !== undefined && cell.v !== null ? String(cell.v).trim() : '';

          if (cellValue !== '') {
            actualMaxRow = r;
            emptyRowCount = 0;
          } else {
            emptyRowCount++;
          }

          if (emptyRowCount >= scanLimit) break;
        }

        originalWorkbook.SheetNames.forEach((name, idx) => {
          const originalSheet = originalWorkbook.Sheets[name];
          if (idx === 0) {
            // Clone the first sheet
            const newSheet: XLSX.WorkSheet = { ...originalSheet };
            
            // Optimization: Use actualMaxRow instead of full range for cloning
            for (let r = range.s.r; r <= actualMaxRow; r++) {
              for (let c = range.s.c; c <= range.e.c; c++) {
                const addr = XLSX.utils.encode_cell({ r, c });
                if (originalSheet[addr]) {
                  newSheet[addr] = { ...originalSheet[addr] };
                }
              }
            }
            XLSX.utils.book_append_sheet(workbook, newSheet, name);
          } else {
            // Reference other sheets to save memory
            XLSX.utils.book_append_sheet(workbook, originalSheet, name);
          }
        });

        const worksheet = workbook.Sheets[firstSheetName];
        
        const totalRowsCount = Math.max(0, actualMaxRow - headerRow);
        let updatedRowsCount = 0;
        let updatedQuotesCount = 0;
        let updatedReferenceIdCount = 0;
        let currentRow = headerRow + 1;
        const chunkSize = 2000;

        const processChunk = () => {
          try {
            const endRow = Math.min(currentRow + chunkSize, actualMaxRow + 1);
            
            const progress = Math.round(((currentRow - headerRow) / (totalRowsCount || 1)) * 100);
            setProcessingMessage(`Transforming data (${progress}%)...`);
            for (let r = currentRow; r < endRow; r++) {
              const cellAddress = XLSX.utils.encode_cell({ r, c: possibleNextStepCol });
              const cell = worksheet[cellAddress];
              
              if (cell && cell.v) {
                const originalValue = String(cell.v);
                const result = transformPossibleNextStep(originalValue, option);
                const newValue = result.newValue;
                const quotesChanged = result.quotesChanged;
                const capChanged = result.capChanged;
                
                if (newValue !== originalValue) {
                  if (quotesChanged) updatedQuotesCount++;
                  if (capChanged) updatedReferenceIdCount++;
                  
                  worksheet[cellAddress].v = newValue;
                  updatedRowsCount++;
                  if (worksheet[cellAddress].w) worksheet[cellAddress].w = newValue;
                }
              }
            }

            currentRow = endRow;

            if (currentRow <= actualMaxRow) {
              setTimeout(processChunk, 0);
            } else {
              // Trim the worksheet range before finalizing
              const finalRange = {
                s: { r: 0, c: 0 },
                e: { r: actualMaxRow, c: range.e.c }
              };
              worksheet['!ref'] = XLSX.utils.encode_range(finalRange);
              finalizeProcessing();
            }
          } catch (chunkErr: any) {
            console.error('Error in processChunk:', chunkErr);
            setError(`Error processing row ${currentRow}: ${chunkErr.message}`);
            setIsProcessing(false);
          }
        };

        const finalizeProcessing = () => {
          processedWorkbookRef.current = workbook;
          setSuccess(true);
          
          let description = '';
          if (option === 'quotes') description = 'Normalized quotes for strings and ensured boolean is not quoted.';
          else if (option === 'capitalize') description = 'Capitalized reference IDs (4th value).';
          else if (option === 'both') description = 'Normalized quotes and capitalized reference IDs.';

          setUpdateInfo({ 
            count: updatedRowsCount, 
            quotesCount: updatedQuotesCount,
            capCount: updatedReferenceIdCount,
            description, 
            totalRows: totalRowsCount,
            selectedOption: option
          });
          
          let suffix = '_PROCESSED';
          if (option === 'quotes') suffix = '_QUOTES_NORMALIZED';
          else if (option === 'capitalize') suffix = '_CAPITALIZED';
          else if (option === 'both') suffix = '_NORMALIZED';

          setDownloadFilename(file.name.replace('.xlsx', `${suffix}.xlsx`));
          setIsProcessing(false);
        };

        processChunk();
      } catch (err: any) {
        setError(err.message || 'An error occurred during processing.');
        setIsProcessing(false);
      }
    }, 100);
  };

  const downloadFile = () => {
    if (!processedWorkbookRef.current) return;

    setIsProcessing(true);
    setProcessingMessage('Generating Excel file (this may take a few minutes for large files)...');
    setError(null);
    
    setTimeout(() => {
      try {
        const workerCode = `
          importScripts('https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js');
          self.onmessage = function(e) {
            try {
              const wbout = XLSX.write(e.data.workbook, e.data.options);
              self.postMessage({ success: true, data: wbout });
            } catch (err) {
              self.postMessage({ success: false, error: err.message });
            }
          };
        `;
        
        const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(workerBlob));
        
        const workerTimeout = setTimeout(() => {
          console.error('Download worker timed out after 5 minutes');
          worker.terminate();
          setIsProcessing(false);
          setError('The download process timed out. The file is very large and taking longer than 5 minutes to generate.');
        }, 300000); // 5 minutes

        worker.onmessage = (e) => {
          clearTimeout(workerTimeout);
          setIsProcessing(false);
          if (e.data.success) {
            const blob = new Blob([e.data.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = downloadFilename || 'processed_file.xlsx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setIsModalOpen(false);
          } else {
            setError('Failed to generate download file: ' + e.data.error);
          }
          worker.terminate();
        };
        
        worker.onerror = (err) => {
          clearTimeout(workerTimeout);
          setIsProcessing(false);
          setError('Worker error: ' + err.message);
          worker.terminate();
        };
        
        worker.postMessage({ 
          workbook: processedWorkbookRef.current, 
          options: { bookType: 'xlsx', type: 'array' } 
        });
      } catch (err: any) {
        setIsProcessing(false);
        setError('Failed to initialize download: ' + err.message);
      }
    }, 100);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center justify-between mb-12"
      >
        <motion.button 
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'tween', ease: 'easeOut', duration: 0.2 }}
          onClick={onBack}
          className="group flex items-center gap-3 px-5 py-3 rounded-2xl cursor-pointer bg-white border border-blue-900 hover:bg-blue-50 hover:shadow-md"
        >
          <ArrowLeft size={18} className="text-blue-900 transition-colors" />
          <span className="text-sm font-bold text-blue-900 transition-colors">
            Go back to Home
          </span>
        </motion.button>

        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'tween', ease: 'easeOut', duration: 0.2 }}
          onClick={onReset}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold shadow-sm cursor-pointer bg-red-50 border border-red-100 text-red-600 hover:bg-red-100"
        >
          <RefreshCw size={18} className="text-red-600" /> 
          <span>Reset Tool</span>
        </motion.button>
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
            {columnNotFound && file && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md p-6 rounded-[2rem] bg-red-50 border border-red-100 text-red-800 flex flex-col items-center text-center gap-3"
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-red-100 text-red-600">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <h4 className="font-black text-lg">Column Not Found</h4>
                  <p className="text-sm font-medium opacity-80">
                    Couldn't identify the "POSSIBLE NEXT STEP" column in Row 9.<br/> Please ensure the file follows the correct template.
                  </p>
                </div>
              </motion.div>
            )}

            {file && !isAlreadyNormalized && !isProcessing && !success && analysisResult && !columnNotFound && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-2xl p-8 rounded-[2.5rem] bg-white border border-gray-100 shadow-xl shadow-gray-200/50 text-gray-900"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gray-50 text-gray-400">
                    <AlertCircle size={24} />
                  </div>
                  <div>
                    <h4 className="font-black text-xl tracking-tight">Identified Changes</h4>
                    <p className="text-sm font-bold text-gray-400">{analysisResult.totalRows} rows analyzed</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {analysisResult.bothFixRows.length === analysisResult.totalRows ? (
                    <div className="p-5 rounded-3xl bg-purple-50/50 border border-purple-100/50 text-purple-900">
                      <p className="flex items-center gap-3 font-bold text-base">
                        <span className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.6)]" />
                        All {analysisResult.totalRows} rows require quote normalization and referenceID capitalization
                      </p>
                    </div>
                  ) : analysisResult.quoteFixRows.length === analysisResult.totalRows ? (
                    <div className="p-5 rounded-3xl bg-amber-50/50 border border-amber-100/50 text-amber-900">
                      <p className="flex items-center gap-3 font-bold text-base">
                        <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                        All {analysisResult.totalRows} rows require quote normalization
                      </p>
                    </div>
                  ) : analysisResult.capitalizeRows.length === analysisResult.totalRows ? (
                    <div className="p-5 rounded-3xl bg-blue-50/50 border border-blue-100/50 text-blue-900">
                      <p className="flex items-center gap-3 font-bold text-base">
                        <span className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]" />
                        All {analysisResult.totalRows} rows require referenceID capitalization
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {analysisResult.bothFixRows.length > 0 && (
                        <div className="p-5 rounded-3xl bg-purple-50/50 border border-purple-100/50 text-purple-900">
                          <div className="flex items-center justify-between mb-2">
                            <span className="flex items-center gap-3 font-black text-base">
                              <span className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.6)]" />
                              Both Updates → {analysisResult.bothFixRows.length} rows
                            </span>
                          </div>
                          <p className="pl-5 text-purple-700/60 font-bold text-sm leading-relaxed break-all">
                            Rows: {formatRowNumbers(analysisResult.bothFixRows)}
                          </p>
                        </div>
                      )}
                      {analysisResult.quoteFixRows.length > 0 && (
                        <div className="p-5 rounded-3xl bg-amber-50/50 border border-amber-100/50 text-amber-900">
                          <div className="flex items-center justify-between mb-2">
                            <span className="flex items-center gap-3 font-black text-base">
                              <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                              Quote Normalization → {analysisResult.quoteFixRows.length} rows
                            </span>
                          </div>
                          <p className="pl-5 text-amber-700/60 font-bold text-sm leading-relaxed break-all">
                            Rows: {formatRowNumbers(analysisResult.quoteFixRows)}
                          </p>
                        </div>
                      )}
                      {analysisResult.capitalizeRows.length > 0 && (
                        <div className="p-5 rounded-3xl bg-blue-50/50 border border-blue-100/50 text-blue-900">
                          <div className="flex items-center justify-between mb-2">
                            <span className="flex items-center gap-3 font-black text-base">
                              <span className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]" />
                              ReferenceID Capitalization → {analysisResult.capitalizeRows.length} rows
                            </span>
                          </div>
                          <p className="pl-5 text-blue-700/60 font-bold text-sm leading-relaxed break-all">
                            Rows: {formatRowNumbers(analysisResult.capitalizeRows)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

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
            ) : !success && !columnNotFound && (
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
                {isProcessing ? processingMessage : 'Process File'}
              </button>
            )}

            {success && updateInfo && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-6 w-full max-w-2xl"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  {/* Identified Changes Block */}
                  {analysisResult && (
                    <div className="p-6 rounded-[2rem] bg-amber-50 border border-amber-100 text-amber-900">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-100 text-amber-600">
                          <AlertCircle size={16} />
                        </div>
                        <h4 className="font-black text-base">Identified Changes</h4>
                      </div>
                      <div className="space-y-3 text-xs font-medium">
                        {analysisResult.bothFixRows.length > 0 && (
                          <p className="flex flex-col gap-0.5">
                            <span className="text-amber-800 font-bold">Both updates:</span>
                            <span className="text-amber-600/80">Rows {formatRowNumbers(analysisResult.bothFixRows)}</span>
                          </p>
                        )}
                        {analysisResult.quoteFixRows.length > 0 && (
                          <p className="flex flex-col gap-0.5">
                            <span className="text-amber-800 font-bold">Only quotes:</span>
                            <span className="text-amber-600/80">Rows {formatRowNumbers(analysisResult.quoteFixRows)}</span>
                          </p>
                        )}
                        {analysisResult.capitalizeRows.length > 0 && (
                          <p className="flex flex-col gap-0.5">
                            <span className="text-amber-800 font-bold">Only capitalization:</span>
                            <span className="text-amber-600/80">Rows {formatRowNumbers(analysisResult.capitalizeRows)}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Applied Changes Block */}
                  <div className="p-6 rounded-[2rem] bg-green-50 border border-green-100 text-green-800">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-100 text-green-600">
                        <CheckCircle2 size={16} />
                      </div>
                      <h4 className="font-black text-base">Applied Changes</h4>
                    </div>
                    <div className="space-y-2 text-xs font-medium opacity-90">
                      <p className="flex justify-between">
                        <span>Total Rows Updated:</span>
                        <span className="font-black">{updateInfo.count}</span>
                      </p>
                      
                      {(updateInfo.selectedOption === 'quotes' || updateInfo.selectedOption === 'both') && (
                        <p className="flex justify-between">
                          <span>Quotes Normalized:</span>
                          <span className="font-black">{updateInfo.quotesCount || 0}</span>
                        </p>
                      )}
                      
                      {(updateInfo.selectedOption === 'capitalize' || updateInfo.selectedOption === 'both') && (
                        <p className="flex justify-between">
                          <span>Reference IDs Capitalized:</span>
                          <span className="font-black">{updateInfo.capCount || 0}</span>
                        </p>
                      )}

                      <p className="pt-2 border-t border-green-200/50 text-[10px] uppercase tracking-wider font-black">
                        Operation: {updateInfo.selectedOption === 'both' ? 'Full Normalization' : updateInfo.selectedOption === 'quotes' ? 'Quote Fix Only' : 'Capitalization Only'}
                      </p>
                    </div>
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
                  disabled={isProcessing}
                  className={`flex-1 px-4 py-4 rounded-2xl font-black transition-all shadow-lg active:scale-95 cursor-pointer ${isProcessing ? 'bg-gray-400 cursor-not-allowed' : 'bg-black text-white hover:bg-gray-800'}`}
                >
                  {isProcessing ? 'Generating...' : 'Download'}
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
            needsQuoteFix={validationResults.needsQuoteFix}
            needsCapitalization={validationResults.needsCapitalization}
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
  needsQuoteFix: boolean;
  needsCapitalization: boolean;
}

const SelectionModal: React.FC<SelectionModalProps> = ({ 
  isOpen, 
  onClose, 
  onProceed,
  needsQuoteFix,
  needsCapitalization
}) => {
  const [option, setOption] = useState<'quotes' | 'capitalize' | 'both' | null>(null);
  const [error, setError] = useState(false);

  // Set default option based on needs
  React.useEffect(() => {
    if (needsQuoteFix && !needsCapitalization) setOption('quotes');
    else if (!needsQuoteFix && needsCapitalization) setOption('capitalize');
    else if (needsQuoteFix && needsCapitalization) setOption('both');
  }, [needsQuoteFix, needsCapitalization]);

  if (!isOpen) return null;

  const handleProceed = () => {
    if (!option) {
      setError(true);
      return;
    }
    onProceed(option);
  };

  const options = [
    { 
      id: 'quotes', 
      title: 'Normalize Quotes', 
      desc: 'Ensure strings are double quoted and boolean is not quoted.',
      needed: needsQuoteFix
    },
    { 
      id: 'capitalize', 
      title: 'Capitalize Reference IDs', 
      desc: 'Convert the 4th value (referenceID) to uppercase.',
      needed: needsCapitalization
    },
    { 
      id: 'both', 
      title: 'Both Transformations', 
      desc: 'Apply both quote normalization and capitalization.',
      needed: needsQuoteFix && needsCapitalization
    },
  ].filter(opt => {
    // Only show "Both" if both are needed
    if (opt.id === 'both') return needsQuoteFix && needsCapitalization;
    return true;
  });

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
            {options.map((opt) => {
              const isCompleted = !opt.needed;
              return (
                <button
                  key={opt.id}
                  disabled={isCompleted}
                  onClick={() => {
                    setOption(opt.id as any);
                    setError(false);
                  }}
                  className={`w-full text-left p-5 rounded-3xl border-2 transition-all duration-300 ${
                    isCompleted
                      ? 'border-green-100 bg-green-50/50 cursor-not-allowed'
                      : option === opt.id 
                        ? 'border-black bg-black/5 shadow-md' 
                        : 'border-gray-100 hover:border-gray-200 bg-gray-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${
                        isCompleted ? 'text-green-600' : option === opt.id ? 'text-black' : 'text-gray-700'
                      }`}>
                        {opt.title}
                      </span>
                      {isCompleted && (
                        <span className="px-2 py-0.5 rounded-full bg-green-100 text-[10px] font-black uppercase text-green-600">
                          Already Correct
                        </span>
                      )}
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      isCompleted 
                        ? 'border-green-500 bg-green-500' 
                        : option === opt.id 
                          ? 'border-black bg-black' 
                          : 'border-gray-300'
                    }`}>
                      {(option === opt.id || isCompleted) && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{opt.desc}</p>
                </button>
              );
            })}
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
            className="flex-1 px-4 py-4 rounded-2xl font-bold transition-all active:scale-95 cursor-pointer bg-transparent text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleProceed}
            className="flex-1 px-4 py-4 rounded-2xl font-black transition-all shadow-xl active:scale-95 cursor-pointer bg-black text-white hover:bg-gray-800"
          >
            Proceed
          </button>
        </div>
      </motion.div>
    </div>
  );
};
