import React, { useState, useEffect } from 'react';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { collection, onSnapshot, query, where, addDoc, getDocs } from 'firebase/firestore';
import { Lead, UserProfile, Meeting } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from 'sonner';
import { 
  Users, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Calendar,
  UserCheck,
  UserCog
} from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from './ui/table';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './ui/select';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, subMonths, eachDayOfInterval, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatDate, cn } from '../lib/utils';
import { DashboardAIInsights } from './DashboardAIInsights';
import { 
  Target,
  DollarSign,
  Zap,
  ArrowRight,
  LayoutDashboard
} from 'lucide-react';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DatePicker } from './ui/DatePicker';
import { GripVertical } from 'lucide-react';

interface DashboardStatsProps {
  profile: UserProfile | null;
  isDemoMode?: boolean;
  clientId: string;
}

const MOCK_LEADS: Lead[] = [
  { id: '1', clientId: 'c1', name: 'Juan Pérez', company: 'Tech Solutions', country: 'Argentina', interest: 'CRM Software', contactInfo: 'juan@tech.com', sector: 'Tecnología', status: 'new', stage: 'setter', tag: 'LinkedIn Perfil 1', lastAction: 'Primer contacto', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), followUps: [], meetings: [] },
  { id: '2', clientId: 'c1', name: 'María García', company: 'Global Retail', country: 'España', interest: 'Marketing Automation', contactInfo: '+34 600 000 000', sector: 'Retail', status: 'contacted', stage: 'setter', tag: 'LinkedIn Perfil 2', lastAction: 'Llamada realizada', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), followUps: [], meetings: [] },
  { id: '3', clientId: 'c1', name: 'Roberto Smith', company: 'Logistics Pro', country: 'México', interest: 'ERP Integration', contactInfo: 'roberto@logistics.mx', sector: 'Logística', status: 'qualified', stage: 'commercial', tag: 'LinkedIn Perfil 1', lastAction: 'Reunión realizada - Calificado', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), followUps: [], meetings: [] },
  { id: '4', clientId: 'c1', name: 'Ana López', company: 'Fintech Corp', country: 'Colombia', interest: 'Payment Gateway', contactInfo: 'ana@fintech.co', sector: 'Finanzas', status: 'closed-won', stage: 'commercial', tag: 'LinkedIn Perfil 3', lastAction: 'Contrato firmado', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), followUps: [], meetings: [] }
];

const YEARS = Array.from({ length: 2070 - 2024 + 1 }, (_, i) => 2024 + i);
const MONTHS_LIST = [
  { label: 'Enero', value: '01' },
  { label: 'Febrero', value: '02' },
  { label: 'Marzo', value: '03' },
  { label: 'Abril', value: '04' },
  { label: 'Mayo', value: '05' },
  { label: 'Junio', value: '06' },
  { label: 'Julio', value: '07' },
  { label: 'Agosto', value: '08' },
  { label: 'Septiembre', value: '09' },
  { label: 'Octubre', value: '10' },
  { label: 'Noviembre', value: '11' },
  { label: 'Diciembre', value: '12' },
];

