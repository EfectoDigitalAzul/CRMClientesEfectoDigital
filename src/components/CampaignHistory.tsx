import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, addDoc, doc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { ClientHistoryNote, UserProfile, HistoryNoteType } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import { 
  StickyNote, 
  Flag, 
  AlertCircle, 
  TrendingUp, 
  Plus, 
  CheckCircle2, 
  Trash2,
  Calendar,
  User as UserIcon,
  MessageSquare,
  Clock
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '../lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface CampaignHistoryProps {
  clientId: string;
  profile: UserProfile | null;
  isDemoMode?: boolean;
}

export function CampaignHistory({ clientId, profile, isDemoMode }: CampaignHistoryProps) {
  const [notes, setNotes] = useState<ClientHistoryNote[]>([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteType, setNewNoteType] = useState<HistoryNoteType>('note');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!clientId) return;

    setLoading(true);
    if (isDemoMode) {
      const loadNotes = () => {
        const stored = localStorage.getItem(`demo-history-notes-${clientId}`);
        const notesData = stored ? JSON.parse(stored) : [];
        setNotes(notesData.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        setLoading(false);
      };

      loadNotes();
      window.addEventListener(`demo-history-notes-updated-${clientId}`, loadNotes);
      return () => window.removeEventListener(`demo-history-notes-updated-${clientId}`, loadNotes);
    }

    const q = query(
      collection(db, 'clients', clientId, 'historyNotes'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notesData = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as ClientHistoryNote));
      setNotes(notesData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `clients/${clientId}/historyNotes`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [clientId, isDemoMode]);

  const handleAddNote = async () => {
    if (!newNoteContent.trim() || !profile || submitting) return;

    setSubmitting(true);
    const noteData: any = {
      clientId,
      content: newNoteContent,
      type: newNoteType,
      authorId: profile.uid,
      authorName: profile.displayName,
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      isResolved: newNoteType === 'blocker' ? false : undefined
    };

    try {
      if (isDemoMode) {
        const stored = localStorage.getItem(`demo-history-notes-${clientId}`);
        const currentNotes = stored ? JSON.parse(stored) : [];
        const newNoteWithId = { ...noteData, id: Math.random().toString(36).substr(2, 9) };
        const updatedNotes = [newNoteWithId, ...currentNotes];
        localStorage.setItem(`demo-history-notes-${clientId}`, JSON.stringify(updatedNotes));
        setNotes(updatedNotes.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        window.dispatchEvent(new CustomEvent(`demo-history-notes-updated-${clientId}`));
      } else {
        await addDoc(collection(db, 'clients', clientId, 'historyNotes'), noteData);
      }

      setNewNoteContent('');
      setNewNoteType('note');
      toast.success('Hito registrado con éxito');
    } catch (error) {
      console.error('Error adding history note:', error);
      toast.error('Error al registrar el hito');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleResolve = async (note: ClientHistoryNote) => {
    if (note.type !== 'blocker' || !clientId) return;

    const newResolvedState = !note.isResolved;

    try {
      if (isDemoMode) {
        const stored = localStorage.getItem(`demo-history-notes-${clientId}`);
        const currentNotes = stored ? JSON.parse(stored) : [];
        const updated = currentNotes.map((n: any) => 
          n.id === note.id ? { ...n, isResolved: newResolvedState } : n
        );
        localStorage.setItem(`demo-history-notes-${clientId}`, JSON.stringify(updated));
        setNotes(updated.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        window.dispatchEvent(new CustomEvent(`demo-history-notes-updated-${clientId}`));
      } else {
        await updateDoc(doc(db, 'clients', clientId, 'historyNotes', note.id), {
          isResolved: newResolvedState
        });
      }
      toast.success(newResolvedState ? 'Traba marcada como resuelta' : 'Traba reactivada');
    } catch (error) {
      toast.error('Error al actualizar el estado');
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      if (isDemoMode) {
        const stored = localStorage.getItem(`demo-history-notes-${clientId}`);
        const currentNotes = stored ? JSON.parse(stored) : [];
        const updated = currentNotes.filter((n: any) => n.id !== id);
        localStorage.setItem(`demo-history-notes-${clientId}`, JSON.stringify(updated));
        setNotes(updated.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        window.dispatchEvent(new CustomEvent(`demo-history-notes-updated-${clientId}`));
      } else {
        await deleteDoc(doc(db, 'clients', clientId, 'historyNotes', id));
      }
      toast.success('Entrada eliminada');
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  const getTypeIcon = (type: HistoryNoteType) => {
    switch (type) {
      case 'milestone': return <Flag className="text-amber-500" size={16} />;
      case 'blocker': return <AlertCircle className="text-rose-500" size={16} />;
      case 'advance': return <TrendingUp className="text-emerald-500" size={16} />;
      default: return <StickyNote className="text-blue-500" size={16} />;
    }
  };

  const getTypeStyles = (type: HistoryNoteType, isResolved?: boolean) => {
    switch (type) {
      case 'milestone': return 'bg-amber-950/20 border-amber-900/30 text-amber-500';
      case 'blocker': return isResolved 
        ? 'bg-slate-900/20 border-slate-800 text-slate-500 opacity-60' 
        : 'bg-rose-950/20 border-rose-900/30 text-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.1)]';
      case 'advance': return 'bg-emerald-950/20 border-emerald-900/30 text-emerald-500';
      default: return 'bg-blue-950/20 border-blue-900/30 text-blue-500';
    }
  };

  const getTypeLabel = (type: HistoryNoteType) => {
    switch (type) {
      case 'milestone': return 'Hito';
      case 'blocker': return 'Traba/Bloqueo';
      case 'advance': return 'Avance';
      default: return 'Observación';
    }
  };

  if (loading) {
    return (
      <Card className="border border-border/40 rounded-[2rem] shadow-none bg-card/40 backdrop-blur-sm overflow-hidden h-full">
        <div className="p-10 flex flex-col items-center justify-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Cargando Histórico...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border border-border/40 rounded-[2rem] shadow-none bg-card/40 backdrop-blur-sm overflow-hidden flex flex-col h-full h-[600px]">
      <CardHeader className="border-b border-border/40 px-8 py-6 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-black text-foreground uppercase italic tracking-tighter flex items-center gap-2">
              <Clock className="text-primary" size={20} /> Histórico de Campaña
            </CardTitle>
            <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">HITOS, TRABAS Y OBSERVACIONES DEL SETTER/EQUIPO</p>
          </div>
          <div className="flex items-center gap-2">
             <Badge variant="outline" className="text-[9px] font-black italic border-primary/20 text-primary bg-primary/5 uppercase">{notes.length} Entradas</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
        {/* Form to add note */}
        <div className="p-6 bg-muted/20 border-b border-border/40 shrink-0">
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <Textarea 
                  placeholder="Describe un avance, una incidencia o un hito..."
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  className="min-h-[80px] bg-background border-border/50 text-xs font-bold resize-none shadow-none focus-visible:ring-primary/20"
                />
              </div>
              <div className="w-[180px] space-y-3">
                <Select value={newNoteType} onValueChange={(v: HistoryNoteType) => setNewNoteType(v)}>
                  <SelectTrigger className="w-full text-[10px] font-black uppercase h-9 bg-background border-border/50">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="note" className="text-[10px] font-black flex items-center gap-2">
                      <div className="flex items-center gap-2"><StickyNote size={12} className="text-blue-500" /> Observación</div>
                    </SelectItem>
                    <SelectItem value="advance" className="text-[10px] font-black">
                      <div className="flex items-center gap-2"><TrendingUp size={12} className="text-emerald-500" /> Avance</div>
                    </SelectItem>
                    <SelectItem value="milestone" className="text-[10px] font-black">
                      <div className="flex items-center gap-2"><Flag size={12} className="text-amber-500" /> Hito</div>
                    </SelectItem>
                    <SelectItem value="blocker" className="text-[10px] font-black">
                      <div className="flex items-center gap-2"><AlertCircle size={12} className="text-rose-500" /> Traba/Bloqueo</div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  onClick={handleAddNote} 
                  disabled={!newNoteContent.trim() || submitting}
                  className="w-full h-10 bg-primary hover:bg-primary/90 text-white text-[10px] font-black uppercase italic tracking-tighter"
                >
                  {submitting ? 'Registrando...' : 'Registrar'}
                  <Plus size={14} className="ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Notes list */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
          {notes.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-10 opacity-40">
              <MessageSquare size={40} className="mb-4 text-primary" />
              <p className="text-xs font-black uppercase tracking-widest leading-tight">No hay histórico registrado</p>
              <p className="text-[10px] font-bold text-muted-foreground mt-2 max-w-[200px]">Empieza a documentar los avances y obstáculos de la campaña.</p>
            </div>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="relative pl-8 group">
                {/* Timeline connector */}
                <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-border/40 group-last:bottom-auto group-last:h-4" />
                
                {/* Timeline dot */}
                <div className={cn(
                  "absolute left-[-5px] top-1 h-3 w-3 rounded-full border-2 border-background",
                  note.type === 'milestone' ? 'bg-amber-500' :
                  note.type === 'blocker' ? (note.isResolved ? 'bg-slate-500' : 'bg-rose-500') :
                  note.type === 'advance' ? 'bg-emerald-500' : 'bg-blue-500'
                )} />

                <div className={cn(
                  "rounded-2xl border p-4 transition-all duration-300",
                  getTypeStyles(note.type, note.isResolved)
                )}>
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex items-center gap-2">
                       {getTypeIcon(note.type)}
                       <span className="text-[10px] font-black uppercase tracking-widest">{getTypeLabel(note.type)}</span>
                       {note.type === 'blocker' && (
                         <Badge 
                           onClick={() => handleToggleResolve(note)}
                           className={cn(
                             "text-[8px] font-black uppercase cursor-pointer transition-transform hover:scale-105",
                             note.isResolved ? "bg-emerald-500/20 text-emerald-600 border-none" : "bg-rose-100 text-rose-600 border border-rose-200"
                           )}
                         >
                           {note.isResolved ? 'RESUELTO' : 'PENDIENTE'}
                         </Badge>
                       )}
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-muted-foreground hover:text-red-500"
                        onClick={() => handleDeleteNote(note.id)}
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </div>

                  <p className="text-xs font-bold leading-relaxed mb-3 whitespace-pre-wrap">{note.content}</p>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-current/10">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5 text-[9px] font-black uppercase opacity-70">
                         <UserIcon size={12} />
                         {note.authorName}
                      </div>
                      <div className="flex items-center gap-1.5 text-[9px] font-black uppercase opacity-70">
                         <Calendar size={12} />
                         {format(parseISO(note.date), "dd MMM, yyyy", { locale: es })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
