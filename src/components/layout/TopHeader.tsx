import React, { useState } from 'react';
import { useNeuro } from '../../context/NeuroContext';
import { Settings, User, ChevronDown, Check, Activity, FileSpreadsheet, Upload, Play } from 'lucide-react';

export const TopHeader: React.FC = () => {
  const {
    subject,
    recording,
    session,
    subjects,
    recordings,
    setSubject,
    setRecording,
    uploadedFile,
    uploadedFileName,
    setUploadedFile,
    runAnalysis,
    isProcessing,
  } = useNeuro();

  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  return (
    <header className="h-16 px-5 border-b border-cyan-500/20 bg-[#070e1c]/80 backdrop-blur-xl flex items-center justify-between select-none z-50 sticky top-0">
      {/* LEFT: Brand Logo & Title */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-950/40 border border-cyan-500/40 shadow-glow-cyan-sm">
          <svg className="w-6 h-6 text-cyan-400 animate-pulse" viewBox="0 0 36 36" fill="none">
            <circle cx="18" cy="18" r="16" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.4" />
            <circle cx="18" cy="8" r="2.5" fill="#00d4ff" />
            <circle cx="8" cy="22" r="2.5" fill="#00f5a0" />
            <circle cx="28" cy="22" r="2.5" fill="#b057f5" />
            <circle cx="18" cy="28" r="2" fill="#00d4ff" />
            <line x1="18" y1="8" x2="8" y2="22" stroke="#00d4ff" strokeWidth="1.2" strokeOpacity="0.6" />
            <line x1="18" y1="8" x2="28" y2="22" stroke="#00d4ff" strokeWidth="1.2" strokeOpacity="0.6" />
            <line x1="8" y1="22" x2="28" y2="22" stroke="#00f5a0" strokeWidth="1" strokeOpacity="0.5" />
            <line x1="8" y1="22" x2="18" y2="28" stroke="#00f5a0" strokeWidth="1" strokeOpacity="0.5" />
            <line x1="28" y1="22" x2="18" y2="28" stroke="#b057f5" strokeWidth="1" strokeOpacity="0.5" />
            <circle cx="18" cy="18" r="3" fill="#00d4ff" fillOpacity="0.8" />
          </svg>
          <div className="absolute inset-0 rounded-xl bg-cyan-400/10 blur-sm pointer-events-none" />
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-wider text-white font-display">
              NEURO<span className="text-cyan-400">AGENT</span>
            </h1>
          </div>
          <div className="text-[9.5px] font-semibold tracking-widest text-cyan-400/80 uppercase">
            AI-Powered EEG Artifact Removal
          </div>
        </div>
      </div>

      {/* CENTER: File Selector, Upload, RUN ANALYSIS & Live Metadata */}
      <div className="flex items-center gap-4">
        {/* File selector pill */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-[#0b1628] border border-cyan-500/30 hover:border-cyan-400 text-xs font-mono text-cyan-200 shadow-panel hover:bg-[#0f1f3a] transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
            <span>{uploadedFileName || session?.recording || `${subject}${recording}.edf`}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-cyan-400/80 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute left-0 mt-2 w-64 p-2 rounded-xl bg-[#091322] border border-cyan-500/30 shadow-2xl backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1">
                Select Subject
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1 mb-2">
                {subjects.map(s => (
                  <button
                    key={s}
                    onClick={() => { setSubject(s); }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono text-left transition-all ${
                      s === subject ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    <span>Subject: {s}</span>
                    {s === subject && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                  </button>
                ))}
              </div>

              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1 border-t border-cyan-500/20 pt-2">
                Recording Run
              </div>
              <div className="flex gap-1.5 p-1">
                {recordings.map(r => (
                  <button
                    key={r}
                    onClick={() => { setRecording(r); setDropdownOpen(false); }}
                    className={`flex-1 py-1 rounded text-xs font-mono text-center transition-all ${
                      r === recording ? 'bg-cyan-500 text-black font-bold shadow-glow-cyan-sm' : 'bg-white/5 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 1. Upload EEG Button */}
        <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0b1628] hover:bg-[#0f1f3a] border border-cyan-500/30 hover:border-cyan-400 text-xs font-mono text-cyan-200 shadow-panel transition-all cursor-pointer">
          <Upload className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="max-w-[120px] truncate" title={uploadedFileName || 'Upload EEG'}>
            {uploadedFileName || 'Upload EEG'}
          </span>
          <input
            type="file"
            accept=".edf"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>

        {/* 2. RUN ANALYSIS Button */}
        <button
          onClick={() => runAnalysis()}
          disabled={isProcessing}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-mono text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer shadow-glow-cyan-sm active:scale-95 ${
            isProcessing
              ? 'bg-cyan-600/50 text-cyan-200 border border-cyan-400/40 cursor-wait opacity-80'
              : 'bg-gradient-to-r from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-black'
          }`}
          title="Run EEG Analysis Pipeline"
        >
          <Play className={`w-3.5 h-3.5 fill-current shrink-0 ${isProcessing ? 'animate-spin' : ''}`} />
          <span>{isProcessing ? 'PROCESSING...' : 'RUN ANALYSIS'}</span>
        </button>

        {/* Vertical divider */}
        <div className="h-6 w-px bg-cyan-500/20" />

        {/* 3. Live Metadata chips */}
        <div className="flex items-center gap-4 text-xs">
          <div>
            <div className="text-[10px] text-gray-400 uppercase font-medium">Sampling Rate</div>
            <div className="font-mono font-bold text-white tracking-wide">
              {session?.sampling_rate != null ? session.sampling_rate : 160} <span className="text-cyan-400 text-[11px]">Hz</span>
            </div>
          </div>

          <div>
            <div className="text-[10px] text-gray-400 uppercase font-medium">Duration</div>
            <div className="font-mono font-bold text-white tracking-wide">
              {session?.duration != null ? session.duration.toFixed(2) : '60.99'} <span className="text-cyan-400 text-[11px]">s</span>
            </div>
          </div>

          <div>
            <div className="text-[10px] text-gray-400 uppercase font-medium">Channels</div>
            <div className="font-mono font-bold text-white tracking-wide">
              {session?.channels != null ? session.channels : 64}
            </div>
          </div>

          <div>
            <div className="text-[10px] text-gray-400 uppercase font-medium">ICA Components</div>
            <div className="font-mono font-bold text-white tracking-wide text-cyan-300">
              {session?.ica_components != null ? session.ica_components : 63}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: System Online & Actions */}
      <div className="flex items-center gap-3">
        {/* Status Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/40 border border-emerald-500/40 text-emerald-400 text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 pulse-online" />
          <span className="tracking-wide">System Online</span>
        </div>

        {/* Settings button */}
        <button
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-cyan-500/20 text-gray-300 hover:text-white transition-all cursor-pointer"
          title="Pipeline Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* User profile avatar */}
        <div className="w-8 h-8 rounded-full bg-cyan-950/80 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shadow-glow-cyan-sm">
          <User className="w-4 h-4" />
        </div>
      </div>
    </header>
  );
};
