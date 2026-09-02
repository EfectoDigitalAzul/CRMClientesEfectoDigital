import React, { useState, useEffect } from 'react';
import { TeamTask, TaskPriority, TaskCategory, TaskWorkflowType, TaskStage, TaskAttachment, UserProfile, Client } from '../types';
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
  FolderPlus,
  Layers,
  ArrowRight,
  HelpCircle
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
  const [workflowType, setWorkflowType] = useState<TaskWorkflowType>('integral_copy_design');
  const [category, setCategory] = useState<TaskCategory>('copy');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  
  // Handlers for specific roles in workflow
  const [assigneeId, setAssigneeId] = useState('');
  const [copywriterId, setCopywriterId] = useState('');
  const [designerId, setDesignerId] = useState('');
  
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
  const copywriters = staffUsers.filter(u => u.role === 'copywriter');
  const designers = staffUsers.filter(u => u.role === 'designer');

  useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title || '');
      setDescription(initialTask.description || '');
      setWorkflowType(initialTask.workflowType || 'integral_copy_design');
      setCategory(initialTask.category || 'copy');
      setPriority(initialTask.priority || 'medium');
      setAssigneeId(initialTask.assigneeId || '');
      setCopywriterId(initialTask.copywriterId || '');
      setDesignerId(initialTask.designerId || '');
      setClientId(initialTask.clientId || '');
      setDueDate(initialTask.dueDate || '');
      setDueTime(initialTask.dueTime || '18:00');
      setVisibleToClient(initialTask.visibleToClient ?? true);
      setAttachments(initialTask.attachments || []);
    } else {
      setTitle('');
      setDescription('');
      setWorkflowType('integral_copy_design');
      setCategory('copy');
      setPriority('medium');
      
      // Auto pre-assign copywriter and designer if available
      const defaultCopy = copywriters[0] || staffUsers.find(u => u.role === 'copywriter') || staffUsers[0];
      const defaultDesigner = designers[0] || staffUsers.find(u => u.role === 'designer');

      setCopywriterId(defaultCopy ? defaultCopy.uid : '');
      setDesignerId(defaultDesigner ? defaultDesigner.uid : '');
      setAssigneeId(defaultCopy ? defaultCopy.uid : (staffUsers[0]?.uid || ''));
      setClientId(preselectedClientId || '');
      
      // Default due date: in 2 days
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 2);
      const pad = (n: number) => String(n).padStart(2, '0');
      setDueDate(`${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(targetDate.getDate())}`);
      setDueTime('18:00');
      setVisibleToClient(true);
      setAttachments([]);
    }
  }, [initialTask, open, preselectedClientId]);

  // When workflow changes, update default category & assignee
  const handleWorkflowChange = (wf: TaskWorkflowType) => {
    setWorkflowType(wf);
    if (wf === 'integral_copy_design') {
      setCategory('copy');
      const firstCopy = copywriters[0] || staffUsers[0];
      if (firstCopy) {
        setCopywriterId(firstCopy.uid);
        setAssigneeId(firstCopy.uid);
      }
    } else if (wf === 'direct_design') {
      setCategory('design');
      const firstDes = designers[0] || staffUsers.find(u => u.role === 'designer') || staffUsers[0];
      if (firstDes) {
        setDesignerId(firstDes.uid);
        setAssigneeId(firstDes.uid);
      }
    } else if (wf === 'direct_copy') {
      setCategory('copy');
      const firstCopy = copywriters[0] || staffUsers[0];
      if (firstCopy) {
        setCopywriterId(firstCopy.uid);
        setAssigneeId(firstCopy.uid);
      }
    }
  };

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
      else if (newLinkType === 'doc') defaultName = 'Google Docs / Brief';
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

    // Determine target assignee based on workflow
    let finalAssigneeId = assigneeId;
    if (workflowType === 'integral_copy_design') {
      finalAssigneeId = copywriterId || assigneeId;
    } else if (workflowType === 'direct_design') {
      finalAssigneeId = designerId || assigneeId;
    }

    if (!finalAssigneeId) {
      toast.error('Debes asignar la tarea a un miembro del equipo');
      return;
    }

    const assignee = staffUsers.find(u => u.uid === finalAssigneeId);
    const copyUser = staffUsers.find(u => u.uid === copywriterId);
    const desUser = staffUsers.find(u => u.uid === designerId);
    const client = clients.find(c => c.id === clientId);

    const nowIso = new Date().toISOString();

    // Determine initial stage
    let initialStage: TaskStage = 'copywriting';
    if (workflowType === 'direct_design') {
      initialStage = 'designing';
    } else if (workflowType === 'direct_copy') {
      initialStage = 'copywriting';
    } else if (workflowType === 'integral_copy_design') {
      initialStage = 'copywriting';
    } else {
      initialStage = 'designing';
    }

    setSaving(true);
    try {
      const taskData: TeamTask = {
        id: initialTask?.id || `task-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        title: title.trim(),
        description: description.trim(),
        category: workflowType === 'integral_copy_design' ? 'copy' : category,
        priority,
        status: initialTask?.status || 'pending_receipt',
        
        workflowType,
        stage: initialTask?.stage || initialStage,
        copyApproved: initialTask?.copyApproved ?? false,
        copyApprovedAt: initialTask?.copyApprovedAt,
        copyApprovedBy: initialTask?.copyApprovedBy,
        copyNotes: initialTask?.copyNotes,
        copyDocUrl: initialTask?.copyDocUrl,
        designNotes: initialTask?.designNotes,
        copywriterId: copywriterId || undefined,
        copywriterName: copyUser ? copyUser.displayName : undefined,
        designerId: designerId || undefined,
        designerName: desUser ? desUser.displayName : undefined,

        creatorId: initialTask?.creatorId || currentProfile?.uid || 'u-azul',
        creatorName: initialTask?.creatorName || currentProfile?.displayName || 'Azul',
        creatorRole: initialTask?.creatorRole || currentProfile?.role || 'director',

        assigneeId: finalAssigneeId,
        assigneeName: assignee?.displayName || 'Asignado',
        assigneeRole: assignee?.role || (workflowType === 'integral_copy_design' ? 'copywriter' : 'designer'),

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
      toast.success(initialTask ? 'Tarea actualizada correctamente' : '¡Tarea creada con Flujo Integral!');
    } catch (err: any) {
      console.error('Error al guardar tarea:', err);
      toast.error(`Error al guardar: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[660px] max-h-[92vh] overflow-y-auto bg-card border-border text-foreground p-0 rounded-2xl shadow-2xl">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-border/20 bg-muted/10">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <CheckSquare size={20} />
              </span>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                  {initialTask ? 'Editar Tarea / Pedido' : 'Nueva Tarea & Flujo de Producción'}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Flujo coordinado entre Copywriting, Revisión, Diseño Gráfico y Feedback del Cliente.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-5 sm:p-6 space-y-5">
            {/* Selector de Flujo de Trabajo (Pipeline) */}
            <div className="space-y-2 p-3.5 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wide text-foreground flex items-center gap-1.5">
                  <Layers size={14} className="text-primary" />
                  Seleccionar Flujo de Trabajo
                </Label>
                <span className="text-[10px] text-muted-foreground">Paso a paso coordinado</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                {/* Flujo 1: Integral */}
                <button
                  type="button"
                  onClick={() => handleWorkflowChange('integral_copy_design')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    workflowType === 'integral_copy_design'
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm ring-2 ring-primary/20'
                      : 'bg-card hover:bg-muted/50 border-border/60 text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold flex items-center gap-1">
                      ✍️ ➔ 🎨 Integral
                    </span>
                    {workflowType === 'integral_copy_design' && (
                      <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    )}
                  </div>
                  <p className={`text-[10px] leading-tight ${workflowType === 'integral_copy_design' ? 'text-primary-foreground/90' : 'text-muted-foreground'}`}>
                    1. Copy ➔ 2. Revisión ➔ 3. Diseñador ➔ 4. Cliente
                  </p>
                </button>

                {/* Flujo 2: Solo Diseño */}
                <button
                  type="button"
                  onClick={() => handleWorkflowChange('direct_design')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    workflowType === 'direct_design'
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm ring-2 ring-primary/20'
                      : 'bg-card hover:bg-muted/50 border-border/60 text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold flex items-center gap-1">
                      🎨 Solo Diseño
                    </span>
                    {workflowType === 'direct_design' && (
                      <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    )}
                  </div>
                  <p className={`text-[10px] leading-tight ${workflowType === 'direct_design' ? 'text-primary-foreground/90' : 'text-muted-foreground'}`}>
                    1. Diseñador ➔ 2. Feedback Cliente
                  </p>
                </button>

                {/* Flujo 3: Solo Copy */}
                <button
                  type="button"
                  onClick={() => handleWorkflowChange('direct_copy')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    workflowType === 'direct_copy'
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm ring-2 ring-primary/20'
                      : 'bg-card hover:bg-muted/50 border-border/60 text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold flex items-center gap-1">
                      ✍️ Solo Copy
                    </span>
                    {workflowType === 'direct_copy' && (
                      <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    )}
                  </div>
                  <p className={`text-[10px] leading-tight ${workflowType === 'direct_copy' ? 'text-primary-foreground/90' : 'text-muted-foreground'}`}>
                    1. Redacción ➔ 2. Feedback Cliente
                  </p>
                </button>
              </div>
            </div>

            {/* Título */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                <span>Título de la Tarea / Creativo *</span>
                <span className="text-[10px] text-muted-foreground font-normal">Claro y descriptivo</span>
              </Label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ej. Creativos Carrusel Meta Ads - Campaña de Captación"
                className="bg-background border-border text-sm font-medium h-10 rounded-lg"
                required
              />
            </div>

            {/* Asignación Inteligente de Responsables según el Flujo */}
            {workflowType === 'integral_copy_design' ? (
              <div className="p-3.5 rounded-xl bg-muted/30 border border-border/50 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">
                    👥 Responsables del Flujo Integral:
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 1. Copywriter */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">1</span>
                      Copywriter (Inicia la tarea) *
                    </Label>
                    <select
                      value={copywriterId}
                      onChange={e => {
                        setCopywriterId(e.target.value);
                        setAssigneeId(e.target.value);
                      }}
                      className="w-full h-9 px-3 bg-background border border-border rounded-lg text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      required
                    >
                      <option value="" disabled>Selecciona Copywriter...</option>
                      {staffUsers.map(user => (
                        <option key={user.uid} value={user.uid}>
                          {user.displayName} {user.role === 'copywriter' ? '✍️ (Copy)' : `(${user.role})`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2. Diseñador (Siguiente etapa) */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-500 text-[10px] font-bold flex items-center justify-center">2</span>
                      Diseñador Gráfico (Recibe tras aprobar copy)
                    </Label>
                    <select
                      value={designerId}
                      onChange={e => setDesignerId(e.target.value)}
                      className="w-full h-9 px-3 bg-background border border-border rounded-lg text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Seleccionar más tarde al aprobar copy</option>
                      {staffUsers.map(user => (
                        <option key={user.uid} value={user.uid}>
                          {user.displayName} {user.role === 'designer' ? '🎨 (Diseñador)' : `(${user.role})`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <UserCheck size={13} className="text-primary" />
                    Asignar Responsable *
                  </Label>
                  <select
                    value={assigneeId}
                    onChange={e => setAssigneeId(e.target.value)}
                    className="w-full h-10 px-3 bg-background border border-border rounded-lg text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  >
                    <option value="" disabled>Selecciona un miembro</option>
                    {staffUsers.map(user => (
                      <option key={user.uid} value={user.uid}>
                        {user.displayName} ({user.role === 'designer' ? 'Diseñador' : user.role === 'copywriter' ? 'Copy' : user.role === 'account_manager' ? 'AM' : user.role === 'director' ? 'Director' : user.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">Nivel de Prioridad</Label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as TaskPriority)}
                    className="w-full h-10 px-3 bg-background border border-border rounded-lg text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="low">🟢 Baja (Normal)</option>
                    <option value="medium">🟡 Media (Estándar)</option>
                    <option value="high">🟠 Alta (Importante)</option>
                    <option value="urgent">🔴 Urgente (Prioridad Máxima ⚡)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Cliente y Prioridad (en caso de Integral) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <FolderPlus size={13} className="text-primary" />
                  Cliente Relacionado
                </Label>
                <select
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  className="w-full h-10 px-3 bg-background border border-border rounded-lg text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">🏢 Interno Efecto (Sin cliente específico)</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {workflowType === 'integral_copy_design' ? (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">Nivel de Prioridad</Label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as TaskPriority)}
                    className="w-full h-10 px-3 bg-background border border-border rounded-lg text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="low">🟢 Baja (Normal)</option>
                    <option value="medium">🟡 Media (Estándar)</option>
                    <option value="high">🟠 Alta (Importante)</option>
                    <option value="urgent">🔴 Urgente (Prioridad Máxima ⚡)</option>
                  </select>
                </div>
              ) : null}
            </div>

            {/* Brief / Descripción */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                <span>Brief / Indicaciones Detalladas</span>
                <span className="text-[10px] text-muted-foreground font-normal">Objetivo, público, formato, restricciones</span>
              </Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Detalla lo que se necesita: Formatos (1080x1080, 1080x1920), propuesta de valor, llamadas a la acción (CTA) y referencias..."
                className="bg-background border-border text-xs min-h-[95px] resize-y rounded-lg"
              />
            </div>

            {/* Fecha Límite & Visibilidad al Cliente */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Calendar size={13} className="text-primary" />
                  Fecha Límite de Entrega
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="bg-background border-border text-xs h-9 rounded-lg"
                  />
                  <Input
                    type="time"
                    value={dueTime}
                    onChange={e => setDueTime(e.target.value)}
                    className="bg-background border-border text-xs h-9 w-24 shrink-0 rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Eye size={13} className="text-primary" />
                  Visibilidad para el Cliente
                </Label>
                <div className="flex items-center gap-2 pt-1">
                  <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={visibleToClient}
                      onChange={e => setVisibleToClient(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                    />
                    <span>Visible para el portal del cliente</span>
                  </label>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  El cliente podrá ver el estado y aprobar el entregable cuando esté listo.
                </p>
              </div>
            </div>

            {/* Archivos & Enlaces de Referencia */}
            <div className="space-y-3 pt-2 border-t border-border/30">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Link2 size={13} className="text-primary" />
                Enlaces & Materiales Adjuntos (Figma, Drive, Canva, Docs)
              </Label>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-3">
                  <select
                    value={newLinkType}
                    onChange={e => setNewLinkType(e.target.value as TaskAttachment['type'])}
                    className="w-full h-9 px-2 bg-background border border-border rounded-lg text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="doc">📄 Google Docs (Copy/Brief)</option>
                    <option value="figma">🎨 Figma</option>
                    <option value="drive">📁 Google Drive</option>
                    <option value="canva">🖼️ Canva</option>
                    <option value="loom">📹 Loom Video</option>
                    <option value="link">🔗 Otro Enlace</option>
                  </select>
                </div>

                <div className="sm:col-span-6">
                  <Input
                    placeholder="https://docs.google.com/... o enlace de referencia"
                    value={newLinkUrl}
                    onChange={e => setNewLinkUrl(e.target.value)}
                    className="bg-background border-border text-xs h-9 rounded-lg"
                  />
                </div>

                <div className="sm:col-span-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddAttachment}
                    className="w-full h-9 text-xs font-bold gap-1 text-primary border-primary/30 hover:bg-primary/10 rounded-lg"
                  >
                    <Plus size={13} />
                    Adjuntar
                  </Button>
                </div>
              </div>

              {/* Lista de adjuntos */}
              {attachments.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {attachments.map(att => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/40 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-primary">🔗</span>
                        <span className="font-semibold text-foreground truncate">{att.name}</span>
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-muted-foreground hover:text-primary truncate max-w-[200px]"
                        >
                          {att.url}
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(att.id)}
                        className="p-1 text-muted-foreground hover:text-red-500 rounded transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="p-4 sm:p-5 border-t border-border/20 bg-muted/10 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs font-semibold rounded-lg"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-5 h-9 rounded-lg shadow-sm"
            >
              {saving ? 'Guardando...' : initialTask ? 'Actualizar Tarea' : 'Crear Tarea con Flujo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
