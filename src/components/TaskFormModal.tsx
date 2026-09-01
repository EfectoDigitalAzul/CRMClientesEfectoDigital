import React, { useState, useEffect } from 'react';
import { TeamTask, TaskPriority, TaskCategory, TaskAttachment, UserProfile, Client } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import { 
  CheckSquare, 
  Link2, 
  Plus, 
  Trash2, 
  Sparkles, 
  Calendar, 
  Clock, 
  AlertCircle, 
  Eye, 
  FileText,
  Palette,
  Megaphone,
  UserCheck,
  FolderPlus
} from 'lucide-react';

interface TaskFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTask?: TeamTask | null;
  onSave: (task: TeamTask) => Promise<void> | void;
  allUsers: UserProfile[];
  clients: Client[];
  currentProfile: UserProfile | null;
  preselectedClientId?: string;
}

export default function TaskFormModal({
  open,
  onOpenChange,
  initialTask,
  onSave,
  allUsers,
  clients,
  currentProfile,
  preselectedClientId
}: TaskFormModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskCategory>('design');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [assigneeId, setAssigneeId] = useState('');
  const [clientId, setClientId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('18:00');
  const [visibleToClient, setVisibleToClient] = useState(true);
  
  // Attachments
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkName, setNewLinkName] = useState('');
  const [newLinkType, setNewLinkType] = useState<TaskAttachment['type']>('figma');

  const [saving, setSaving] = useState(false);

  // Filter staff users (excluding clients)
  const staffUsers = allUsers.filter(u => u.role !== 'client' && u.isActive !== false);

  useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title || '');
      setDescription(initialTask.description || '');
      setCategory(initialTask.category || 'design');
      setPriority(initialTask.priority || 'medium');
      setAssigneeId(initialTask.assigneeId || '');
      setClientId(initialTask.clientId || '');
      setDueDate(initialTask.dueDate || '');
      setDueTime(initialTask.dueTime || '18:00');
      setVisibleToClient(initialTask.visibleToClient ?? true);
      setAttachments(initialTask.attachments || []);
    } else {
      setTitle('');
      setDescription('');
      setCategory('design');
      setPriority('medium');
      // Default to first designer/copywriter if exists, or first staff
      const defaultAssignee = staffUsers.find(u => u.role === 'designer' || u.role === 'copywriter') || staffUsers[0];
      setAssigneeId(defaultAssignee ? defaultAssignee.uid : '');
      setClientId(preselectedClientId || '');
      
      // Default due date: tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const pad = (n: number) => String(n).padStart(2, '0');
      setDueDate(`${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`);
      setDueTime('18:00');
      setVisibleToClient(true);
      setAttachments([]);
    }
  }, [initialTask, open, preselectedClientId]);

  const handleAddAttachment = () => {
    if (!newLinkUrl.trim()) {
      toast.error('Ingresa una URL válida');
      return;
    }

    let formattedUrl = newLinkUrl.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    let defaultName = newLinkName.trim();
    if (!defaultName) {
      if (newLinkType === 'figma') defaultName = 'Tablero Figma';
      else if (newLinkType === 'drive') defaultName = 'Carpeta Google Drive';
      else if (newLinkType === 'canva') defaultName = 'Diseño Canva';
      else if (newLinkType === 'loom') defaultName = 'Video Loom';
      else defaultName = 'Enlace de referencia';
    }

    const newAtt: TaskAttachment = {
      id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: defaultName,
      url: formattedUrl,
      type: newLinkType,
      uploadedAt: new Date().toISOString(),
      uploadedBy: currentProfile?.displayName || 'Usuario',
    };

    setAttachments([...attachments, newAtt]);
    setNewLinkUrl('');
    setNewLinkName('');
    toast.success('Enlace adjuntado');
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(attachments.filter(a => a.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('El título de la tarea es obligatorio');
      return;
    }

    if (!assigneeId) {
      toast.error('Debes asignar la tarea a un miembro del equipo');
      return;
    }

    const assignee = staffUsers.find(u => u.uid === assigneeId);
    const client = clients.find(c => c.id === clientId);

    const nowIso = new Date().toISOString();

    setSaving(true);
    try {
      const taskData: TeamTask = {
        id: initialTask?.id || `task-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        status: initialTask?.status || 'pending_receipt',
        
        creatorId: initialTask?.creatorId || currentProfile?.uid || 'u-azul',
        creatorName: initialTask?.creatorName || currentProfile?.displayName || 'Azul',
        creatorRole: initialTask?.creatorRole || currentProfile?.role || 'director',

        assigneeId,
        assigneeName: assignee?.displayName || 'Asignado',
        assigneeRole: assignee?.role || 'designer',

        clientId: clientId || undefined,
        clientName: client ? client.name : (clientId ? 'Cliente' : undefined),

        isReceived: initialTask?.isReceived ?? false,
        receivedAt: initialTask?.receivedAt,
        receivedBy: initialTask?.receivedBy,

        visibleToClient,
        clientFeedback: initialTask?.clientFeedback,
        clientFeedbackDate: initialTask?.clientFeedbackDate,
        clientApproved: initialTask?.clientApproved,
        clientApprovedAt: initialTask?.clientApprovedAt,

        deliverableUrl: initialTask?.deliverableUrl,
        deliverableNotes: initialTask?.deliverableNotes,

        dueDate: dueDate || undefined,
        dueTime: dueTime || '18:00',
        completedAt: initialTask?.completedAt,
        completedBy: initialTask?.completedBy,

        attachments,
        comments: initialTask?.comments || [],

        createdAt: initialTask?.createdAt || nowIso,
        updatedAt: nowIso,
      };

      await onSave(taskData);
      onOpenChange(false);
      toast.success(initialTask ? 'Tarea actualizada correctamente' : '¡Tarea asignada con éxito!');
    } catch (err: any) {
      console.error('Error al guardar tarea:', err);
      toast.error(`Error al guardar: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto bg-card border-border text-foreground p-0">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="p-6 pb-4 border-b border-border/20 bg-muted/20">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-primary/10 text-primary">
                <CheckSquare size={18} />
              </span>
              <div>
                <DialogTitle className="text-lg font-black uppercase italic tracking-tight">
                  {initialTask ? 'Editar Tarea / Pedido' : 'Nueva Tarea / Pedido de Equipo'}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Asigna trabajo a Diseñadores, Copys o compañeros con confirmación de entrega y feedback del cliente.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-5">
            {/* Título */}
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase text-muted-foreground flex items-center justify-between">
                <span>Título de la Tarea / Pedido *</span>
                <span className="text-[10px] lowercase text-primary font-normal">sé claro y específico</span>
              </Label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ej. Creativos Carrusel Meta Ads - Campaña Otoño"
                className="bg-background border-border text-sm font-semibold h-10"
                required
              />
            </div>

            {/* Categoría y Prioridad */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase text-muted-foreground">Área / Categoría</Label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as TaskCategory)}
                  className="w-full h-10 px-3 bg-background border border-border rounded-lg text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="design">🎨 Diseño Gráfico / Creativos</option>
                  <option value="copy">✍️ Copywriting / Textos</option>
                  <option value="pauta">📢 Pauta / Meta Ads</option>
                  <option value="account_management">💼 Gestión AM / Cuentas</option>
                  <option value="general">⚡ General / Tarea Interna</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase text-muted-foreground">Nivel de Prioridad</Label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as TaskPriority)}
                  className="w-full h-10 px-3 bg-background border border-border rounded-lg text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="low">🟢 Baja (Normal)</option>
                  <option value="medium">🟡 Media (Estándar)</option>
                  <option value="high">🟠 Alta (Importante)</option>
                  <option value="urgent">🔴 Urgente (Prioridad Máxima ⚡)</option>
                </select>
              </div>
            </div>

            {/* Asignación y Cliente */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase text-muted-foreground flex items-center gap-1.5">
                  <UserCheck size={13} className="text-primary" />
                  Asignar a *
                </Label>
                <select
                  value={assigneeId}
                  onChange={e => setAssigneeId(e.target.value)}
                  className="w-full h-10 px-3 bg-background border border-border rounded-lg text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                >
                  <option value="" disabled>Selecciona un miembro del equipo</option>
                  {staffUsers.map(user => (
                    <option key={user.uid} value={user.uid}>
                      {user.displayName} ({user.role === 'designer' ? 'Diseñador' : user.role === 'copywriter' ? 'Copy' : user.role === 'account_manager' ? 'AM' : user.role === 'director' ? 'Director' : user.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase text-muted-foreground flex items-center gap-1.5">
                  <FolderPlus size={13} className="text-primary" />
                  Cliente Relacionado
                </Label>
                <select
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  className="w-full h-10 px-3 bg-background border border-border rounded-lg text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">🏢 Interno Efecto (Sin cliente específico)</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Fechas Límite (Deadline) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase text-muted-foreground flex items-center gap-1.5">
                  <Calendar size={13} className="text-emerald-500" />
                  Fecha Límite (Entrega)
                </Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="bg-background border-border text-xs font-bold h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase text-muted-foreground flex items-center gap-1.5">
                  <Clock size={13} className="text-emerald-500" />
                  Hora Límite
                </Label>
                <Input
                  type="time"
                  value={dueTime}
                  onChange={e => setDueTime(e.target.value)}
                  className="bg-background border-border text-xs font-bold h-10"
                />
              </div>
            </div>

            {/* Descripción / Brief */}
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase text-muted-foreground">
                Brief / Descripción detallada
              </Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Detalla los requerimientos, medidas, público objetivo, gancho del copy o instrucciones específicas..."
                rows={4}
                className="bg-background border-border text-xs leading-relaxed"
              />
            </div>

            {/* Visibilidad para el Cliente */}
            <div className="p-3.5 bg-primary/5 rounded-xl border border-primary/20 flex items-start gap-3">
              <input
                type="checkbox"
                id="visibleToClientCheckbox"
                checked={visibleToClient}
                onChange={e => setVisibleToClient(e.target.checked)}
                className="h-4 w-4 mt-0.5 rounded text-primary focus:ring-primary border-border cursor-pointer accent-primary"
              />
              <label htmlFor="visibleToClientCheckbox" className="text-xs cursor-pointer select-none space-y-0.5">
                <p className="font-bold text-foreground flex items-center gap-1.5">
                  <Eye size={13} className="text-primary" />
                  Hacer visible al cliente para revisión y feedback
                </p>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  Cuando la tarea pase a <strong>"Esperando Feedback del Cliente"</strong> o <strong>"Completada"</strong>, el cliente podrá ver el entregable en su portal, aprobarlo o dejar comentarios.
                </p>
              </label>
            </div>

            {/* Enlaces y Adjuntos (Figma, Drive, Canva, etc.) */}
            <div className="space-y-3 pt-2 border-t border-border/20">
              <Label className="text-xs font-black uppercase text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Link2 size={13} className="text-primary" />
                  Enlaces de Recursos & Archivos (Figma, Drive, Canva)
                </span>
                <span className="text-[10px] text-muted-foreground font-semibold">{attachments.length} adjuntos</span>
              </Label>

              {attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map(att => (
                    <div key={att.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/30 text-xs">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="text-base shrink-0">
                          {att.type === 'figma' && '🎨'}
                          {att.type === 'drive' && '📁'}
                          {att.type === 'canva' && '✨'}
                          {att.type === 'loom' && '📹'}
                          {att.type === 'doc' && '📄'}
                          {att.type === 'image' && '🖼️'}
                          {att.type === 'link' && '🔗'}
                        </span>
                        <div className="truncate">
                          <p className="font-bold text-foreground truncate">{att.name}</p>
                          <a href={att.url} target="_blank" rel="noreferrer" className="text-[10px] text-primary hover:underline truncate block">
                            {att.url}
                          </a>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(att.id)}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-3 bg-muted/20 rounded-xl border border-border/20">
                <div className="sm:col-span-3">
                  <select
                    value={newLinkType}
                    onChange={e => setNewLinkType(e.target.value as any)}
                    className="w-full h-9 px-2 bg-background border border-border rounded-lg text-xs font-medium text-foreground"
                  >
                    <option value="figma">🎨 Figma</option>
                    <option value="drive">📁 Google Drive</option>
                    <option value="canva">✨ Canva</option>
                    <option value="loom">📹 Loom</option>
                    <option value="doc">📄 Google Doc</option>
                    <option value="image">🖼️ Imagen/Ref</option>
                    <option value="link">🔗 Link Web</option>
                  </select>
                </div>
                <div className="sm:col-span-4">
                  <Input
                    placeholder="Nombre (ej. Brief Placa 1)"
                    value={newLinkName}
                    onChange={e => setNewLinkName(e.target.value)}
                    className="h-9 bg-background border-border text-xs"
                  />
                </div>
                <div className="sm:col-span-4">
                  <Input
                    placeholder="URL (https://...)"
                    value={newLinkUrl}
                    onChange={e => setNewLinkUrl(e.target.value)}
                    className="h-9 bg-background border-border text-xs"
                  />
                </div>
                <div className="sm:col-span-1 flex items-center justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleAddAttachment}
                    className="h-9 w-9 bg-primary/10 border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground shrink-0"
                    title="Agregar Enlace"
                  >
                    <Plus size={16} />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-border/20 bg-muted/20 flex items-center justify-between sm:justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="text-xs font-bold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs uppercase px-5 h-9"
            >
              {saving ? 'Guardando...' : (initialTask ? 'Guardar Cambios' : 'Asignar Tarea 🚀')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
