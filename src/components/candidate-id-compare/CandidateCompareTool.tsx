import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Copy, 
  Download, 
  Trash2, 
  Check, 
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  FileText,
  Loader2
} from 'lucide-react';
import { parseInput, makeUnique, compareSets } from './utils';

interface CandidateCompareToolProps {
  onBack?: () => void;
  onReset?: () => void;
}

export const CandidateCompareTool: React.FC<CandidateCompareToolProps> = ({ onBack, onReset }) => {
  const [leftInput, setLeftInput] = useState('');
  const [rightInput, setRightInput] = useState('');
  const [results, setResults] = useState<{
    onlyLeft: string[];
    onlyRight: string[];
    both: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [stats, setStats] = useState({
    left: { total: 0, unique: 0 },
    right: { total: 0, unique: 0 }
  });

  // Debounced stats calculation to keep UI responsive with large inputs
  useEffect(() => {
    const timer = setTimeout(() => {
      const leftParsed = parseInput(leftInput);
      const rightParsed = parseInput(rightInput);
      setStats({
        left: {
          total: leftParsed.length,
          unique: new Set(leftParsed.map(id => id.toLowerCase())).size
        },
        right: {
          total: rightParsed.length,
          unique: new Set(rightParsed.map(id => id.toLowerCase())).size
        }
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [leftInput, rightInput]);

  const handleMakeUnique = (side: 'left' | 'right') => {
    setIsProcessing(true);
    // Use setTimeout to allow UI to show processing state
    setTimeout(() => {
      if (side === 'left') {
        const parsed = parseInput(leftInput);
        const unique = makeUnique(parsed);
        setLeftInput(unique.join('\n'));
      } else {
        const parsed = parseInput(rightInput);
        const unique = makeUnique(parsed);
        setRightInput(unique.join('\n'));
      }
      setIsProcessing(false);
    }, 10);
  };

  const handleCompare = () => {
    setError(null);
    const leftParsed = parseInput(leftInput);
    const rightParsed = parseInput(rightInput);

    if (leftParsed.length === 0 && rightParsed.length === 0) {
      setError('Please provide IDs in at least one input field.');
      return;
    }

    setIsProcessing(true);
    setTimeout(() => {
      try {
        const diff = compareSets(leftParsed, rightParsed);
        setResults(diff);
      } catch (err) {
        setError('Comparison failed. The dataset might be too large for browser memory.');
        console.error(err);
      } finally {
        setIsProcessing(false);
      }
    }, 10);
  };

  const handleReset = () => {
    setLeftInput('');
    setRightInput('');
    setResults(null);
    setError(null);
    if (onReset) onReset();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const downloadResults = (ids: string[], filename: string) => {
    const blob = new Blob([ids.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header Controls */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center justify-between mb-8"
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
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'tween', ease: 'easeOut', duration: 0.2 }}
          onClick={handleReset}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold shadow-sm cursor-pointer bg-red-50 border border-red-100 text-red-600 hover:bg-red-100"
        >
          <RefreshCw size={18} className="text-red-600" /> 
          <span>Reset Tool</span>
        </motion.button>
      </motion.div>

      {/* Input Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Panel */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-8 bg-white rounded-[2.5rem] border border-gray-100 shadow-xl shadow-black/[0.02]"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Filter className="text-blue-600" size={20} />
               Candidate IDs from Reprocessed
            </h2>
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 bg-gray-50 px-2 py-1 rounded-md">
              Side A
            </div>
          </div>

          <div className="relative group">
            <textarea
              value={leftInput}
              onChange={(e) => setLeftInput(e.target.value)}
              placeholder="Paste Candidate IDs here (new lines, commas, or tabs)..."
              className="w-full h-80 p-6 bg-gray-50 border-none rounded-2xl text-sm font-mono focus:ring-2 focus:ring-blue-500/20 transition-all resize-none mb-4 outline-none"
            />
            {leftInput && (
              <button 
                onClick={() => setLeftInput('')}
                className="absolute top-4 right-4 p-2 text-gray-300 hover:text-red-500 transition-colors"
                title="Clear input"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Total: {stats.left.total}</span>
              <span className="text-[10px] font-bold text-blue-500 uppercase tracking-tighter">Unique: {stats.left.unique}</span>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleMakeUnique('left')}
              className="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 hover:bg-black transition-colors"
            >
              Make Unique
            </motion.button>
          </div>
        </motion.div>

        {/* Right Panel */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-8 bg-white rounded-[2.5rem] border border-gray-100 shadow-xl shadow-black/[0.02]"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Search className="text-purple-600" size={20} />
               Candidate IDs from Regular
            </h2>
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 bg-gray-50 px-2 py-1 rounded-md">
              Side B
            </div>
          </div>

          <div className="relative group">
            <textarea
              value={rightInput}
              onChange={(e) => setRightInput(e.target.value)}
              placeholder="Paste Candidate IDs here (new lines, commas, or tabs)..."
              className="w-full h-80 p-6 bg-gray-50 border-none rounded-2xl text-sm font-mono focus:ring-2 focus:ring-purple-500/20 transition-all resize-none mb-4 outline-none"
            />
            {rightInput && (
              <button 
                onClick={() => setRightInput('')}
                className="absolute top-4 right-4 p-2 text-gray-300 hover:text-red-500 transition-colors"
                title="Clear input"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Total: {stats.right.total}</span>
              <span className="text-[10px] font-bold text-purple-500 uppercase tracking-tighter">Unique: {stats.right.unique}</span>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleMakeUnique('right')}
              className="px-6 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/20 hover:bg-black transition-colors"
            >
              Make Unique
            </motion.button>
          </div>
        </motion.div>
      </div>

      {/* Compare Button */}
      <div className="flex flex-col items-center justify-center pt-8">
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-red-500 text-sm font-bold mb-4 bg-red-50 px-4 py-2 rounded-xl"
          >
            <AlertCircle size={16} />
            {error}
          </motion.div>
        )}
        <motion.button
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleCompare}
          disabled={isProcessing}
          className={`group px-12 py-5 bg-black text-white rounded-[2rem] text-lg font-black shadow-2xl shadow-black/20 flex items-center gap-4 transition-all ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-black/40'}`}
        >
          <span>{isProcessing ? 'Processing...' : 'Compare IDs'}</span>
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
            {isProcessing ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <RefreshCw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
            )}
          </div>
        </motion.button>
      </div>

      {/* Results Section */}
      <AnimatePresence>
        {results && (
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-12 border-t border-gray-100"
          >
            <ResultCard 
              title="Only in Reprocessed" 
              count={results.onlyLeft.length} 
              ids={results.onlyLeft} 
              color="blue"
              icon={<Search className="text-blue-600" size={20} />}
            />
            <ResultCard 
              title="Only in Regular" 
              count={results.onlyRight.length} 
              ids={results.onlyRight} 
              color="purple"
              icon={<Search className="text-purple-600" size={20} />}
            />
            <ResultCard 
              title="Present in Both" 
              count={results.both.length} 
              ids={results.both} 
              color="green"
              icon={<CheckCircle2 className="text-green-600" size={20} />}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface ResultCardProps {
  title: string;
  count: number;
  ids: string[];
  color: 'blue' | 'purple' | 'green';
  icon: React.ReactNode;
}

const ResultCard: React.FC<ResultCardProps> = ({ title, count, ids, color, icon }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100 hover:border-blue-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-100 hover:border-purple-200',
    green: 'bg-green-50 text-green-600 border-green-100 hover:border-green-200'
  };

  const [copied, setCopied] = useState(false);
  const displayLimit = 200;
  const displayedIds = ids.slice(0, displayLimit);

  const handleCopy = () => {
    navigator.clipboard.writeText(ids.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([ids.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, '_')}_ids.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-black/[0.02] flex flex-col h-[500px]"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl ${colorClasses[color].split(' ')[0]}`}>
            {icon}
          </div>
          <div>
            <h3 className="text-lg font-bold leading-tight">{title}</h3>
            <p className={`text-[10px] font-black uppercase tracking-widest ${colorClasses[color].split(' ')[1]}`}>
              {count} Results
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-gray-50 rounded-2xl mb-6 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {ids.length > 0 ? (
            <>
              {displayedIds.map((id, i) => (
                <div key={i} className="text-xs font-mono bg-white p-2 rounded-lg border border-gray-100 truncate shadow-sm">
                  {id}
                </div>
              ))}
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center opacity-30 gap-2">
              <FileText size={40} />
              <span className="text-[10px] font-bold uppercase tracking-widest">No entries found</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleCopy}
          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
            copied ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-black hover:text-white'
          }`}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? 'Copied' : 'Copy List'}</span>
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleDownload}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold bg-gray-100 text-gray-600 hover:bg-black hover:text-white transition-all"
        >
          <Download size={14} />
          <span>Download</span>
        </motion.button>
      </div>
    </motion.div>
  );
};
