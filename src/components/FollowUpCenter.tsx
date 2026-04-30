import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, where, doc, updateDoc, addDoc, arrayUnion } from 'firebase/firestore';
import { Lead, UserProfile, Client, FollowUp } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  FastForward, 
  Calendar, 
  MessageSquare, 
  User, 
  Building2,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  CalendarDays,
  Target,
  LayoutDashboard,
  Zap
} from 'lucide-react';
import { format, isSameDay, parseISO, isPast, isToday, addDays } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { formatDate } from '../lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { DatePicker } from './ui/DatePicker';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription 
} from './ui/dialog';

interface FollowUpCenterProps {
  profile: UserProfile | null;
  clientId: string;
  isDemoMode?: boolean;
  onLeadClick?: (lead: Lead) => void;
}

export default function FollowUpCenter({ profile, clientId, isDemoMode, onLeadClick }: FollowUpCenterProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'today' | 'pending' | 'completed'>('today');
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [schedulingFutureLead, setSchedulingFutureLead] = useState<Lead | null>(null);
  const [futureDate, setFutureDate] = useState<string>(format(addDays(new Date(), 7), 'yyyy-MM-dd'));

  useEffect(() => {
    if (isDemoMode) {
      const loadLeads = () => {
        const stored = localStorage.getItem('demo-leads');
        const allLeads: Lead[] = stored ? JSON.parse(stored) : [];
        // Filter leads for this client and that need follow-up
        setLeads(allLeads.filter(l => l.clientId === clientId && l.isActive));
        setLoading(false);
      };
      loadLeads();
      window.addEventListener('demo-leads-updated', loadLeads);
      return () => window.removeEventListener('demo-leads-updated', loadLeads);
    }

    const q = query(collection(db, 'leads'), where('clientId', '==', clientId), where('isActive', '==', true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const leadsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead));
      setLeads(leadsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching leads in FollowUpCenter:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [clientId, isDemoMode]);

  const handleAction = async (lead: Lead, action: 'done' | 'not-interested' | 'future' | 'reschedule', customDate?: string) => {
    const note = noteMap[lead.id] || '';
    const today = new Date().toISOString();
    
    let updates: Partial<Lead> = {
      updatedAt: today,
      lastActionAuthorId: profile?.uid || 'system',
    };

    const newFollowUp: FollowUp = {
      id: Math.random().toString(36).substr(2, 9),
      date: today,
      type: profile?.role === 'director' ? 'director' : 'account_manager',
      note: note || (action === 'done' ? 'Seguimiento realizado' : action === 'not-interested' ? 'Sin interés' : 'A futuro'),
      authorId: profile?.uid || 'system',
      authorName: profile?.displayName || 'Sistema'
    };

    if (action === 'done') {
      const currentSequence = lead.followUpSequence || 0;
      const nextSequence = currentSequence + 1;
      
      updates.status = lead.status === 'new' ? 'contacted' : lead.status;
      updates.lastAction = note || `Seguimiento Semanal #${nextSequence} realizado`;
      updates.followUpSequence = nextSequence;

      if (nextSequence <= 3) {
        // Move to next week
        updates.nextFollowUpDate = format(addDays(new Date(), 7), 'yyyy-MM-dd');
      } else {
        // No more weeks in sequence
        updates.status = 'not-interested';
        updates.lastAction = 'Secuencia de 3 seguimientos completada - Lead marcado como No Interesado';
        updates.nextFollowUpDate = undefined;
      }
    } else if (action === 'not-interested') {
      updates.status = 'not-interested';
      updates.lastAction = 'Marcado como No Interesado';
    } else if (action === 'future') {
      updates.status = 'future';
      updates.lastAction = 'Seguimiento programado para el futuro';
      updates.nextFollowUpDate = customDate || format(addDays(new Date(), 30), 'yyyy-MM-dd');
    } else if (action === 'reschedule') {
      updates.status = 'reschedule';
      updates.lastAction = note || 'Seguimiento reprogramado';
      updates.nextFollowUpDate = format(addDays(new Date(), 1), 'yyyy-MM-dd'); // Default to tomorrow
    }

    if (isDemoMode) {
      const stored = localStorage.getItem('demo-leads');
      const allLeads: Lead[] = stored ? JSON.parse(stored) : [];
      const index = allLeads.findIndex(l => l.id === lead.id);
      if (index !== -1) {
        allLeads[index] = { 
          ...allLeads[index], 
          ...updates, 
          followUps: [...(allLeads[index].followUps || []), newFollowUp] 
        };
        localStorage.setItem('demo-leads', JSON.stringify(allLeads));
        window.dispatchEvent(new CustomEvent('demo-leads-updated'));
        toast.success("Seguimiento registrado");
      }
    } else {
      await updateDoc(doc(db, 'leads', lead.id), {
        ...updates,
        followUps: arrayUnion(newFollowUp)
      });
      toast.success("Seguimiento registrado en la nube");
    }
    
    setNoteMap(prev => ({ ...prev, [lead.id]: '' }));
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pendingLeads = leads.filter(l => {
    // Matches the strict pending count logic
    if (l.status !== 'follow-up' || !l.nextFollowUpDate) return false;
    
    // Filter by stage based on role for "real" actionable data
    if (profile?.role === 'client') return false;

    const nextDate = parseISO(l.nextFollowUpDate);
    nextDate.setHours(0,0,0,0);

    if (filter === 'today') return isSameDay(nextDate, today) || isPast(nextDate);
    return true;
  }).sort((a, b) => {
    const dateA = a.nextFollowUpDate ? parseISO(a.nextFollowUpDate).getTime() : 0;
    const dateB = b.nextFollowUpDate ? parseISO(b.nextFollowUpDate).getTime() : 0;
    return dateA - dateB;
  });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 max-w-6xl mx-auto">
      {/* Header Premium */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary/20 via-primary/5 to-transparent p-10 border border-primary/20 shadow-2xl shadow-primary/5">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-10">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-primary shadow-xl shadow-primary/30 text-primary-foreground transform active:scale-95 transition-transform cursor-pointer">
                <Target size={28} />
              </div>
              <div>
                <h1 className="text-4xl font-black tracking-tighter text-foreground uppercase italic leading-none">Centro de Seguimientos</h1>
                <p className="text-[10px] font-black tracking-[0.3em] text-primary uppercase mt-1">Gestión Estratégica de Contactos</p>
              </div>
            </div>
            <p className="text-muted-foreground font-medium max-w-xl text-balance italic">
              "La constancia es la clave del cierre". Optimiza tu flujo de trabajo, prioriza los prospectos calientes y no dejes que ningún lead se enfríe.
            </p>
            
            <div className="flex flex-wrap gap-4 pt-2">
               <div className="flex items-center gap-2 px-4 py-2 bg-background/50 rounded-xl border border-border">
                  <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                  <span className="text-[10px] font-black uppercase text-muted-foreground">Atrasados:</span>
                  <span className="text-sm font-black text-destructive">{pendingLeads.filter(l => isPast(parseISO(l.nextFollowUpDate!)) && !isToday(parseISO(l.nextFollowUpDate!))).length}</span>
               </div>
               <div className="flex items-center gap-2 px-4 py-2 bg-background/50 rounded-xl border border-border">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-black uppercase text-muted-foreground">Para Hoy:</span>
                  <span className="text-sm font-black text-emerald-500">{pendingLeads.filter(l => isToday(parseISO(l.nextFollowUpDate!))).length}</span>
               </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 bg-card/60 backdrop-blur-xl p-2 rounded-3xl border border-border shadow-2xl">
            <div className="flex p-1 bg-muted rounded-2xl">
              <button 
                onClick={() => setFilter('today')}
                className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'today' ? 'bg-background text-primary shadow-lg scale-105' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Prioridad Hoy
              </button>
              <button 
                onClick={() => setFilter('pending')}
                className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'pending' ? 'bg-background text-primary shadow-lg scale-105' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Vista General
              </button>
            </div>
            <p className="text-[9px] text-center font-black text-muted-foreground/60 uppercase tracking-widest py-1">Total: {pendingLeads.length} leads</p>
          </div>
        </div>
        <div className="absolute -top-24 -right-24 h-64 w-64 bg-primary/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute -bottom-12 -left-12 h-32 w-32 bg-emerald-500/10 rounded-full blur-[60px]" />
      </div>

      {pendingLeads.length === 0 ? (
        <Card className="border-border/40 shadow-none bg-muted/20 rounded-3xl py-20">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <div className="h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-6 border border-emerald-500/20">
              <CheckCircle2 size={40} />
            </div>
            <h2 className="text-xl font-black text-foreground mb-2 italic">¡Increíble trabajo!</h2>
            <p className="text-muted-foreground font-medium max-w-sm">
              Has completado todos los seguimientos programados. Es un buen momento para buscar nuevos prospectos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {pendingLeads.map((lead) => (
              <motion.div
                key={lead.id}
                layout
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: -100 }}
                className="h-full"
              >
                <Card 
                  className="h-full border border-border/60 hover:border-primary/30 transition-all duration-300 shadow-sm hover:shadow-xl bg-card rounded-2xl flex flex-col overflow-hidden group cursor-pointer"
                  onClick={() => onLeadClick?.(lead)}
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />
                  
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between mb-2">
                       <Badge variant="outline" className={`text-[10px] font-black uppercase tracking-wider py-0 px-2 ${
                         isPast(parseISO(lead.nextFollowUpDate!)) && !isToday(parseISO(lead.nextFollowUpDate!)) ? 'border-destructive/50 text-destructive bg-destructive/5' : 'border-primary/30 text-primary'
                       }`}>
                         {isToday(parseISO(lead.nextFollowUpDate!)) ? 'PARA HOY' : 
                          isPast(parseISO(lead.nextFollowUpDate!)) ? 'ATRASADO' : 
                          formatDate(lead.nextFollowUpDate)}
                       </Badge>
                       <div className="flex gap-1 items-center" onClick={e => e.stopPropagation()}>
                          <div className="flex gap-0.5 mr-2">
                            {[1, 2, 3].map(i => (
                              <div 
                                key={i} 
                                className={`h-1.5 w-1.5 rounded-full ${
                                  (lead.followUpSequence || 0) >= i ? 'bg-green-500' : 'bg-muted-foreground/30'
                                }`} 
                              />
                            ))}
                          </div>
                          <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
                            {lead.followUps.filter(f => f.authorId === profile?.uid).length} ACT.
                          </span>
                       </div>
                    </div>
                    <CardTitle className="text-lg font-black tracking-tight text-foreground truncate">{lead.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                      <Building2 size={12} />
                      <span className="truncate">{lead.company}</span>
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex-1 space-y-4 pt-0">
                    <div className="bg-muted/40 p-3 rounded-xl border border-border/40">
                      <p className="text-[10px] font-black text-muted-foreground uppercase mb-1 flex items-center gap-1">
                        <TrendingUp size={10} /> Interés principal
                      </p>
                      <p className="text-xs font-semibold text-foreground italic">"{lead.interest}"</p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-muted-foreground uppercase flex items-center gap-1">
                        <MessageSquare size={10} /> Nota de Seguimiento
                      </p>
                      <textarea 
                        value={noteMap[lead.id] || ''}
                        onChange={(e) => setNoteMap(prev => ({ ...prev, [lead.id]: e.target.value }))}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="¿Qué pasó en este contacto?"
                        className="w-full h-20 bg-muted/60 border border-border rounded-xl p-3 text-xs font-semibold focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button 
                        onClick={() => handleAction(lead, 'done')}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[10px] uppercase gap-1.5 h-10 rounded-xl shadow-lg shadow-emerald-500/20"
                      >
                        <CheckCircle2 size={14} /> Contactado
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => handleAction(lead, 'not-interested')}
                        className="border-2 border-slate-200 text-slate-500 hover:bg-slate-50 font-black text-[10px] uppercase gap-1.5 h-10 rounded-xl"
                      >
                        <XCircle size={14} /> No Interesa
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => setSchedulingFutureLead(lead)}
                        className="border-2 border-sky-100 text-sky-600 hover:bg-sky-50 font-black text-[10px] uppercase gap-1.5 h-10 rounded-xl"
                      >
                        <CalendarDays size={14} /> A Futuro
                      </Button>
                      <Button 
                        variant="secondary"
                        onClick={() => handleAction(lead, 'reschedule')}
                        className="bg-muted text-foreground hover:bg-border font-black text-[10px] uppercase gap-1.5 h-10 rounded-xl"
                      >
                        <Clock size={14} /> Reprogramar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Future Scheduling Dialog */}
      <Dialog open={!!schedulingFutureLead} onOpenChange={(open) => !open && setSchedulingFutureLead(null)}>
        <DialogContent className="sm:max-w-[425px] rounded-[2rem] border-none bg-card p-0 overflow-hidden">
          <div className="bg-primary p-6 text-white pb-10">
            <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter mb-1">Agendar Seguimiento</DialogTitle>
            <DialogDescription className="text-white/70 text-xs font-bold uppercase tracking-widest">
              Selecciona la fecha para contactar a {schedulingFutureLead?.name}
            </DialogDescription>
          </div>
          
          <div className="p-8 -mt-6 bg-card rounded-t-[2rem] space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Fecha de Seguimiento</label>
              <DatePicker 
                date={futureDate} 
                setDate={setFutureDate} 
                className="h-14 rounded-2xl text-base border-2 focus:ring-primary h-12"
              />
            </div>

            <DialogFooter className="mt-8">
              <Button 
                variant="outline" 
                onClick={() => setSchedulingFutureLead(null)}
                className="rounded-2xl font-black text-[10px] uppercase h-12 px-6"
              >
                Cancelar
              </Button>
              <Button 
                onClick={() => {
                  if (schedulingFutureLead) {
                    handleAction(schedulingFutureLead, 'future', futureDate);
                    setSchedulingFutureLead(null);
                  }
                }}
                className="rounded-2xl font-black text-[10px] uppercase h-12 px-8 bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20"
              >
                Guardar Programación
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
