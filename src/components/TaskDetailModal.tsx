import React, { useState } from 'react';
import { 
  TeamTask, 
  TaskStatus, 
  TaskCategory,
  TaskComment, 
  UserProfile, 
  Client,
  TaskAttachment 
} from '../types';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Clock,
  Calendar,
  AlertTriangle,
  Send,
  Link2,
  ExternalLink,
  MessageSquare,
  Edit,
  Trash2,
  CheckSquare,
  Eye,
  FileCheck,
  BellRing,
  ThumbsUp,
  Folder,
  User,
  ArrowRight,
  ShieldCheck,
  Plus,
  ArrowRightLeft,
  Share2,
  StickyNote,
  Tag
} from 'lucide-react';

interface TaskDetailModalProps {
  task: TeamTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateTask: (task: TeamTask) => Promise<void> | void;
  onDeleteTask?: (taskId: string) => Promise<void> | void;
  onEditTask?: (task: TeamTask) => void;
  currentProfile: UserProfile | null;
  clients: Client[];
  allUsers?: UserProfile[];
}

export default function TaskDetailModal({
  task,
  open,
  onOpenChange,
  onUpdateTask,
  onDeleteTask,
  onEditTask,
  currentProfile,
  clients,
  allUsers = [],
}: TaskDetailModalProps) {
  const [commentText, setCommentText] = useState('');
  const [commentCategory, setCommentCategory] = useState<'general' | 'instruction' | 'handover'>('general');
  const [deliverableUrl, setDeliverableUrl] = useState('');
  const [deliverableNotes, setDeliverableNotes] = useState('');
  const [isEditingDeliverable, setIsEditingDeliverable] = useState(false);
  const [clientFeedbackText, setClientFeedbackText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Handover / Reassignment state
  const [isHandoverOpen, setIsHandoverOpen] = useState(false);
  const [handoverTargetUserId, setHandoverTargetUserId] = useState('');
  const [handoverCategory, setHandoverCategory] = useState<TaskCategory>('design');
  const [handoverNote, setHandoverNote] = useState('');
  const [submittingHandover, setSubmittingHandover] = useState(false);

  if (!task) return null;

  const isAssignee = currentProfile?.uid === task.assigneeId;
  const isCreator = currentProfile?.uid === task.creatorId;
  const isClientUser = currentProfile?.role === 'client';
  const isStaff = !isClientUser;
  const isDirector = currentProfile?.role === 'director';

  // Format Dates
  const formatDate = (isoStr?: string) => {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  // Status Labels & Badges
  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'pending_receipt':
        return <Badge className="bg-amber-500/15 text-amber-600 border border-amber-500/30 text-xs font-black">🔔 Pendiente de Recepción</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500/15 text-blue-600 border border-blue-500/30 text-xs font-black">⏳ En Proceso</Badge>;
      case 'internal_review':
        return <Badge className="bg-purple-500/15 text-purple-600 border border-purple-500/30 text-xs font-black">🔍 En Revisión Interna</Badge>;
      case 'waiting_client_feedback':
        return <Badge className="bg-pink-500/15 text-pink-600 border border-pink-500/30 text-xs font-black">💬 Esperando Feedback Cliente</Badge>;
      case 'completed':
        return <Badge className="bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 text-xs font-black">✅ Completada / Aprobada</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-500/15 text-red-600 border border-red-500/30 text-xs font-black">🚫 Cancelada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge className="bg-red-500 text-white font-black text-[10px] uppercase">🔴 Urgente ⚡</Badge>;
      case 'high':
        return <Badge className="bg-orange-500/15 text-orange-600 border border-orange-500/30 font-bold text-[10px]">🟠 Alta</Badge>;
      case 'medium':
        return <Badge className="bg-amber-500/15 text-amber-600 border border-amber-500/30 font-bold text-[10px]">🟡 Media</Badge>;
      case 'low':
      default:
        return <Badge className="bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 font-bold text-[10px]">🟢 Baja</Badge>;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'design': return '🎨 Diseño Gráfico';
      case 'copy': return '✍️ Copywriting';
      case 'pauta': return '📢 Pauta / Meta Ads';
      case 'account_management': return '💼 Gestión AM';
      case 'general': default: return '⚡ General';
    }
  };

  // 1. Action: Confirm Receipt ("Visto / Enterado")
  const handleConfirmReceipt = async () => {
    const nowIso = new Date().toISOString();
    const updated: TeamTask = {
      ...task,
      isReceived: true,
      receivedAt: nowIso,
      receivedBy: currentProfile?.displayName || 'Asignado',
      status: task.status === 'pending_receipt' ? 'in_progress' : task.status,
      updatedAt: nowIso,
    };
    await onUpdateTask(updated);
    toast.success('¡Recepción confirmada! La tarea pasó al estado "En Proceso".');
  };

  // 2. Action: Change Status
  const handleStatusChange = async (newStatus: TaskStatus) => {
    const nowIso = new Date().toISOString();
    const updated: TeamTask = {
      ...task,
      status: newStatus,
      completedAt: newStatus === 'completed' ? nowIso : (task.status === 'completed' ? undefined : task.completedAt),
      completedBy: newStatus === 'completed' ? (currentProfile?.displayName || 'Usuario') : task.completedBy,
      updatedAt: nowIso,
    };
    await onUpdateTask(updated);
    toast.success(`Estado actualizado a: ${newStatus}`);
  };

  // 3. Action: Save Deliverable
  const handleSaveDeliverable = async () => {
    if (!deliverableUrl.trim()) {
      toast.error('Ingresa un enlace para el entregable');
      return;
    }
    const nowIso = new Date().toISOString();
    const updated: TeamTask = {
      ...task,
      deliverableUrl: deliverableUrl.trim(),
      deliverableNotes: deliverableNotes.trim() || undefined,
      status: task.visibleToClient ? 'waiting_client_feedback' : 'internal_review',
      updatedAt: nowIso,
    };
    await onUpdateTask(updated);
    setIsEditingDeliverable(false);
    toast.success('¡Entregable guardado! La tarea pasó a revisión.');
  };

  // 4. Action: Client Approval
  const handleClientApprove = async () => {
    const nowIso = new Date().toISOString();
    const updated: TeamTask = {
      ...task,
      clientApproved: true,
      clientApprovedAt: nowIso,
      status: 'completed',
      completedAt: nowIso,
      completedBy: currentProfile?.displayName || 'Cliente',
      updatedAt: nowIso,
    };
    await onUpdateTask(updated);
    toast.success('🎉 ¡Creativo / Tarea aprobada exitosamente!');
  };

  // 5. Action: Send Client Feedback
  const handleSendClientFeedback = async () => {
    if (!clientFeedbackText.trim()) {
      toast.error('Por favor escribe tus comentarios o ajustes');
      return;
    }
    const nowIso = new Date().toISOString();
    
    // Also add as a comment
    const newComment: TaskComment = {
      id: `comm-${Date.now()}`,
      authorId: currentProfile?.uid || 'user',
      authorName: currentProfile?.displayName || (isClientUser ? 'Cliente' : 'Usuario'),
      authorRole: currentProfile?.role || (isClientUser ? 'client' : 'director'),
      authorPhotoURL: currentProfile?.photoURL,
      content: `💬 [Feedback del Cliente]: ${clientFeedbackText.trim()}`,
      createdAt: nowIso,
    };

    const updated: TeamTask = {
      ...task,
      clientFeedback: clientFeedbackText.trim(),
      clientFeedbackDate: nowIso,
      clientApproved: false,
      status: 'in_progress', // Return to in_progress for designer/copy to make revisions
      comments: [...(task.comments || []), newComment],
      updatedAt: nowIso,
    };

    await onUpdateTask(updated);
    setClientFeedbackText('');
    toast.success('Feedback enviado al equipo de Efecto.');
  };

  // 6. Action: Pass / Handover Task to another Team Member (e.g. Copy to Designer)
  const handleHandoverTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handoverTargetUserId) {
      toast.error('Selecciona a qué miembro del equipo deseas pasarle la tarea');
      return;
    }

    const targetUser = allUsers.find(u => u.uid === handoverTargetUserId);
    if (!targetUser) {
      toast.error('Usuario seleccionado no válido');
      return;
    }

    setSubmittingHandover(true);
    const nowIso = new Date().toISOString();
    const handoverMessage = handoverNote.trim() 
      ? `🔄 [Pase de Tarea]: ${currentProfile?.displayName || 'Miembro'} le pasó la tarea a ${targetUser.displayName} (${targetUser.role}). Nota: "${handoverNote.trim()}"`
      : `🔄 [Pase de Tarea]: ${currentProfile?.displayName || 'Miembro'} le pasó la tarea a ${targetUser.displayName} (${targetUser.role}).`;

    const handoverComment: TaskComment = {
      id: `comm-handover-${Date.now()}`,
      authorId: currentProfile?.uid || 'user',
      authorName: currentProfile?.displayName || 'Usuario',
      authorRole: currentProfile?.role || 'director',
      authorPhotoURL: currentProfile?.photoURL,
      content: handoverMessage,
      createdAt: nowIso,
    };

    try {
      const updated: TeamTask = {
        ...task,
        assigneeId: targetUser.uid,
        assigneeName: targetUser.displayName || targetUser.username || 'Asignado',
        assigneeRole: targetUser.role,
        category: handoverCategory || task.category,
        isReceived: false, // Target user needs to acknowledge "Enterado"
        receivedAt: undefined,
        receivedBy: undefined,
        status: 'pending_receipt', // Resets to pending receipt so new assignee gets notified
        comments: [...(task.comments || []), handoverComment],
        updatedAt: nowIso,
      };

      await onUpdateTask(updated);
      setIsHandoverOpen(false);
      setHandoverNote('');
      toast.success(`¡Tarea transferida con éxito a ${targetUser.displayName}!`);
    } catch (err: any) {
      toast.error(`Error al pasar la tarea: ${err.message || err}`);
    } finally {
      setSubmittingHandover(false);
    }
  };

  // 7. Action: Add New Comment / Specific Note
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setSubmittingComment(true);
    const nowIso = new Date().toISOString();

    let prefix = '';
    if (commentCategory === 'instruction') prefix = '📌 [Instrucción / Requisito]: ';
    else if (commentCategory === 'handover') prefix = '🔄 [Pase / Avance]: ';

    const newComment: TaskComment = {
      id: `comm-${Date.now()}`,
      authorId: currentProfile?.uid || 'user',
      authorName: currentProfile?.displayName || 'Usuario',
      authorRole: currentProfile?.role || 'director',
      authorPhotoURL: currentProfile?.photoURL,
      content: `${prefix}${commentText.trim()}`,
      createdAt: nowIso,
    };

    try {
      const updated: TeamTask = {
        ...task,
        comments: [...(task.comments || []), newComment],
        updatedAt: nowIso,
      };
      await onUpdateTask(updated);
      setCommentText('');
      setCommentCategory('general');
      toast.success('Nota guardada con éxito');
    } catch (err: any) {
      toast.error(`Error al comentar: ${err.message || err}`);
    } finally {
      setSubmittingComment(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[92vh] overflow-y-auto bg-card border-border text-foreground p-0">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-border/20 bg-muted/20">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {getStatusBadge(task.status)}
                {getPriorityBadge(task.priority)}
                <Badge variant="outline" className="text-[10px] font-bold">
                  {getCategoryLabel(task.category)}
                </Badge>
                {task.clientName && (
                  <Badge variant="secondary" className="text-[10px] font-bold flex items-center gap-1">
                    <Folder size={11} className="text-primary" />
                    {task.clientName}
                  </Badge>
                )}
              </div>
              <DialogTitle className="text-xl font-black tracking-tight text-foreground mt-2 leading-snug">
                {task.title}
              </DialogTitle>
            </div>

            {isStaff && (
              <div className="flex items-center gap-1 shrink-0">
                {onEditTask && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onOpenChange(false);
                      onEditTask(task);
                    }}
                    className="h-8 text-xs font-bold gap-1"
                  >
                    <Edit size={13} />
                    Editar
                  </Button>
                )}
                {onDeleteTask && (isDirector || isCreator) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (window.confirm('¿Seguro que deseas eliminar esta tarea?')) {
                        onDeleteTask(task.id);
                        onOpenChange(false);
                      }
                    }}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    title="Eliminar Tarea"
                  >
                    <Trash2 size={15} />
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* BANNER 1: NOTIFICATION & RECEIPT ("Enterado / Visto") */}
          {!task.isReceived && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-xl bg-amber-500/20 text-amber-600 shrink-0">
                  <BellRing size={20} className="animate-bounce" />
                </span>
                <div>
                  <p className="text-xs font-black uppercase text-amber-700 dark:text-amber-400">
                    🔔 Pedido Pendiente de Recepción
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Asignado a <strong>{task.assigneeName}</strong> ({task.assigneeRole}). Confirma la recepción para iniciar el trabajo.
                  </p>
                </div>
              </div>
              {(isAssignee || isStaff) && (
                <Button
                  onClick={handleConfirmReceipt}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase px-4 h-9 shrink-0 gap-1.5 shadow-sm"
                >
                  <ShieldCheck size={15} />
                  Confirmar Recepción (Enterado)
                </Button>
              )}
            </div>
          )}

          {task.isReceived && (
            <div className="px-3.5 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-emerald-500" />
                <span>Recibido por <strong>{task.receivedBy || task.assigneeName}</strong> el {formatDate(task.receivedAt)}</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">Status: En Proceso</span>
            </div>
          )}

          {/* Meta Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-muted/20 rounded-xl border border-border/20 text-xs">
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground">Asignado a</p>
              <p className="font-bold text-foreground mt-0.5 flex items-center gap-1">
                <User size={12} className="text-primary" />
                {task.assigneeName}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground">Solicitado por</p>
              <p className="font-bold text-foreground mt-0.5">{task.creatorName}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground">Fecha Límite</p>
              <p className="font-bold text-foreground mt-0.5 flex items-center gap-1">
                <Calendar size={12} className="text-emerald-500" />
                {task.dueDate || 'Sin fecha'} {task.dueTime ? `(${task.dueTime})` : ''}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground">Visibilidad Cliente</p>
              <p className="font-bold text-foreground mt-0.5 flex items-center gap-1">
                <Eye size={12} className={task.visibleToClient ? "text-primary" : "text-muted-foreground"} />
                {task.visibleToClient ? 'Visible' : 'Solo Interno'}
              </p>
            </div>
          </div>

          {/* HANDOVER / PASE DE TAREA (Para pasar del Copy al Diseñador, o a otro miembro) */}
          {isStaff && (
            <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                    <ArrowRightLeft size={16} />
                  </span>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-tight text-foreground flex items-center gap-2">
                      Pase de Tarea entre Miembros del Equipo
                    </h4>
                    <p className="text-[10px] text-muted-foreground">
                      ¿Terminaste tu parte? Pásale la tarea a otro miembro (ej. del Copywriter al Diseñador o al AM).
                    </p>
                  </div>
                </div>

                {!isHandoverOpen && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Suggest opposite role or common next step
                      if (task.category === 'copy') {
                        setHandoverCategory('design');
                      } else if (task.category === 'design') {
                        setHandoverCategory('pauta');
                      }
                      setIsHandoverOpen(true);
                    }}
                    className="h-7 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 border-indigo-500/30 gap-1"
                  >
                    <ArrowRightLeft size={13} />
                    Pasar a otro miembro
                  </Button>
                )}
              </div>

              {isHandoverOpen && (
                <form onSubmit={handleHandoverTask} className="space-y-3 pt-2 border-t border-indigo-500/20 animate-in fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">
                        Nuevo Asignado *
                      </Label>
                      <select
                        value={handoverTargetUserId}
                        onChange={e => setHandoverTargetUserId(e.target.value)}
                        required
                        className="w-full h-9 px-3 bg-background border border-border rounded-lg text-xs font-bold text-foreground"
                      >
                        <option value="">Selecciona miembro del equipo...</option>
                        {allUsers
                          .filter(u => u.role !== 'client' && u.uid !== task.assigneeId)
                          .map(u => (
                            <option key={u.uid} value={u.uid}>
                              {u.displayName || u.username} ({u.role.toUpperCase()})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">
                        Área / Categoría Siguiente
                      </Label>
                      <select
                        value={handoverCategory}
                        onChange={e => setHandoverCategory(e.target.value as TaskCategory)}
                        className="w-full h-9 px-3 bg-background border border-border rounded-lg text-xs font-bold text-foreground"
                      >
                        <option value="design">🎨 Diseño Gráfico</option>
                        <option value="copy">✍️ Copywriting</option>
                        <option value="pauta">📢 Pauta / Meta Ads</option>
                        <option value="account_management">💼 Gestión AM</option>
                        <option value="general">⚡ General</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">
                      Nota o Instrucción del Pase (Opcional)
                    </Label>
                    <Input
                      placeholder="Ej: Los copys ya están listos en el doc adjunto, por favor armar las placas con colores de marca..."
                      value={handoverNote}
                      onChange={e => setHandoverNote(e.target.value)}
                      className="bg-background border-border text-xs h-9"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsHandoverOpen(false)}
                      className="h-8 text-xs font-bold"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={submittingHandover || !handoverTargetUserId}
                      className="h-8 text-xs font-black uppercase bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-sm"
                    >
                      <ArrowRightLeft size={13} />
                      Confirmar Pase de Tarea
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Status Changer (Staff Only) */}
          {isStaff && (
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase text-muted-foreground flex items-center justify-between">
                <span>Cambiar Estado del Flujo de Trabajo</span>
                <span className="text-[10px] text-muted-foreground">Efecto Digital Workflow</span>
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: 'pending_receipt', label: '🔔 Pendiente' },
                  { key: 'in_progress', label: '⏳ En Proceso' },
                  { key: 'internal_review', label: '🔍 Revisión Interna' },
                  { key: 'waiting_client_feedback', label: '💬 Feedback Cliente' },
                  { key: 'completed', label: '✅ Completada / Aprobada' },
                ].map(st => (
                  <Button
                    key={st.key}
                    type="button"
                    variant={task.status === st.key ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleStatusChange(st.key as TaskStatus)}
                    className={`text-xs font-bold h-8 ${task.status === st.key ? 'bg-primary text-primary-foreground font-black' : 'bg-background'}`}
                  >
                    {st.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Description / Brief */}
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
              <FileCheck size={14} className="text-primary" />
              Brief / Requerimientos de la Tarea
            </h4>
            <div className="p-4 rounded-xl bg-background border border-border/40 text-xs leading-relaxed whitespace-pre-wrap font-medium">
              {task.description || <span className="italic text-muted-foreground">Sin descripción detallada.</span>}
            </div>
          </div>

          {/* Attached Resources / Links */}
          {task.attachments && task.attachments.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                <Link2 size={14} className="text-primary" />
                Archivos & Enlaces de Trabajo ({task.attachments.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {task.attachments.map(att => (
                  <a
                    key={att.id}
                    href={att.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/60 border border-border/30 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <span className="text-xl shrink-0">
                        {att.type === 'figma' && '🎨'}
                        {att.type === 'drive' && '📁'}
                        {att.type === 'canva' && '✨'}
                        {att.type === 'loom' && '📹'}
                        {att.type === 'doc' && '📄'}
                        {att.type === 'image' && '🖼️'}
                        {att.type === 'link' && '🔗'}
                      </span>
                      <div className="truncate">
                        <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                          {att.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">
                          {att.url}
                        </p>
                      </div>
                    </div>
                    <ExternalLink size={14} className="text-muted-foreground group-hover:text-primary shrink-0 ml-2" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* DELIVERABLE SECTION (Entregable Final del Diseñador/Copy) */}
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-primary/20 text-primary">
                  <CheckSquare size={16} />
                </span>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-tight text-foreground">
                    Entregable Final (Creativos / Textos / Links)
                  </h4>
                  <p className="text-[10px] text-muted-foreground">
                    Enlace al tablero de Figma, carpeta de Drive, Canva o archivo finalizado.
                  </p>
                </div>
              </div>

              {isStaff && !isEditingDeliverable && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDeliverableUrl(task.deliverableUrl || '');
                    setDeliverableNotes(task.deliverableNotes || '');
                    setIsEditingDeliverable(true);
                  }}
                  className="h-7 text-[11px] font-bold"
                >
                  {task.deliverableUrl ? 'Actualizar Entregable' : '+ Cargar Entregable'}
                </Button>
              )}
            </div>

            {task.deliverableUrl && !isEditingDeliverable && (
              <div className="p-3 bg-background rounded-lg border border-border/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="overflow-hidden">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Enlace de Entrega:</p>
                  <a
                    href={task.deliverableUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1.5 mt-0.5 truncate"
                  >
                    <ExternalLink size={13} />
                    {task.deliverableUrl}
                  </a>
                  {task.deliverableNotes && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      "{task.deliverableNotes}"
                    </p>
                  )}
                </div>
                <a
                  href={task.deliverableUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 font-black text-xs uppercase rounded-lg shrink-0 flex items-center gap-1.5 shadow-sm"
                >
                  Abrir Entregable
                  <ArrowRight size={14} />
                </a>
              </div>
            )}

            {isEditingDeliverable && (
              <div className="space-y-3 p-3 bg-background rounded-lg border border-border/40 animate-in fade-in">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">URL del Entregable *</Label>
                  <Input
                    placeholder="https://www.figma.com/... o https://drive.google.com/..."
                    value={deliverableUrl}
                    onChange={e => setDeliverableUrl(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Notas de entrega (Opcional)</Label>
                  <Input
                    placeholder="Ej. Se agregaron 3 variaciones de formato 1:1 y 9:16 para reels..."
                    value={deliverableNotes}
                    onChange={e => setDeliverableNotes(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingDeliverable(false)}
                    className="h-8 text-xs font-bold"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveDeliverable}
                    className="h-8 text-xs font-black uppercase bg-primary text-primary-foreground"
                  >
                    Guardar Entregable
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* CLIENT FEEDBACK & APPROVAL SECTION */}
          {(task.visibleToClient || isClientUser || task.status === 'waiting_client_feedback' || task.status === 'completed') && (
            <div className="p-4 rounded-xl bg-pink-500/5 border border-pink-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-pink-500/20 text-pink-600">
                    <MessageSquare size={16} />
                  </span>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-tight text-foreground flex items-center gap-2">
                      Feedback & Aprobación del Cliente
                      {task.clientApproved && (
                        <Badge className="bg-emerald-500 text-white font-black text-[10px]">
                          ✅ Aprobado
                        </Badge>
                      )}
                    </h4>
                    <p className="text-[10px] text-muted-foreground">
                      Espacio para que el cliente revise creativos, deje ajustes o dé su aprobación final.
                    </p>
                  </div>
                </div>

                {/* Approve Button */}
                {!task.clientApproved && (
                  <Button
                    onClick={handleClientApprove}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase px-3.5 h-8 gap-1.5 shadow-sm"
                  >
                    <ThumbsUp size={14} />
                    {isClientUser ? 'Aprobar Creativo ✅' : 'Marcar Aprobado por Cliente'}
                  </Button>
                )}
              </div>

              {task.clientApproved && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  <span>Aprobado por el cliente el {formatDate(task.clientApprovedAt || task.completedAt)}</span>
                </div>
              )}

              {task.clientFeedback && (
                <div className="p-3 bg-background rounded-lg border border-border/40 text-xs">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold mb-1">
                    <span>Último Feedback Registrado:</span>
                    <span>{formatDate(task.clientFeedbackDate)}</span>
                  </div>
                  <p className="font-medium text-foreground whitespace-pre-wrap">{task.clientFeedback}</p>
                </div>
              )}

              {/* Feedback Input Box */}
              {!task.clientApproved && (
                <div className="space-y-2 pt-2 border-t border-pink-500/20">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">
                    {isClientUser ? '¿Necesitas algún ajuste o cambio en el entregable?' : 'Registrar Feedback / Correcciones del Cliente:'}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Escribe aquí los comentarios o cambios necesarios..."
                      value={clientFeedbackText}
                      onChange={e => setClientFeedbackText(e.target.value)}
                      className="bg-background border-border text-xs h-9"
                    />
                    <Button
                      onClick={handleSendClientFeedback}
                      className="bg-pink-600 hover:bg-pink-700 text-white font-black text-xs uppercase px-4 h-9 shrink-0 gap-1"
                    >
                      <Send size={13} />
                      Enviar Feedback
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Comments & Activity Thread */}
          <div className="space-y-3 pt-4 border-t border-border/20">
            <h4 className="text-xs font-black uppercase text-muted-foreground tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <MessageSquare size={14} className="text-primary" />
                Comentarios & Notas del Equipo ({task.comments?.length || 0})
              </span>
            </h4>

            {/* Comment List */}
            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
              {(!task.comments || task.comments.length === 0) ? (
                <div className="p-4 text-center text-xs text-muted-foreground italic rounded-xl bg-muted/20 border border-border/20">
                  No hay comentarios aún. Deja una nota o instrucción aquí.
                </div>
              ) : (
                task.comments.map(comm => (
                  <div key={comm.id} className="p-3 rounded-xl bg-muted/30 border border-border/20 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-foreground">
                        <span>{comm.authorName}</span>
                        <Badge variant="outline" className="text-[9px] py-0 px-1 font-semibold">
                          {comm.authorRole}
                        </Badge>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {formatDate(comm.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-foreground font-medium whitespace-pre-wrap leading-relaxed">
                      {comm.content}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Add Comment / Note Input Form */}
            <form onSubmit={handleAddComment} className="space-y-2 pt-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase text-muted-foreground mr-1">Tipo de Nota:</span>
                <button
                  type="button"
                  onClick={() => setCommentCategory('general')}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                    commentCategory === 'general'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border/40 hover:bg-muted/40'
                  }`}
                >
                  💬 General
                </button>
                <button
                  type="button"
                  onClick={() => setCommentCategory('instruction')}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                    commentCategory === 'instruction'
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-background text-muted-foreground border-border/40 hover:bg-muted/40'
                  }`}
                >
                  📌 Requisito / Instrucción
                </button>
                <button
                  type="button"
                  onClick={() => setCommentCategory('handover')}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                    commentCategory === 'handover'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-background text-muted-foreground border-border/40 hover:bg-muted/40'
                  }`}
                >
                  🔄 Avance / Pase
                </button>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  placeholder={
                    commentCategory === 'instruction'
                      ? 'Escribe la instrucción o requisito clave...'
                      : commentCategory === 'handover'
                      ? 'Escribe el avance realizado antes de pasar la posta...'
                      : 'Escribe una nota, consulta o actualización...'
                  }
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  className="bg-background border-border text-xs h-9"
                />
                <Button
                  type="submit"
                  disabled={submittingComment || !commentText.trim()}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs uppercase px-4 h-9 shrink-0 gap-1.5"
                >
                  <Send size={13} />
                  Guardar Nota
                </Button>
              </div>
            </form>
          </div>
        </div>

        <DialogFooter className="p-4 border-t border-border/20 bg-muted/20 flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground font-mono">
            ID: {task.id} • Actualizado: {formatDate(task.updatedAt)}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs font-bold"
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
