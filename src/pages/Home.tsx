import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  FileSpreadsheet, 
  Tags, 
  Type,
  RefreshCw,
  ExternalLink,
  GitCompare,
  FileCode
} from 'lucide-react';

const supportingTools = [
  { 
    name: 'BPD Comparison Tool', 
    description: 'Compare rule sheets and status mappings in mappings with clarity.',
    url: 'https://bpd-spark.vercel.app/',
    icon: GitCompare,
    color: 'bg-orange-50 text-orange-600'
  },
  { 
    name: 'XML to CSV/JSON', 
    description: 'Convert XML files into structured CSV or JSON formats.',
    url: 'https://xml-tool-bay.vercel.app/',
    icon: FileCode,
    color: 'bg-cyan-50 text-cyan-600'
  }
];

export const Home: React.FC = () => {
  const navigate = useNavigate();

  const resetApp = () => {
    window.location.reload();
  };

  return (
    <div className="max-w-5xl mx-auto relative">
      {/* Header Section */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12"
      >
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 bg-black text-white">
            <RefreshCw className='mb-0.5' size={12} />
            <span className='mt-0.5'>Tool Selection</span>
          </div>
          <h1 className="tracking-tighter leading-none text-5xl font-black">
            Select <span className="text-gray-300">a</span> Tool
          </h1>
          <p className="font-medium text-gray-500">
            Choose the specialized tool you need for your workflow.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'tween', ease: 'easeOut', duration: 0.2 }}
            onClick={resetApp}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold shadow-sm cursor-pointer bg-red-50 border border-red-100 text-red-600 hover:bg-red-100"
          >
            <RefreshCw size={18} className="text-red-600" /> 
            <span>Reset</span>
          </motion.button>
        </div>
      </motion.header>

      <main className="space-y-16">
        {/* Main Tools Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-12">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'tween', ease: 'easeOut', duration: 0.2 }}
            onClick={() => navigate('/drl-to-csv')}
            className="p-8 bg-white rounded-[2.5rem] border border-gray-100 shadow-xl shadow-black/[0.02] text-left group hover:border-black/10 cursor-pointer"
          >
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6 group-hover:bg-black group-hover:text-white transition-colors">
              <FileSpreadsheet size={32} />
            </div>
            <h3 className="text-2xl font-bold mb-2">DRL to CSV⧸ Excel</h3>
            <p className="text-sm text-gray-500 leading-relaxed">Extract workflow steps and metadata from DRL files with precision.</p>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'tween', ease: 'easeOut', duration: 0.2 }}
            onClick={() => navigate('/format-labels')}
            className="p-8 bg-white rounded-[2.5rem] border border-gray-100 shadow-xl shadow-black/[0.02] text-left group hover:border-black/10 cursor-pointer"
          >
            <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-6 group-hover:bg-black group-hover:text-white transition-colors">
              <Tags size={32} />
            </div>
            <h3 className="text-2xl font-bold mb-2">Format Labels</h3>
            <p className="text-sm text-gray-500 leading-relaxed">Extract and format labels based on Reference IDs from Excel files.</p>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'tween', ease: 'easeOut', duration: 0.2 }}
            onClick={() => navigate('/capitalize-tool')}
            className="p-8 bg-white rounded-[2.5rem] border border-gray-100 shadow-xl shadow-black/[0.02] text-left group hover:border-black/10 cursor-pointer"
          >
            <div className="w-16 h-16 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center mb-6 group-hover:bg-black group-hover:text-white transition-colors">
              <Type size={32} />
            </div>
            <h3 className="text-2xl font-bold mb-2">Capitalize IDs</h3>
            <p className="text-sm text-gray-500 leading-relaxed">Normalize quotes and capitalize Reference IDs in Excel files.</p>
          </motion.button>
        </div>

        {/* Supporting Tools Section - Slightly smaller cards for secondary tools */}
        <section className="pt-12 border-t border-gray-100">
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-2">
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-gray-400">Supporting Tools</h2>
              <div className="flex-1 h-px bg-gray-50" />
            </div>
            <p className="text-sm font-medium text-gray-400">
              Essential utilities to support your workflow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {supportingTools.map((tool, idx) => (
              <motion.a
                key={idx}
                href={tool.url}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.99 }}
                transition={{ type: 'tween', ease: 'easeOut', duration: 0.2 }}
                className="p-6 bg-white rounded-[2rem] border border-gray-100 shadow-lg shadow-black/[0.01] text-left group hover:border-black/5 block relative decoration-0"
              >
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-5 group-hover:bg-black group-hover:text-white transition-colors ${tool.color}`}>
                  <tool.icon size={28} />
                </div>
                
                <div className="absolute top-8 right-8 text-gray-300 group-hover:text-black transition-colors">
                  <ExternalLink size={16} />
                </div>

                <h3 className="text-xl font-bold mb-2">{tool.name}</h3>
                <p className="text-xs text-gray-400 leading-relaxed font-medium">{tool.description}</p>
              </motion.a>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};
