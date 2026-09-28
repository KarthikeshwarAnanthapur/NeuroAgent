import React, { useState } from 'react';
import { useNeuro } from '../context/NeuroContext';
import { EEGScalp3D } from '../components/eeg/EEGScalp3D';
import { Eye, Layers, Compass, ZoomIn, ZoomOut } from 'lucide-react';

export const Visualization: React.FC = () => {
  const { channels, selectedChannel, setSelectedChannel } = useNeuro();
  const [activeTab, setActiveTab] = useState<'3d' | 'stacked'>('3d');

  // 16 key 10-20 channels for montage display
  const keyChannels = ['Fp1', 'Fp2', 'F7', 'F3', 'Fz', 'F4', 'F8', 'T7', 'C3', 'Cz', 'C4', 'T8', 'P7', 'Pz', 'P8', 'Oz'];

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4 select-none">
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
        <div>
          <h1 className="text-xl font-bold font-mono tracking-wide text-white flex items-center gap-2.5">
            <Eye className="w-5 h-5 text-cyan-400" />
            <span>Interactive Neuro-Visualization Suite</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Immersive 3D scalp surface exploration, spherical 10-20 topography, and multi-channel trace montage.
          </p>
        </div>

        <div className="flex rounded-lg bg-black/60 p-0.5 border border-cyan-500/30">
          <button
            onClick={() => setActiveTab('3d')}
            className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold transition-all cursor-pointer ${
              activeTab === '3d' ? 'bg-cyan-500 text-black shadow-glow-cyan-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            3D Scalp Hero
          </button>
          <button
            onClick={() => setActiveTab('stacked')}
            className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold transition-all cursor-pointer ${
              activeTab === 'stacked' ? 'bg-cyan-500 text-black shadow-glow-cyan-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            Multi-Trace Montage
          </button>
        </div>
      </div>

      {activeTab === '3d' ? (
        <div className="w-full h-[620px] rounded-2xl glass-panel border border-cyan-500/20 shadow-panel relative overflow-hidden">
          <EEGScalp3D />
        </div>
      ) : (
        <div className="p-5 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-cyan-300 border-b border-cyan-500/15 pb-2">
            <span>16-Channel Continuous Scalp Montage (Time Window: 0 - 10s)</span>
            <span className="text-gray-400">Scale: 50 µV / div</span>
          </div>

          <div className="space-y-2 py-2">
            {keyChannels.map((ch, idx) => {
              const isSelected = ch.toUpperCase() === selectedChannel.toUpperCase();
              return (
                <div
                  key={ch}
                  onClick={() => setSelectedChannel(ch)}
                  className={`flex items-center gap-3 p-1.5 rounded-lg cursor-pointer transition-all ${
                    isSelected ? 'bg-cyan-500/15 border border-cyan-400/40' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="w-10 text-right text-xs font-mono font-bold text-cyan-300">
                    {ch}
                  </div>
                  <div className="flex-1 h-6 relative bg-black/30 rounded flex items-center px-2">
                    <svg className="w-full h-full" viewBox="0 0 400 24" preserveAspectRatio="none">
                      <path
                        d={`M 0,12 Q 25,${idx % 2 === 0 ? 3 : 21} 50,12 T 100,${idx === 2 ? 0 : 12} T 150,${idx === 2 ? 24 : 12} T 200,12 T 250,${idx % 3 === 0 ? 5 : 18} T 300,12 T 350,12 T 400,12`}
                        fill="none"
                        stroke={isSelected ? '#00f5a0' : (idx === 2 ? '#ff3b5c' : '#38bdf8')}
                        strokeWidth="1.2"
                      />
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
