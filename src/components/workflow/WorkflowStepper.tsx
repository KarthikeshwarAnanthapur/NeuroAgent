import React from 'react';
import { useNeuro } from '../../context/NeuroContext';
import { Check, ArrowRight } from 'lucide-react';

export const WorkflowStepper: React.FC = () => {
  const { workflowSteps, setActiveRoute } = useNeuro();

  return (
    <div className="w-full py-2.5 px-6 rounded-2xl glass-panel flex items-center justify-between gap-2 overflow-x-auto select-none border border-cyan-500/20 shadow-panel">
      {workflowSteps.map((step, index) => {
        const isCompleted = step.status === 'completed';
        const isInProgress = step.status === 'in_progress';
        const isPending = step.status === 'pending';

        return (
          <React.Fragment key={step.id}>
            {/* Step Item */}
            <button
              onClick={() => setActiveRoute(step.path)}
              className="flex items-center gap-3 group text-left cursor-pointer transition-all duration-200"
            >
              {/* Step Number / Icon Badge */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono transition-all duration-300 ${
                  isCompleted
                    ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(0,245,160,0.3)]'
                    : isInProgress
                    ? 'bg-cyan-500/25 border-2 border-cyan-400 text-cyan-200 shadow-glow-cyan animate-pulse'
                    : 'bg-white/5 border border-gray-700 text-gray-500'
                }`}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5 text-emerald-300 stroke-[3]" /> : step.id}
              </div>

              {/* Title & Status */}
              <div>
                <div
                  className={`text-xs font-semibold tracking-wide transition-colors ${
                    isCompleted
                      ? 'text-gray-200 group-hover:text-emerald-300'
                      : isInProgress
                      ? 'text-cyan-300 font-bold group-hover:text-cyan-200'
                      : 'text-gray-400 group-hover:text-gray-300'
                  }`}
                >
                  {step.title}
                </div>
                <div
                  className={`text-[10px] font-mono tracking-wider uppercase ${
                    isCompleted
                      ? 'text-emerald-400'
                      : isInProgress
                      ? 'text-cyan-400 font-semibold flex items-center gap-1'
                      : 'text-gray-500'
                  }`}
                >
                  {isInProgress && (
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping inline-block" />
                  )}
                  {isCompleted ? 'Completed' : isInProgress ? 'In Progress' : 'Pending'}
                </div>
              </div>
            </button>

            {/* Connecting line between steps */}
            {index < workflowSteps.length - 1 && (
              <div className="flex-1 mx-2 flex items-center justify-center min-w-[24px]">
                <div
                  className={`h-0.5 w-full rounded-full transition-all duration-500 ${
                    isCompleted && workflowSteps[index + 1].status !== 'pending'
                      ? 'bg-gradient-to-r from-emerald-500/80 to-cyan-500/80'
                      : isCompleted
                      ? 'bg-emerald-500/40'
                      : 'bg-gray-800'
                  }`}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
