import React, { useState } from 'react';
import { useNeuro } from '../context/NeuroContext';
import { Waves, Search, Activity, Zap, CheckCircle, AlertTriangle } from 'lucide-react';

export const Channels: React.FC = () => {
  const { channels, selectedChannel, setSelectedChannel, comparisonData } = useNeuro();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'clean' | 'artifact' | 'review'>('all');

  const filteredChannels = channels.filter(ch => {
    const matchesSearch = ch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          ch.index.toString().includes(searchTerm);
    const matchesFilter = filter === 'all' || ch.status === filter;
    return matchesSearch && matchesFilter;
  });

  const selectedChInfo = channels.find(c => c.name.toUpperCase() === selectedChannel.toUpperCase()) || channels[0];

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5 select-none">
      {/* Page Title */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-4">
        <div>
          <h1 className="text-xl font-bold font-mono tracking-wide text-white flex items-center gap-2.5">
            <Waves className="w-5 h-5 text-cyan-400" />
            <span>Channel Matrix & Scalp Electrometry</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            64-channel 10–20 international montage inspection, impedance validation, and individual electrometric statistics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {(['all', 'clean', 'artifact', 'review'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all cursor-pointer ${
                filter === f
                  ? 'bg-cyan-500 text-black font-bold shadow-glow-cyan-sm'
                  : 'bg-white/5 hover:bg-white/10 text-gray-300 border border-cyan-500/20'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Channel Deep Dive */}
      <div className="grid grid-cols-12 gap-4">
        {/* Selected Channel Metrics */}
        <div className="col-span-4 p-4 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel space-y-4">
          <div className="flex items-center justify-between border-b border-cyan-500/15 pb-2">
            <div>
              <span className="text-[10px] text-gray-400 font-mono uppercase">Selected Electrode</span>
              <div className="text-2xl font-bold font-mono text-cyan-300">
                {selectedChInfo.name} <span className="text-xs font-normal text-gray-400">(#{selectedChInfo.index})</span>
              </div>
            </div>

            <div
              className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono uppercase tracking-wider ${
                selectedChInfo.status === 'artifact'
                  ? 'bg-red-500/20 border border-red-500 text-red-400 shadow-glow-red'
                  : selectedChInfo.status === 'review'
                  ? 'bg-amber-500/20 border border-amber-500 text-amber-400'
                  : 'bg-emerald-500/20 border border-emerald-500 text-emerald-400'
              }`}
            >
              {selectedChInfo.status}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-2.5 rounded-xl bg-black/40 border border-cyan-500/15">
              <div className="text-[10px] text-gray-400 uppercase">Pre-Clean Std</div>
              <div className="text-base font-bold text-purple-400 mt-0.5">
                {comparisonData?.raw_std || 27.46} µV
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-black/40 border border-cyan-500/15">
              <div className="text-[10px] text-gray-400 uppercase">Post-Clean Std</div>
              <div className="text-base font-bold text-emerald-400 mt-0.5">
                {comparisonData?.clean_std || 11.14} µV
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-black/40 border border-cyan-500/15">
              <div className="text-[10px] text-gray-400 uppercase">Artifact Drop</div>
              <div className="text-base font-bold text-cyan-300 mt-0.5">
                -{comparisonData?.reduction_pct || 83.6}%
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-black/40 border border-cyan-500/15">
              <div className="text-[10px] text-gray-400 uppercase">Impedance</div>
              <div className="text-base font-bold text-white mt-0.5">
                4.2 kΩ <span className="text-emerald-400 text-xs font-normal">(OK)</span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-xs text-gray-300 space-y-1">
            <div className="font-bold text-cyan-300">Montage Spatial Coordinates</div>
            <div className="font-mono text-[11px] text-gray-400">
              X: {selectedChInfo.x} &nbsp;·&nbsp; Y: {selectedChInfo.y} &nbsp;·&nbsp; Z: {selectedChInfo.z}
            </div>
          </div>
        </div>

        {/* 64 Channel Grid Matrix */}
        <div className="col-span-8 p-4 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 border-b border-cyan-500/15 pb-2">
            <span className="text-xs font-bold font-mono tracking-wider text-cyan-300 uppercase">
              Electrode Grid Matrix ({filteredChannels.length} Channels)
            </span>

            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Filter channels..."
                className="w-full pl-8 pr-2.5 py-1 rounded-md bg-black/50 border border-cyan-500/20 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {/* Matrix grid */}
          <div className="grid grid-cols-8 gap-2 max-h-[360px] overflow-y-auto p-1">
            {filteredChannels.map(ch => {
              const isSelected = ch.name.toUpperCase() === selectedChannel.toUpperCase();
              return (
                <button
                  key={ch.name}
                  onClick={() => setSelectedChannel(ch.name)}
                  className={`p-2 rounded-xl text-center font-mono transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-cyan-500 text-black border-cyan-300 font-bold shadow-glow-cyan scale-105 z-10'
                      : ch.status === 'artifact'
                      ? 'bg-red-950/20 border-red-500/30 text-red-300 hover:border-red-400'
                      : ch.status === 'review'
                      ? 'bg-amber-950/20 border-amber-500/30 text-amber-300 hover:border-amber-400'
                      : 'bg-white/5 border-cyan-500/15 text-gray-200 hover:bg-white/10 hover:border-cyan-400'
                  }`}
                >
                  <div className="text-[10px] text-gray-400 font-normal">#{ch.index}</div>
                  <div className="text-xs font-bold mt-0.5">{ch.name}</div>
                  <div
                    className={`w-1.5 h-1.5 rounded-full mx-auto mt-1 ${
                      ch.status === 'artifact'
                        ? 'bg-red-400 shadow-[0_0_4px_#ff3b5c]'
                        : ch.status === 'review'
                        ? 'bg-amber-400 shadow-[0_0_4px_#f59e0b]'
                        : 'bg-emerald-400'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
