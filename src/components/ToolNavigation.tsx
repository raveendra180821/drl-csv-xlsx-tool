import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { FileSpreadsheet, Tags, Type, Search } from 'lucide-react';

const tools = [
  { name: 'DRL Tool', path: '/drl-to-csv', icon: FileSpreadsheet },
  { name: 'Labels Tool', path: '/format-labels', icon: Tags },
  { name: 'Capitalize Tool', path: '/capitalize-tool', icon: Type },
  { name: 'Compare Tool', path: '/compare-ids', icon: Search },
];

export const ToolNavigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="flex items-center gap-3">
      {tools
        .filter((tool) => tool.path !== location.pathname)
        .map((tool) => (
          <motion.button
            key={tool.path}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'tween', ease: 'easeOut', duration: 0.2 }}
            onClick={() => navigate(tool.path)}
            className="flex items-center gap-2 px-4 py-3 rounded-2xl shadow-sm cursor-pointer bg-white border border-gray-200 hover:bg-gray-50 group"
          >
            <tool.icon size={18} className="text-blue-600 transition-colors" />
            <span className="text-xs font-bold text-gray-600 transition-colors group-hover:text-black">
              {tool.name}
            </span>
          </motion.button>
        ))}
    </div>
  );
};
