import React from 'react';
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
  useDroppable
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Lead, LeadStatus, UserProfile } from '../types';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { Building2, User, Phone, Mail, Linkedin, MoreHorizontal, Calendar, Clock } from 'lucide-react';
import { getStatusBadgeColor, getStatusLabel, formatDate, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface LeadKanbanProps {
  leads: Lead[];
  onStatusChange: (leadId: string, newStatus: LeadStatus) => void;
  onLeadClick: (lead: Lead) => void;
  profile: UserProfile | null;
}

const COLUMNS: { id: string; title: string; color: string; statuses: LeadStatus[] }[] = [
  { id: 'new', title: 'Nuevo', color: 'bg-blue-500', statuses: ['new'] },
  { id: 'contacted', title: 'Contactado', color: 'bg-indigo-500', statuses: ['contacted'] },
  { id: 'follow-up', title: 'Seguimiento', color: 'bg-amber-500', statuses: ['follow-up'] },
  { id: 'future', title: 'A Futuro', color: 'bg-sky-500', statuses: ['future'] },
  { id: 'meeting-scheduled', title: 'Reunión', color: 'bg-purple-500', statuses: ['meeting-scheduled'] },
  { id: 'reschedule', title: 'Reprogramar', color: 'bg-pink-500', statuses: ['reschedule'] },
  { id: 'qualified', title: 'Calificada', color: 'bg-rose-500', statuses: ['qualified'] },
  { id: 'closed-won', title: 'Ganado', color: 'bg-emerald-500', statuses: ['closed-won'] },
  { id: 'closed-lost', title: 'Perdido', color: 'bg-slate-500', statuses: ['closed-lost'] },
];

export default function LeadKanban({ leads, onStatusChange, onLeadClick, profile }: LeadKanbanProps) {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeLead = leads.find(l => l.id === active.id);
    const overId = over.id as string;
    
    // Check if dropping over a column or another card
    const overColumn = COLUMNS.find(c => c.id === overId);
    let overLead = leads.find(l => l.id === overId);
    
    if (activeLead) {
      const newStatus = overColumn ? overColumn.statuses[0] : overLead?.status;
      if (newStatus && activeLead.status !== newStatus) {
        onStatusChange(activeLead.id, newStatus);
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
  };

  const activeLead = activeId ? leads.find(l => l.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-6 min-h-[50vh] md:min-h-[calc(100vh-320px)] max-h-[80vh] md:max-h-none custom-scrollbar overscroll-x-contain">
        {COLUMNS.map((column) => (
          <KanbanColumn 
            key={column.id} 
            column={column} 
            leads={leads.filter(l => column.statuses.includes(l.status))}
            onLeadClick={onLeadClick}
          />
        ))}
      </div>
      
      <DragOverlay dropAnimation={{
        sideEffects: defaultDropAnimationSideEffects({
          styles: {
            active: {
              opacity: '0.5',
            },
          },
        }),
      }}>
        {activeLead ? (
          <LeadCard lead={activeLead} isOverlay onLeadClick={() => {}} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

interface KanbanColumnProps {
  column: typeof COLUMNS[0];
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ column, leads, onLeadClick }) => {
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  return (
    <div className="flex-shrink-0 w-80 flex flex-col gap-3">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <div className={cn("h-2 w-2 rounded-full", column.color)} />
          <h3 className="font-bold text-sm text-foreground uppercase tracking-wider">{column.title}</h3>
          <Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px] font-bold h-5 px-1.5 border-none">
            {leads.length}
          </Badge>
        </div>
      </div>

      <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
        <div 
          ref={setNodeRef}
          className="flex-1 bg-muted/20 border border-border/50 rounded-2xl p-2 space-y-3 min-h-[400px]"
          id={column.id}
        >
          {leads.map((lead) => (
            <SortableLeadCard key={lead.id} lead={lead} onLeadClick={onLeadClick} />
          ))}
          {leads.length === 0 && (
            <div className="h-full flex items-center justify-center py-10 opacity-20 italic text-[10px] text-muted-foreground">
              Arrastra leads aquí
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

interface SortableLeadCardProps {
  lead: Lead;
  onLeadClick: (lead: Lead) => void;
}

const SortableLeadCard: React.FC<SortableLeadCardProps> = ({ lead, onLeadClick }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <LeadCard lead={lead} onLeadClick={onLeadClick} />
    </div>
  );
}

function LeadCard({ lead, isOverlay, onLeadClick }: { lead: Lead; isOverlay?: boolean; onLeadClick: (lead: Lead) => void }) {
  return (
    <Card 
      className={cn(
        "p-3 border border-border bg-card shadow-sm hover:border-primary/50 transition-all cursor-grab active:cursor-grabbing group",
        isOverlay && "shadow-2xl border-primary/50 rotate-2 scale-105",
        lead.status === 'qualified' && "border-emerald-500/30 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.05)]"
      )}
      onClick={() => onLeadClick(lead)}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">{lead.name}</span>
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1 truncate">
              <Building2 size={12} />
              {lead.company}
            </span>
          </div>
          {lead.stage && (
            <Badge variant="outline" className={cn(
              "text-[9px] font-black uppercase px-1.5 py-0 border-none shrink-0",
              lead.stage === 'setter' ? "bg-blue-500/10 text-blue-500" : "bg-purple-500/10 text-purple-500"
            )}>
              {lead.stage === 'setter' ? 'Setter' : 'Com'}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap text-[10px] font-medium text-muted-foreground">
          {lead.country && (
            <span className="flex items-center gap-1">
              <User size={10} />
              {lead.country}
            </span>
          )}
          {lead.tag && (
            <span className="px-1.5 py-0.5 bg-muted rounded leading-none border border-border/50">
              {lead.tag}
            </span>
          )}
        </div>

        {/* Follow-up Sequence Progress */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[9px] font-bold text-muted-foreground/70 uppercase">
            <span>Seguimiento</span>
            <span>{lead.followUpSequence || 0}/3</span>
          </div>
          <div className="flex gap-0.5 h-1 w-full bg-muted rounded-full overflow-hidden">
            {[1, 2, 3].map(i => (
              <div 
                key={i} 
                className={`flex-1 h-full rounded-full ${
                  (lead.followUpSequence || 0) >= i ? 'bg-green-500' : 'bg-muted-foreground/20'
                }`} 
              />
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="flex -space-x-1">
                {lead.contactInfo && (
                  <div className="h-5 w-5 rounded-full bg-muted border border-border flex items-center justify-center">
                    {lead.contactInfo.includes('@') ? <Mail size={10} /> : <Phone size={10} />}
                  </div>
                )}
                {lead.linkedinUrl && (
                  <div className="h-5 w-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                    <Linkedin size={10} />
                  </div>
                )}
             </div>
             <span className="text-[9px] font-bold text-muted-foreground uppercase">{formatDate(lead.updatedAt)}</span>
          </div>
          
          {lead.nextFollowUpDate && new Date(lead.nextFollowUpDate) <= new Date() && (
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          )}
        </div>
      </div>
    </Card>
  );
}
