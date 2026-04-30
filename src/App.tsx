/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { 
  FileSpreadsheet
} from 'lucide-react';
import { motion } from 'motion/react';
import { Home } from './pages/Home';
import { DRLToolPage } from './pages/DRLToolPage';
import { LabelsToolPage } from './pages/LabelsToolPage';
import { CapitalizeToolPage } from './pages/CapitalizeToolPage';
import { CandidateComparePage } from './pages/CandidateComparePage';

export default function App() {
  return (
    <BrowserRouter>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen font-sans p-4 md:p-8 bg-[#f8f9fa] text-[#1a1a1a] selection:bg-black selection:text-white"
      >
        <div className="max-w-5xl mx-auto relative">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/drl-to-csv" element={<DRLToolPage />} />
            <Route path="/format-labels" element={<LabelsToolPage />} />
            <Route path="/capitalize-tool" element={<CapitalizeToolPage />} />
            <Route path="/compare-ids" element={<CandidateComparePage />} />
          </Routes>

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
      </motion.div>
    </BrowserRouter>
  );
}
