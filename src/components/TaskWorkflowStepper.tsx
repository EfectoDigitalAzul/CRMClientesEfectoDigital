import React from 'react';
import { TaskStage, TaskWorkflowType } from '../types';
import { Check, ArrowRight, FileText, CheckCircle, Palette, Sparkles, Clock } from 'lucide-react';

interface TaskWorkflowStepperProps {
  workflowType?: TaskWorkflowType;
  currentStage?: TaskStage;
  onSelectStage?: (stage: TaskStage) => void;
  canAdvance?: boolean;
}

export default function TaskWorkflowStepper({
  workflowType = 'integral_copy_design',
  currentStage = 'copywriting',
  onSelectStage,
  canAdvance = true,
}: TaskWorkflowStepperProps) {
  // Define stages for each workflow
  const getWorkflowStages = (): { id: TaskStage; label: string; role: string; icon: React.ReactNode }[] => {
    if (workflowType === 'integral_copy_design') {
      return [
        { id: 'copywriting', label: '1. Redacción Copy', role: 'Copywriter', icon: <FileText size={13} /> },
        { id: 'copy_review', label: '2. Revisión Copy', role: 'AM / Cliente', icon: <CheckCircle size={13} /> },
        { id: 'designing', label: '3. Diseño Piezas', role: 'Diseñador', icon: <Palette size={13} /> },
        { id: 'final_review', label: '4. Feedback & Aprobación', role: 'Cliente', icon: <Sparkles size={13} /> },
      ];
    } else if (workflowType === 'direct_design') {
      return [
        { id: 'designing', label: '1. Diseño Gráfico', role: 'Diseñador', icon: <Palette size={13} /> },
        { id: 'final_review', label: '2. Feedback & Revisión', role: 'Cliente', icon: <Sparkles size={13} /> },
        { id: 'completed', label: '3. Aprobado', role: 'Final', icon: <Check size={13} /> },
      ];
    } else if (workflowType === 'direct_copy') {
      return [
        { id: 'copywriting', label: '1. Redacción Copy', role: 'Copywriter', icon: <FileText size={13} /> },
        { id: 'final_review', label: '2. Feedback / Revisión', role: 'Cliente', icon: <CheckCircle size={13} /> },
        { id: 'completed', label: '3. Aprobado', role: 'Final', icon: <Check size={13} /> },
      ];
    } else {
      return [
        { id: 'designing', label: '1. En Elaboración', role: 'Equipo', icon: <Clock size={13} /> },
        { id: 'final_review', label: '2. En Revisión', role: 'Revisión', icon: <Sparkles size={13} /> },
        { id: 'completed', label: '3. Finalizado', role: 'Aprobado', icon: <Check size={13} /> },
      ];
    }
  };

  const stages = getWorkflowStages();
  const currentIdx = stages.findIndex((s) => s.id === currentStage);
  const activeIndex = currentIdx >= 0 ? currentIdx : 0;

  return (
    <div className="bg-muted/20 border border-border/30 rounded-xl p-3.5 space-y-3">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
            Pipeline de Producción
          </span>
          <span className="text-xs font-semibold text-foreground">
            {workflowType === 'integral_copy_design' && 'Flujo Integral (Copy ➔ Revisión ➔ Diseño ➔ Aprobación)'}
            {workflowType === 'direct_design' && 'Flujo Directo Diseño'}
            {workflowType === 'direct_copy' && 'Flujo Directo Copywriting'}
            {workflowType === 'general' && 'Flujo General'}
          </span>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground">
          Paso {activeIndex + 1} de {stages.length}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {stages.map((st, idx) => {
          const isDone = idx < activeIndex;
          const isCurrent = idx === activeIndex;
          const isUpcoming = idx > activeIndex;

          return (
            <button
              key={st.id}
              type="button"
              disabled={!canAdvance}
              onClick={() => onSelectStage && onSelectStage(st.id)}
              className={`p-2.5 rounded-lg border text-left transition-all relative ${
                isCurrent
                  ? 'bg-background border-primary shadow-xs ring-1 ring-primary/20'
                  : isDone
                  ? 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10'
                  : 'bg-background/40 border-border/20 opacity-60 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
                    isDone
                      ? 'bg-emerald-500 text-white'
                      : isCurrent
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isDone ? <Check size={11} /> : idx + 1}
                </span>
                <span className="text-[10px] font-medium text-muted-foreground">{st.role}</span>
              </div>
              <p
                className={`text-xs font-medium truncate ${
                  isCurrent
                    ? 'text-primary font-semibold'
                    : isDone
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {st.label}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
