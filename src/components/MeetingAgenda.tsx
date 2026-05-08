import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, onSnapshot, query, where, orderBy, addDoc, updateDoc, doc } from 'firebase/firestore';
import { Meeting, Lead, UserProfile, LeadStatus } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Video, 
  MoreVertical, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Plus
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { cn, formatDate } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { DialogTrigger } from '@/components/ui/dialog';

interface MeetingAgendaProps {
  clientId: string;
  isDemoMode?: boolean;
  profile: UserProfile | null;
  targetId?: string | null;
  onTargetProcessed?: () => void;
}

const MOCK_MEETINGS: Meeting[] = [
  {
    id: 'm1',
    leadId: '1',
    leadName: 'Juan Pérez',
    clientId: 'default',
    date: new Date().toISOString(),
    time: '10:00',
    duration: 45,
    status: 'pending',
    scheduledBy: 'Admin',
    meetingLink: 'https://meet.google.com/abc-defg-hij',
    createdAt: new Date().toISOString()
  },
  {
    id: 'm2',
    leadId: '3',
    leadName: 'Roberto Smith',
    clientId: 'default',
    date: addDays(new Date(), 1).toISOString(),
    time: '15:30',
    duration: 60,
    status: 'pending',
    scheduledBy: 'Admin',
    createdAt: new Date().toISOString()
  }
];