export default function DashboardStats({ profile, isDemoMode, clientId }: DashboardStatsProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [widgetOrder, setWidgetOrder] = useState<string[]>([]);
  
  // Use a key to force re-render when switching clients or periods to avoid chart glitches
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setRefreshKey(prev => prev + 1);
  }, [clientId]);
  
  // Date selection states
  const [dateMode, setDateMode] = useState<'month' | 'range'>('month');
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [compareMonth, setCompareMonth] = useState<string>(format(subMonths(new Date(), 1), 'yyyy-MM'));
  
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  const [compareRange, setCompareRange] = useState({
    start: format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'),
    end: format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd')
  });

  const [isComparing, setIsComparing] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    // Load widget order from localStorage
    const savedOrder = localStorage.getItem(`dashboard-order-${clientId}`);
    if (savedOrder) {
      setWidgetOrder(JSON.parse(savedOrder));
    } else {
      setWidgetOrder([
        'stat-new', 'stat-followups', 'stat-actual-revenue', 'stat-revenue',
        'widget-ai', 'chart-historical-leads', 'chart-historical-meetings',
        'table-monthly-comparison',
        'chart-funnel', 'chart-histogram',
        'chart-sectors', 'list-followups-simple', 'list-agenda', 'chart-stages', 'chart-status', 'table-tags',
        'list-activity'
      ]);
    }

    if (isDemoMode) {
      const loadLeads = () => {
        const stored = localStorage.getItem('demo-leads');
        const allLeads: Lead[] = stored ? JSON.parse(stored) : MOCK_LEADS;
        const filtered = allLeads.filter(l => l.clientId === clientId);
        setLeads(filtered);
        
        // Mock meetings from leads
        const mockMeetings: Meeting[] = [];
        filtered.forEach(lead => {
          if (lead.status === 'qualified' || lead.status === 'meeting-scheduled') {
            mockMeetings.push({
              id: `m-${lead.id}`,
              leadId: lead.id,
              clientId: lead.clientId,
              date: lead.updatedAt || lead.createdAt,
              time: '10:00',
              status: lead.status === 'qualified' ? 'completed' : 'scheduled',
              type: 'online',
              createdAt: lead.createdAt
            } as any);
          }
        });
        setMeetings(mockMeetings);
      };
      
      loadLeads();
      setLoading(false);
      
      window.addEventListener('demo-leads-updated', loadLeads);
      return () => window.removeEventListener('demo-leads-updated', loadLeads);
    }

    const qLeads = query(collection(db, 'leads'), where('clientId', '==', clientId));
    const qMeetings = query(collection(db, 'meetings'), where('clientId', '==', clientId));

    const unsubLeads = onSnapshot(qLeads, (snapshot) => {
      const leadsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead));
      setLeads(leadsData);
      checkLoading();
    }, (error) => {
      console.error("Error fetching leads in Dashboard:", error);
      toast.error("Error al cargar leads del tablero");
      setLoading(false);
    });

    const unsubMeetings = onSnapshot(qMeetings, (snapshot) => {
      const meetingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setMeetings(meetingsData);
      checkLoading();
    }, (error) => {
      console.error("Error fetching meetings in Dashboard:", error);
      toast.error("Error al cargar reuniones del tablero");
      setLoading(false);
    });

    function checkLoading() {
      setLoading(false);
    }

    return () => {
      unsubLeads();
      unsubMeetings();
    };
  }, [clientId, isDemoMode]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setWidgetOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over?.id as string);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        localStorage.setItem(`dashboard-order-${clientId}`, JSON.stringify(newOrder));
        return newOrder;
      });
    }
  };

  const filterItemsByPeriod = <T extends { createdAt?: string; date?: string }>(items: T[], start: string, end: string, dateKey: keyof T = 'createdAt') => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);
    
    return items.filter(item => {
      const dateStr = item[dateKey] as string;
      if (!dateStr) return false;
      const date = parseISO(dateStr);
      return isWithinInterval(date, { start: startDate, end: endDate });
    });
  };

  const getActivePeriodRange = (mode: 'month' | 'range', monthStr: string, range: {start: string, end: string}) => {
    if (mode === 'month') {
      const [year, month] = monthStr.split('-').map(Number);
      return {
        start: format(startOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd'),
        end: format(endOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd')
      };
    }
    return range;
  };

  const normalizeSector = (sector: string): string => {
    if (!sector) return 'No especificado';
    const s = sector.toLowerCase().trim();
    
    if (s.includes('tech') || s.includes('software') || s.includes('it ') || s === 'it' || s.includes('sistemas') || s.includes('tecnología') || s.includes('saas') || s.includes('digital') || s.includes('desarrollo') || s.includes('ia ') || s.includes('ai ')) {
      return 'Tecnología/IT';
    }
    if (s.includes('finan') || s.includes('bank') || s.includes('banco') || s.includes('seguro') || s.includes('fintech') || s.includes('contab') || s.includes('invers')) {
      return 'Finanzas/Banca';
    }
    if (s.includes('salud') || s.includes('health') || s.includes('medicina') || s.includes('farma') || s.includes('odont') || s.includes('clínic') || s.includes('hospit')) {
      return 'Salud/Farma';
    }
    if (s.includes('retail') || s.includes('comercio') || s.includes('venta') || s.includes('ecommerce') || s.includes('tienda') || s.includes('supermerc') || s.includes('moda') || s.includes('ropa')) {
      return 'Retail/E-commerce';
    }
    if (s.includes('logis') || s.includes('transp') || s.includes('envio') || s.includes('distrib') || s.includes('flete') || s.includes('comercio ext')) {
      return 'Logística/Transporte';
    }
    if (s.includes('consul') || s.includes('asesor') || s.includes('servicio profes') || s.includes('agency') || s.includes('agencia') || s.includes('legal') || s.includes('estudio') || s.includes('marketing') || s.includes('public')) {
      return 'Servicios/Consultoría';
    }
    if (s.includes('educa') || s.includes('school') || s.includes('univ') || s.includes('capacita') || s.includes('enseñ') || s.includes('academy') || s.includes('academia')) {
      return 'Educación';
    }
    if (s.includes('cons') || s.includes('obra') || s.includes('inmueble') || s.includes('real estate') || s.includes('propiedad') || s.includes('arquitect') || s.includes('inmobil')) {
      return 'Construcción/Bienes Raíces';
    }
    if (s.includes('manuf') || s.includes('indus') || s.includes('fabrica') || s.includes('alimento') || s.includes('agro') || s.includes('campo') || s.includes('ganad')) {
      return 'Industria/Agro';
    }
    
    return sector.charAt(0).toUpperCase() + sector.slice(1);
  };

  const getSectorColor = (sector: string): string => {
    const colors: Record<string, string> = {
      'Tecnología/IT': '#3b82f6',
      'Finanzas/Banca': '#10b981',
      'Salud/Farma': '#ec4899',
      'Retail/E-commerce': '#f59e0b',
      'Logística/Transporte': '#6366f1',
      'Servicios/Consultoría': '#8b5cf6',
      'Educación': '#06b6d4',
      'Construcción/Bienes Raíces': '#ef4444',
      'Industria/Manufactura': '#64748b'
    };
    return colors[sector] || '#94a3b8';
  };

  const getStatsForLeads = (filteredLeads: Lead[], filteredMeetings: Meeting[]) => {
    return {
      total: filteredLeads.length,
      new: filteredLeads.length, // Total leads added in the period (for stat cards)
      currentlyNew: filteredLeads.filter(l => l.status === 'new').length, // Strictly currently NEW
      contacted: filteredLeads.filter(l => l.status === 'contacted').length,
      followUp: filteredLeads.filter(l => l.status === 'follow-up').length,
      meetings: filteredMeetings.length, // Total meetings activity
      meetingsStatus: filteredLeads.filter(l => l.status === 'meeting-scheduled' || l.status === 'reschedule').length, // Strictly current MEETING status
      qualified: filteredLeads.filter(l => l.status === 'qualified').length,
      closed: filteredLeads.filter(l => l.status === 'closed-won').length,
      notInterested: filteredLeads.filter(l => l.status === 'not-interested').length,
      setter: filteredLeads.filter(l => l.stage === 'setter').length,
      commercial: filteredLeads.filter(l => l.stage === 'commercial').length,
      revenuePotential: filteredLeads
        .filter(l => l.status === 'qualified' || l.status === 'meeting-scheduled')
        .length * 1500, // Valor promedio $1500
      actualRevenue: filteredLeads
        .filter(l => l.status === 'closed-won')
        .length * 1500,
      leadsPerDay: (() => {
        const startDate = eachDayOfInterval({
          start: new Date(currentPeriod.start),
          end: new Date(currentPeriod.end)
        });
        
        return startDate.map(day => {
          const count = filteredLeads.filter(l => {
            const lDate = l.createdAt ? parseISO(l.createdAt) : null;
            return lDate && isSameDay(lDate, day);
          }).length;
          
          return {
            date: format(day, 'dd/MM'),
            cantidad: count
          };
        });
      })(),
      historicalData: (() => {
        // Last 12 months historical data
        const months = [];
        for (let i = 11; i >= 0; i--) {
          const d = subMonths(new Date(), i);
          const monthKey = format(d, 'yyyy-MM');
          const monthLabel = format(d, 'MMM yy', { locale: es });
          
          const leadsInMonth = leads.filter(l => l.createdAt && l.createdAt.startsWith(monthKey)).length;
          const meetingsInMonth = meetings.filter(m => m.date && m.date.startsWith(monthKey)).length;
          
          months.push({
            name: monthLabel,
            leads: leadsInMonth,
            reuniones: meetingsInMonth
          });
        }
        return months;
      })(),
      funnelData: [
        { name: 'Total Leads', value: filteredLeads.length, color: '#3b82f6' },
        { name: 'Contactados', value: filteredLeads.filter(l => l.status !== 'new').length, color: '#6366f1' },
        { name: 'Calificados', value: filteredLeads.filter(l => l.status === 'qualified' || l.status === 'meeting-scheduled' || l.status === 'closed-won').length, color: '#10b981' },
        { name: 'Ganados', value: filteredLeads.filter(l => l.status === 'closed-won').length, color: '#059669' },
      ],
      tagData: (() => {
        const counts: Record<string, number> = {};
        filteredLeads.forEach(l => {
          const t = l.tag || 'Sin Tag';
          counts[t] = (counts[t] || 0) + 1;
        });
        return Object.entries(counts)
          .map(([name, value]) => ({ 
            name, 
            value,
            percentage: filteredLeads.length > 0 ? ((value / filteredLeads.length) * 100).toFixed(1) : 0
          }))
          .sort((a, b) => b.value - a.value);
      })(),
      sectorData: (() => {
        const counts: Record<string, number> = {};
        filteredLeads.forEach(l => {
          const s = normalizeSector(l.sector || '');
          counts[s] = (counts[s] || 0) + 1;
        });
        return Object.entries(counts)
          .map(([name, value]) => ({ 
            name, 
            value,
            fill: getSectorColor(name)
          }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10);
      })(),
      monthlyComparison: (() => {
        const months = [];
        for (let i = 5; i >= 0; i--) {
          const d = subMonths(new Date(), i);
          const monthKey = format(d, 'yyyy-MM');
          const monthLabel = format(d, 'MMMM', { locale: es });
          
          const leadsInMonth = leads.filter(l => l.createdAt && l.createdAt.startsWith(monthKey)).length;
          const meetingsInMonth = meetings.filter(m => m.date && m.date.startsWith(monthKey)).length;
          const closedInMonth = leads.filter(l => l.updatedAt && l.updatedAt.startsWith(monthKey) && l.status === 'closed-won').length;
          
          months.push({
            name: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
            leads: leadsInMonth,
            reuniones: meetingsInMonth,
            cierres: closedInMonth,
            monthKey
          });
        }
        return months;
      })()
    };
  };

  const currentPeriod = getActivePeriodRange(dateMode, selectedMonth, dateRange);
  const comparePeriod = getActivePeriodRange(dateMode, compareMonth, compareRange);

  const currentLeads = filterItemsByPeriod(leads, currentPeriod.start, currentPeriod.end, 'createdAt') as Lead[];
  const currentMeetings = filterItemsByPeriod(meetings, currentPeriod.start, currentPeriod.end, 'date') as Meeting[];
  const stats = getStatsForLeads(currentLeads, currentMeetings);
  
  const comparisonLeads = isComparing ? filterItemsByPeriod(leads, comparePeriod.start, comparePeriod.end, 'createdAt') as Lead[] : [];
  const comparisonMeetings = isComparing ? filterItemsByPeriod(meetings, comparePeriod.start, comparePeriod.end, 'date') as Meeting[] : [];
  const comparisonStats = isComparing ? getStatsForLeads(comparisonLeads, comparisonMeetings) : null;

  const chartData = [
    { name: 'Nuevos', value: stats.currentlyNew, color: '#3b82f6' },
    { name: 'Contactados', value: stats.contacted, color: '#6366f1' },
    { name: 'Seguimiento', value: stats.followUp, color: '#f59e0b' },
    { name: 'Reuniones', value: stats.meetingsStatus, color: '#8b5cf6' },
    { name: 'Calificadas', value: stats.qualified, color: '#10b981' },
    { name: 'Ganados', value: stats.closed, color: '#059669' },
    { name: 'No Interesados', value: stats.notInterested, color: '#94a3b8' },
  ];

  const stageData = [
    { name: 'Prospección', value: stats.setter, color: '#3b82f6' },
    { name: 'Comercial', value: stats.commercial, color: '#8b5cf6' },
  ];

  const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#64748b'];

  const getMonthLabel = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const m = MONTHS_LIST.find(opt => opt.value === month);
    return `${m?.label} ${year}`;
  };

  const getPeriodLabel = (mode: 'month' | 'range', monthStr: string, range: {start: string, end: string}) => {
    if (mode === 'month') return getMonthLabel(monthStr);
    return `${format(new Date(range.start), 'dd/MM/yyyy')} - ${format(new Date(range.end), 'dd/MM/yyyy')}`;
  };

  const pendingFollowUps = leads.filter(l => {
    if (!l.nextFollowUpDate || l.status === 'closed-won' || l.status === 'closed-lost' || l.status === 'not-interested') return false;
    const followUpCount = l.followUps?.length || 0;
    if (followUpCount >= 3 && (l.status === 'new' || l.status === 'contacted')) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextDate = new Date(l.nextFollowUpDate);
    nextDate.setHours(0, 0, 0, 0);
    return nextDate <= today;
  });

  const renderWidget = (id: string) => {
    switch (id) {
      case 'stat-new':
        const newTrend = isComparing && comparisonStats ? {
          label: `${Math.abs(((stats.new - comparisonStats.new) / (comparisonStats.new || 1) * 100)).toFixed(0)}%`,
          positive: stats.new >= comparisonStats.new
        } : undefined;
        return (
          <StatCard 
            title="Nuevos Leads" 
            value={stats.new} 
            icon={<Users size={18} className="text-primary" />} 
            description={isComparing ? `vs ${comparisonStats?.new || 0} previo` : "Total interesados sumados"}
            trend={newTrend}
          />
        );
      case 'stat-followups':
        return (
          <div className="relative group/card h-full">
            <StatCard 
              title="Seguimientos" 
              value={pendingFollowUps.length} 
              icon={<Clock size={18} className="text-amber-500" />} 
              description="Pendientes por contactar"
              valueColor="text-amber-500"
            />
            <div className="absolute bottom-4 right-6 opacity-0 group-hover/card:opacity-100 transition-all">
               <Button 
                variant="link" 
                size="sm" 
                className="text-[10px] font-black text-primary p-0 uppercase"
                onClick={() => (window as any).setActiveTab?.('follow-ups')}
               >
                 Abrir Centro <ArrowRight size={10} className="ml-1" />
               </Button>
            </div>
          </div>
        );
      case 'chart-historical-leads':
        return (
          <Card className="border border-border/40 rounded-[2rem] shadow-none bg-card/40 backdrop-blur-sm overflow-hidden h-full">
            <CardHeader className="border-b border-border/40 px-8 py-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-black text-foreground uppercase italic tracking-tighter">Histórico de Interesados</CardTitle>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">Tendencia mensual de captación (12 meses)</p>
                </div>
                <Users size={18} className="text-primary opacity-50" />
              </div>
            </CardHeader>
            <CardContent className="pt-8">
              <div className="h-[250px] w-full min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%" key={`historical-leads-${refreshKey}`}>
                  <AreaChart data={stats.historicalData}>
                    <defs>
                      <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" opacity={0.3} />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: '#a1a1aa', fontWeight: 800 }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: '#a1a1aa', fontWeight: 800 }} 
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', borderRadius: '16px', border: '1px solid #27272a', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ color: '#fafafa', fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <Area type="monotone" dataKey="leads" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorLeads)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        );
      case 'chart-historical-meetings':
        return (
          <Card className="border border-border/40 rounded-[2rem] shadow-none bg-card/40 backdrop-blur-sm overflow-hidden h-full">
            <CardHeader className="border-b border-border/40 px-8 py-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-black text-foreground uppercase italic tracking-tighter">Histórico de Reuniones</CardTitle>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">Desempeño comercial por mes</p>
                </div>
                <Calendar size={18} className="text-purple-500 opacity-50" />
              </div>
            </CardHeader>
            <CardContent className="pt-8">
              <div className="h-[250px] w-full min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%" key={`historical-meetings-${refreshKey}`}>
                  <AreaChart data={stats.historicalData}>
                    <defs>
                      <linearGradient id="colorReuniones" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" opacity={0.3} />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: '#a1a1aa', fontWeight: 800 }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: '#a1a1aa', fontWeight: 800 }} 
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', borderRadius: '16px', border: '1px solid #27272a', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ color: '#fafafa', fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <Area type="monotone" dataKey="reuniones" stroke="#a855f7" strokeWidth={4} fillOpacity={1} fill="url(#colorReuniones)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        );
      case 'stat-meetings':
        const meetingsTrend = isComparing && comparisonStats ? {
          label: `${Math.abs(((stats.meetings - comparisonStats.meetings) / (comparisonStats.meetings || 1) * 100)).toFixed(0)}%`,
          positive: stats.meetings >= comparisonStats.meetings
        } : undefined;
        return (
          <StatCard 
            title="Reuniones" 
            value={stats.meetings} 
            icon={<Calendar size={18} className="text-purple-500" />} 
            description={isComparing ? `vs ${comparisonStats?.meetings || 0} previo` : "Agendadas y realizadas"}
            valueColor="text-purple-500"
            trend={meetingsTrend}
          />
        );
      case 'stat-revenue':
        return (
          <StatCard 
            title="Ingresos Estimados" 
            value={`$${stats.revenuePotential.toLocaleString()}`} 
            icon={<Target className="text-emerald-500" />} 
            description="Basado en leads calificados"
            valueColor="text-emerald-500"
          />
        );
      case 'stat-actual-revenue':
        return (
          <StatCard 
            title="Ventas Cerradas" 
            value={`$${stats.actualRevenue.toLocaleString()}`} 
            icon={<DollarSign className="text-emerald-600" />} 
            description="Ingresos reales (Ganados)"
            valueColor="text-emerald-600"
          />
        );
      case 'table-monthly-comparison':
        return (
          <Card className="border border-border/40 rounded-[2rem] shadow-none bg-card/40 backdrop-blur-sm overflow-hidden h-full">
            <CardHeader className="border-b border-border/40 px-8 py-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-black text-foreground uppercase italic tracking-tighter">Comparativa Mensual</CardTitle>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">Desempeño de campañas y reuniones por mes</p>
                </div>
                <TrendingUp size={18} className="text-primary opacity-50" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="text-[10px] font-black uppercase text-muted-foreground px-8">Mes</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center">Interesados</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center">Reuniones</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center">Cierres</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.monthlyComparison.map((m: any) => (
                    <TableRow key={m.name} className="hover:bg-primary/5 transition-colors border-border/40">
                      <TableCell className="px-8 font-black text-xs uppercase tracking-tight">{m.name}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 border-none font-black text-[10px]">{m.leads}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="bg-purple-500/10 text-purple-500 border-none font-black text-[10px]">{m.reuniones}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-none font-black text-[10px]">{m.cierres}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      case 'widget-ai':
        return <DashboardAIInsights leads={currentLeads} meetings={currentMeetings} />;
      case 'chart-funnel':
        return (
          <Card className="border border-border rounded-xl shadow-none bg-card h-full">
            <CardHeader className="border-b border-border px-6 py-4">
              <CardTitle className="text-base font-bold text-foreground">Embudo de Ventas</CardTitle>
            </CardHeader>
            <CardContent className="pt-8">
              <div className="space-y-6">
                {stats.funnelData.map((item, index) => (
                  <div key={item.name} className="relative">
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-[10px] font-extrabold uppercase text-muted-foreground">{item.name}</span>
                       <span className="text-sm font-black text-foreground">{item.value}</span>
                    </div>
                    <div className="h-4 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full transition-all duration-1000"
                        style={{ 
                          width: `${stats.funnelData[0].value > 0 ? (item.value / stats.funnelData[0].value) * 100 : 0}%`,
                          backgroundColor: item.color 
                        }}
                      />
                    </div>
                    {index < stats.funnelData.length - 1 && (
                      <div className="flex justify-center -my-1 relative z-10">
                        <div className="bg-background rounded-full p-0.5 border border-border shadow-sm">
                          <ArrowRight className="size-3 text-muted-foreground rotate-90" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      case 'chart-histogram':
        return (
          <Card className="border border-border rounded-xl shadow-none bg-card h-full">
            <CardHeader className="border-b border-border px-6 py-4">
              <CardTitle className="text-base font-bold text-foreground">Distribución de Leads por Día</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-[250px] w-full min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%" key={`histogram-${refreshKey}`}>
                  <BarChart data={stats.leadsPerDay}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#a1a1aa', fontWeight: 600 }}
                      interval={Math.floor(stats.leadsPerDay.length / 7)}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#a1a1aa', fontWeight: 600 }}
                    />
                    <Tooltip 
                      cursor={{ fill: '#27272a' }}
                      contentStyle={{ backgroundColor: '#18181b', borderRadius: '12px', border: '1px solid #27272a', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ color: '#fafafa' }}
                    />
                    <Bar dataKey="cantidad" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        );
      case 'chart-sectors':
        return (
          <Card className="border border-border rounded-xl shadow-none overflow-hidden h-full bg-card">
            <CardHeader className="border-b border-border px-6 py-4 flex flex-row items-center justify-between bg-card">
              <div>
                <CardTitle className="text-base font-bold text-foreground">Interés por Sector</CardTitle>
                <p className="text-[11px] text-muted-foreground">Distribución de las empresas de los leads</p>
              </div>
            </CardHeader>
            <CardContent className="pt-8 px-6 bg-card">
              <div className={`grid gap-8 ${isComparing ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
                <div className="space-y-4">
                  {isComparing && <p className="text-xs font-bold text-center text-muted-foreground uppercase">{getPeriodLabel(dateMode, selectedMonth, dateRange)}</p>}
                  <div className="h-[300px] min-h-[300px]">
                    <ResponsiveContainer width="100%" height="100%" key={`sectors-1-${refreshKey}`}>
                      <PieChart>
                        <Pie
                          data={stats.sectorData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                          stroke="none"
                        >
                          {stats.sectorData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#18181b', borderRadius: '12px', border: '1px solid #27272a', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          itemStyle={{ color: '#fafafa' }}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 600, color: '#a1a1aa' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                {isComparing && comparisonStats && (
                  <div className="space-y-4 border-l pl-8 border-border">
                    <p className="text-xs font-bold text-center text-primary uppercase">{getPeriodLabel(dateMode, compareMonth, compareRange)}</p>
                    <div className="h-[300px] min-h-[300px]">
                      <ResponsiveContainer width="100%" height="100%" key={`sectors-2-${refreshKey}`}>
                        <PieChart>
                          <Pie
                            data={comparisonStats.sectorData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                          >
                            {comparisonStats.sectorData.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#18181b', borderRadius: '12px', border: '1px solid #27272a', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            itemStyle={{ color: '#fafafa' }}
                          />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 600, color: '#a1a1aa' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      case 'chart-stages':
        return (
          <Card className="border border-border rounded-xl shadow-none bg-card h-full">
            <CardHeader className="border-b border-border px-6 py-4">
              <CardTitle className="text-base font-bold text-foreground">Distribución por Etapa</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex items-center justify-around mb-8">
                <div className="text-center">
                  <div className="h-12 w-12 rounded-full bg-blue-950/30 flex items-center justify-center text-blue-400 mx-auto mb-2 border border-blue-900/50">
                    <UserCheck size={24} />
                  </div>
                  <p className="text-2xl font-black text-blue-400">{stats.setter}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Fase Setter</p>
                </div>
                <div className="h-12 w-px bg-border" />
                <div className="text-center">
                  <div className="h-12 w-12 rounded-full bg-purple-950/30 flex items-center justify-center text-purple-400 mx-auto mb-2 border border-purple-900/50">
                    <UserCog size={24} />
                  </div>
                  <p className="text-2xl font-black text-purple-600">{stats.commercial}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Fase Comercial</p>
                </div>
              </div>
              <div className="h-[180px] min-h-[180px]">
                <ResponsiveContainer width="100%" height="100%" key={`stages-${refreshKey}`}>
                  <BarChart data={stageData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#27272a" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#a1a1aa', fontWeight: 500 }} width={100} />
                    <Tooltip 
                      cursor={{ fill: '#27272a' }}
                      contentStyle={{ backgroundColor: '#18181b', borderRadius: '12px', border: '1px solid #27272a' }}
                      itemStyle={{ color: '#fafafa' }}
                    />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={30}>
                      {stageData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        );
      case 'chart-status':
        return (
          <Card className="border border-border rounded-xl shadow-none bg-card h-full">
            <CardHeader className="border-b border-border px-6 py-4">
              <CardTitle className="text-base font-bold text-foreground">Estado de los Leads</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] pt-6 min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%" key={`status-${refreshKey}`}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#a1a1aa', fontWeight: 500 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#a1a1aa', fontWeight: 500 }} />
                  <Tooltip 
                    cursor={{ fill: '#27272a' }}
                    contentStyle={{ backgroundColor: '#18181b', borderRadius: '12px', border: '1px solid #27272a', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ color: '#fafafa' }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        );
      case 'table-monthly-comparison':
        return (
          <Card key={id} className="col-span-full border border-border shadow-none overflow-hidden bg-card rounded-2xl">
            <CardHeader className="border-b border-border bg-muted/30 px-6 py-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-black italic uppercase tracking-tighter text-foreground flex items-center gap-2">
                  <Calendar className="text-primary" size={18} /> Comparativa Mensual de Campañas
                </CardTitle>
                <p className="text-[10px] font-bold text-muted-foreground uppercase mt-0.5 tracking-widest">Rendimiento histórico de leads y reuniones</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-500/10 text-emerald-500 border-none font-black italic text-[10px]">6 Meses</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto custom-scrollbar">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="hover:bg-transparent border-border">
                      <TableHead className="font-black text-[10px] uppercase text-muted-foreground py-4 px-6 italic w-[150px]">Mes</TableHead>
                      <TableHead className="font-black text-[10px] uppercase text-muted-foreground text-center italic">Total Leads</TableHead>
                      <TableHead className="font-black text-[10px] uppercase text-muted-foreground text-center italic">Reuniones</TableHead>
                      <TableHead className="font-black text-[10px] uppercase text-muted-foreground text-center italic">Cierres</TableHead>
                      <TableHead className="font-black text-[10px] uppercase text-muted-foreground text-center italic">Tasa Conv.</TableHead>
                      <TableHead className="font-black text-[10px] uppercase text-muted-foreground text-right italic pr-6">Tendencia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.monthlyComparison.map((m: any, idx: number) => {
                      const prevMonth = idx > 0 ? stats.monthlyComparison[idx-1] : null;
                      const hasIncrease = prevMonth ? m.leads > prevMonth.leads : true;
                      const conversion = m.leads > 0 ? ((m.reuniones / m.leads) * 100).toFixed(1) : '0';

                      return (
                        <TableRow key={m.monthKey} className="border-border hover:bg-muted/30 transition-colors">
                          <TableCell className="font-black text-xs italic px-6 py-4 text-foreground">{m.name}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center gap-1">
                               <span className="font-black text-sm">{m.leads}</span>
                               <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                                 <div className="h-full bg-primary" style={{ width: `${Math.min(100, (m.leads / Math.max(...stats.monthlyComparison.map((x:any) => x.leads))) * 100)}%` }} />
                               </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center gap-1">
                               <span className="font-black text-sm">{m.reuniones}</span>
                               <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                                 <div className="h-full bg-primary/60" style={{ width: `${Math.min(100, (m.reuniones / Math.max(...stats.monthlyComparison.map((x:any) => x.reuniones))) * 100)}%` }} />
                               </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-black text-sm text-emerald-500">{m.cierres}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="text-[10px] font-black italic border-primary/20 text-primary bg-primary/5">{conversion}%</Badge>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <div className="flex items-center justify-end gap-1.5">
                              <div className={`h-1.5 w-1.5 rounded-full ${hasIncrease ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                              <span className={`text-[10px] font-black uppercase italic ${hasIncrease ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {hasIncrease ? 'Creciendo' : 'Estable'}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      case 'table-tags':
        return (
          <Card className="border border-border rounded-xl shadow-none bg-card h-full">
            <CardHeader className="border-b border-border px-6 py-4 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold text-foreground">Origen de Leads (Tags)</CardTitle>
              <Badge variant="outline" className="text-[10px] uppercase font-bold border-border">{stats.tagData.length} Canales</Badge>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-card z-10">
                    <tr className="border-b border-border">
                      <th className="py-2 text-[10px] font-bold text-muted-foreground uppercase">Canal / Tag</th>
                      <th className="py-2 text-[10px] font-bold text-muted-foreground uppercase text-right">Cantidad</th>
                      <th className="py-2 text-[10px] font-bold text-muted-foreground uppercase text-right">Impacto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {stats.tagData.map((tag) => (
                      <tr key={tag.name} className="group hover:bg-muted/30 transition-colors">
                        <td className="py-3 pr-4">
                           <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">{tag.name}</span>
                        </td>
                        <td className="py-3 text-right">
                          <span className="text-sm font-black text-foreground">{tag.value}</span>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[10px] font-bold text-primary">{tag.percentage}%</span>
                            <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary" 
                                style={{ width: `${tag.percentage}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {stats.tagData.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-10 text-center text-xs text-muted-foreground italic">
                          No hay datos de tags disponibles
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      case 'list-followups':
        return (
          <Card className="border border-border rounded-xl shadow-none bg-card h-full">
            <CardHeader className="border-b border-border px-6 py-4 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold text-foreground">Seguimientos Pendientes</CardTitle>
              <Badge className="bg-orange-950/40 text-orange-400 border border-orange-900/30">{pendingFollowUps.length}</Badge>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {pendingFollowUps.map(lead => (
                  <div key={lead.id} className="flex items-center gap-4 rounded-lg border border-border p-3 transition-all hover:border-orange-900/50 hover:bg-orange-950/10">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-orange-950/30 text-orange-500 border border-orange-900/30`}>
                      <Clock size={18} />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-bold text-foreground">{lead.name}</p>
                        <Badge variant="outline" className={`text-[9px] font-bold uppercase px-1.5 py-0 ${
                          lead.stage === 'setter' ? 'border-blue-900/50 text-blue-400' : 'border-purple-900/50 text-purple-400'
                        }`}>
                          {lead.stage === 'setter' ? 'Setter' : 'Comercial'}
                        </Badge>
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground font-medium">{lead.company} • {lead.interest}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-orange-500 font-bold uppercase tracking-wider">Pendiente</p>
                      <p className="text-[9px] text-muted-foreground font-medium">{lead.followUps?.length || 0} seg.</p>
                    </div>
                  </div>
                ))}
                {pendingFollowUps.length === 0 && (
                  <div className="flex h-40 flex-col items-center justify-center text-muted-foreground">
                    <CheckCircle2 size={32} className="mb-2 text-success opacity-20" />
                    <p className="text-sm font-medium">¡Todo al día!</p>
                    <p className="text-[11px]">No hay seguimientos pendientes para hoy.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      case 'list-activity':
        return (
          <Card className="border border-border rounded-xl shadow-none bg-card h-full">
            <CardHeader className="border-b border-border px-6 py-4 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold text-foreground">Actividad Reciente</CardTitle>
              <Zap size={16} className="text-primary animate-pulse" />
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {leads.slice(0, 6).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).map(lead => (
                  <div key={lead.id} className="flex items-center gap-4 rounded-lg border border-border p-3 transition-all hover:border-primary/20 hover:bg-muted/30">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${getStatusColor(lead.status)}`}>
                      <Users size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">{lead.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground font-medium">{lead.lastAction}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-muted-foreground font-black uppercase whitespace-nowrap">{formatDate(lead.updatedAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      case 'list-agenda':
        return (
          <Card className="border border-border rounded-xl shadow-none bg-card h-full">
            <CardHeader className="border-b border-border px-6 py-4">
              <CardTitle className="text-base font-bold text-foreground">Próximas Reuniones</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {meetings
                  .filter(m => m.status === 'scheduled' || m.status === 'pending')
                  .slice(0, 4)
                  .map(meeting => (
                    <div key={meeting.id} className="flex items-center gap-3 p-3 rounded-lg border border-border-dashed bg-muted/20">
                      <div className="flex flex-col items-center justify-center h-12 w-12 rounded bg-card border border-border">
                        <span className="text-[10px] font-black uppercase text-primary leading-none">{format(parseISO(meeting.date), 'MMM', { locale: es })}</span>
                        <span className="text-lg font-black leading-none">{format(parseISO(meeting.date), 'dd')}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">Reunión Lead</p>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium">
                          <Clock size={12} />
                          <span>{meeting.time} hs</span>
                        </div>
                      </div>
                      <Button size="icon-sm" variant="ghost" className="text-primary" onClick={() => (window as any).setActiveTab?.('meetings')}>
                        <ArrowRight size={14} />
                      </Button>
                    </div>
                  ))}
                {meetings.filter(m => m.status === 'scheduled' || m.status === 'pending').length === 0 && (
                  <div className="py-6 text-center">
                    <p className="text-xs text-muted-foreground italic">No hay reuniones próximas</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      case 'list-followups-simple':
        return (
          <Card className="border border-border rounded-xl shadow-none bg-card h-full">
            <CardHeader className="border-b border-border px-6 py-4 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold text-foreground italic flex items-center gap-2">
                <Target size={16} className="text-primary" />
                Seguimientos de Hoy
              </CardTitle>
              <Badge variant="outline" className="text-[10px] font-black border-primary/20 text-primary">{pendingFollowUps.length}</Badge>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {pendingFollowUps.slice(0, 5).map(lead => (
                  <div key={lead.id} className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/10 group hover:bg-primary/10 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black truncate">{lead.name}</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">{lead.company}</p>
                    </div>
                    <Button 
                      size="icon-sm" 
                      variant="ghost" 
                      className="text-primary rounded-full hover:bg-primary hover:text-white"
                      onClick={() => (window as any).setActiveTab?.('follow-ups')}
                    >
                      <ArrowRight size={16} />
                    </Button>
                  </div>
                ))}
                {pendingFollowUps.length === 0 && (
                  <div className="py-10 text-center space-y-2">
                    <CheckCircle2 size={32} className="mx-auto text-emerald-500 opacity-20" />
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none">Todo al día</p>
                  </div>
                )}
                {pendingFollowUps.length > 5 && (
                   <Button 
                    variant="ghost" 
                    className="w-full text-[10px] font-black uppercase text-primary"
                    onClick={() => (window as any).setActiveTab?.('follow-ups')}
                   >
                     Ver todos ({pendingFollowUps.length})
                   </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-10">
      {/* Modern Dashboard Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-3 rounded-2xl bg-primary shadow-[0_0_20px_rgba(var(--primary),0.4)] text-primary-foreground transform -rotate-3 transition-transform hover:rotate-0 cursor-pointer">
              <LayoutDashboard size={28} />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter text-foreground uppercase italic leading-none">Intelligence Hub</h1>
              <p className="text-[10px] font-black tracking-[0.3em] text-muted-foreground uppercase mt-1">Efecto Digital Business Intelligence</p>
            </div>
          </div>
          <p className="text-muted-foreground font-medium flex items-center gap-2">
            Visualizando flujo de <Badge variant="secondary" className="px-3 rounded-full font-black text-[10px] text-primary bg-primary/10 border-primary/20 uppercase tracking-wider">{getPeriodLabel(dateMode, selectedMonth, dateRange)}</Badge>
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 bg-card/60 backdrop-blur-xl p-2 rounded-3xl border border-border shadow-md">
           <div className="flex bg-muted rounded-2xl p-1">
            <button 
              onClick={() => setDateMode('month')} 
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${dateMode === 'month' ? 'bg-background text-primary shadow-lg scale-105' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Vista Mensual
            </button>
            <button 
              onClick={() => setDateMode('range')} 
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${dateMode === 'range' ? 'bg-background text-primary shadow-lg scale-105' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Rango Libre
            </button>
          </div>
          
          <div className="h-10 w-px bg-border mx-2" />
          
          <div className="flex items-center gap-3">
             <Button 
                variant="outline" 
                size="sm" 
                onClick={() => (window as any).setActiveTab?.('follow-ups')}
                className="h-11 px-6 rounded-2xl font-black text-[10px] uppercase gap-2 transition-all border-dashed hover:border-primary hover:bg-primary/5 text-primary"
             >
               <Target size={14} />
               Centro de Seguimiento
             </Button>
             <Button 
                variant={isComparing ? "secondary" : "outline"} 
                size="sm" 
                onClick={() => setIsComparing(!isComparing)}
                className={`h-11 px-6 rounded-2xl font-black text-[10px] uppercase gap-2 transition-all border-2 ${isComparing ? 'bg-primary/10 border-primary text-primary shadow-[0_0_15px_rgba(var(--primary),0.2)]' : 'border-dashed hover:border-primary'}`}
             >
               <TrendingUp size={14} className={isComparing ? "animate-bounce" : ""} />
               {isComparing ? 'Modo Comparativo' : 'Comparar Periodos'}
             </Button>
          </div>
        </div>
      </div>

      {isComparing && (
        <div className="bg-primary/5 border border-primary/20 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-8 animate-in slide-in-from-top-6 duration-700 ease-out">
          <div className="flex items-center gap-6">
             <div className="p-4 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20 transform hover:scale-110 transition-transform">
                <TrendingUp size={32} />
             </div>
             <div>
                <p className="text-xs font-black uppercase text-primary tracking-[0.2em] leading-none mb-1">Análisis Comparativo Estratégico</p>
                <p className="text-sm font-bold text-muted-foreground italic">Comparando con {getPeriodLabel(dateMode, compareMonth, compareRange)}</p>
             </div>
          </div>
          
          <div className="flex items-center gap-4 bg-background/50 backdrop-blur-md p-3 rounded-2xl border border-border">
            {dateMode === 'month' ? (
              <div className="flex items-center gap-2">
                <Select value={compareMonth.split('-')[1]} onValueChange={(m) => setCompareMonth(`${compareMonth.split('-')[0]}-${m}`)}>
                  <SelectTrigger className="w-[120px] h-10 rounded-xl bg-background border-none font-black text-[10px] uppercase">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS_LIST.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={compareMonth.split('-')[0]} onValueChange={(y) => setCompareMonth(`${y}-${compareMonth.split('-')[1]}`)}>
                  <SelectTrigger className="w-[100px] h-10 rounded-xl bg-background border-none font-black text-[10px] uppercase">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map(y => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
                <div className="flex items-center gap-3">
                  <DatePicker date={compareRange.start} setDate={(d) => setCompareRange(prev => ({...prev, start: d}))} className="h-10 rounded-xl" />
                  <div className="w-4 h-0.5 bg-border rounded-full" />
                  <DatePicker date={compareRange.end} setDate={(d) => setCompareRange(prev => ({...prev, end: d}))} className="h-10 rounded-xl" />
                </div>
            )}
          </div>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <SortableContext items={widgetOrder.slice(0, 4)} strategy={rectSortingStrategy}>
            {widgetOrder.slice(0, 4).map((id) => (
              <SortableWidget key={id} id={id}>
                {renderWidget(id)}
              </SortableWidget>
            ))}
          </SortableContext>
        </div>

        {/* Dedicated Historical Section */}
        <div className="space-y-6 pt-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black tracking-tighter text-foreground uppercase italic leading-none">Análisis Histórico Proyectado</h2>
              <p className="text-[10px] font-black tracking-[0.2em] text-muted-foreground uppercase mt-1">Evolución comercial de los últimos 12 meses</p>
            </div>
            <div className="flex items-center gap-3">
               <Button 
                variant="outline" 
                size="sm" 
                onClick={async () => {
                  try {
                    const isDemo = (window as any).isDemoMode || !isFirebaseConfigured;
                    const demoLead = {
                      id: "demo-applica-lead-" + Date.now(),
                      name: "Marcos de Applica",
                      company: "Applica S.A.",
                      country: "España",
                      interest: "Optimización de Flujo de Leads",
                      contactInfo: "marcos@applica.io",
                      sector: "Tecnología",
                      status: "new",
                      stage: 'setter',
                      followUps: [],
                      meetings: [],
                      followUpSequence: 0,
                      nextFollowUpDate: new Date().toISOString().split('T')[0], // Today!
                      lastAction: "Nuevo lead ingresado para pruebas",
                      isActive: true,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    };

                    if (isDemo) {
                      const storedLeads = localStorage.getItem('demo-leads');
                      const leads = storedLeads ? JSON.parse(storedLeads) : [];
                      
                      // Ensure we have a client to assign it to
                      const storedClients = localStorage.getItem('demo-clients');
                      let clients = storedClients ? JSON.parse(storedClients) : [];
                      let applicaClient = clients.find((c: any) => c.name.includes("Applica"));
                      
                      if (!applicaClient) {
                        applicaClient = {
                          id: "client-applica-demo",
                          name: "Applica Project",
                          description: "Cliente de prueba para visualización de seguimientos",
                          createdAt: new Date().toISOString(),
                          availableTags: ["Alta Prioridad", "Demo"],
                          accountManagerId: profile?.uid || 'u-azul'
                        };
                        clients.push(applicaClient);
                        localStorage.setItem('demo-clients', JSON.stringify(clients));
                        window.dispatchEvent(new CustomEvent('demo-clients-updated'));
                      }
                      
                      leads.push({ ...demoLead, clientId: applicaClient.id });
                      localStorage.setItem('demo-leads', JSON.stringify(leads));
                      window.dispatchEvent(new CustomEvent('demo-leads-updated'));
                      toast.success("Lead de Applica generado con éxito. Revisa el Centro de Seguimientos.");
                    } else {
                      // Real mode
                      const clientsSnap = await getDocs(query(collection(db, 'clients'), where('name', '==', 'Applica Project')));
                      let clientId = "";
                      
                      if (clientsSnap.empty) {
                        const newClient = await addDoc(collection(db, 'clients'), {
                          name: "Applica Project",
                          description: "Cliente de prueba para visualización de seguimientos",
                          createdAt: new Date().toISOString(),
                          availableTags: ["Alta Prioridad", "Demo"],
                          accountManagerId: profile?.uid || 'u-azul'
                        });
                        clientId = newClient.id;
                      } else {
                        clientId = clientsSnap.docs[0].id;
                      }
                      
                      await addDoc(collection(db, 'leads'), { ...demoLead, clientId });
                      toast.success("Lead de Applica generado en Firebase. Revisa el Centro de Seguimientos.");
                    }
                  } catch (error) {
                    console.error(error);
                    toast.error("Error al generar lead de prueba");
                  }
                }}
                className="h-11 px-6 rounded-2xl font-black text-[10px] uppercase gap-2 transition-all border-dashed border-amber-500/50 hover:border-amber-500 hover:bg-amber-500/5 text-amber-500"
               >
                 <Zap size={14} />
                 Generar Lead de Prueba (Applica)
               </Button>
               <div className="h-8 w-px bg-border mx-1" />
               <div className="px-4 py-2 text-[10px] font-black text-primary uppercase bg-muted rounded-2xl">Filtro histórico: 1 Año</div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {renderWidget('chart-historical-leads')}
            {renderWidget('chart-historical-meetings')}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mt-10">
          <SortableContext items={widgetOrder.slice(4)} strategy={rectSortingStrategy}>
            {widgetOrder.slice(4).map((id) => (
              // Filter out the historical charts since they are now in a dedicated section
              (id !== 'chart-historical-leads' && id !== 'chart-historical-meetings') && (
                <SortableWidget key={id} id={id} fullWidth={id === 'chart-sectors' || id === 'widget-ai' || id === 'chart-funnel' || id === 'chart-histogram'}>
                  {renderWidget(id)}
                </SortableWidget>
              )
            ))}
          </SortableContext>
        </div>
      </DndContext>
    </div>
  );
}

interface SortableWidgetProps {
  id: string;
  children: React.ReactNode;
  fullWidth?: boolean;
  key?: string | number;
}

function SortableWidget({ id, children, fullWidth }: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    gridColumn: fullWidth ? 'span 2 / span 2' : undefined
  };

  return (
    <div ref={setNodeRef} style={style} className={cn("relative group h-full", isDragging && "opacity-50")}>
      <div 
        {...attributes} 
        {...listeners}
        className="absolute top-2 right-2 z-20 p-1 bg-muted/80 rounded border border-border opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <GripVertical size={14} className="text-muted-foreground" />
      </div>
      {children}
    </div>
  );
}

function StatCard({ title, value, icon, description, trend, valueColor = "text-foreground" }: { 
  title: string; 
  value: string | number; 
  icon: React.ReactNode; 
  description: string;
  trend?: { label: string; positive: boolean };
  valueColor?: string;
}) {
  return (
    <Card className="relative overflow-hidden border border-border/40 shadow-sm hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-500 bg-card/60 backdrop-blur-xl group rounded-3xl h-full">
      <CardContent className="p-7">
        <div className="flex items-start justify-between relative z-10">
          <div className="flex-1 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/80">{title}</p>
            <div className="flex items-baseline gap-2">
              <h3 className={cn("text-4xl font-black tracking-tighter", valueColor)}>{value}</h3>
              {trend && (
                <div className={cn(
                  "flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full",
                  trend.positive ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                )}>
                  {trend.positive ? "↑" : "↓"} {trend.label}
                </div>
              )}
            </div>
            <p className="text-xs font-bold text-muted-foreground leading-relaxed italic">{description}</p>
          </div>
          <div className="p-4 rounded-2xl bg-muted/30 group-hover:bg-primary/10 group-hover:scale-110 transition-all duration-500 border border-border/50">
            {icon}
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute -bottom-6 -right-6 h-24 w-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors duration-700" />
      </CardContent>
    </Card>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case 'new': return 'bg-blue-950/30 text-blue-400 border border-blue-900/30';
    case 'contacted': return 'bg-indigo-950/30 text-indigo-400 border border-indigo-900/30';
    case 'follow-up': return 'bg-orange-950/30 text-orange-400 border border-orange-900/30';
    case 'meeting-scheduled': return 'bg-purple-950/30 text-purple-400 border border-purple-900/30';
    case 'qualified': return 'bg-emerald-500 text-white border border-emerald-400';
    case 'closed-won': return 'bg-green-950/30 text-green-400 border border-green-900/30';
    case 'closed-lost': return 'bg-red-950/30 text-red-400 border border-red-900/30';
    case 'not-interested': return 'bg-slate-900/50 text-slate-500 border border-slate-800';
    default: return 'bg-muted text-muted-foreground border border-border';
  }
}
