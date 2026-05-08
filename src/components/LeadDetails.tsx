import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { doc, updateDoc, collection, addDoc, onSnapshot, query, orderBy, getDoc } from 'firebase/firestore';
import { Lead, UserProfile, LeadStatus, FollowUp, Meeting, Client } from '../types';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './ui/select';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from './ui/sheet';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from './ui/dialog';
import { DatePicker } from './ui/DatePicker';
import { 
  Phone, 
  Mail, 
  MapPin, 
  Building2, 
  Calendar as CalendarIcon, 
  MessageSquare, 
  History,
  CheckCircle2,
  Clock,
  User,
  Linkedin,
  Video,
  Plus,
  UserCheck,
  UserCog,
  Loader2, 
  Sparkles,
  X,
  FileText,
  Upload
} from 'lucide-react';
import { toast } from 'sonner';
import { getStatusBadgeColor, getStatusLabel, formatDate, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { scrapeLinkedInProfile, analyzeLinkedInPDF } from '../services/linkedinService';
import { Calendar } from '@/components/ui/calendar';

interface LeadDetailsProps {
  lead: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: UserProfile | null;
  isDemoMode?: boolean;
}

export default function LeadDetails({ lead, open, onOpenChange, profile, isDemoMode }: LeadDetailsProps) {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isFutureDatePickerOpen, setIsFutureDatePickerOpen] = useState(false);
  const [futureFollowUpDate, setFutureFollowUpDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [confirmationData, setConfirmationData] = useState({
    didHappen: true,
    isQualified: true,
    rescheduleReason: ''
  });
  const [meetingDate, setMeetingDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [meetingTime, setMeetingTime] = useState('10:00');
  const [meetingLink, setMeetingLink] = useState('');
  const [meetingFeedback, setMeetingFeedback] = useState('');
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    name: lead.name,
    company: lead.company,
    contactInfo: lead.contactInfo,
    country: lead.country,
    sector: lead.sector,
    position: lead.position || '',
    interest: lead.interest,
    tag: lead.tag || ''
  });
  const [enriching, setEnriching] = useState(false);
  const [parsingPdf, setParsingPdf] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  useEffect(() => {
    setEditData({
      name: lead.name,
      company: lead.company,
      contactInfo: lead.contactInfo,
      country: lead.country,
      sector: lead.sector,
      position: lead.position || '',
      interest: lead.interest,
      tag: lead.tag || ''
    });
  }, [lead]);

  useEffect(() => {
    const fetchClientTags = async () => {
      if (!lead.clientId) return;
      
      try {
        if (isDemoMode) {
          const stored = localStorage.getItem('demo-clients');
          if (stored) {
            const clients = JSON.parse(stored) as Client[];
            const client = clients.find(c => c.id === lead.clientId);
            if (client?.availableTags) {
              setAvailableTags(client.availableTags);
            }
          }
        } else {
          const clientSnap = await getDoc(doc(db, 'clients', lead.clientId));
          if (clientSnap.exists()) {
            const data = clientSnap.data() as Client;
            if (data.availableTags) {
              setAvailableTags(data.availableTags);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching client tags:", error);
      }
    };

    if (open) {
      fetchClientTags();
    }
  }, [lead.clientId, open, isDemoMode]);

  const enrichWithAI = async () => {
    if (!lead.linkedinUrl) return;
    setEnriching(true);
    try {
      const data = await scrapeLinkedInProfile(lead.linkedinUrl);
      applyEnrichedData(data);
    } catch (error) {
      toast.error("Error al enriquecer perfil");
    } finally {
      setEnriching(false);
    }
  };

  const enrichWithPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error("Por favor sube un archivo PDF");
      return;
    }

    setParsingPdf(true);
    const toastId = toast.loading("Analizando PDF...");

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const data = await analyzeLinkedInPDF(base64);
        
        if (data) {
          await applyEnrichedData(data);
          toast.success("Perfil enriquecido desde PDF", { id: toastId });
        } else {
          toast.error("No se pudo analizar el PDF", { id: toastId });
        }
        setParsingPdf(false);
      };
      reader.onerror = () => {
        toast.error("Error al leer el archivo", { id: toastId });
        setParsingPdf(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("PDF Parsing error:", error);
      toast.error("Error al procesar el PDF", { id: toastId });
      setParsingPdf(false);
    }
  };

  const applyEnrichedData = async (data: any) => {
    if (data) {
      const updates: Partial<Lead> = {};
      if (data.name && data.name !== 'No especificado' && data.name !== 'Nombre') updates.name = data.name;
      if (data.company && data.company !== 'No especificado' && data.company !== 'Empresa') updates.company = data.company;
      if (data.position && data.position !== 'No especificado' && data.position !== 'Cargo') updates.position = data.position;
      if (data.country && data.country !== 'No especificado' && data.country !== 'País') updates.country = data.country;
      if (data.sector && data.sector !== 'No especificado' && data.sector !== 'Industria') updates.sector = data.sector;
      if (data.interest && data.interest !== 'No especificado') updates.interest = data.interest;
      if (data.contactInfo && data.contactInfo !== 'No especificado') updates.contactInfo = data.contactInfo;
      
      // Update local edit form if in edit mode
      if (isEditing) {
        setEditData(prev => ({ ...prev, ...updates }));
      }

      // Save to DB immediately if there are any real updates
      if (Object.keys(updates).length > 0) {
        if (isDemoMode) {
          updateLeadInDemo(updates);
        } else {
          await updateDoc(doc(db, 'leads', lead.id), {
            ...updates,
            updatedAt: new Date().toISOString()
          });
        }
        return true;
      }
    }
    return false;
  };

  useEffect(() => {
    if (!lead.id) return;

    if (isDemoMode) {
      const loadDemoData = () => {
        // Load follow-ups from lead object if they exist, or from a separate store
        // For simplicity in demo, we'll assume they are part of the lead object or stored by leadId
        const storedLeads = localStorage.getItem('demo-leads');
        if (storedLeads) {
          const allLeads: Lead[] = JSON.parse(storedLeads);
          const currentLead = allLeads.find(l => l.id === lead.id);
          if (currentLead) {
            setFollowUps(currentLead.followUps || []);
          }
        }

        const storedMeetings = localStorage.getItem('demo-meetings');
        if (storedMeetings) {
          const allMeetings: Meeting[] = JSON.parse(storedMeetings);
          setMeetings(allMeetings.filter(m => m.leadId === lead.id));
        }
      };

      loadDemoData();
      window.addEventListener('demo-leads-updated', loadDemoData);
      window.addEventListener('demo-meetings-updated', loadDemoData);
      return () => {
        window.removeEventListener('demo-leads-updated', loadDemoData);
        window.removeEventListener('demo-meetings-updated', loadDemoData);
      };
    }

    const fuQuery = query(collection(db, 'leads', lead.id, 'followUps'), orderBy('date', 'desc'));
    const fuUnsubscribe = onSnapshot(fuQuery, (snapshot) => {
      setFollowUps(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FollowUp)));
    });

    const mQuery = query(collection(db, 'leads', lead.id, 'meetings'), orderBy('date', 'desc'));
    const mUnsubscribe = onSnapshot(mQuery, (snapshot) => {
      setMeetings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Meeting)));
    });

    return () => {
      fuUnsubscribe();
      mUnsubscribe();
    };
  }, [lead.id, isDemoMode]);

  const updateLeadInDemo = (updates: Partial<Lead>) => {
    const stored = localStorage.getItem('demo-leads');
    if (stored) {
      const allLeads: Lead[] = JSON.parse(stored);
      const updatedLeads = allLeads.map(l => 
        l.id === lead.id ? { ...l, ...updates, updatedAt: new Date().toISOString() } : l
      );
      localStorage.setItem('demo-leads', JSON.stringify(updatedLeads));
      window.dispatchEvent(new CustomEvent('demo-leads-updated'));
    }
  };

  const addFollowUp = async () => {
    if (!newNote.trim()) return;
    setLoading(true);
    try {
      const fu: Omit<FollowUp, 'id'> = {
        date: new Date().toISOString(),
        type: profile?.role === 'setter' ? 'setter' : 'commercial',
        note: newNote,
        authorId: profile?.uid || auth.currentUser?.uid || 'demo-user',
        authorName: profile?.displayName || 'Usuario',
      };

      if (isDemoMode) {
        const stored = localStorage.getItem('demo-leads');
        if (stored) {
          const allLeads: Lead[] = JSON.parse(stored);
          const updatedLeads = allLeads.map(l => {
            if (l.id === lead.id) {
              const newFollowUps = [
                { ...fu, id: Math.random().toString(36).substr(2, 9) },
                ...(l.followUps || [])
              ];
              return {
                ...l,
                followUps: newFollowUps,
                lastAction: `Seguimiento: ${newNote.substring(0, 30)}...`,
                updatedAt: new Date().toISOString(),
                status: l.status === 'new' ? 'contacted' : l.status
              };
            }
            return l;
          });
          localStorage.setItem('demo-leads', JSON.stringify(updatedLeads));
          window.dispatchEvent(new CustomEvent('demo-leads-updated'));
        }
      } else {
        await addDoc(collection(db, 'leads', lead.id, 'followUps'), fu);
        await updateDoc(doc(db, 'leads', lead.id), {
          lastAction: `Seguimiento: ${newNote.substring(0, 30)}...`,
          lastActionAuthorId: auth.currentUser?.uid || 'demo-user',
          updatedAt: new Date().toISOString(),
          status: lead.status === 'new' ? 'contacted' : lead.status
        });
      }

      setNewNote('');
      toast.success("Seguimiento registrado");
    } catch (error) {
      toast.error("Error al registrar seguimiento");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus: LeadStatus) => {
    try {
      if (newStatus === 'future') {
        setIsFutureDatePickerOpen(true);
        return;
      }

      const updates: Partial<Lead> = {
        status: newStatus,
        updatedAt: new Date().toISOString()
      };

      // If it's a "meeting" or terminal status, clear the follow-up date
      if (['meeting-scheduled', 'qualified', 'closed-won', 'closed-lost', 'not-interested'].includes(newStatus)) {
        updates.nextFollowUpDate = undefined;
      }

      if (isDemoMode) {
        updateLeadInDemo(updates);
      } else {
        await updateDoc(doc(db, 'leads', lead.id), updates);
      }
      toast.success(`Estado actualizado a ${getStatusLabel(newStatus)}`);
    } catch (error) {
      toast.error("Error al actualizar estado");
    }
  };

  const handleFutureFollowUpSave = async () => {
    setLoading(true);
    try {
      const updates = {
        status: 'future' as LeadStatus,
        nextFollowUpDate: new Date(futureFollowUpDate.replace(/-/g, '/')).toISOString(),
        updatedAt: new Date().toISOString(),
        lastAction: `Marcado para seguimiento futuro: ${formatDate(futureFollowUpDate)}`
      };

      if (isDemoMode) {
        updateLeadInDemo(updates);
      } else {
        await updateDoc(doc(db, 'leads', lead.id), updates);
      }
      
      toast.success("Seguimiento futuro programado");
      setIsFutureDatePickerOpen(false);
    } catch (error) {
      toast.error("Error al programar seguimiento");
    } finally {
      setLoading(false);
    }
  };

  const updateStage = async (newStage: 'setter' | 'commercial') => {
    try {
      const now = new Date();
      const nextFollowUp = new Date(now);
      nextFollowUp.setDate(now.getDate() + 1);

      const updates = {
        stage: newStage,
        updatedAt: now.toISOString(),
        nextFollowUpDate: nextFollowUp.toISOString(),
        lastAction: `Cambiado a Fase ${newStage === 'setter' ? 'Setter' : 'Comercial'}`
      };

      if (isDemoMode) {
        updateLeadInDemo(updates);
      } else {
        await updateDoc(doc(db, 'leads', lead.id), updates);
      }
      toast.success(`Etapa actualizada a ${newStage === 'setter' ? 'Setter' : 'Comercial'}`);
    } catch (error) {
      toast.error("Error al actualizar etapa");
    }
  };

  const handleSaveEdit = async () => {
    setLoading(true);
    try {
      if (isDemoMode) {
        updateLeadInDemo(editData);
      } else {
        await updateDoc(doc(db, 'leads', lead.id), {
          ...editData,
          updatedAt: new Date().toISOString()
        });
      }
      toast.success("Lead actualizado correctamente");
      setIsEditing(false);
    } catch (error) {
      toast.error("Error al actualizar lead");
    } finally {
      setLoading(false);
    }
  };

  const handleClientMeetingConfirmation = async () => {
    if (!selectedMeetingId) return;
    
    const updateData: Partial<Meeting> = {
      clientConfirmed: true,
      status: confirmationData.didHappen ? 'completed' : 'reschedule',
      isQualified: confirmationData.didHappen ? confirmationData.isQualified : undefined,
      rescheduleReason: !confirmationData.didHappen ? confirmationData.rescheduleReason : undefined,
    };

    try {
      if (isDemoMode) {
        const stored = localStorage.getItem('demo-meetings');
        if (stored) {
          const allMeetings: Meeting[] = JSON.parse(stored);
          const updated = allMeetings.map(m => m.id === selectedMeetingId ? { ...m, ...updateData } : m);
          localStorage.setItem('demo-meetings', JSON.stringify(updated));
          window.dispatchEvent(new CustomEvent('demo-meetings-updated'));
        }
        
        if (confirmationData.didHappen) {
          const newStatus = confirmationData.isQualified ? 'qualified' : 'closed-lost';
          updateLeadInDemo({ 
            status: newStatus, 
            lastAction: `Reunión realizada - ${confirmationData.isQualified ? 'Calificado' : 'No Calificado'}`,
            updatedAt: new Date().toISOString()
          });
        } else {
          updateLeadInDemo({ status: 'reschedule', lastAction: `Cliente pide reprogramar: ${confirmationData.rescheduleReason}`, updatedAt: new Date().toISOString() });
        }
      } else {
        await updateDoc(doc(db, 'meetings', selectedMeetingId), updateData);
        if (confirmationData.didHappen) {
          const newStatus = confirmationData.isQualified ? 'qualified' : 'closed-lost';
          await updateDoc(doc(db, 'leads', lead.id), { 
            status: newStatus, 
            lastAction: `Reunión realizada - ${confirmationData.isQualified ? 'Calificado' : 'No Calificado'}`,
            updatedAt: new Date().toISOString()
          });
        } else {
          await updateDoc(doc(db, 'leads', lead.id), { 
            status: 'reschedule', 
            lastAction: `Cliente pide reprogramar: ${confirmationData.rescheduleReason}`,
            updatedAt: new Date().toISOString()
          });
        }
      }
      toast.success("Confirmación guardada");
      setIsConfirmationOpen(false);
      setSelectedMeetingId(null);
    } catch (error) {
      toast.error("Error al guardar confirmación");
    }
  };

  const scheduleMeeting = async () => {
    setLoading(true);
    try {
      // Ensure we use the date as is, replacing - with / to avoid UTC issues
      const dateForMeeting = new Date(meetingDate.replace(/-/g, '/'));
      const meeting: Omit<Meeting, 'id'> = {
        leadId: lead.id,
        leadName: lead.name,
        clientId: lead.clientId,
        date: dateForMeeting.toISOString(),
        time: meetingTime,
        duration: 45,
        status: 'pending',
        scheduledBy: profile?.displayName || 'Sistema',
        meetingLink: meetingLink || undefined,
        createdAt: new Date().toISOString()
      };

      if (isDemoMode) {
        const stored = localStorage.getItem('demo-meetings');
        const allMeetings = stored ? JSON.parse(stored) : [];
        const meetingWithId = { ...meeting, id: Math.random().toString(36).substr(2, 9) };
        allMeetings.push(meetingWithId);
        localStorage.setItem('demo-meetings', JSON.stringify(allMeetings));
        window.dispatchEvent(new CustomEvent('demo-meetings-updated'));

        updateLeadInDemo({
          status: 'meeting-scheduled',
          lastAction: `Reunión agendada: ${meetingDate} ${meetingTime}`,
          nextFollowUpDate: null
        });
      } else {
        await addDoc(collection(db, 'meetings'), meeting);
        await updateDoc(doc(db, 'leads', lead.id), {
          status: 'meeting-scheduled',
          lastAction: `Reunión agendada: ${meetingDate} ${meetingTime}`,
          updatedAt: new Date().toISOString(),
          nextFollowUpDate: null
        });
      }

      toast.success("Reunión agendada correctamente");
      setIsScheduleOpen(false);
    } catch (error) {
      toast.error("Error al agendar reunión");
    } finally {
      setLoading(false);
    }
  };

  const handleWeeklyFollowUpDone = async () => {
    setLoading(true);
    try {
      const currentSequence = lead.followUpSequence || 0;
      const nextSequence = currentSequence + 1;
      let updates: Partial<Lead> = {};
      
      const now = new Date();
      
      if (nextSequence <= 3) {
        const nextDate = new Date(now);
        nextDate.setDate(now.getDate() + 7);
        
        updates = {
          followUpSequence: nextSequence,
          nextFollowUpDate: nextDate.toISOString(),
          lastAction: `Seguimiento Semanal ${nextSequence} marcado como realizado`,
          status: 'follow-up'
        };
      } else {
        updates = {
          followUpSequence: nextSequence,
          status: 'not-interested',
          lastAction: 'Secuencia de 3 seguimientos completada - Lead marcado como No Interesado',
          nextFollowUpDate: undefined
        };
      }

      const fuNote = `Seguimiento Semanal #${currentSequence + 1} completado automáticamente.`;
      const fu: Omit<FollowUp, 'id'> = {
        date: now.toISOString(),
        type: profile?.role === 'setter' ? 'setter' : 'commercial',
        note: fuNote,
        authorId: auth.currentUser?.uid || 'demo-user',
        authorName: profile?.displayName || 'Sistema',
      };

      if (isDemoMode) {
        const stored = localStorage.getItem('demo-leads');
        if (stored) {
          const allLeads: Lead[] = JSON.parse(stored);
          const updatedLeads = allLeads.map(l => {
            if (l.id === lead.id) {
              const newFollowUps = [
                { ...fu, id: Math.random().toString(36).substr(2, 9) },
                ...(l.followUps || [])
              ];
              return {
                ...l,
                ...updates,
                followUps: newFollowUps,
                updatedAt: now.toISOString()
              };
            }
            return l;
          });
          localStorage.setItem('demo-leads', JSON.stringify(updatedLeads));
          window.dispatchEvent(new CustomEvent('demo-leads-updated'));
        }
      } else {
        await addDoc(collection(db, 'leads', lead.id, 'followUps'), fu);
        await updateDoc(doc(db, 'leads', lead.id), {
          ...updates,
          updatedAt: now.toISOString()
        });
      }

      toast.success(nextSequence <= 3 ? `¡Seguimiento ${nextSequence} listo! Siguiente en 7 días.` : "Ciclo completado. Lead marcado como No Interesado.");
    } catch (error) {
      console.error(error);
      toast.error("Error al actualizar seguimiento semanal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md md:max-w-lg border-l border-border bg-background p-0 overflow-hidden flex flex-col">
        <SheetHeader className="px-8 py-6 border-b border-border bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <SheetTitle className="text-xl font-extrabold tracking-tight text-foreground">
                {isEditing ? 'Editando Lead' : 'Detalle del Lead'}
              </SheetTitle>
              <Badge className={`status-pill ${getStatusBadgeColor(lead.status)} ${lead.status === 'qualified' ? 'border-2 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'border-none shadow-none'}`}>
                {getStatusLabel(lead.status)}
              </Badge>
            </div>
            {profile?.role !== 'client' && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsEditing(!isEditing)} 
                className="font-bold border-secondary text-primary hover:bg-secondary"
              >
                {isEditing ? 'Cancelar' : 'Editar Info'}
              </Button>
            )}
          </div>
          {!isEditing && <p className="text-sm text-muted-foreground font-medium">{lead.name} • {lead.company}</p>}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-background custom-scrollbar overscroll-contain pb-32">
          {!isEditing && (
            <div className="flex items-center gap-6 bg-card p-6 rounded-2xl border border-border shadow-none">
              <div className="space-y-1">
                <h2 className="text-2xl font-black text-foreground leading-tight">{lead.name}</h2>
                <div className="flex items-center gap-2 text-muted-foreground font-semibold">
                  <Building2 size={16} />
                  <span>{lead.company}</span>
                </div>
                {lead.linkedinUrl && (
                  <a 
                    href={lead.linkedinUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:text-primary/70 font-bold mt-2 transition-colors"
                  >
                    <Linkedin size={16} />
                    Ver perfil LinkedIn
                  </a>
                )}
              </div>
            </div>
          )}

          {isEditing ? (
            <section className="space-y-4 bg-card p-4 rounded-xl border border-border">
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Editar Información</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-foreground">Nombre</Label>
                  <Input value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} className="h-8 text-xs bg-muted border-border" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-foreground">Empresa</Label>
                  <Input value={editData.company} onChange={e => setEditData({...editData, company: e.target.value})} className="h-8 text-xs bg-muted border-border" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-foreground">Contacto</Label>
                  <Input value={editData.contactInfo} onChange={e => setEditData({...editData, contactInfo: e.target.value})} className="h-8 text-xs bg-muted border-border" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-foreground">País</Label>
                  <Input value={editData.country} onChange={e => setEditData({...editData, country: e.target.value})} className="h-8 text-xs bg-muted border-border" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-foreground">Sector</Label>
                  <Input value={editData.sector} onChange={e => setEditData({...editData, sector: e.target.value})} className="h-8 text-xs bg-muted border-border" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-foreground">Cargo / Puesto</Label>
                  <Input value={editData.position} onChange={e => setEditData({...editData, position: e.target.value})} className="h-8 text-xs bg-muted border-border" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-foreground">Tag / Perfil</Label>
                  {availableTags.length > 0 ? (
                    <Select 
                      value={editData.tag} 
                      onValueChange={(value) => setEditData({ ...editData, tag: value })}
                    >
                      <SelectTrigger className="h-8 text-xs bg-muted border-border">
                        <SelectValue placeholder="Seleccionar Tag" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        {availableTags.map(tag => (
                          <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                        ))}
                        <SelectItem value="other">Otro / Manual...</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={editData.tag} onChange={e => setEditData({...editData, tag: e.target.value})} className="h-8 text-xs bg-muted border-border" placeholder="Ej: Perfil Juan" />
                  )}
                  {editData.tag === 'other' && (
                    <Input 
                      className="h-8 text-xs bg-muted border-border mt-1"
                      value={editData.tag === 'other' ? '' : editData.tag}
                      onChange={(e) => setEditData({ ...editData, tag: e.target.value })} 
                      placeholder="Escribir tag manualmente..."
                    />
                  )}
                </div>
              </div>
              <Button onClick={handleSaveEdit} disabled={loading} className="w-full h-9 font-bold bg-primary text-primary-foreground hover:bg-primary/90">
                {loading ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </section>
          ) : (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Etapa y Estado</h3>
                <Badge variant="outline" className={`text-[10px] font-extrabold uppercase px-2 py-1 border-2 flex items-center gap-1.5 ${
                  lead.stage === 'setter' 
                    ? 'border-blue-400/30 text-blue-400 bg-blue-400/10' 
                    : 'border-purple-400/30 text-purple-400 bg-purple-400/10'
                }`}>
                  {lead.stage === 'setter' ? (
                    <>
                      <UserCheck size={12} />
                      <span>Fase Setter</span>
                    </>
                  ) : (
                    <>
                      <UserCog size={12} />
                      <span>Fase Comercial</span>
                    </>
                  )}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-6 bg-muted/20 p-4 rounded-xl border border-border/50">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Empresa</p>
                  <p className="text-sm font-bold text-foreground">{lead.company}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Cargo / Puesto</p>
                  <p className="text-sm font-bold text-foreground">{lead.position || 'No especificado'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Interés</p>
                  <p className="text-sm font-bold text-foreground">{lead.interest}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">País</p>
                  <p className="text-sm font-bold text-foreground">{lead.country}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Sector</p>
                  <p className="text-sm font-bold text-foreground">{lead.sector}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Contacto</p>
                  <p className="text-sm font-bold text-foreground">{lead.contactInfo}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Tag / Origen</p>
                  {lead.tag ? (
                    <Badge variant="secondary" className="text-[10px] font-bold bg-muted text-foreground border border-border">
                      {lead.tag}
                    </Badge>
                  ) : (
                    <p className="text-sm font-bold text-muted-foreground italic">Sin tag</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Próximo Seguimiento</p>
                  <div className="flex items-center gap-2">
                    <Clock size={14} className={lead.nextFollowUpDate && new Date(lead.nextFollowUpDate) <= new Date() ? "text-green-500" : "text-muted-foreground"} />
                    <p className={`text-sm font-bold ${lead.nextFollowUpDate && new Date(lead.nextFollowUpDate) <= new Date() ? "text-green-400" : "text-foreground"}`}>
                      {lead.nextFollowUpDate ? formatDate(lead.nextFollowUpDate) : 'No programado'}
                    </p>
                  </div>
                </div>
                <div className="space-y-1 col-span-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">LinkedIn y Enriquecimiento</p>
                  <div className="flex flex-col gap-3">
                    {lead.linkedinUrl && (
                      <div className="flex items-center justify-between">
                        <a 
                          href={lead.linkedinUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/70 transition-colors"
                        >
                          <Linkedin size={14} />
                          Ver perfil de LinkedIn
                        </a>
                        {profile?.role !== 'client' && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={enrichWithAI}
                            disabled={enriching}
                            className="h-7 text-[10px] font-bold text-primary gap-1.5 hover:bg-secondary"
                          >
                            {enriching ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                            Completar con URL
                          </Button>
                        )}
                      </div>
                    )}
                    
                    {profile?.role !== 'client' && (
                      <div className="flex items-center justify-between gap-4 p-2 rounded-lg border border-border/50 bg-muted/50">
                        <div className="flex items-center gap-2">
                          <FileText size={14} className="text-muted-foreground" />
                          <span className="text-xs font-medium text-foreground">Enriquecer con PDF</span>
                        </div>
                        <div className="relative">
                          <Input 
                            type="file" 
                            accept=".pdf"
                            onChange={enrichWithPdf}
                            disabled={parsingPdf}
                            className="hidden"
                            id="pdf-enricher"
                          />
                          <Label 
                            htmlFor="pdf-enricher"
                            className="h-7 px-3 flex items-center justify-center text-[10px] font-bold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 cursor-pointer"
                          >
                            {parsingPdf ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} className="mr-1" />}
                            Subir PDF
                          </Label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* History Section */}
          <section className="space-y-6">
            <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Historial de Seguimiento</h3>
            <div className="space-y-4">
              {followUps
                .filter(fu => fu.authorId === profile?.uid)
                .map((fu) => (
                  <div key={fu.id} className="relative pl-6 border-l-2 border-primary/20 py-1">
                    <div className="absolute -left-[5px] top-2 h-2 w-2 rounded-full bg-primary"></div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-extrabold text-primary uppercase tracking-tight">
                        {fu.type === 'setter' ? 'Setter' : 'Comercial'}: {fu.authorName}
                      </span>
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {formatDate(fu.date)}
                      </span>
                    </div>
                    <p className="text-[13px] text-foreground leading-relaxed font-medium">
                      {fu.note}
                    </p>
                  </div>
                ))}
              {followUps.filter(fu => fu.authorId === profile?.uid).length === 0 && (
                <p className="text-sm text-muted-foreground italic font-medium text-center py-4 bg-muted/10 rounded-lg border border-dashed border-border">No hay seguimientos registrados por ti.</p>
              )}
            </div>
          </section>

          {/* Meetings Section for Clients */}
          {meetings.length > 0 && (
            <section className="space-y-4 pt-4 border-t border-border/50">
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Reuniones y Feedback</h3>
              <div className="space-y-3">
                {meetings.map((m) => (
                  <Card key={m.id} className="p-3 border border-border/50 shadow-none bg-muted/10">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-xs font-bold text-foreground">{format(new Date(m.date), 'dd/MM/yyyy')} - {m.time}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">{m.status}</p>
                      </div>
                      {m.status === 'pending' && !m.clientConfirmed && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-[10px] font-bold text-primary hover:bg-secondary"
                          onClick={() => {
                            setSelectedMeetingId(m.id);
                            setIsConfirmationOpen(true);
                          }}
                        >
                          {profile?.role === 'client' ? 'Confirmar / Reprogramar' : 'Marcar Resultado'}
                        </Button>
                      )}
                      {m.clientConfirmed && (
                        <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">Confirmada</span>
                      )}
                    </div>
                    {m.feedback && (
                      <div className="mt-2 p-2 bg-card rounded border border-border italic text-xs text-muted-foreground font-medium">
                        "{m.feedback}"
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Add Follow-up - Hide for clients */}
          {profile?.role !== 'client' && (
            <section className="space-y-4 pt-4 border-t border-border/50">
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Registrar Nueva Acción</h3>
              <div className="space-y-3">
                <Input 
                  placeholder="Escribe aquí los detalles del seguimiento..." 
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addFollowUp()}
                  className="bg-muted/50 border-border rounded-xl focus:ring-primary/20 transition-all font-medium text-sm"
                />
                <Button 
                  onClick={addFollowUp} 
                  className="w-full font-bold shadow-none bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={loading || !newNote.trim()}
                >
                  {loading ? "Guardando..." : "Guardar Seguimiento"}
                </Button>
              </div>
            </section>
          )}

          {/* Add Meeting - Hide for clients */}
          {profile?.role !== 'client' && (
            <section className="space-y-4 pt-4 border-t border-border/50">
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Acciones Rápidas</h3>
              <Button 
                onClick={() => setIsScheduleOpen(true)} 
                variant="outline" 
                className="w-full h-10 gap-2 font-bold border-secondary text-primary hover:bg-secondary"
              >
                <CalendarIcon size={16} />
                Agendar Reunión
              </Button>
            </section>
          )}

          {/* Etapa de Seguimiento - Hide for clients */}
          {profile?.role !== 'client' && (
            <div className="space-y-6">
              {/* Weekly Follow-up Section */}
              <section className="space-y-4 pt-4 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Secuencia Semanal (3 Semanas)</h3>
                  <Badge variant="outline" className="text-[10px] font-bold">
                    {lead.followUpSequence || 0} de 3 completados
                  </Badge>
                </div>
                
                <Card className="p-4 bg-muted/20 border-border/50 overflow-hidden relative">
                  {(lead.followUpSequence || 0) < 3 && !['not-interested', 'closed-won', 'closed-lost', 'meeting-scheduled', 'qualified', 'future'].includes(lead.status) ? (
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 border border-primary/20">
                          <Clock size={16} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-foreground">
                            Seguimiento Semana { (lead.followUpSequence || 0) + 1 }
                          </p>
                          <p className="text-[11px] text-muted-foreground leading-tight">
                            {lead.nextFollowUpDate ? `Programado para el ${formatDate(lead.nextFollowUpDate)}` : 'Pendiente de programar'}
                          </p>
                        </div>
                      </div>
                      
                      <Button 
                        onClick={handleWeeklyFollowUpDone}
                        disabled={loading}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-9 shadow-md shadow-green-900/20 gap-2"
                      >
                        <CheckCircle2 size={16} />
                        Marcar como LISTO
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-4 text-center space-y-2">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${lead.status === 'not-interested' ? 'bg-slate-500/20 text-slate-500' : 'bg-green-500/20 text-green-500'}`}>
                        {lead.status === 'not-interested' ? <X size={20} /> : <CheckCircle2 size={20} />}
                      </div>
                      <p className="text-xs font-bold text-foreground">
                        {lead.status === 'not-interested' ? 'Ciclo cerrado: No Interesado' : 'Secuencia Semanal Finalizada'}
                      </p>
                      <p className="text-[10px] text-muted-foreground italic">
                        {lead.status === 'not-interested' ? 'Se realizaron los 3 intentos sin éxito.' : 'El prospecto avanzó en el embudo.'}
                      </p>
                    </div>
                  )}

                  {/* Progress Line */}
                  <div className="mt-4 flex gap-1 h-1 w-full bg-muted rounded-full overflow-hidden">
                    {[1, 2, 3].map(i => (
                      <div 
                        key={i} 
                        className={`flex-1 h-full rounded-full transition-all duration-500 ${
                          (lead.followUpSequence || 0) >= i ? 'bg-green-500' : 'bg-muted-foreground/20'
                        }`} 
                      />
                    ))}
                  </div>
                </Card>
              </section>

              <section className="space-y-4 pt-4 border-t border-border/50">
                <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Etapa de Seguimiento</h3>
              <div className="flex gap-2">
                <Button
                  variant={lead.stage === 'setter' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateStage('setter')}
                  className={`flex-1 text-[11px] font-bold h-9 ${lead.stage === 'setter' ? 'bg-primary text-primary-foreground shadow-none' : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50 shadow-none'}`}
                >
                  Fase Setter
                </Button>
                <Button
                  variant={lead.stage === 'commercial' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateStage('commercial')}
                  className={`flex-1 text-[11px] font-bold h-9 ${lead.stage === 'commercial' ? 'bg-primary text-primary-foreground shadow-none' : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50 shadow-none'}`}
                >
                  Fase Comercial
                </Button>
              </div>
            </section>
          </div>
        )}

          {/* Status Update - Restricted for clients */}
          {profile?.role !== 'client' && (
            <section className="space-y-4 pt-4 border-t border-border/50">
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Actualizar Estado</h3>
              <div className="flex gap-2 flex-wrap">
                {(['new', 'contacted', 'follow-up', 'future', 'meeting-scheduled', 'qualified', 'closed-won', 'closed-lost', 'reschedule', 'not-interested'] as LeadStatus[]).map((status) => (
                  <Button
                    key={status}
                    variant={lead.status === status ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateStatus(status)}
                    className={`text-[11px] font-bold h-8 px-3 ${lead.status === status ? 'bg-primary text-primary-foreground shadow-none' : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50 shadow-none'}`}
                  >
                    {getStatusLabel(status)}
                  </Button>
                ))}
              </div>
            </section>
          )}
        </div>
      </SheetContent>

      {/* Client Confirmation Dialog */}
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
                  Sí
                </Button>
                <Button 
                  type="button"
                  variant={!confirmationData.didHappen ? 'default' : 'outline'}
                  onClick={() => setConfirmationData({...confirmationData, didHappen: false})}
                  className="flex-1"
                >
                  No
                </Button>
              </div>
            </div>

            {confirmationData.didHappen ? (
              <div className="space-y-4">
                <Label className="text-xs uppercase font-bold text-muted-foreground">¿Prospecto calificado?</Label>
                <div className="flex gap-4">
                  <Button 
                    type="button"
                    variant={confirmationData.isQualified ? 'default' : 'outline'}
                    onClick={() => setConfirmationData({...confirmationData, isQualified: true})}
                    className="flex-1 text-xs"
                  >
                    Calificado
                  </Button>
                  <Button 
                    type="button"
                    variant={!confirmationData.isQualified ? 'default' : 'outline'}
                    onClick={() => setConfirmationData({...confirmationData, isQualified: false})}
                    className="flex-1 text-xs"
                  >
                    No Calificado
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="reason-details" className="text-xs uppercase font-bold text-muted-foreground">Motivo opcional</Label>
                <Input 
                  id="reason-details" 
                  value={confirmationData.rescheduleReason} 
                  onChange={(e) => setConfirmationData({...confirmationData, rescheduleReason: e.target.value})} 
                  placeholder="Ej: El cliente no asistió..."
                  className="bg-muted border-border"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmationOpen(false)} className="border-border">Cancelar</Button>
            <Button onClick={handleClientMeetingConfirmation} className="bg-primary text-primary-foreground font-bold">
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border text-card-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">Agendar Reunión con {lead.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground font-medium">Fecha de Reunión</Label>
                <DatePicker 
                  date={meetingDate} 
                  setDate={setMeetingDate}
                  className="h-11 border-border bg-muted w-full font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-time" className="text-foreground font-medium">Hora</Label>
                <Input 
                  id="m-time" 
                  type="time" 
                  value={meetingTime} 
                  onChange={(e) => setMeetingTime(e.target.value)} 
                  className="bg-muted border-border font-bold"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-link" className="text-foreground font-medium">Link de Reunión (Opcional)</Label>
              <Input 
                id="m-link" 
                value={meetingLink} 
                onChange={(e) => setMeetingLink(e.target.value)} 
                placeholder="https://meet.google.com/..."
                className="bg-muted border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsScheduleOpen(false)} className="border-border text-foreground hover:bg-muted font-bold">Cancelar</Button>
            <Button onClick={scheduleMeeting} disabled={loading} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
              {loading ? "Agendando..." : "Agendar Reunión"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Future Follow-up Date Picker Dialog */}
      <Dialog open={isFutureDatePickerOpen} onOpenChange={setIsFutureDatePickerOpen}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border text-card-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground italic font-black uppercase tracking-tighter">Programar Seguimiento Futuro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground italic">Seleccionar Fecha</Label>
              <DatePicker 
                date={futureFollowUpDate} 
                setDate={setFutureFollowUpDate}
                className="h-11 border-border bg-muted w-full font-bold"
              />
            </div>
            <p className="text-[10px] text-muted-foreground italic font-medium leading-tight">
              El lead pasará a estado "A Futuro" y se te notificará en la fecha seleccionada para retomar el contacto.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFutureDatePickerOpen(false)} className="border-border font-bold">Cancelar</Button>
            <Button onClick={handleFutureFollowUpSave} disabled={loading} className="bg-primary text-primary-foreground font-bold italic uppercase tracking-widest text-[10px]">
              {loading ? "Guardando..." : "Confirmar Fecha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