export default function MeetingAgenda({ clientId, isDemoMode, profile, targetId, onTargetProcessed }: MeetingAgendaProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isNewMeetingOpen, setIsNewMeetingOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [meetingDate, setMeetingDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [meetingTime, setMeetingTime] = useState('10:00');
  const [meetingLink, setMeetingLink] = useState('');
  const [meetingFeedback, setMeetingFeedback] = useState('');
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [confirmationData, setConfirmationData] = useState({
    didHappen: true,
    isQualified: true,
    rescheduleReason: ''
  });

  useEffect(() => {
    if (isDemoMode) {
      const stored = localStorage.getItem('demo-meetings');
      if (stored) {
        setMeetings(JSON.parse(stored).filter((m: Meeting) => m.clientId === clientId));
      } else {
        setMeetings(MOCK_MEETINGS.filter(m => m.clientId === clientId));
        localStorage.setItem('demo-meetings', JSON.stringify(MOCK_MEETINGS));
      }
      
      // Load leads for the dropdown
      const storedLeads = localStorage.getItem('demo-leads');
      if (storedLeads) {
        setLeads(JSON.parse(storedLeads).filter((l: Lead) => l.clientId === clientId));
      }
      
      setLoading(false);

      const handleUpdate = () => {
        const updated = localStorage.getItem('demo-meetings');
        if (updated) setMeetings(JSON.parse(updated).filter((m: Meeting) => m.clientId === clientId));
      };
      window.addEventListener('demo-meetings-updated', handleUpdate);
      return () => window.removeEventListener('demo-meetings-updated', handleUpdate);
    }

    const q = query(
      collection(db, 'meetings'), 
      where('clientId', '==', clientId),
      orderBy('date', 'asc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMeetings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Meeting)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'meetings');
    });

    // Also fetch leads for the dropdown
    const leadsQ = query(collection(db, 'leads'), where('clientId', '==', clientId));
    const leadsUnsubscribe = onSnapshot(leadsQ, (snapshot) => {
      setLeads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'leads');
    });

    return () => {
      unsubscribe();
      leadsUnsubscribe();
    };
  }, [clientId, isDemoMode]);

  useEffect(() => {
    if (targetId && meetings.length > 0) {
      const meeting = meetings.find(m => m.id === targetId);
      if (meeting) {
        setSelectedDate(new Date(meeting.date.replace(/-/g, '/')));
        if (onTargetProcessed) onTargetProcessed();
      }
    }
  }, [targetId, meetings, onTargetProcessed]);

  const handleCreateMeeting = async () => {
    const lead = leads.find(l => l.id === selectedLeadId);
    if (!lead) return;

    // Use / instead of - to avoid UTC issues
    const dateForMeeting = new Date(meetingDate.replace(/-/g, '/'));
    const newMeeting: Omit<Meeting, 'id'> = {
      leadId: lead.id,
      leadName: lead.name,
      clientId,
      date: dateForMeeting.toISOString(),
      time: meetingTime,
      duration: 45,
      status: 'pending',
      scheduledBy: profile?.displayName || 'Sistema',
      meetingLink: meetingLink || undefined,
      createdAt: new Date().toISOString()
    };

    try {
      if (isDemoMode) {
        const stored = localStorage.getItem('demo-meetings');
        const allMeetings = stored ? JSON.parse(stored) : MOCK_MEETINGS;
        const meetingWithId = { ...newMeeting, id: Math.random().toString(36).substr(2, 9) };
        allMeetings.push(meetingWithId);
        localStorage.setItem('demo-meetings', JSON.stringify(allMeetings));
        window.dispatchEvent(new CustomEvent('demo-meetings-updated'));

        // Update lead status and stage in demo
        const storedLeads = localStorage.getItem('demo-leads');
        if (storedLeads) {
          const allLeads: Lead[] = JSON.parse(storedLeads);
          const updatedLeads = allLeads.map(l => 
            l.id === lead.id ? { 
              ...l, 
              status: 'meeting-scheduled', 
              lastAction: `Reunión agendada: ${format(meetingDate, 'dd/MM/yyyy')} ${meetingTime}`,
              updatedAt: new Date().toISOString() 
            } : l
          );
          localStorage.setItem('demo-leads', JSON.stringify(updatedLeads));
          window.dispatchEvent(new CustomEvent('demo-leads-updated'));
        }
      } else {
        await addDoc(collection(db, 'meetings'), newMeeting);
        await updateDoc(doc(db, 'leads', lead.id), {
          status: 'meeting-scheduled',
          lastAction: `Reunión agendada: ${format(meetingDate, 'dd/MM/yyyy')} ${meetingTime}`,
          updatedAt: new Date().toISOString()
        });
      }
      toast.success("Reunión agendada correctamente");
      setIsNewMeetingOpen(false);
    } catch (error) {
      toast.error("Error al agendar reunión");
    }
  };

  const updateMeetingStatus = async (meetingId: string, status: Meeting['status']) => {
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;

    try {
      if (isDemoMode) {
        const stored = localStorage.getItem('demo-meetings');
        const allMeetings = stored ? JSON.parse(stored) : [];
        const updated = allMeetings.map((m: Meeting) => m.id === meetingId ? { ...m, status } : m);
        localStorage.setItem('demo-meetings', JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('demo-meetings-updated'));

        // Logic to change lead stage based on result
        if (status === 'completed' || status === 'cancelled' || status === 'no-show') {
          const storedLeads = localStorage.getItem('demo-leads');
          if (storedLeads) {
            const allLeads: Lead[] = JSON.parse(storedLeads);
            const leadStatus: LeadStatus = status === 'completed' ? 'qualified' : 'contacted';
            const updatedLeads = allLeads.map(l => 
              l.id === meeting.leadId ? { 
                ...l, 
                status: leadStatus,
                lastAction: `Reunión marcada como ${status === 'completed' ? 'Realizada' : 'No asistió/Cancelada'}`
              } : l
            );
            localStorage.setItem('demo-leads', JSON.stringify(updatedLeads));
            window.dispatchEvent(new CustomEvent('demo-leads-updated'));
          }
        }
      } else {
        await updateDoc(doc(db, 'meetings', meetingId), { status });
        
        // Logic to change lead stage based on result
        if (status === 'completed' || status === 'cancelled' || status === 'no-show') {
          const leadStatus: LeadStatus = status === 'completed' ? 'qualified' : 'contacted';
          const updateObj: any = {
            status: leadStatus,
            lastAction: `Reunión marcada como ${status === 'completed' ? 'Realizada' : 'No asistió/Cancelada'}`,
            updatedAt: new Date().toISOString()
          };
          
          if (status === 'completed') {
            updateObj.stage = 'commercial';
          }

          await updateDoc(doc(db, 'leads', meeting.leadId), updateObj);
        }
      }
      toast.success("Estado de reunión y etapa del lead actualizados");
    } catch (error) {
      toast.error("Error al actualizar estado");
    }
  };

  const handleClientConfirmation = async () => {
    if (!selectedMeetingId) return;
    
    const updateData: Partial<Meeting> = {
      clientConfirmed: true,
      status: confirmationData.didHappen ? 'completed' : 'reschedule',
      isQualified: confirmationData.didHappen ? confirmationData.isQualified : undefined,
      rescheduleReason: !confirmationData.didHappen ? confirmationData.rescheduleReason : undefined,
      feedback: meetingFeedback || undefined
    };

    try {
      const meeting = meetings.find(m => m.id === selectedMeetingId);
      if (!meeting) return;
      
      if (isDemoMode) {
        const stored = localStorage.getItem('demo-meetings');
        if (stored) {
          const allMeetings: Meeting[] = JSON.parse(stored);
          const updated = allMeetings.map(m => m.id === selectedMeetingId ? { ...m, ...updateData } : m);
          localStorage.setItem('demo-meetings', JSON.stringify(updated));
          window.dispatchEvent(new CustomEvent('demo-meetings-updated'));
        }
        
        // Update lead status based on meeting result
        const storedLeads = localStorage.getItem('demo-leads');
        if (storedLeads) {
          const allLeads: Lead[] = JSON.parse(storedLeads);
          const leadStatus: LeadStatus = confirmationData.didHappen 
            ? (confirmationData.isQualified ? 'qualified' : 'closed-lost')
            : 'reschedule';
          
          const updatedLeads = allLeads.map(l => 
            l.id === meeting.leadId ? { 
              ...l, 
              status: leadStatus,
              stage: confirmationData.didHappen && confirmationData.isQualified ? 'commercial' : l.stage,
              lastAction: confirmationData.didHappen 
                ? `Cliente confirmó reunión como ${confirmationData.isQualified ? 'Calificada' : 'Perdido'}. Feedback: ${meetingFeedback || 'Sin comentario'}`
                : `Cliente pide reprogramar: ${confirmationData.rescheduleReason}` 
            } : l
          );
          localStorage.setItem('demo-leads', JSON.stringify(updatedLeads));
          window.dispatchEvent(new CustomEvent('demo-leads-updated'));
        }
      } else {
        await updateDoc(doc(db, 'meetings', selectedMeetingId), updateData);
        
        const leadStatus: LeadStatus = confirmationData.didHappen 
          ? (confirmationData.isQualified ? 'qualified' : 'closed-lost')
          : 'reschedule';

        const leadUpdate: any = { 
          status: leadStatus, 
          lastAction: confirmationData.didHappen 
            ? `Cliente confirmó reunión como ${confirmationData.isQualified ? 'Calificada' : 'Perdido'}. Feedback: ${meetingFeedback || 'Sin comentario'}`
            : `Cliente pide reprogramar: ${confirmationData.rescheduleReason}`,
          updatedAt: new Date().toISOString()
        };

        if (confirmationData.didHappen && confirmationData.isQualified) {
          leadUpdate.stage = 'commercial';
        }

        await updateDoc(doc(db, 'leads', meeting.leadId), leadUpdate);
      }
      toast.success("Confirmación y etapa del lead guardadas");
      setIsConfirmationOpen(false);
      setSelectedMeetingId(null);
      setMeetingFeedback('');
    } catch (error) {
      toast.error("Error al guardar confirmación");
    }
  };

  const weekDays = eachDayOfInterval({
    start: startOfWeek(selectedDate, { weekStartsOn: 1 }),
    end: endOfWeek(selectedDate, { weekStartsOn: 1 })
  });

  const dailyMeetings = meetings.filter(m => isSameDay(parseISO(m.date), selectedDate));

  return (
    <div className="p-8 space-y-8 bg-background text-foreground min-h-full">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-extrabold tracking-tight">Agenda de Reuniones</h2>
          <p className="text-sm text-muted-foreground font-medium">Gestiona tus citas y videollamadas</p>
        </div>
        {profile?.role !== 'client' && (
          <Button onClick={() => setIsNewMeetingOpen(true)} className="gap-2 font-bold bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus size={18} />
            Agendar Reunión
          </Button>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Calendar Sidebar */}
        <Card className="lg:col-span-4 border-border bg-card shadow-none overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-muted/30">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold capitalize">
                {format(selectedDate, 'MMMM yyyy', { locale: es })}
              </CardTitle>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setSelectedDate(addDays(selectedDate, -7))}>
                  <ChevronLeft size={16} />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setSelectedDate(addDays(selectedDate, 7))}>
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => (
                <span key={d} className="text-[10px] font-bold text-muted-foreground">{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((day, i) => {
                const hasMeetings = meetings.some(m => isSameDay(parseISO(m.date), day));
                const isSelected = isSameDay(day, selectedDate);
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(day)}
                    className={`
                      relative h-10 rounded-lg flex flex-col items-center justify-center transition-all font-bold text-xs
                      ${isSelected ? 'bg-primary text-primary-foreground shadow-md scale-105 z-10' : 'text-foreground/70 hover:bg-muted'}
                    `}
                  >
                    <span>{format(day, 'd')}</span>
                    {hasMeetings && !isSelected && (
                      <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
            
            <div className="mt-8 space-y-4">
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Resumen Semanal</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 p-3 rounded-xl border border-border/50">
                  <p className="text-xs text-muted-foreground font-medium">Pendientes</p>
                  <p className="text-xl font-bold text-primary">{meetings.filter(m => m.status === 'pending').length}</p>
                </div>
                <div className="bg-muted/50 p-3 rounded-xl border border-border/50">
                  <p className="text-xs text-muted-foreground font-medium">Completadas</p>
                  <p className="text-xl font-bold text-success">{meetings.filter(m => m.status === 'completed').length}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Daily Schedule */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold">
              {isSameDay(selectedDate, new Date()) ? 'Hoy' : format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
            </h3>
            <span className="text-xs font-bold text-muted-foreground">{dailyMeetings.length} Reuniones</span>
          </div>

          <div className="space-y-3">
            {dailyMeetings.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 bg-muted/20 rounded-2xl border-2 border-dashed border-border/50 text-center px-4">
                <CalendarIcon size={40} className="text-muted-foreground/30 mb-3" />
                <p className="text-sm font-bold text-muted-foreground/50">No hay reuniones para este día</p>
                <Button variant="link" onClick={() => setIsNewMeetingOpen(true)} className="text-xs font-bold text-primary">
                  Agendar una ahora
                </Button>
              </div>
            ) : (
              dailyMeetings.map((meeting) => (
                <Card key={meeting.id} className="border-border bg-card shadow-none hover:bg-muted/30 transition-all group overflow-hidden">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="flex flex-col items-center justify-center min-w-[60px] border-r border-border pr-4">
                      <span className="text-sm font-black text-primary">{meeting.time}</span>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">{meeting.duration} min</span>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-sm text-foreground">{meeting.leadName}</h4>
                        <StatusBadge status={meeting.status} />
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-medium">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {meeting.time} hs
                        </span>
                        {meeting.meetingLink && (
                          <a 
                            href={meeting.meetingLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:text-primary/70 font-bold transition-colors"
                          >
                            <Video size={12} />
                            Unirse a llamada
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {meeting.status === 'pending' && profile?.role !== 'client' && (
                        <>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 w-8 p-0 text-success border-success/30 hover:bg-success/10"
                            onClick={() => updateMeetingStatus(meeting.id, 'completed')}
                          >
                            <CheckCircle2 size={16} />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 w-8 p-0 text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => updateMeetingStatus(meeting.id, 'cancelled')}
                          >
                            <XCircle size={16} />
                          </Button>
                        </>
                      )}
                      {profile?.role === 'client' && meeting.status === 'pending' && !meeting.clientConfirmed && (
                        <Button 
                          variant="default" 
                          size="sm" 
                          className="h-8 text-[11px] font-bold bg-primary hover:bg-primary/90"
                          onClick={() => {
                            setSelectedMeetingId(meeting.id);
                            setIsConfirmationOpen(true);
                          }}
                        >
                          Confirmar / Reprogramar
                        </Button>
                      )}
                      {(meeting.clientConfirmed || meeting.feedback) && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 text-[10px] font-bold text-muted-foreground"
                          disabled
                        >
                          {meeting.clientConfirmed ? 'Confirmada' : 'Con Feedback'}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      <Dialog open={isConfirmationOpen} onOpenChange={setIsConfirmationOpen}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle>Confirmación de Reunión</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <Label className="text-xs uppercase font-bold text-muted-foreground">¿Se realizó la reunión?</Label>
              <div className="flex gap-4">
                <Button 
                  type="button"
                  variant={confirmationData.didHappen ? 'default' : 'outline'}
                  onClick={() => setConfirmationData({...confirmationData, didHappen: true})}
                  className="flex-1"
                >
                  Sí, se tuvo
                </Button>
                <Button 
                  type="button"
                  variant={!confirmationData.didHappen ? 'default' : 'outline'}
                  onClick={() => setConfirmationData({...confirmationData, didHappen: false})}
                  className="flex-1"
                >
                  No se tuvo
                </Button>
              </div>
            </div>

            {confirmationData.didHappen ? (
              <div className="space-y-4">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Resultado de la reunión</Label>
                <div className="flex gap-4">
                  <Button 
                    type="button"
                    variant={confirmationData.isQualified ? 'default' : 'outline'}
                    onClick={() => setConfirmationData({...confirmationData, isQualified: true})}
                    className={`flex-1 text-xs font-bold ${confirmationData.isQualified ? 'bg-success hover:bg-success/90' : ''}`}
                  >
                    Calificada
                  </Button>
                  <Button 
                    type="button"
                    variant={!confirmationData.isQualified ? 'default' : 'outline'}
                    onClick={() => setConfirmationData({...confirmationData, isQualified: false})}
                    className={`flex-1 text-xs font-bold ${!confirmationData.isQualified ? 'bg-destructive hover:bg-destructive/90' : ''}`}
                  >
                    Perdido
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="reason" className="text-xs uppercase font-bold text-muted-foreground">Motivo opcional</Label>
                <Input 
                  id="reason" 
                  value={confirmationData.rescheduleReason} 
                  onChange={(e) => setConfirmationData({...confirmationData, rescheduleReason: e.target.value})} 
                  placeholder="Ej: No se presentó, pidió otra fecha..."
                  className="bg-muted border-border"
                />
                <p className="text-[10px] text-muted-foreground italic">Se marcará para Reprogramar</p>
              </div>
            )}

            <div className="space-y-2 border-t border-border pt-4">
              <Label htmlFor="feedback" className="text-xs uppercase font-bold text-muted-foreground">Feedback de la reunión (Opcional)</Label>
              <textarea
                id="feedback"
                className="w-full bg-muted border border-border rounded-lg p-3 text-sm min-h-[80px] focus:outline-none focus:ring-1 focus:ring-primary transition-all text-foreground"
                value={meetingFeedback}
                onChange={(e) => setMeetingFeedback(e.target.value)}
                placeholder="Cuéntanos un poco más sobre cómo fue la reunión..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmationOpen(false)} className="border-border">Cancelar</Button>
            <Button onClick={handleClientConfirmation} className="bg-primary text-primary-foreground font-bold">
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isNewMeetingOpen} onOpenChange={setIsNewMeetingOpen}>
        <DialogContent className="sm:max-w-[450px] bg-card border-border text-card-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">Agendar Nueva Reunión</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-foreground font-medium">Lead / Contacto</Label>
              <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
                <SelectTrigger className="bg-muted border-border">
                  <SelectValue placeholder="Seleccionar lead" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {leads.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.name} ({l.company})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground font-medium">Fecha de Reunión (DD/MM/YYYY)</Label>
                <Dialog open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                  <DialogTrigger
                    render={
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-bold border-border bg-muted h-11"
                      />
                    }
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                    {formatDate(meetingDate)}
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[340px] p-4 bg-card border-border shadow-2xl">
                    <DialogHeader>
                      <DialogTitle className="text-sm font-bold text-center">Seleccionar Fecha</DialogTitle>
                    </DialogHeader>
                    <div className="flex justify-center pt-2">
                      <Calendar
                        mode="single"
                        selected={new Date(meetingDate.replace(/-/g, '/'))}
                        onSelect={(date) => {
                          if (date) {
                            setMeetingDate(format(date, 'yyyy-MM-dd'));
                            setIsDatePickerOpen(false);
                          }
                        }}
                        initialFocus
                        locale={es}
                        className="rounded-md border border-border"
                      />
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="space-y-2">
                <Label htmlFor="time" className="text-foreground font-medium">Hora</Label>
                <Input 
                  id="time" 
                  type="time" 
                  value={meetingTime} 
                  onChange={(e) => setMeetingTime(e.target.value)} 
                  className="bg-muted border-border font-bold"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="link" className="text-foreground font-medium">Link de Reunión (Opcional)</Label>
              <Input 
                id="link" 
                value={meetingLink} 
                onChange={(e) => setMeetingLink(e.target.value)} 
                placeholder="https://meet.google.com/..."
                className="bg-muted border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewMeetingOpen(false)} className="border-border text-foreground">Cancelar</Button>
            <Button onClick={handleCreateMeeting} disabled={!selectedLeadId || !meetingDate || !meetingTime} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
              Agendar Reunión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: Meeting['status'] }) {
  const styles = {
    pending: 'bg-blue-400/20 text-blue-400 border border-blue-400/30',
    completed: 'bg-green-400/20 text-green-400 border border-green-400/30',
    cancelled: 'bg-red-400/20 text-red-400 border border-red-400/30',
    'no-show': 'bg-muted text-muted-foreground border border-border'
  };

  const labels = {
    pending: 'Pendiente',
    completed: 'Realizada',
    cancelled: 'Cancelada',
    'no-show': 'No asistió'
  };

  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
