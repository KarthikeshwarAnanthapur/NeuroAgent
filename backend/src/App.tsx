import React from 'react';
import { useNeuro } from './context/NeuroContext';
import { TopHeader } from './components/layout/TopHeader';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { EEGData } from './pages/EEGData';
import { Channels } from './pages/Channels';
import { Preprocessing } from './pages/Preprocessing';
import { ICAAnalysis } from './pages/ICAAnalysis';
import { ArtifactAI } from './pages/ArtifactAI';
import { Reconstruction } from './pages/Reconstruction';
import { QualityCheck } from './pages/QualityCheck';
import { Visualization } from './pages/Visualization';
import { Reports } from './pages/Reports';
import { Export } from './pages/Export';

export const App: React.FC = () => {
  const { activeRoute } = useNeuro();

  const renderCurrentPage = () => {
    switch (activeRoute) {
      case 'dashboard':
        return <Dashboard />;
      case 'data':
        return <EEGData />;
      case 'channels':
        return <Channels />;
      case 'preprocessing':
        return <Preprocessing />;
      case 'ica':
        return <ICAAnalysis />;
      case 'ai':
        return <ArtifactAI />;
      case 'reconstruction':
        return <Reconstruction />;
      case 'quality':
        return <QualityCheck />;
      case 'visualization':
        return <Visualization />;
      case 'reports':
        return <Reports />;
      case 'export':
        return <Export />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#050811] text-[#f0f6fc] overflow-hidden select-none font-sans">
      {/* 1. FIXED TOP HEADER */}
      <TopHeader />

      {/* 2. BODY: LEFT SIDEBAR + MAIN WORKSPACE */}
      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
        <Sidebar />

        {/* MAIN WORKSPACE */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {renderCurrentPage()}
        </main>
      </div>
    </div>
  );
};

export default App;
