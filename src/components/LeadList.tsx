import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, where, addDoc, writeBatch } from 'firebase/firestore';
import { Lead, UserProfile, LeadStatus } from '../types';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from './ui/table';
import { Card } from './ui/card';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from './ui/dropdown-menu';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription 
} from './ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './ui/select';
import { Label } from './ui/label';
import { 
  MoreVertical, 
  Search, 
  Filter, 
  Download, 
  Upload,
  Eye, 
  Edit, 
  Trash2,
  Phone,
  Mail,
  MapPin,
  Building2,
  MoreHorizontal,
  Linkedin,
  UserCheck,
  UserCog,
  ChevronUp,
  ChevronDown,
  Clock,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { getStatusBadgeColor, getStatusLabel, formatDate, cn } from '../lib/utils';
import LeadDetails from './LeadDetails';
import LeadKanban from './LeadKanban';
import FollowUpCenter from './FollowUpCenter';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutGrid, List, Target, Zap } from 'lucide-react';

interface LeadListProps {
  profile: UserProfile | null;
  isDemoMode?: boolean;
  clientId: string;
  targetId?: string | null;
  onTargetProcessed?: () => void;
  onLeadClick?: (lead: Lead) => void;
  initialViewMode?: 'table' | 'kanban' | 'followup';
}

const MOCK_LEADS: Lead[] = [
  {
    id: '1',
    clientId: 'c1',
    name: 'Juan Pérez',
    company: 'Tech Solutions',
    country: 'Argentina',
    interest: 'CRM Software',
    contactInfo: 'juan@tech.com',
    linkedinUrl: 'https://www.linkedin.com/in/juanperez/',
    sector: 'Tecnología',
    status: 'new',
    stage: 'setter',
    tag: 'LinkedIn Perfil 1',
    lastAction: 'Primer contacto',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nextFollowUpDate: new Date().toISOString(),
    followUps: [],
    meetings: []
  },
  {
    id: '2',
    clientId: 'c1',
    name: 'María García',
    company: 'Global Retail',
    country: 'España',
    interest: 'Marketing Automation',
    contactInfo: '+34 600 000 000',
    sector: 'Retail',
    status: 'contacted',
    stage: 'setter',
    tag: 'LinkedIn Perfil 2',
    lastAction: 'Llamada realizada',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nextFollowUpDate: new Date(Date.now() + 86400000).toISOString(),
    followUps: [],
    meetings: []
  },
  {
    id: '3',
    clientId: 'c1',
    name: 'Roberto Smith',
    company: 'Qualified Systems',
    country: 'México',
    interest: 'Enterprise ERP',
    contactInfo: 'roberto@qualified.com',
    sector: 'Software',
    status: 'qualified',
    stage: 'commercial',
    tag: 'LinkedIn Perfil 1',
    lastAction: 'Reunión realizada - Calificado',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nextFollowUpDate: new Date().toISOString(),
    followUps: [],
    meetings: []
  }
];

