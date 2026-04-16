import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Tags } from 'lucide-react';
import { FormattedLabelsTool } from '../components/FormattedLabelsTool';
import { ToolNavigation } from '../components/ToolNavigation';

export const LabelsToolPage: React.FC = () => {
  const navigate = useNavigate();
  const [resetCounter, setResetCounter] = useState(0);

  return (
    <div className="max-w-5xl mx-auto relative">
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12"
      >
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 bg-black text-white">
            <Tags className='mb-0.5' size={12} />
            <span className='mt-0.5'>Labels Tool</span>
          </div>
          <h1 className="tracking-tighter leading-none text-5xl font-black">
            Format <span className="text-gray-300">Labels</span>
          </h1>
          <p className="font-medium text-gray-500">
            Extract and format labels based on Reference IDs.
          </p>
        </div>
        <ToolNavigation />
      </motion.header>

      <main className="space-y-8">
        <FormattedLabelsTool 
          key={`labels-${resetCounter}`} 
          onBack={() => navigate('/')} 
          onReset={() => setResetCounter(prev => prev + 1)} 
        />
      </main>
    </div>
  );
};
