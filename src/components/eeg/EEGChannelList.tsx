import React, { useState, useMemo } from 'react';
import { useNeuro } from '../../context/NeuroContext';
import { Search } from 'lucide-react';

export const EEGChannelList: React.FC = () => {
  const { channels, selectedChannel, setSelectedChannel } = useNeuro();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredChannels = useMemo(() => {
    return channels.filter(ch =>
      ch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ch.index.toString().includes(searchTerm)
    );
  }, [channels, searchTerm]);

  return (
    <div className="w-56 shrink-0 h-full border-l border-cyan-500/15 flex flex-col bg-[#070e1b]/60 select-none">
      {/* Header */}
      <div className="p-3 border-b border-cyan-500/15">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold font-mono tracking-wider text-cyan-300 uppercase">
            Channel List
          </span>
          <span className="text-[10px] font-mono text-gray-400">
            ({channels.length})
          </span>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search channel..."
            className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-black/40 border border-cyan-500/20 text-xs font-mono text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition-colors"
          />
        </div>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredChannels.map(ch => {
          const isSelected = ch.name.toUpperCase() === selectedChannel.toUpperCase();
          const numStr = ch.index < 10 ? `0${ch.index}` : `${ch.index}`;

          return (
            <button
              key={ch.name}
              onClick={() => setSelectedChannel(ch.name)}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-mono transition-all duration-150 cursor-pointer ${
                isSelected
                  ? 'bg-cyan-500/20 border border-cyan-400/60 text-cyan-300 shadow-glow-cyan-sm font-bold'
                  : 'hover:bg-white/5 text-gray-300 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-gray-400 w-4 text-right">{numStr}</span>
                <span className="tracking-wide">{ch.name}</span>
              </div>

              {/* Status dot */}
              <div
                className={`w-2 h-2 rounded-full ${
                  ch.status === 'artifact'
                    ? 'bg-red-400 shadow-[0_0_6px_#ff3b5c]'
                    : ch.status === 'review'
                    ? 'bg-amber-400 shadow-[0_0_6px_#f59e0b]'
                    : 'bg-emerald-400 shadow-[0_0_6px_#00f5a0]'
                }`}
                title={`Status: ${ch.status}`}
              />
            </button>
          );
        })}

        {filteredChannels.length === 0 && (
          <div className="text-center py-6 text-xs text-gray-500 font-mono">
            No channel matches "{searchTerm}"
          </div>
        )}
      </div>
    </div>
  );
};