export default function LeadList({ profile, isDemoMode, clientId, targetId, onTargetProcessed, onLeadClick, initialViewMode }: LeadListProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [deleteConfirmInfo, setDeleteConfirmInfo] = useState<{ id: string; name: string } | null>(null);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [confirmStep, setConfirmStep] = useState(1);
  const [viewMode, setViewMode] = useState<'table' | 'kanban' | 'followup'>(initialViewMode || 'table');

  useEffect(() => {
    if (initialViewMode) {
      setViewMode(initialViewMode);
    }
  }, [initialViewMode]);
  
  // Import Mapping State
  const [isMappingDialogOpen, setIsMappingDialogOpen] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  
  const LEAD_FIELDS = [
    { key: 'name', label: 'Nombre Completo', keywords: ['nombre', 'name', 'fullname', 'person', 'contacto', 'contact', 'lead', 'prospecto', 'cliente'] },
    { key: 'company', label: 'Empresa', keywords: ['empresa', 'company', 'organization', 'nombreempresa', 'entidad', 'negocio', 'institucion', 'razon social', 'industria'] },
    { key: 'contactInfo', label: 'Contacto (General)', keywords: ['contacto', 'contact', 'datos', 'info', 'comunicacion', 'resumen'] },
    { key: 'email', label: 'Email / Correo', keywords: ['email', 'mail', 'correo', 'e-mail', 'dirección', 'email_address', 'correo electronico'] },
    { key: 'phone', label: 'Teléfono / WhatsApp / Número', keywords: ['telefono', 'phone', 'tel', 'whatsapp', 'celular', 'mobile', 'numero', 'num', 'cel', 'movil', 'telephone'] },
    { key: 'status', label: 'Estado del Lead (CRM)', keywords: ['status', 'tracking', 'seguimiento', 'situacion', 'fasecrm', 'etapa', 'estado', 'fase'] },
    { key: 'stage', label: 'Rol (Setter / Comercial)', keywords: ['stage', 'etapa', 'quien', 'responsable', 'asignado', 'tipo', 'fase', 'rol', 'perfil', 'etapa crm'] },
    { key: 'country', label: 'País / Ubicación', keywords: ['pais', 'country', 'ubicacion', 'location', 'region', 'ciudad', 'provincia', 'estado', 'localidad'] },
    { key: 'interest', label: 'Interés / Ubicación Extra', keywords: ['interes', 'interest', 'tipodeinteres', 'necesidad', 'servicio', 'motivo', 'detalle', 'comentario', 'notas', 'observaciones'] },
    { key: 'tag', label: 'Tag / Etiqueta', keywords: ['tag', 'etiqueta', 'perfil', 'fuente', 'origen', 'leads', 'campaña', 'fuente de lead', 'label'] },
    { key: 'linkedinUrl', label: 'LinkedIn URL', keywords: ['linkedinurl', 'urllinkedin', 'perfillinkedin', 'url', 'linkedin', 'link', 'perfil', 'enlace'] }
  ];

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [showScrollButtons, setShowScrollButtons] = useState(false);
  const [canScroll, setCanScroll] = useState(false);

  useEffect(() => {
    if (isDemoMode) {
      const loadDemoLeads = () => {
        const stored = localStorage.getItem('demo-leads');
        if (stored) {
          setLeads(JSON.parse(stored));
        } else {
          setLeads(MOCK_LEADS);
          localStorage.setItem('demo-leads', JSON.stringify(MOCK_LEADS));
        }
      };
      
      loadDemoLeads();
      window.addEventListener('demo-leads-updated', loadDemoLeads);
      return () => window.removeEventListener('demo-leads-updated', loadDemoLeads);
    }
    const q = query(
      collection(db, 'leads'), 
      where('clientId', '==', clientId),
      orderBy('updatedAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const leadsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead));
      // Filter out placeholder leads
      setLeads(leadsData.filter(l => 
        !l.name.toLowerCase().includes('mi primer lead') && 
        !l.name.toLowerCase().includes('lead follow')
      ));
    });

    return () => unsubscribe();
  }, [clientId, isDemoMode]);

  const pendingFollowUpsCount = leads.filter(l => {
    // Strictly count leads in 'follow-up' status that are due or overdue
    if (l.status !== 'follow-up' || !l.nextFollowUpDate) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextDate = new Date(l.nextFollowUpDate);
    nextDate.setHours(0, 0, 0, 0);
    
    const isDue = nextDate <= today;
    if (!isDue) return false;

    // Filter by stage based on role for "real" actionable data
    if (profile?.role === 'client') return false;

    return true;
  }).length;

  useEffect(() => {
    if (targetId && leads.length > 0) {
      const lead = leads.find(l => l.id === targetId);
      if (lead) {
        onLeadClick?.(lead);
        if (onTargetProcessed) onTargetProcessed();
      }
    }
  }, [targetId, leads, onTargetProcessed, onLeadClick]);

  const toggleStage = async (lead: Lead) => {
    if (profile?.role === 'client') return;
    
    const newStage = lead.stage === 'setter' ? 'commercial' : 'setter';
    try {
      if (isDemoMode) {
        const stored = localStorage.getItem('demo-leads');
        if (stored) {
          const allLeads: Lead[] = JSON.parse(stored);
          const updated = allLeads.map(l => 
            l.id === lead.id ? { ...l, stage: newStage, updatedAt: new Date().toISOString(), lastAction: `Cambiado a Fase ${newStage === 'setter' ? 'Prospección' : 'Comercial'}` } : l
          );
          localStorage.setItem('demo-leads', JSON.stringify(updated));
          window.dispatchEvent(new CustomEvent('demo-leads-updated'));
        }
      } else {
        await updateDoc(doc(db, 'leads', lead.id), {
          stage: newStage,
          updatedAt: new Date().toISOString(),
          lastAction: `Cambiado a Fase ${newStage === 'setter' ? 'Prospección' : 'Comercial'}`
        });
      }
      toast.success(`Cambiado a Fase ${newStage === 'setter' ? 'Prospección' : 'Comercial'}`);
    } catch (error) {
      toast.error("Error al cambiar etapa");
    }
  };

  const filteredLeads = leads.filter(lead => {
    const matchesClient = lead.clientId === clientId;
    const matchesSearch = 
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.contactInfo.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    const matchesStage = stageFilter === 'all' || lead.stage === stageFilter;
    
    return matchesClient && matchesSearch && matchesStatus && matchesStage;
  });

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const checkScroll = () => {
      setShowScrollButtons(container.scrollTop > 100);
      setCanScroll(container.scrollHeight > container.clientHeight);
    };

    checkScroll();
    container.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);
    
    // Check after data might have loaded
    const timeout = setTimeout(checkScroll, 1000);

    return () => {
      container.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
      clearTimeout(timeout);
    };
  }, [filteredLeads]);

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToBottom = () => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(leads.map(l => ({
      Nombre: l.name,
      Empresa: l.company,
      País: l.country,
      Interés: l.interest,
      Contacto: l.contactInfo,
      Categoría: l.category,
      Sector: l.sector,
      Estado: l.status,
      Activo: l.isActive ? 'Sí' : 'No',
      Creado: formatDate(l.createdAt)
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
    XLSX.writeFile(workbook, "EfectoDigital_Leads.xlsx");
    toast.success("Leads exportados correctamente");
  };

  const handleDeleteAction = async () => {
    if (!deleteConfirmInfo) return;
    try {
      if (isDemoMode) {
        const stored = localStorage.getItem('demo-leads');
        if (stored) {
          const allLeads: Lead[] = JSON.parse(stored);
          const updatedLeads = allLeads.filter(l => l.id !== deleteConfirmInfo.id);
          localStorage.setItem('demo-leads', JSON.stringify(updatedLeads));
          setLeads(updatedLeads);
          window.dispatchEvent(new CustomEvent('demo-leads-updated'));
        }
      } else {
        await deleteDoc(doc(db, 'leads', deleteConfirmInfo.id));
      }
      toast.success("Lead eliminado correctamente");
      setDeleteConfirmInfo(null);
    } catch (error) {
      toast.error("Error al eliminar el lead");
    }
  };

  const handleBulkDeleteAction = async () => {
    if (selectedLeadIds.length === 0) return;
    try {
      if (isDemoMode) {
        const stored = localStorage.getItem('demo-leads');
        if (stored) {
          const allLeads: Lead[] = JSON.parse(stored);
          const updatedLeads = allLeads.filter(l => !selectedLeadIds.includes(l.id));
          localStorage.setItem('demo-leads', JSON.stringify(updatedLeads));
          setLeads(updatedLeads);
          window.dispatchEvent(new CustomEvent('demo-leads-updated'));
        }
      } else {
        const promises = selectedLeadIds.map(id => deleteDoc(doc(db, 'leads', id)));
        await Promise.all(promises);
      }
      toast.success(`${selectedLeadIds.length} leads eliminados correctamente`);
      setSelectedLeadIds([]);
      setIsBulkDeleteConfirmOpen(false);
      setConfirmStep(1);
    } catch (error) {
      console.error(error);
      toast.error("Error al eliminar los leads");
    }
  };

  const handleDelete = (id: string, name: string) => {
    setDeleteConfirmInfo({ id, name });
  };

  const handleBulkDeleteRequest = () => {
    if (selectedLeadIds.length === 0) return;
    setIsBulkDeleteConfirmOpen(true);
    setConfirmStep(1);
  };

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeadIds(prev => 
      prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedLeadIds.length === filteredLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(filteredLeads.map(l => l.id));
    }
  };

  const handleViewDetails = (lead: Lead) => {
    onLeadClick?.(lead);
  };

  const handleStatusChange = async (leadId: string, newStatus: LeadStatus) => {
    try {
      if (isDemoMode) {
        const stored = localStorage.getItem('demo-leads');
        if (stored) {
          const allLeads: Lead[] = JSON.parse(stored);
          const updated = allLeads.map(l => 
            l.id === leadId ? { ...l, status: newStatus, updatedAt: new Date().toISOString(), lastAction: `Estado cambiado a ${getStatusLabel(newStatus)}` } : l
          );
          localStorage.setItem('demo-leads', JSON.stringify(updated));
          window.dispatchEvent(new CustomEvent('demo-leads-updated'));
        }
      } else {
        await updateDoc(doc(db, 'leads', leadId), {
          status: newStatus,
          updatedAt: new Date().toISOString(),
          lastAction: `Estado cambiado a ${getStatusLabel(newStatus)}`
        });
      }
      toast.success(`Estado actualizado a ${getStatusLabel(newStatus)}`);
    } catch (error) {
      toast.error("Error al actualizar estado");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          toast.error("El archivo está vacío");
          return;
        }

        const headers = Object.keys(data[0]);
        setDetectedHeaders(headers);
        setImportData(data);
        
        // Initial automatic mapping based on keywords
        const initialMapping: Record<string, string> = {};
        LEAD_FIELDS.forEach(field => {
          const match = headers.find(h => {
            const cleanH = h.toLowerCase().trim().replace(/\s+/g, '');
            return field.keywords.some(k => cleanH.includes(k.toLowerCase()));
          });
          if (match) initialMapping[field.key] = match;
        });
        
        setMapping(initialMapping);
        setIsMappingDialogOpen(true);
      } catch (error) {
        console.error(error);
        toast.error("Error al procesar el archivo");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const processImport = async () => {
    if (importData.length === 0) return;
  
    try {
      const now = new Date().toISOString();
      const newLeads: Lead[] = importData.map((row) => {
        const getMappedValue = (fieldKey: string) => {
          const header = mapping[fieldKey];
          return (header && row[header]) ? row[header].toString().trim() : null;
        };
  
        const name = getMappedValue('name');
        const linkedinUrl = getMappedValue('linkedinUrl');
        
        let finalName = name || 'Sin nombre';
        if (finalName === 'Sin nombre' && linkedinUrl && linkedinUrl.toLowerCase().includes('linkedin.com/in/')) {
          const match = linkedinUrl.match(/linkedin\.com\/in\/([^\/?#\s]+)/);
          if (match) {
            const slug = match[1].replace(/-[a-z0-9]+$/i, '');
            const parts = slug.split(/[-._ ]+/).filter((s: string) => s.length > 1 && !/^\d+$/.test(s));
            if (parts.length > 0) {
              finalName = parts.map((s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(' ');
            }
          }
        }
  
        const email = getMappedValue('email');
        const phone = getMappedValue('phone');
        const contactInfoField = getMappedValue('contactInfo');
        
        let finalContact = contactInfoField || '';
        
        if (!finalContact) {
          if (email && phone) finalContact = `${email} | ${phone}`;
          else finalContact = email || phone || '';
        }
        
        if (!finalContact || finalContact === 'null' || finalContact === 'undefined') {
          finalContact = linkedinUrl || 'Sin contacto';
        }
  
        const stageValue = getMappedValue('stage')?.toLowerCase() || '';
        const stage: 'setter' | 'commercial' = (
          stageValue.includes('comercial') || 
          stageValue.includes('closer') || 
          stageValue.includes('venta') || 
          stageValue.includes('commercial')
        ) ? 'commercial' : 'setter';

        const statusRaw = getMappedValue('status')?.toLowerCase() || '';
        let status: Lead['status'] = 'new';
        if (statusRaw.includes('contactado') || statusRaw.includes('contacted')) status = 'contacted';
        else if (statusRaw.includes('calificado') || statusRaw.includes('qualified')) status = 'qualified';
        else if (statusRaw.includes('no interesa') || statusRaw.includes('not interest')) status = 'not-interested';
        else if (statusRaw.includes('ganado') || statusRaw.includes('won')) status = 'closed-won';
        else if (statusRaw.includes('perdido') || statusRaw.includes('lost')) status = 'closed-lost';
        else if (statusRaw.includes('seguimiento') || statusRaw.includes('follow')) status = 'follow-up';
  
        if (finalName === 'Sin nombre' && !getMappedValue('company') && (!finalContact || finalContact === 'Sin contacto')) return null;
  
        return {
          id: Math.random().toString(36).substr(2, 9),
          clientId,
          name: finalName,
          company: getMappedValue('company') || 'Sin empresa',
          contactInfo: finalContact,
          country: getMappedValue('country') || 'No especificado',
          sector: getMappedValue('sector') || 'No especificado',
          interest: getMappedValue('interest') || 'No especificado',
          category: 'General',
          tag: getMappedValue('tag') || '',
          linkedinUrl: linkedinUrl || '',
          status: status,
          stage: stage,
          followUpSequence: 0,
          lastAction: 'Importado desde BBDD',
          isActive: true,
          createdAt: now,
          updatedAt: now,
          followUps: [],
          meetings: []
        } as Lead;
      }).filter((lead): lead is Lead => lead !== null);

      if (newLeads.length === 0) {
        toast.error("No se encontraron leads válidos con el mapeo actual");
        return;
      }

      if (isDemoMode) {
        const stored = localStorage.getItem('demo-leads');
        const existingLeads = stored ? JSON.parse(stored) : MOCK_LEADS;
        const updatedLeads = [...newLeads, ...existingLeads];
        localStorage.setItem('demo-leads', JSON.stringify(updatedLeads));
        window.dispatchEvent(new CustomEvent('demo-leads-updated'));
      } else {
        const batches = [];
        for (let i = 0; i < newLeads.length; i += 500) {
          const batch = writeBatch(db);
          const chunk = newLeads.slice(i, i + 500);
          chunk.forEach(lead => {
            const docRef = doc(collection(db, 'leads'));
            batch.set(docRef, lead);
          });
          batches.push(batch.commit());
        }
        await Promise.all(batches);
      }

      toast.success(`Importación exitosa: ${newLeads.length} leads`);
      setIsMappingDialogOpen(false);
      setImportData([]);
    } catch (error) {
      console.error(error);
      toast.error("Error al importar los datos");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Buscar leads, empresas..." 
              className="pl-10 bg-muted border-border shadow-none h-10 text-foreground" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
    <div className="flex items-center gap-2 bg-muted border border-border rounded-lg px-2 h-10">
            <Filter size={14} className="text-muted-foreground ml-1" />
            <select 
              className="bg-transparent border-none text-sm focus:outline-none transition-all text-muted-foreground font-bold pr-2 h-full cursor-pointer"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
            >
              <option value="all">Todas las etapas</option>
              <option value="setter">Prospección</option>
              <option value="commercial">Comercial</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-muted border border-border rounded-lg px-2 h-10">
            <div className="h-2 w-2 rounded-full bg-primary ml-1" />
            <select 
              className="bg-transparent border-none text-sm focus:outline-none transition-all text-muted-foreground font-bold pr-2 h-full cursor-pointer"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Todos los estados</option>
              <option value="new">Nuevos</option>
              <option value="contacted">Contactados</option>
              <option value="follow-up">Seguimiento</option>
              <option value="future">A Futuro</option>
              <option value="meeting-scheduled">Reunión agendada</option>
              <option value="qualified">Calificada</option>
              <option value="closed-won">Cerrado ganado</option>
              <option value="closed-lost">Cerrado perdido</option>
              <option value="reschedule">Reprogramar</option>
              <option value="not-interested">No interesado</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-muted p-1 rounded-lg border border-border h-10 mr-2">
            <button 
              onClick={() => setViewMode('followup')}
              className={cn(
                "px-3 flex items-center justify-center rounded-md transition-all gap-1.5",
                viewMode === 'followup' ? "bg-amber-500 text-white shadow-md shadow-amber-500/20" : "text-muted-foreground hover:text-foreground"
              )}
              title="Modo Seguimiento"
            >
              <Zap size={16} />
              <span className="text-[10px] font-black uppercase hidden md:inline">Seguimientos</span>
            </button>
            <div className="w-[1px] bg-border mx-1 my-1" />
            <button 
              onClick={() => setViewMode('table')}
              className={cn(
                "px-3 flex items-center justify-center rounded-md transition-all",
                viewMode === 'table' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List size={16} />
            </button>
            <button 
              onClick={() => setViewMode('kanban')}
              className={cn(
                "px-3 flex items-center justify-center rounded-md transition-all",
                viewMode === 'kanban' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid size={16} />
            </button>
          </div>
          {(profile?.role === 'director' || profile?.role === 'account_manager') && selectedLeadIds.length > 0 && (
            <Button 
              variant="destructive" 
              onClick={handleBulkDeleteRequest}
              className="gap-2 font-semibold shadow-none"
            >
              <Trash2 size={18} />
              Eliminar seleccionados ({selectedLeadIds.length})
            </Button>
          )}
          {(profile?.role === 'director' || profile?.role === 'account_manager') && (
            <Button variant="outline" onClick={exportToExcel} className="gap-2 border-border bg-card shadow-none font-semibold hover:bg-muted text-foreground">
              <Download size={18} />
              Exportar
            </Button>
          )}
          {profile?.role !== 'client' && (
            <div className="relative">
              <input
                type="file"
                accept=".csv, .xlsx, .xls"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleFileUpload}
              />
              <Button variant="outline" className="gap-2 border-border bg-card shadow-none font-semibold hover:bg-muted text-foreground">
                <Upload size={18} />
                Cargar BBDD
              </Button>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'followup' ? (
          <motion.div
            key="followup-view"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <FollowUpCenter 
               profile={profile}
               clientId={clientId}
               isDemoMode={isDemoMode}
               onLeadClick={onLeadClick}
            />
          </motion.div>
        ) : viewMode === 'table' ? (
          <motion.div
            key="table-view"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="border border-border rounded-xl shadow-none overflow-hidden bg-card relative">
              <div 
                ref={scrollContainerRef}
                className="max-h-[60vh] md:max-h-[calc(100vh-320px)] overflow-y-auto overflow-x-auto custom-scrollbar overscroll-contain"
              >
                <Table>
                  <TableHeader className="sticky top-0 z-20 bg-muted/90 backdrop-blur shadow-sm">
                    <TableRow className="hover:bg-transparent border-b border-border">
                      <TableHead className="w-[50px] py-4 px-6 text-center sticky top-0 bg-transparent z-20">
                        <input 
                          type="checkbox" 
                          className="h-4 w-4 rounded border-border bg-muted text-primary focus:ring-primary"
                          checked={selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0}
                          onChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="font-bold text-muted-foreground py-4 px-6 sticky top-0 bg-transparent z-20">Nombre / Empresa</TableHead>
                      <TableHead className="font-bold text-muted-foreground py-4 px-6 sticky top-0 bg-transparent z-20">Tag / Perfil</TableHead>
                      <TableHead className="font-bold text-muted-foreground py-4 px-6 sticky top-0 bg-transparent z-20">Etapa</TableHead>
                      <TableHead className="font-bold text-muted-foreground py-4 px-6 sticky top-0 bg-transparent z-20">Contacto</TableHead>
                      <TableHead className="font-bold text-muted-foreground py-4 px-6 sticky top-0 bg-transparent z-20">País / Sector</TableHead>
                      <TableHead className="font-bold text-muted-foreground py-4 px-6 sticky top-0 bg-transparent z-20 w-[150px]">Seguimiento</TableHead>
                      <TableHead className="font-bold text-muted-foreground py-4 px-6 sticky top-0 bg-transparent z-20 text-center">Estado</TableHead>
                      <TableHead className="font-bold text-muted-foreground py-4 px-6 sticky top-0 bg-transparent z-20">Última Acción</TableHead>
                      <TableHead className="w-[80px] py-4 px-6 sticky top-0 bg-transparent z-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow 
                      key={lead.id} 
                      className={`cursor-pointer transition-colors ${
                        selectedLeadIds.includes(lead.id) 
                          ? 'bg-secondary hover:bg-secondary/80' 
                          : lead.status === 'qualified'
                            ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-b border-emerald-500/30'
                            : (lead.status === 'meeting-scheduled' && lead.meetings?.some(m => m.status === 'completed'))
                              ? 'bg-green-500/10 hover:bg-green-500/20 border-b border-green-500/20'
                              : 'hover:bg-muted/30 border-b border-border'
                      }`}
                      onClick={() => handleViewDetails(lead)}
                    >
                      <TableCell className="py-4 px-6 text-center" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="h-4 w-4 rounded border-border bg-muted text-primary focus:ring-primary"
                          checked={selectedLeadIds.includes(lead.id)}
                          onChange={() => toggleLeadSelection(lead.id)}
                        />
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="font-bold text-foreground">{lead.name}</span>
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                            <Building2 size={12} />
                            {lead.company}
                            {lead.position && lead.position !== 'No especificado' && (
                              <>
                                <span className="mx-1">•</span>
                                <span>{lead.position}</span>
                              </>
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        {lead.tag ? (
                          <Badge variant="secondary" className="text-[10px] font-bold bg-muted text-muted-foreground border-none">
                            {lead.tag}
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic">Sin tag</span>
                        )}
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <Badge 
                          variant="outline" 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStage(lead);
                          }}
                          className={`text-[10px] font-extrabold uppercase px-2 py-1 border-2 flex items-center gap-1.5 w-fit cursor-pointer hover:scale-105 transition-transform ${
                            lead.stage === 'setter' 
                              ? 'border-blue-900/50 text-blue-400 bg-blue-950/20' 
                              : 'border-purple-900/50 text-purple-400 bg-purple-950/20'
                          }`}
                        >
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
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <div className="flex flex-col gap-1">
                          <span className="flex items-center gap-1 text-sm text-muted-foreground font-medium">
                            {lead.contactInfo.includes('@') ? <Mail size={14} /> : <Phone size={14} />}
                            {lead.contactInfo}
                          </span>
                          {lead.linkedinUrl && (
                            <a 
                              href={lead.linkedinUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[10px] text-primary hover:underline font-bold"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Linkedin size={12} />
                              LinkedIn
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="flex items-center gap-1 text-sm text-muted-foreground font-medium">
                            <MapPin size={14} />
                            {lead.country}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-medium">{lead.sector}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <div className="flex flex-col gap-1.5 min-w-[120px]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                               <Sparkles size={10} className="text-amber-500" />
                               <span className="text-[10px] font-black italic text-foreground">
                                 {lead.followUpSequence || 0}/3 Sem
                               </span>
                            </div>
                            {lead.nextFollowUpDate && (
                              <span className={cn(
                                "text-[9px] font-black uppercase italic px-1.5 py-0.5 rounded",
                                new Date(lead.nextFollowUpDate) <= new Date() 
                                  ? "bg-amber-500 text-white" 
                                  : "text-muted-foreground/60"
                              )}>
                                {formatDate(lead.nextFollowUpDate)}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-1 h-1.5 w-full bg-muted rounded-full overflow-hidden p-[0.5px]">
                            {[1, 2, 3].map(i => (
                              <div 
                                key={i} 
                                className={`flex-1 h-full rounded-full transition-all duration-700 ${
                                  (lead.followUpSequence || 0) >= i ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-muted-foreground/10'
                                }`} 
                              />
                            ))}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <Badge className={`status-pill ${getStatusBadgeColor(lead.status)} ${lead.status === 'qualified' ? 'border-2 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'border-none shadow-none'}`}>
                          {getStatusLabel(lead.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">
                            {lead.lastActionAuthorId && lead.lastActionAuthorId !== profile?.uid && lead.lastAction.startsWith('Seguimiento:') 
                              ? 'Seguimiento registrado' 
                              : lead.lastAction}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{formatDate(lead.updatedAt)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <DropdownMenu>
                          <DropdownMenuTrigger 
                            onClick={(e) => e.stopPropagation()}
                            className="group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                          >
                            <MoreVertical size={16} />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl border-border shadow-lg">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewDetails(lead); }} className="font-medium cursor-pointer">
                              <Eye className="mr-2 h-4 w-4" /> Ver detalles
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewDetails(lead); }} className="font-medium cursor-pointer">
                              <Clock className="mr-2 h-4 w-4 text-amber-500" /> Gestionar Seguimiento
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewDetails(lead); }} className="font-medium cursor-pointer">
                              <Edit className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {(profile?.role === 'director' || profile?.role === 'account_manager') && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(lead.id, lead.name); }} className="text-destructive font-medium cursor-pointer">
                                <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredLeads.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="h-40 text-center text-muted-foreground font-medium">
                        No se encontraron leads con los filtros actuales.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </motion.div>
      ) : (
        <motion.div
          key="kanban-view"
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
        >
          <LeadKanban 
            leads={filteredLeads}
            onStatusChange={handleStatusChange}
            onLeadClick={handleViewDetails}
            profile={profile}
          />
        </motion.div>
      )}
      </AnimatePresence>

      <AnimatePresence>
        {canScroll && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="absolute bottom-4 right-4 flex flex-col gap-2 z-30"
          >
            {showScrollButtons && (
              <Button 
                variant="secondary" 
                size="icon" 
                className="rounded-full shadow-lg border border-border bg-card/90 backdrop-blur hover:bg-card h-9 w-9 text-foreground"
                onClick={scrollToTop}
                title="Subir al inicio"
              >
                <ChevronUp size={18} />
              </Button>
            )}
            <Button 
              variant="secondary" 
              size="icon" 
              className="rounded-full shadow-lg border border-border bg-card/90 backdrop-blur hover:bg-card h-9 w-9 text-foreground"
              onClick={scrollToBottom}
              title="Bajar al final"
            >
              <ChevronDown size={18} />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de eliminación individual */}
      <Dialog open={!!deleteConfirmInfo} onOpenChange={(open) => !open && setDeleteConfirmInfo(null)}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border text-card-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">Eliminar Lead</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center">
            <Trash2 size={48} className="mx-auto text-destructive mb-4 opacity-20" />
            <p className="text-sm text-foreground">
              ¿Estás seguro de que deseas eliminar permanentemente a <span className="font-bold">{deleteConfirmInfo?.name}</span>?
            </p>
            <p className="text-xs text-muted-foreground mt-2">Esta acción no se puede deshacer.</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteConfirmInfo(null)} className="border-border text-foreground hover:bg-muted font-bold">Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteAction} className="font-bold">Eliminar permanentemente</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de eliminación masiva (Doble confirmación) */}
      <Dialog open={isBulkDeleteConfirmOpen} onOpenChange={(open) => !open && setIsBulkDeleteConfirmOpen(false)}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border text-card-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">{confirmStep === 1 ? '¿Eliminar leads seleccionados?' : '¡ATENCIÓN! Confirmación final'}</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center">
            {confirmStep === 1 ? (
              <>
                <Trash2 size={48} className="mx-auto text-destructive mb-4 opacity-20" />
                <p className="text-sm text-foreground">
                  Vas a eliminar <span className="font-bold">{selectedLeadIds.length} leads</span>. ¿Deseas continuar?
                </p>
              </>
            ) : (
              <>
                <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="text-destructive" size={24} />
                </div>
                <p className="text-sm font-bold text-destructive">
                  Esta acción es IRREVERSIBLE.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Se borrará toda la información de los {selectedLeadIds.length} contactos seleccionados.
                </p>
              </>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => {
              setIsBulkDeleteConfirmOpen(false);
              setConfirmStep(1);
            }} className="border-border text-foreground hover:bg-muted font-bold">
              Cancelar
            </Button>
            {confirmStep === 1 ? (
              <Button variant="destructive" onClick={() => setConfirmStep(2)} className="font-bold">Siguiente paso</Button>
            ) : (
              <Button variant="destructive" onClick={handleBulkDeleteAction} className="font-bold">Confirmar eliminación masiva</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Data Mapping Dialog */}
      <Dialog open={isMappingDialogOpen} onOpenChange={setIsMappingDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-8 rounded-[2.5rem] bg-card/95 backdrop-blur-xl border-border/50">
          <DialogHeader className="pb-6 border-b border-border/50">
            <DialogTitle className="text-3xl font-black italic uppercase tracking-tighter text-foreground">
              Alinear Datos de Importación
            </DialogTitle>
            <DialogDescription className="text-sm font-bold text-muted-foreground uppercase opacity-70 tracking-widest">
              Asocia las columnas de tu archivo con los campos del CRM
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto py-8 pr-2 custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {LEAD_FIELDS.map((field) => (
                <div key={field.key} className="space-y-3 p-5 rounded-2xl bg-muted/30 border border-border/50 hover:border-primary/30 transition-all group">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">
                      {field.label}
                    </Label>
                    {mapping[field.key] ? (
                      <Badge className="bg-emerald-500/10 text-emerald-500 border-none text-[8px] font-black uppercase px-2">Asignado</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[8px] font-black uppercase opacity-40 px-2">Pendiente</Badge>
                    )}
                  </div>
                  
                  <Select 
                    value={mapping[field.key] || "skip"} 
                    onValueChange={(val) => setMapping(prev => ({ ...prev, [field.key]: val === "skip" ? "" : val }))}
                  >
                    <SelectTrigger className="w-full h-12 rounded-xl bg-card border-border/50 font-bold text-sm shadow-none">
                      <SelectValue placeholder="Omitir este campo" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/50 shadow-2xl">
                      <SelectItem value="skip" className="font-bold text-muted-foreground uppercase text-[10px]">Omitir este campo</SelectItem>
                      {detectedHeaders.map((header) => (
                        <SelectItem key={header} value={header} className="font-bold text-sm">
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="mt-10 p-6 rounded-3xl bg-primary/5 border border-primary/20 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                <LayoutGrid size={14} />
                Vista Previa del Primer Lead
              </h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {LEAD_FIELDS.filter(f => mapping[f.key]).map(f => (
                  <div key={f.key} className="flex flex-col">
                    <span className="text-[8px] font-black text-muted-foreground uppercase opacity-50">{f.label}</span>
                    <span className="text-[11px] font-bold text-foreground truncate">{importData[0]?.[mapping[f.key]]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-6 border-t border-border/50 gap-4">
            <Button 
              variant="ghost" 
              onClick={() => setIsMappingDialogOpen(false)}
              className="h-14 px-8 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
            >
              Cancelar
            </Button>
            <Button 
              onClick={processImport}
              className="h-14 px-10 rounded-2xl font-black text-xs uppercase tracking-widest bg-primary shadow-[0_0_25px_rgba(var(--primary),0.4)] hover:shadow-[0_0_35px_rgba(var(--primary),0.6)] transition-all"
            >
              Iniciar Importación ({importData.length} leads)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
