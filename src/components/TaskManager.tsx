import React, { useState, useEffect, useMemo } from 'react';
import { 
  TeamTask, 
  TaskStatus, 
  TaskCategory, 
  TaskPriority, 
  UserProfile, 
  Client 
} from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { toast } from 'sonner';
import TaskFormModal from './TaskFormModal';
import TaskDetailModal from './TaskDetailModal';
import {
  CheckSquare,
  Plus,
  Search,
  Filter,
  Columns,
  List,
  Calendar,
  Clock,
  User,
  Folder,
  Link2,
  ExternalLink,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  BellRing,
  Sparkles,
  ArrowRight,
  Eye,
  ThumbsUp,
  LayoutGrid,
  GripVertical
} from 'lucide-react';

interface TaskManagerProps {
  isDemoMode?: boolean;
  currentProfile: UserProfile | null;
  clients: Client[];
  users: UserProfile[];
  scopedClientId?: string; // If passed, filters tasks exclusively for this client
}

export default function TaskManager({
  isDemoMode,
  currentProfile,
  clients,
  users,
  scopedClientId,
}: TaskManagerProps) {
  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [loading, setLoading] = useState(true);

  // View mode
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TeamTask | null>(null);
  const [selectedTask, setSelectedTask] = useState<TeamTask | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>(scopedClientId || 'all');
  const [quickFilter, setQuickFilter] = useState<'all' | 'my_assigned' | 'my_created' | 'designers' | 'copys' | 'waiting_feedback'>('all');

  // Drag and Drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<TaskStatus | null>(null);

  const isClientUser = currentProfile?.role === 'client';
  const isStaff = !isClientUser;

  // 1. Data Loading & Persistence
  useEffect(() => {
    if (isDemoMode) {
      const loadDemoTasks = () => {
        const stored = localStorage.getItem('demo-tasks');
        if (stored) {
          setTasks(JSON.parse(stored));
        } else {
          // Initial mock demo tasks
          const initialTasks: TeamTask[] = [
            {
              id: 'task-iron-1',
              title: 'Creativos Carrusel Meta Ads - Campaña Primavera',
              description: 'Diseñar 4 placas para carrusel de Instagram/Facebook con gancho de descuento de temporada. Incluir llamado a la acción a WhatsApp.',
              category: 'design',
              priority: 'high',
              status: 'waiting_client_feedback',
              creatorId: 'u-azul',
              creatorName: 'Azul',
              creatorRole: 'director',
              assigneeId: 'u-designer-1',
              assigneeName: 'Lucas Diseñador',
              assigneeRole: 'designer',
              clientId: 'client-iron-log',
              clientName: 'Iron Log',
              isReceived: true,
              receivedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
              receivedBy: 'Lucas Diseñador',
              visibleToClient: true,
              deliverableUrl: 'https://www.figma.com/design/iron-log-primavera-2026',
              deliverableNotes: 'Placas 1:1 listas y adaptadas. Se dejaron 2 opciones de portada.',
              dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
              dueTime: '18:00',
              attachments: [
                {
                  id: 'att-1',
                  name: 'Brief & Manual de Marca Iron Log',
                  url: 'https://drive.google.com/drive/folders/iron-log-brand',
                  type: 'drive',
                  uploadedAt: new Date().toISOString(),
                  uploadedBy: 'Azul',
                },
              ],
              comments: [
                {
                  id: 'c-1',
                  authorId: 'u-azul',
                  authorName: 'Azul',
                  authorRole: 'director',
                  content: 'Lucas, recordá utilizar la tipografía corporativa y el logo en color blanco.',
                  createdAt: new Date(Date.now() - 86400000).toISOString(),
                },
                {
                  id: 'c-2',
                  authorId: 'u-designer-1',
                  authorName: 'Lucas Diseñador',
                  authorRole: 'designer',
                  content: '¡Listo! Ya subí el enlace al tablero de Figma para feedback.',
                  createdAt: new Date().toISOString(),
                },
              ],
              createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              id: 'task-iron-2',
              title: 'Copywriting para Anuncios de WhatsApp & Formularios',
              description: 'Redactar 3 ángulos de copys para pauta publicitaria: 1 de dolor/urgencia, 1 de beneficio directo y 1 de prueba social.',
              category: 'copy',
              priority: 'medium',
              status: 'in_progress',
              creatorId: 'u-naza',
              creatorName: 'Naza',
              creatorRole: 'account_manager',
              assigneeId: 'u-copy-1',
              assigneeName: 'Camila Copywriter',
              assigneeRole: 'copywriter',
              clientId: 'client-iron-log',
              clientName: 'Iron Log',
              isReceived: true,
              receivedAt: new Date(Date.now() - 86400000).toISOString(),
              receivedBy: 'Camila Copywriter',
              visibleToClient: true,
              dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
              dueTime: '16:00',
              attachments: [],
              comments: [],
              createdAt: new Date(Date.now() - 86400000).toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              id: 'task-iron-3',
              title: 'Placas Formato 9:16 para Reels e Historias',
              description: 'Adaptar las creatividades principales a formato vertical 9:16 con subtítulos grandes para visualización sin audio.',
              category: 'design',
              priority: 'urgent',
              status: 'pending_receipt',
              creatorId: 'u-azul',
              creatorName: 'Azul',
              creatorRole: 'director',
              assigneeId: 'u-designer-1',
              assigneeName: 'Lucas Diseñador',
              assigneeRole: 'designer',
              clientId: 'client-iron-log',
              clientName: 'Iron Log',
              isReceived: false,
              visibleToClient: true,
              dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
              dueTime: '12:00',
              attachments: [],
              comments: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ];
          setTasks(initialTasks);
          localStorage.setItem('demo-tasks', JSON.stringify(initialTasks));
        }
        setLoading(false);
      };

      loadDemoTasks();
      window.addEventListener('demo-tasks-updated', loadDemoTasks);
      return () => window.removeEventListener('demo-tasks-updated', loadDemoTasks);
    }

    // Firestore Live Subscription
    const q = query(collection(db, 'team_tasks'), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loadedTasks: TeamTask[] = snapshot.docs.map(
          (d) => ({ id: d.id, ...d.data() } as TeamTask)
        );
        setTasks(loadedTasks);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'team_tasks');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isDemoMode]);

  // 2. Save / Update Task Handlers
  const cleanData = (obj: any): any => {
    const cleaned: any = {};
    Object.keys(obj).forEach((key) => {
      if (obj[key] !== undefined) {
        cleaned[key] = obj[key];
      }
    });
    return cleaned;
  };

  const handleSaveTask = async (taskData: TeamTask) => {
    if (isDemoMode) {
      const stored = localStorage.getItem('demo-tasks');
      const currentList: TeamTask[] = stored ? JSON.parse(stored) : tasks;
      const index = currentList.findIndex((t) => t.id === taskData.id);
      let updatedList: TeamTask[];
      if (index >= 0) {
        updatedList = currentList.map((t) => (t.id === taskData.id ? taskData : t));
      } else {
        updatedList = [taskData, ...currentList];
      }
      localStorage.setItem('demo-tasks', JSON.stringify(updatedList));
      setTasks(updatedList);
      window.dispatchEvent(new CustomEvent('demo-tasks-updated'));
    } else {
      const cleaned = cleanData(taskData);
      await setDoc(doc(db, 'team_tasks', taskData.id), cleaned, { merge: true });
    }

    if (selectedTask?.id === taskData.id) {
      setSelectedTask(taskData);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      if (isDemoMode) {
        const stored = localStorage.getItem('demo-tasks');
        const currentList: TeamTask[] = stored ? JSON.parse(stored) : tasks;
        const updatedList = currentList.filter((t) => t.id !== taskId);
        localStorage.setItem('demo-tasks', JSON.stringify(updatedList));
        setTasks(updatedList);
        window.dispatchEvent(new CustomEvent('demo-tasks-updated'));
      } else {
        await deleteDoc(doc(db, 'team_tasks', taskId));
      }
      toast.success('Tarea eliminada');
    } catch (err: any) {
      toast.error(`Error al eliminar: ${err.message || err}`);
    }
  };

  // Drag & Drop Status Mover
  const handleDropOnColumn = async (newStatus: TaskStatus) => {
    if (!draggedTaskId) return;
    const taskToMove = tasks.find((t) => t.id === draggedTaskId);
    if (!taskToMove || taskToMove.status === newStatus) {
      setDraggedTaskId(null);
      setDragOverColumnId(null);
      return;
    }

    const nowIso = new Date().toISOString();
    const updated: TeamTask = {
      ...taskToMove,
      status: newStatus,
      completedAt: newStatus === 'completed' ? nowIso : (taskToMove.status === 'completed' ? undefined : taskToMove.completedAt),
      completedBy: newStatus === 'completed' ? (currentProfile?.displayName || 'Usuario') : taskToMove.completedBy,
      updatedAt: nowIso,
    };

    // If moving from pending_receipt to in_progress, automatically acknowledge receipt
    if (taskToMove.status === 'pending_receipt' && (newStatus === 'in_progress' || newStatus === 'internal_review')) {
      updated.isReceived = true;
      updated.receivedAt = nowIso;
      updated.receivedBy = currentProfile?.displayName || 'Equipo';
    }

    setDraggedTaskId(null);
    setDragOverColumnId(null);

    await handleSaveTask(updated);
    toast.success(`Tarea movida a: ${newStatus}`);
  };

  // 3. Filtering logic
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // If scoped to a specific client (e.g. from Client Workspace)
      if (scopedClientId && task.clientId !== scopedClientId) {
        return false;
      }

      // If user is a client, only show visible tasks for their assigned client
      if (isClientUser) {
        if (task.clientId !== currentProfile?.assignedClientId) return false;
        if (!task.visibleToClient && task.status !== 'waiting_client_feedback' && task.status !== 'completed') {
          return false;
        }
      }

      // Quick filter
      if (quickFilter === 'my_assigned' && task.assigneeId !== currentProfile?.uid) return false;
      if (quickFilter === 'my_created' && task.creatorId !== currentProfile?.uid) return false;
      if (quickFilter === 'designers' && task.assigneeRole !== 'designer') return false;
      if (quickFilter === 'copys' && task.assigneeRole !== 'copywriter') return false;
      if (quickFilter === 'waiting_feedback' && task.status !== 'waiting_client_feedback') return false;

      // Dropdown filters
      if (selectedCategory !== 'all' && task.category !== selectedCategory) return false;
      if (selectedAssignee !== 'all' && task.assigneeId !== selectedAssignee) return false;
      if (selectedStatus !== 'all' && task.status !== selectedStatus) return false;
      if (selectedClientFilter !== 'all' && task.clientId !== selectedClientFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = task.title.toLowerCase().includes(q);
        const matchDesc = (task.description || '').toLowerCase().includes(q);
        const matchAssignee = (task.assigneeName || '').toLowerCase().includes(q);
        const matchClient = (task.clientName || '').toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchAssignee && !matchClient) return false;
      }

      return true;
    });
  }, [
    tasks,
    scopedClientId,
    isClientUser,
    currentProfile,
    quickFilter,
    selectedCategory,
    selectedAssignee,
    selectedStatus,
    selectedClientFilter,
    searchQuery,
  ]);

  // Counts for summary metrics
  const stats = useMemo(() => {
    const total = filteredTasks.length;
    const pendingReceipt = filteredTasks.filter((t) => t.status === 'pending_receipt').length;
    const inProgress = filteredTasks.filter((t) => t.status === 'in_progress').length;
    const review = filteredTasks.filter((t) => t.status === 'internal_review').length;
    const waitingFeedback = filteredTasks.filter((t) => t.status === 'waiting_client_feedback').length;
    const completed = filteredTasks.filter((t) => t.status === 'completed').length;
    return { total, pendingReceipt, inProgress, review, waitingFeedback, completed };
  }, [filteredTasks]);

  // Kanban Columns Definition - Refined minimal colors
  const kanbanColumns: { id: TaskStatus; title: string; icon: string; dotColor: string }[] = [
    { id: 'pending_receipt', title: 'Pendiente de Visto', icon: '🔔', dotColor: 'bg-amber-500' },
    { id: 'in_progress', title: 'En Proceso', icon: '⏳', dotColor: 'bg-blue-500' },
    { id: 'internal_review', title: 'Revisión Interna', icon: '🔍', dotColor: 'bg-purple-500' },
    { id: 'waiting_client_feedback', title: 'Feedback Cliente', icon: '💬', dotColor: 'bg-pink-500' },
    { id: 'completed', title: 'Completada / Aprobada', icon: '✅', dotColor: 'bg-emerald-500' },
  ];

  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case 'urgent':
        return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/20">Urgente</span>;
      case 'high':
        return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">Alta</span>;
      case 'medium':
        return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-muted text-muted-foreground">Media</span>;
      case 'low':
      default:
        return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-muted text-muted-foreground">Baja</span>;
    }
  };

  const getCategoryBadge = (category: TaskCategory) => {
    switch (category) {
      case 'design': return <span className="text-[10px] font-medium text-foreground/80 flex items-center gap-1">🎨 Diseño</span>;
      case 'copy': return <span className="text-[10px] font-medium text-foreground/80 flex items-center gap-1">✍️ Copy</span>;
      case 'pauta': return <span className="text-[10px] font-medium text-foreground/80 flex items-center gap-1">📢 Pauta</span>;
      case 'account_management': return <span className="text-[10px] font-medium text-foreground/80 flex items-center gap-1">💼 AM</span>;
      case 'general': default: return <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">⚡ General</span>;
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-4 sm:p-5 rounded-xl border border-border/40 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <CheckSquare size={20} />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {isClientUser ? 'Mis Creativos & Tareas' : 'Asignación de Tareas & Creativos'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isClientUser
                ? 'Revisa entregables, deja feedback y aprueba creativos de tu marca.'
                : 'Flujos integrados de Copy, Diseño y revisión con confirmación de recepción.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-muted/40 p-0.5 rounded-lg border border-border/30">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                viewMode === 'kanban'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Columns size={13} />
              Kanban
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                viewMode === 'list'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List size={13} />
              Lista
            </button>
          </div>

          {/* New Task Button (Staff) */}
          {isStaff && (
            <Button
              onClick={() => {
                setEditingTask(null);
                setIsFormOpen(true);
              }}
              size="sm"
              className="h-8 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-xs"
            >
              <Plus size={14} />
              Nueva Tarea
            </Button>
          )}
        </div>
      </div>

      {/* 2. Quick Stat Counters - Clean and Minimal */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
        <div 
          onClick={() => { setQuickFilter('all'); setSelectedStatus('all'); }}
          className="p-3 bg-card border border-border/30 rounded-lg hover:border-border transition-all cursor-pointer"
        >
          <p className="text-[11px] text-muted-foreground font-medium">Total</p>
          <p className="text-lg font-semibold text-foreground mt-0.5">{stats.total}</p>
        </div>

        <div 
          onClick={() => { setSelectedStatus('pending_receipt'); }}
          className="p-3 bg-card border border-border/30 rounded-lg hover:border-amber-500/40 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <span>Pendientes</span>
          </div>
          <p className="text-lg font-semibold text-foreground mt-0.5">{stats.pendingReceipt}</p>
        </div>

        <div 
          onClick={() => { setSelectedStatus('in_progress'); }}
          className="p-3 bg-card border border-border/30 rounded-lg hover:border-blue-500/40 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
            <span>En Proceso</span>
          </div>
          <p className="text-lg font-semibold text-foreground mt-0.5">{stats.inProgress}</p>
        </div>

        <div 
          onClick={() => { setSelectedStatus('internal_review'); }}
          className="p-3 bg-card border border-border/30 rounded-lg hover:border-purple-500/40 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
            <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
            <span>Revisión Int.</span>
          </div>
          <p className="text-lg font-semibold text-foreground mt-0.5">{stats.review}</p>
        </div>

        <div 
          onClick={() => { setSelectedStatus('waiting_client_feedback'); }}
          className="p-3 bg-card border border-border/30 rounded-lg hover:border-pink-500/40 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
            <span className="w-2 h-2 rounded-full bg-pink-500 shrink-0" />
            <span>Feedback</span>
          </div>
          <p className="text-lg font-semibold text-foreground mt-0.5">{stats.waitingFeedback}</p>
        </div>

        <div 
          onClick={() => { setSelectedStatus('completed'); }}
          className="p-3 bg-card border border-border/30 rounded-lg hover:border-emerald-500/40 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span>Completadas</span>
          </div>
          <p className="text-lg font-semibold text-foreground mt-0.5">{stats.completed}</p>
        </div>
      </div>

      {/* 3. Filters & Search Bar */}
      <div className="bg-card p-4 rounded-xl border border-border/30 space-y-3">
        {/* Quick Filter Pills */}
        {isStaff && (
          <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-border/20">
            {[
              { id: 'all', label: 'Todas las Tareas' },
              { id: 'my_assigned', label: '🎯 Asignadas a mí' },
              { id: 'my_created', label: '📝 Creadas por mí' },
              { id: 'designers', label: '🎨 Diseñadores' },
              { id: 'copys', label: '✍️ Copys' },
              { id: 'waiting_feedback', label: '💬 Esperando Feedback Cliente' },
            ].map((pill) => (
              <Button
                key={pill.id}
                variant={quickFilter === pill.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setQuickFilter(pill.id as any)}
                className={`text-xs font-bold h-7 rounded-lg px-2.5 ${quickFilter === pill.id ? 'bg-primary text-primary-foreground font-black' : 'bg-background'}`}
              >
                {pill.label}
              </Button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="Buscar por título, brief, asignado o cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs bg-background border-border font-medium"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full h-9 px-3 bg-background border border-border rounded-lg text-xs font-semibold text-foreground"
            >
              <option value="all">Todas las Áreas</option>
              <option value="design">🎨 Diseño Gráfico</option>
              <option value="copy">✍️ Copywriting</option>
              <option value="pauta">📢 Pauta / Ads</option>
              <option value="account_management">💼 Gestión AM</option>
              <option value="general">⚡ General</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full h-9 px-3 bg-background border border-border rounded-lg text-xs font-semibold text-foreground"
            >
              <option value="all">Todos los Estados</option>
              <option value="pending_receipt">🔔 Pendiente de Recepción</option>
              <option value="in_progress">⏳ En Proceso</option>
              <option value="internal_review">🔍 En Revisión Interna</option>
              <option value="waiting_client_feedback">💬 Esperando Feedback Cliente</option>
              <option value="completed">✅ Completada / Aprobada</option>
              <option value="cancelled">🚫 Cancelada</option>
            </select>
          </div>

          {/* Client Filter (Staff) */}
          {!scopedClientId && isStaff && (
            <div>
              <select
                value={selectedClientFilter}
                onChange={(e) => setSelectedClientFilter(e.target.value)}
                className="w-full h-9 px-3 bg-background border border-border rounded-lg text-xs font-semibold text-foreground"
              >
                <option value="all">Todos los Clientes</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 4. KANBAN VIEW */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3.5 overflow-x-auto pb-4">
          {kanbanColumns.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.id);
            const isColumnDragOver = dragOverColumnId === col.id;

            return (
              <div
                key={col.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverColumnId !== col.id) {
                    setDragOverColumnId(col.id);
                  }
                }}
                onDragLeave={(e) => {
                  // Only clear if leaving the column element itself
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                  if (dragOverColumnId === col.id) {
                    setDragOverColumnId(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDropOnColumn(col.id);
                }}
                className={`flex flex-col rounded-xl p-2.5 min-w-[270px] transition-all duration-150 ${
                  isColumnDragOver
                    ? 'bg-primary/5 border border-dashed border-primary ring-1 ring-primary/20'
                    : 'bg-muted/15 border border-border/30'
                }`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between px-1.5 py-2 mb-2 border-b border-border/20">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.dotColor} shrink-0`} />
                    <span className="text-xs font-semibold text-foreground">{col.title}</span>
                  </div>
                  <span className="text-[11px] font-mono font-medium text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border/30">
                    {colTasks.length}
                  </span>
                </div>

                {/* Cards List */}
                <div className="space-y-2 flex-1 overflow-y-auto max-h-[calc(100vh-320px)] pr-0.5">
                  {colTasks.length === 0 ? (
                    <div className={`py-8 text-center text-xs rounded-lg border border-dashed transition-colors ${
                      isColumnDragOver 
                        ? 'border-primary/40 text-primary bg-primary/5 font-medium' 
                        : 'border-border/30 text-muted-foreground/60 bg-transparent'
                    }`}>
                      {isColumnDragOver ? 'Soltar aquí' : 'Sin tareas'}
                    </div>
                  ) : (
                    colTasks.map((task) => {
                      const isBeingDragged = draggedTaskId === task.id;

                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => {
                            setDraggedTaskId(task.id);
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', task.id);
                          }}
                          onDragEnd={() => {
                            setDraggedTaskId(null);
                            setDragOverColumnId(null);
                          }}
                          onClick={() => {
                            setSelectedTask(task);
                            setIsDetailOpen(true);
                          }}
                          className={`p-3 bg-card rounded-lg border transition-all cursor-grab active:cursor-grabbing space-y-2 group select-none ${
                            isBeingDragged
                              ? 'opacity-40 scale-[0.98] border-primary border-dashed shadow-none'
                              : 'border-border/40 hover:border-border hover:shadow-xs'
                          }`}
                        >
                          {/* Top Tags & Drag Handle */}
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-muted-foreground/30 group-hover:text-muted-foreground transition-colors">
                                <GripVertical size={12} />
                              </span>
                              {getPriorityBadge(task.priority)}
                              {getCategoryBadge(task.category)}
                            </div>
                            {task.clientName && (
                              <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[85px]">
                                {task.clientName}
                              </span>
                            )}
                          </div>

                          {/* Title */}
                          <h4 className="text-xs font-medium text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2">
                            {task.title}
                          </h4>

                          {/* Deliverable link pill if exists */}
                          {task.deliverableUrl && (
                            <div className="px-2 py-1 rounded bg-primary/5 border border-primary/20 flex items-center justify-between text-[10px] font-medium text-primary">
                              <span className="flex items-center gap-1 truncate">
                                <Sparkles size={11} />
                                Entregable listo
                              </span>
                              <ExternalLink size={10} className="shrink-0" />
                            </div>
                          )}

                          {/* Client approval pill */}
                          {task.clientApproved && (
                            <div className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 text-[10px] font-medium flex items-center gap-1">
                              <CheckCircle2 size={11} />
                              Aprobado por cliente
                            </div>
                          )}

                          {/* Bottom Row: Assignee & Date */}
                          <div className="pt-2 border-t border-border/20 flex items-center justify-between text-[11px] text-muted-foreground">
                            <div className="flex items-center gap-1.5 font-medium text-foreground truncate">
                              <div className="w-4 h-4 rounded-full bg-muted text-foreground flex items-center justify-center text-[9px] font-bold shrink-0">
                                {task.assigneeName.charAt(0)}
                              </div>
                              <span className="truncate text-xs">{task.assigneeName}</span>
                            </div>

                            {task.dueDate && (
                              <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground shrink-0">
                                <Calendar size={10} />
                                <span>{task.dueDate.split('-').slice(1).join('/')}</span>
                              </div>
                            )}
                          </div>

                          {/* Quick Receipt Confirmation Button if not received */}
                          {!task.isReceived && (
                            <div className="pt-0.5">
                              <span className="w-full py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-600 text-[9px] font-medium flex items-center justify-center gap-1">
                                <BellRing size={10} />
                                Pendiente visto
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. LIST / TABLE VIEW */}
      {viewMode === 'list' && (
        <Card className="border-border/40 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/30 border-b border-border/20 text-[10px] font-black uppercase text-muted-foreground">
                <tr>
                  <th className="p-3.5">Estado / Flujo</th>
                  <th className="p-3.5">Tarea & Cliente</th>
                  <th className="p-3.5">Área</th>
                  <th className="p-3.5">Asignado</th>
                  <th className="p-3.5">Prioridad</th>
                  <th className="p-3.5">Fecha Límite</th>
                  <th className="p-3.5">Entregable</th>
                  <th className="p-3.5 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground italic">
                      No se encontraron tareas con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task) => (
                    <tr
                      key={task.id}
                      onClick={() => {
                        setSelectedTask(task);
                        setIsDetailOpen(true);
                      }}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {task.status === 'pending_receipt' && (
                            <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px] font-bold">
                              🔔 Pendiente
                            </Badge>
                          )}
                          {task.status === 'in_progress' && (
                            <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30 text-[10px] font-bold">
                              ⏳ En Proceso
                            </Badge>
                          )}
                          {task.status === 'internal_review' && (
                            <Badge className="bg-purple-500/15 text-purple-600 border-purple-500/30 text-[10px] font-bold">
                              🔍 Revisión
                            </Badge>
                          )}
                          {task.status === 'waiting_client_feedback' && (
                            <Badge className="bg-pink-500/15 text-pink-600 border-pink-500/30 text-[10px] font-bold">
                              💬 Feedback
                            </Badge>
                          )}
                          {task.status === 'completed' && (
                            <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px] font-bold">
                              ✅ Aprobada
                            </Badge>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5">
                        <p className="font-bold text-foreground leading-snug">{task.title}</p>
                        {task.clientName && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Folder size={10} />
                            {task.clientName}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        {getCategoryBadge(task.category)}
                      </td>

                      <td className="p-3.5 whitespace-nowrap font-bold text-foreground">
                        {task.assigneeName}
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        {getPriorityBadge(task.priority)}
                      </td>

                      <td className="p-3.5 whitespace-nowrap font-medium text-foreground">
                        {task.dueDate || '-'}
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        {task.deliverableUrl ? (
                          <a
                            href={task.deliverableUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-primary/10 text-primary hover:underline font-bold text-[10px]"
                          >
                            <ExternalLink size={11} />
                            Ver Entrega
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-[10px] italic">Sin entrega</span>
                        )}
                      </td>

                      <td className="p-3.5 whitespace-nowrap text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[11px] font-bold"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTask(task);
                            setIsDetailOpen(true);
                          }}
                        >
                          Ver Detalle →
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 6. Modals */}
      <TaskFormModal
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        initialTask={editingTask}
        onSave={handleSaveTask}
        allUsers={users}
        clients={clients}
        currentProfile={currentProfile}
        preselectedClientId={scopedClientId}
      />

      <TaskDetailModal
        task={selectedTask}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onUpdateTask={handleSaveTask}
        onDeleteTask={handleDeleteTask}
        onEditTask={(task) => {
          setEditingTask(task);
          setIsFormOpen(true);
        }}
        currentProfile={currentProfile}
        clients={clients}
        allUsers={users}
      />
    </div>
  );
}
