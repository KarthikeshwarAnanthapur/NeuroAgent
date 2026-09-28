import React from 'react';
import { EEGScalp3D } from '../components/eeg/EEGScalp3D';
import { EEGChannelList } from '../components/eeg/EEGChannelList';
import { ICAComponentPanel } from '../components/ica/ICAComponentPanel';
import { BeforeAfterCharts } from '../components/charts/BeforeAfterCharts';
import { Brain } from 'lucide-react';

export const Dashboard: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col gap-4 overflow-y-auto p-4 select-none">
      {/* 1. CENTRAL WORKSPACE: 3D SCALP + CHANNEL LIST (LEFT) & AI COMPONENT ANALYSIS (RIGHT) */}
      <div className="grid grid-cols-12 gap-4 flex-1 min-h-[460px]">
        {/* LEFT / CENTER PANEL: EEG CHANNELS (3D SCALP VIEW) + CHANNEL LIST */}
        <div className="col-span-7 flex flex-col rounded-2xl glass-panel border border-cyan-500/20 shadow-panel overflow-hidden">
          {/* Card Header */}
          <div className="px-4 py-2.5 border-b border-cyan-500/15 flex items-center justify-between bg-[#081121]/50">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
                <Brain className="w-3.5 h-3.5" />
              </div>
              <div>
                <h2 className="text-xs font-bold font-mono tracking-wider text-cyan-300 uppercase">
                  EEG Channels <span className="text-gray-400 font-normal">(3D Scalp View)</span>
                </h2>
                <div className="text-[10px] text-gray-400 font-mono">
                  64 Channels (10-20 System)
                </div>
              </div>
            </div>
          </div>

          {/* Scalp 3D Viewport + Channel List sub-column */}
          <div className="flex-1 flex overflow-hidden">
            {/* 3D Scalp Visualizer */}
            <div className="flex-1 relative h-full">
              <EEGScalp3D />
            </div>

            {/* Channel List Sub-column */}
            <EEGChannelList />
          </div>
        </div>

        {/* RIGHT PANEL: AI COMPONENT ANALYSIS */}
        <div className="col-span-5 h-full">
          <ICAComponentPanel />
        </div>
      </div>

      {/* 3. BOTTOM WORKSPACE: 3 SCIENTIFIC COMPARISON PANELS */}
      <div className="w-full">
        <BeforeAfterCharts />
      </div>
    </div>
  );
};
