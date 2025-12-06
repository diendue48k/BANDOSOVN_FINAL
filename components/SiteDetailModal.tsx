import React from 'react';
import { Site, Person } from '../types';
import { SiteDetailContent } from './SiteDetailContent';
import { DirectionsIcon } from './Icons';

interface SiteDetailModalProps {
  site: Site;
  onClose: () => void;
  onPersonSelect: (person: Person) => void;
  onShowDirections: (site: Site) => void;
}

export const SiteDetailModal: React.FC<SiteDetailModalProps> = ({ site, onClose, onPersonSelect, onShowDirections }) => {
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-0 md:p-4 animate-fade-in"
      onClick={onClose}
    >
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
      <div 
        className="bg-slate-800 md:rounded-lg shadow-xl w-full h-full md:h-auto md:max-w-3xl md:max-h-[90vh] flex flex-col text-slate-200 border border-slate-700"
        onClick={(e) => e.stopPropagation()} // Prevent click from closing modal
      >
        <header className="p-4 border-b border-slate-700 flex justify-between items-center flex-shrink-0">
          <div className="flex-1 mr-4 min-w-0">
            <h2 className="text-2xl font-bold text-cyan-400 truncate">{site.site_name}</h2>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button 
                onClick={() => onShowDirections(site)}
                className="p-2 bg-slate-700 hover:bg-sky-600 text-sky-400 hover:text-white rounded-full transition-colors border border-slate-600"
                title="Chỉ đường tới đây"
            >
                <DirectionsIcon className="h-5 w-5" />
            </button>
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors p-2 rounded-full hover:bg-slate-700"
              aria-label="Đóng"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>
        <div className="p-6 overflow-y-auto">
          <SiteDetailContent siteId={site.site_id} isModal={true} onPersonSelect={onPersonSelect} />
        </div>
      </div>
    </div>
  );
};