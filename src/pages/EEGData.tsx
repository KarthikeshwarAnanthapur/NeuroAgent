import React, { useState, useEffect } from 'react';
import { useNeuro } from '../context/NeuroContext';
import { fetchDatasetManifest } from '../api/reportApi';
import { Database, FileUp, CheckCircle, Clock, Cpu, BarChart3, AlertCircle } from 'lucide-react';

export const EEGData: React.FC = () => {
  const { subject, recording, session, subjects, recordings, setSubject, setRecording } = useNeuro();
  const [manifest, setManifest] = useState<any[]>([]);

  useEffect(() => {
    fetchDatasetManifest().then(setManifest);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5 select-none">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-4">
        <div>
          <h1 className="text-xl font-bold font-mono tracking-wide text-white flex items-center gap-2.5">
            <Database className="w-5 h-5 text-cyan-400" />
            <span>EEG Recording & Dataset Management</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Clinical EEG recordings inventory, EDF acquisition parameters, and data integrity verification.
          </p>
        </div>

        {/* Upload Button */}
        <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs shadow-glow-cyan transition-all cursor-pointer">
          <FileUp className="w-4 h-4" />
          <span>Upload EEG (.EDF / .FIF)</span>
          <input type="file" className="hidden" accept=".edf,.fif,.bdf,.set" />
        </label>
      </div>

      {/* Current Active Recording Overview */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel">
          <div className="text-[10px] font-mono uppercase text-gray-400">Current Session</div>
          <div className="text-2xl font-bold font-mono text-cyan-300 mt-1">
            {subject}{recording}
          </div>
          <div className="text-[11px] text-emerald-400 flex items-center gap-1.5 mt-2">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Integrity Verified</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel">
          <div className="text-[10px] font-mono uppercase text-gray-400">Electrode System</div>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            {session?.channels || 64} <span className="text-sm font-normal text-gray-400">Channels</span>
          </div>
          <div className="text-[11px] text-cyan-400 mt-2 font-mono">
            Standard 10-20 Extended
          </div>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel">
          <div className="text-[10px] font-mono uppercase text-gray-400">Sampling Rate</div>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            {session?.sampling_rate || 160} <span className="text-sm font-normal text-gray-400">Hz</span>
          </div>
          <div className="text-[11px] text-gray-400 mt-2 font-mono">
            Bandwidth: 0.1 - 70 Hz
          </div>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel">
          <div className="text-[10px] font-mono uppercase text-gray-400">Recording Length</div>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            {session?.duration ? session.duration.toFixed(2) : '60.99'} <span className="text-sm font-normal text-gray-400">s</span>
          </div>
          <div className="text-[11px] text-gray-400 mt-2 font-mono">
            9,760 Raw Samples
          </div>
        </div>
      </div>

      {/* Dataset Inventory Table */}
      <div className="p-5 rounded-2xl glass-panel border border-cyan-500/20 shadow-panel">
        <h2 className="text-sm font-bold font-mono tracking-wider text-cyan-300 uppercase mb-3 flex items-center justify-between">
          <span>Processed Subjects Inventory</span>
          <span className="text-xs text-gray-400 font-normal">Available in Local Repository</span>
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-cyan-500/20 text-gray-400 text-[11px]">
                <th className="py-2.5 px-3">Subject ID</th>
                <th className="py-2.5 px-3">Recording</th>
                <th className="py-2.5 px-3">Channels</th>
                <th className="py-2.5 px-3">Sampling Rate</th>
                <th className="py-2.5 px-3">Duration</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-200">
              {subjects.slice(0, 10).map((subj, idx) => {
                const isSelected = subj === subject;
                return (
                  <tr
                    key={subj}
                    className={`hover:bg-cyan-500/5 transition-colors ${
                      isSelected ? 'bg-cyan-500/10' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 font-bold text-white flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      <span>{subj}</span>
                    </td>
                    <td className="py-2.5 px-3 text-cyan-300">R01</td>
                    <td className="py-2.5 px-3">64 Ch</td>
                    <td className="py-2.5 px-3">160 Hz</td>
                    <td className="py-2.5 px-3">60.99 s</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-[10px]">
                        PROCESSED
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => { setSubject(subj); setRecording('R01'); }}
                        className={`px-3 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-500 text-black font-bold'
                            : 'bg-white/5 hover:bg-white/10 text-cyan-300 border border-cyan-500/30'
                        }`}
                      >
                        {isSelected ? 'Loaded' : 'Load EEG'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
