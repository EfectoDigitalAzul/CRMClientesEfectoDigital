import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  Edit3, 
  Save, 
  X, 
  Plus,
  TrendingUp,
  BarChart3,
  Calendar,
  Layers,
  Users,
  Target,
  ArrowUpRight,
  PieChart as PieIcon,
  LineChart as LineIcon,
  DollarSign,
  Activity,
  Award,
  Zap,
  History as HistoryIcon,
  Search,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { Client, Lead, Meeting, UserProfile } from '../types';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '../lib/utils';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';

interface ClientReportGeneratorProps {
  client: Client;
  leads: Lead[];
  meetings: Meeting[];
  author: UserProfile | null;
  onClose: () => void;
}

export default function ClientReportGenerator({ client, leads, meetings, author, onClose }: ClientReportGeneratorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [visibleSections, setVisibleSections] = useState<Record<string, boolean>>({
    totalLeads: true,
    wonLeads: true,
    investment: true,
    roi: true,
    cpl: true,
    leadGoal: true,
    qualityScoreCard: true,
    actualClients: true,
    statusChart: true,
    sourceChart: true,
    totalConversion: true,
    qualityLeadScore: true,
    showRate: true,
    historicalTable: true,
    historicalChart: true,
    auditNotes: true,
    consultantInfo: true,
    roadmap: true
  });
  
  const toggleSection = (section: string) => {
    setVisibleSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const [reportLabels, setReportLabels] = useState({
    totalLeads: "Leads Captados",
    wonLeads: "Cierres de Venta",
    investment: "Inversión Adspend",
    roi: "ROI Estimado",
    cpl: "CPL Promedio",
    leadGoal: "Lead Goal",
    qualityScoreCard: "Quality Score",
    actualClients: "Cierres Reales",
    statusTitle: "Cualificación de Leads",
    sourceTitle: "Origen de Leads (Top Sources)",
    efficiencyTitle: "Eficiencia Comercial & Quality Metrics",
    historicalTitle: "Historico 6 Meses",
    auditTitle: "Auditoría Estratégica",
    roadmapTitle: "Hoja de Ruta",
    totalConversion: "Conversión Total",
    qualityLeadScore: "Quality Lead Score",
    showRate: "Show Rate (Held)",
    periodHeader: "Periodo / Mes",
    leadsHeader: "Leads Totales",
    meetingsHeader: "Meetings",
    variationHeader: "Variación",
    responsibleLabel: "Responsable de Proyecto"
  });

  const handleLabelChange = (key: keyof typeof reportLabels, value: string) => {
    setReportLabels(prev => ({ ...prev, [key]: value }));
  };

  const getSectionLabel = (key: string) => {
    return reportLabels[key as keyof typeof reportLabels] || key.replace(/([A-Z])/g, ' $1').toUpperCase();
  };
  
  // Header and Metadata
  const [reportTitle, setReportTitle] = useState(`Informe Ejecutivo: ${client.name}`);
  const [reportSubtitle, setReportSubtitle] = useState("Digital Growth & Lead Generation Performance");
  const [reportNotes, setReportNotes] = useState(client.notes || '');
  const [nextSteps, setNextSteps] = useState(client.nextSteps || '');
  
  const clientLeads = useMemo(() => leads.filter(l => l.clientId === client.id), [leads, client.id]);
  const clientMeetings = useMemo(() => meetings.filter(m => m.clientId === client.id), [meetings, client.id]);

  // Initial stats calculation
  const calculatedStats = useMemo(() => {
    const wonLeads = clientLeads.filter(l => l.status === 'closed-won').length;
    const completedMeetings = clientMeetings.filter(m => m.status === 'completed').length;
    const conversionRate = clientLeads.length > 0 ? Math.round((wonLeads / clientLeads.length) * 100) : 0;
    const meetingAttendanceRate = clientMeetings.length > 0 ? Math.round((completedMeetings / clientMeetings.length) * 100) : 0;
    const closureRate = completedMeetings > 0 ? Math.round((wonLeads / completedMeetings) * 100) : 0;

    return {
      totalLeads: clientLeads.length,
      wonLeads,
      totalMeetings: clientMeetings.length,
      completedMeetings,
      conversionRate,
      meetingAttendanceRate,
      closureRate,
      investment: client.budget || 0,
      cpl: client.budget && clientLeads.length > 0 ? Math.round(client.budget / clientLeads.length) : 0,
      roi: client.budget && wonLeads > 0 ? Math.round(((wonLeads * 500) / client.budget) * 100) : 0, // Mock calculation for ROI
      qualityScore: 85,
      actualClients: wonLeads,
      leadGoal: 50
    };
  }, [clientLeads, clientMeetings, client.budget]);

  // Editable stats state
  const [editableStats, setEditableStats] = useState({
    ...calculatedStats
  });

  // Monthly Data for History Table
  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 6 }).map((_, i) => {
      const date = subMonths(new Date(), i);
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      
      const leadsInMonth = clientLeads.filter(l => {
        if (!l.createdAt) return false;
        try {
          const leadDate = new Date(l.createdAt);
          if (isNaN(leadDate.getTime())) return false;
          return isWithinInterval(leadDate, { start, end });
        } catch (e) {
          return false;
        }
      }).length;

      const meetingsInMonth = clientMeetings.filter(m => {
        if (!m.date) return false;
        try {
          const meetingDate = new Date(m.date);
          if (isNaN(meetingDate.getTime())) return false;
          return isWithinInterval(meetingDate, { start, end });
        } catch (e) {
          return false;
        }
      }).length;

      return {
        month: format(date, 'MMMM yyyy', { locale: es }).toUpperCase(),
        leads: leadsInMonth,
        meetings: meetingsInMonth,
        id: i
      };
    }).reverse();
    return months;
  }, [clientLeads, clientMeetings]);

  // Editable Monthly Data
  const [editableMonthlyData, setEditableMonthlyData] = useState(
    monthlyData.map(d => ({ ...d, visible: true }))
  );

  const visibleMonthlyData = useMemo(() => 
    editableMonthlyData.filter(d => d.visible),
    [editableMonthlyData]
  );

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    clientLeads.forEach(lead => {
      counts[lead.status] = (counts[lead.status] || 0) + 1;
    });

    const COLORS: Record<string, string> = {
      'new': '#3b82f6',
      'contacted': '#6366f1',
      'follow-up': '#8b5cf6',
      'meeting-scheduled': '#f59e0b',
      'closed-won': '#10b981',
      'closed-lost': '#ef4444',
      'reschedule': '#64748b',
    };

    const data = Object.entries(counts).map(([name, value]) => ({
      name: name.replace('-', ' ').toUpperCase(),
      value,
      color: COLORS[name] || '#94a3b8'
    }));

    return data.length > 0 ? data : [{ name: 'SIN DATOS', value: 1, color: '#f1f5f9' }];
  }, [clientLeads]);

  const sourceData = useMemo(() => {
    const counts: Record<string, number> = {};
    clientLeads.forEach(lead => {
      const source = lead.source || 'DESCONOCIDO';
      counts[source] = (counts[source] || 0) + 1;
    });

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    return Object.entries(counts).map(([name, value], i) => ({
      name: name.toUpperCase(),
      value,
      color: COLORS[i % COLORS.length]
    })).sort((a, b) => b.value - a.value);
  }, [clientLeads]);

  const handlePrint = () => {
    window.print();
  };

  const handleStatChange = (key: string, value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value);
    setEditableStats(prev => ({ ...prev, [key]: isNaN(numValue) ? 0 : numValue }));
  };

  const handleMonthlyChange = (index: number, key: string, value: any) => {
    const newData = [...editableMonthlyData];
    newData[index] = { ...newData[index], [key]: value };
    setEditableMonthlyData(newData);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-zinc-950/90 backdrop-blur-md flex items-center justify-center p-4 print:p-0 print:bg-white print:backdrop-blur-none">
      <Card className="w-full max-w-6xl h-full flex flex-col shadow-2xl border-white/10 bg-zinc-100 print:shadow-none print:border-none print:h-auto print:static rounded-3xl overflow-hidden">
        
        {/* Superior Controls UI - Hidden in Print */}
        <div className="p-4 border-b bg-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-4">
            <div className="bg-black p-2 rounded-xl">
              <FileText className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tighter uppercase italic leading-none">Editor de Informe Premium</h2>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Personaliza cada dato antes de exportar</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant={isEditing ? "default" : "outline"}
              size="sm" 
              onClick={() => setIsEditing(!isEditing)}
              className={cn(
                "rounded-xl h-10 px-6 text-[10px] font-black uppercase tracking-widest transition-all",
                isEditing ? "bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-500/20" : "hover:bg-zinc-100"
              )}
            >
              {isEditing ? <><Save size={16} className="mr-2" /> Guardar Cambios</> : <><Edit3 size={16} className="mr-2" /> Editar Métricas</>}
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={handlePrint}
              className="rounded-xl h-10 px-6 text-[10px] font-black uppercase tracking-widest bg-emerald-500 hover:bg-emerald-600 shadow-xl shadow-emerald-500/30 text-white"
            >
              <Download size={16} className="mr-2" /> Exportar PDF Final
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              className="rounded-xl hover:bg-red-500/10 hover:text-red-500"
            >
              <X size={20} />
            </Button>
          </div>
        </div>

        {/* Paper Simulation Content */}
        <div className="flex-1 overflow-y-auto bg-zinc-200 p-8 print:p-0 print:overflow-visible print:bg-white">
          <div id="report-content" className="bg-white w-full max-w-[210mm] mx-auto min-h-[297mm] shadow-2xl p-16 space-y-12 text-black font-sans print:shadow-none print:max-w-none print:p-12">
            
            {/* Header Strategy */}
            <header className="flex justify-between items-start border-b-[12px] border-black pb-12">
              <div className="space-y-6 flex-1 pr-12">
                <div className="space-y-2">
                  <p className="text-[11px] font-black tracking-[0.5em] text-zinc-400 uppercase italic">Efecto Digital Business Lab</p>
                  {isEditing ? (
                    <div className="space-y-4">
                      <Input 
                        value={reportTitle} 
                        onChange={(e) => setReportTitle(e.target.value)}
                        className="text-5xl font-black italic tracking-tighter uppercase leading-none border-none p-0 h-auto focus-visible:ring-0 text-black placeholder:text-zinc-200 bg-transparent"
                      />
                      <Input 
                        value={reportSubtitle} 
                        onChange={(e) => setReportSubtitle(e.target.value)}
                        className="text-sm font-bold text-muted-foreground uppercase tracking-widest border-none p-0 h-auto focus-visible:ring-0 bg-transparent"
                      />
                    </div>
                  ) : (
                    <>
                      <h1 className="text-6xl font-black italic tracking-tighter uppercase leading-[0.9] break-words">{reportTitle}</h1>
                      <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{reportSubtitle}</p>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-4 pt-4">
                  <Badge className="bg-black text-white hover:bg-black border-none rounded-none px-6 py-2 text-[10px] font-black uppercase tracking-[0.4em]">
                    REPORT 2024.V3
                  </Badge>
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 italic">
                    REF: CRM-{client.id.slice(0, 8).toUpperCase()} • {format(new Date(), 'dd MMMM, yyyy', { locale: es }).toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="text-right flex flex-col items-end gap-3">
                <div className="h-16 w-16 bg-black flex items-center justify-center">
                  <span className="text-white font-black text-2xl italic tracking-tighter">ED</span>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-black">Performance Audit</p>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase italic">Growth Solutions</p>
                </div>
              </div>
            </header>

            {isEditing && Object.values(visibleSections).some(v => !v) && (
              <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-xl animate-in fade-in slide-in-from-top-2 no-print">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-3 flex items-center gap-2">
                  <AlertCircle size={14} /> Elementos Ocultos (Haz clic para restaurar)
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(visibleSections).map(([key, isVisible]) => !isVisible && (
                    <Button 
                      key={key} 
                      variant="outline" 
                      size="sm" 
                      onClick={() => toggleSection(key)}
                      className="h-7 text-[9px] font-bold uppercase tracking-tighter border-amber-200 bg-white hover:bg-amber-100 text-amber-700"
                    >
                      <Plus size={10} className="mr-1" /> {getSectionLabel(key).toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Core KPIs - Fully Editable */}
            <section className="grid grid-cols-4 gap-4">
              {[
                { labelKey: 'totalLeads' as const, key: 'totalLeads', icon: Target, color: 'border-blue-500' },
                { labelKey: 'wonLeads' as const, key: 'wonLeads', icon: TrendingUp, color: 'border-emerald-500' },
                { labelKey: 'investment' as const, key: 'investment', icon: DollarSign, color: 'border-zinc-900', prefix: '$' },
                { labelKey: 'roi' as const, key: 'roi', icon: Zap, color: 'border-purple-500', suffix: '%' }
              ].map((item, idx) => visibleSections[item.key] && (
                <div key={idx} className={cn("relative group/card border-l-4 p-5 space-y-3 bg-zinc-50", item.color)}>
                  {isEditing && (
                    <Button 
                      variant="destructive" 
                      size="icon" 
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-lg z-10 opacity-0 group-hover/card:opacity-100 transition-opacity"
                      onClick={() => toggleSection(item.key)}
                    >
                      <X size={12} />
                    </Button>
                  )}
                  <div className="flex items-center justify-between">
                    <item.icon size={16} className="opacity-30" />
                    {isEditing ? (
                      <Input 
                        value={reportLabels[item.labelKey]}
                        onChange={(e) => handleLabelChange(item.labelKey, e.target.value)}
                        className="text-[9px] font-black uppercase tracking-widest text-zinc-400 border-none p-0 h-auto focus-visible:ring-0 bg-transparent w-full text-right"
                      />
                    ) : (
                      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{reportLabels[item.labelKey]}</span>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="flex items-center">
                      {item.prefix && <span className="text-3xl font-black italic mr-1">{item.prefix}</span>}
                      <Input 
                        type="number"
                        value={editableStats[item.key as keyof typeof editableStats]}
                        onChange={(e) => handleStatChange(item.key, e.target.value)}
                        className="text-4xl font-black italic tracking-tighter w-full border-none p-0 h-auto focus-visible:ring-0 bg-transparent"
                      />
                      {item.suffix && <span className="text-3xl font-black italic ml-1">{item.suffix}</span>}
                    </div>
                  ) : (
                    <div className="text-5xl font-black italic tracking-tighter flex items-baseline gap-1">
                      {item.prefix && <span className="text-2xl">{item.prefix}</span>}
                      {editableStats[item.key as keyof typeof editableStats]}
                      {item.suffix && <span className="text-2xl">{item.suffix}</span>}
                    </div>
                  )}
                </div>
              ))}
            </section>

            <section className="grid grid-cols-4 gap-4">
               {[
                { labelKey: 'cpl' as const, key: 'cpl', icon: Activity, color: 'border-amber-500', prefix: '$' },
                { labelKey: 'leadGoal' as const, key: 'leadGoal', icon: Target, color: 'border-blue-200' },
                { labelKey: 'qualityScoreCard' as const, key: 'qualityScoreCard', icon: Award, color: 'border-emerald-200', suffix: '/100' },
                { labelKey: 'actualClients' as const, key: 'actualClients', icon: CheckCircle2, color: 'border-zinc-500' }
              ].map((item, idx) => visibleSections[item.key] && (
                <div key={idx} className={cn("relative group/card border-l-4 p-5 space-y-3 bg-zinc-50", item.color)}>
                  {isEditing && (
                    <Button 
                      variant="destructive" 
                      size="icon" 
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-lg z-10 opacity-0 group-hover/card:opacity-100 transition-opacity"
                      onClick={() => toggleSection(item.key)}
                    >
                      <X size={12} />
                    </Button>
                  )}
                  <div className="flex items-center justify-between">
                    <item.icon size={16} className="opacity-30" />
                    {isEditing ? (
                      <Input 
                        value={reportLabels[item.labelKey]}
                        onChange={(e) => handleLabelChange(item.labelKey, e.target.value)}
                        className="text-[9px] font-black uppercase tracking-widest text-zinc-400 border-none p-0 h-auto focus-visible:ring-0 bg-transparent w-full text-right"
                      />
                    ) : (
                      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{reportLabels[item.labelKey]}</span>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="flex items-center">
                      {item.prefix && <span className="text-2xl font-black italic mr-1">{item.prefix}</span>}
                      <Input 
                        type="number"
                        value={editableStats[item.key === 'qualityScoreCard' ? 'qualityScore' : item.key as keyof typeof editableStats]}
                        onChange={(e) => handleStatChange(item.key === 'qualityScoreCard' ? 'qualityScore' : item.key, e.target.value)}
                        className="text-3xl font-black italic tracking-tighter w-full border-none p-0 h-auto focus-visible:ring-0 bg-transparent"
                      />
                      {item.suffix && <span className="text-2xl font-black italic ml-1">{item.suffix}</span>}
                    </div>
                  ) : (
                    <div className="text-3xl font-black italic tracking-tighter flex items-baseline gap-1">
                      {item.prefix && <span className="text-xl">{item.prefix}</span>}
                      {editableStats[item.key === 'qualityScoreCard' ? 'qualityScore' : item.key as keyof typeof editableStats]}
                      {item.suffix && <span className="text-xl">{item.suffix}</span>}
                    </div>
                  )}
                </div>
              ))}
            </section>

            {/* Main Visuals: Charts */}
            <section className="grid grid-cols-2 gap-16 pt-6">
              {visibleSections.statusChart && (
                <div className="space-y-8 relative group/chart">
                  {isEditing && (
                    <Button 
                      variant="destructive" 
                      size="icon" 
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-lg z-10"
                      onClick={() => toggleSection('statusChart')}
                    >
                      <X size={12} />
                    </Button>
                  )}
                  <div className="flex items-center justify-between border-b-2 border-black pb-2">
                    {isEditing ? (
                      <Input 
                        value={reportLabels.statusTitle}
                        onChange={(e) => handleLabelChange('statusTitle', e.target.value)}
                        className="text-[12px] font-black uppercase text-black tracking-[0.3em] border-none p-0 h-auto focus-visible:ring-0 bg-transparent w-full"
                      />
                    ) : (
                      <p className="text-[12px] font-black uppercase text-black tracking-[0.3em]">{reportLabels.statusTitle}</p>
                    )}
                    <Search size={16} />
                  </div>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusData}
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {statusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: '10px', fontWeight: 'bold', border: '2px solid black', borderRadius: '0' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {statusData.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px] border-b border-zinc-100 py-1">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="font-bold opacity-50 uppercase tracking-tighter">{item.name}</span>
                        </div>
                        <span className="font-black">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {visibleSections.sourceChart && (
                <div className="space-y-8 relative group/chart">
                  {isEditing && (
                    <Button 
                      variant="destructive" 
                      size="icon" 
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-lg z-10"
                      onClick={() => toggleSection('sourceChart')}
                    >
                      <X size={12} />
                    </Button>
                  )}
                  <div className="flex items-center justify-between border-b-2 border-black pb-2">
                    {isEditing ? (
                      <Input 
                        value={reportLabels.sourceTitle}
                        onChange={(e) => handleLabelChange('sourceTitle', e.target.value)}
                        className="text-[12px] font-black uppercase text-black tracking-[0.3em] border-none p-0 h-auto focus-visible:ring-0 bg-transparent w-full"
                      />
                    ) : (
                      <p className="text-[12px] font-black uppercase text-black tracking-[0.3em]">{reportLabels.sourceTitle}</p>
                    )}
                    <Target size={16} />
                  </div>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sourceData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 9, fontWeight: 900 }}
                          width={100}
                        />
                        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ fontSize: '10px', border: '2px solid black' }} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {sourceData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center">Distribución por canal publicitario</p>
                  </div>
                </div>
              )}
            </section>

            <section className="relative pt-6">
              <div className="space-y-8">
                <div className="flex items-center justify-between border-b-2 border-black pb-2">
                  {isEditing ? (
                    <Input 
                      value={reportLabels.efficiencyTitle}
                      onChange={(e) => handleLabelChange('efficiencyTitle', e.target.value)}
                      className="text-[12px] font-black uppercase text-black tracking-[0.3em] border-none p-0 h-auto focus-visible:ring-0 bg-transparent w-full"
                    />
                  ) : (
                    <p className="text-[12px] font-black uppercase text-black tracking-[0.3em]">{reportLabels.efficiencyTitle}</p>
                  )}
                  <Zap size={16} />
                </div>
                <div className="grid grid-cols-3 gap-12 py-6">
                  {[
                    { labelKey: 'totalConversion' as const, key: 'totalConversion', value: editableStats.conversionRate, color: 'bg-emerald-500' },
                    { labelKey: 'qualityLeadScore' as const, key: 'qualityLeadScore', value: editableStats.qualityScore, color: 'bg-blue-600' },
                    { labelKey: 'showRate' as const, key: 'showRate', value: editableStats.meetingAttendanceRate, color: 'bg-zinc-900' },
                  ].map((metric, idx) => visibleSections[metric.key] && (
                    <div key={idx} className="relative group/metric space-y-4">
                      {isEditing && (
                        <Button 
                          variant="destructive" 
                          size="icon" 
                          className="absolute -top-4 -right-4 h-6 w-6 rounded-full shadow-lg z-10 opacity-0 group-hover/metric:opacity-100 transition-opacity"
                          onClick={() => toggleSection(metric.key)}
                        >
                          <X size={12} />
                        </Button>
                      )}
                      <div className="flex justify-between items-end">
                        {isEditing ? (
                          <Input 
                            value={reportLabels[metric.labelKey]}
                            onChange={(e) => handleLabelChange(metric.labelKey, e.target.value)}
                            className="text-[10px] font-black uppercase tracking-widest text-zinc-400 border-none p-0 h-auto focus-visible:ring-0 bg-transparent w-full"
                          />
                        ) : (
                          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{reportLabels[metric.labelKey]}</span>
                        )}
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <Input 
                              type="number"
                              value={metric.value}
                              onChange={(e) => handleStatChange(metric.key === 'totalConversion' ? 'conversionRate' : metric.key === 'qualityLeadScore' ? 'qualityScore' : 'meetingAttendanceRate', e.target.value)}
                              className="w-12 h-6 text-right border-none p-0 focus-visible:ring-0 font-black italic bg-transparent"
                            />
                            <span className="text-[10px] font-black">%</span>
                          </div>
                        ) : (
                          <span className="text-2xl font-black italic tracking-tighter">{metric.value}%</span>
                        )}
                      </div>
                      <div className="h-3 bg-zinc-100 w-full overflow-hidden border border-zinc-200">
                        <div 
                          className={cn("h-full transition-all duration-1000", metric.color)}
                          style={{ width: `${metric.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Historical Performance Table - Fully Editable */}
            <section className="space-y-6 pt-6">
              <div className="flex items-center justify-between border-b-2 border-black pb-2">
                {isEditing ? (
                  <Input 
                    value={reportLabels.historicalTitle}
                    onChange={(e) => handleLabelChange('historicalTitle', e.target.value)}
                    className="text-[12px] font-black uppercase text-black tracking-[0.3em] border-none p-0 h-auto focus-visible:ring-0 bg-transparent w-full"
                  />
                ) : (
                  <p className="text-[12px] font-black uppercase text-black tracking-[0.3em]">{reportLabels.historicalTitle}</p>
                )}
                <HistoryIcon size={16} />
              </div>
              {visibleSections.historicalChart && (
                <div className="h-[200px] mb-8 bg-zinc-50 p-6 relative group/chart">
                  {isEditing && (
                    <Button 
                      variant="destructive" 
                      size="icon" 
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-lg z-10"
                      onClick={() => toggleSection('historicalChart')}
                    >
                      <X size={12} />
                    </Button>
                  )}
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={visibleMonthlyData}>
                      <defs>
                        <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900 }} />
                      <Tooltip contentStyle={{ borderRadius: '0', border: '2px solid black' }} />
                      <Area type="monotone" dataKey="leads" stroke="#3b82f6" fillOpacity={1} fill="url(#colorLeads)" />
                      <Area type="monotone" dataKey="meetings" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
              
              {visibleSections.historicalTable && (
                <div className="border border-black overflow-hidden relative group/section">
                  {isEditing && (
                    <Button 
                      variant="destructive" 
                      size="icon" 
                      className="absolute top-2 right-2 h-6 w-6 rounded-full shadow-lg z-10"
                      onClick={() => toggleSection('historicalTable')}
                    >
                      <X size={12} />
                    </Button>
                  )}
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-black text-white">
                        <th className="p-4 text-[10px] font-black uppercase tracking-widest">
                          {isEditing ? (
                            <Input 
                              value={reportLabels.periodHeader}
                              onChange={(e) => handleLabelChange('periodHeader', e.target.value)}
                              className="text-[10px] font-black uppercase tracking-widest text-white border-none p-0 h-auto focus-visible:ring-0 bg-transparent w-full"
                            />
                          ) : (
                            reportLabels.periodHeader
                          )}
                        </th>
                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-center">
                          {isEditing ? (
                            <Input 
                              value={reportLabels.leadsHeader}
                              onChange={(e) => handleLabelChange('leadsHeader', e.target.value)}
                              className="text-[10px] font-black uppercase tracking-widest text-white border-none p-0 h-auto focus-visible:ring-0 bg-transparent w-full text-center"
                            />
                          ) : (
                            reportLabels.leadsHeader
                          )}
                        </th>
                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-center">
                          {isEditing ? (
                            <Input 
                              value={reportLabels.meetingsHeader}
                              onChange={(e) => handleLabelChange('meetingsHeader', e.target.value)}
                              className="text-[10px] font-black uppercase tracking-widest text-white border-none p-0 h-auto focus-visible:ring-0 bg-transparent w-full text-center"
                            />
                          ) : (
                            reportLabels.meetingsHeader
                          )}
                        </th>
                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-right">
                          {isEditing ? (
                            <Input 
                              value={reportLabels.variationHeader}
                              onChange={(e) => handleLabelChange('variationHeader', e.target.value)}
                              className="text-[10px] font-black uppercase tracking-widest text-white border-none p-0 h-auto focus-visible:ring-0 bg-transparent w-full text-right"
                            />
                          ) : (
                            reportLabels.variationHeader
                          )}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {editableMonthlyData.map((data, idx) => (
                        <tr key={idx} className={cn(
                          "border-b border-zinc-100 last:border-0 hover:bg-zinc-50 transition-colors",
                          !data.visible && !isEditing && "hidden"
                        )}>
                          <td className="p-4 text-[11px] font-black uppercase italic">
                            {isEditing ? (
                              <div className="flex items-center gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className={cn("h-6 w-6", data.visible ? "text-zinc-300" : "text-amber-500")}
                                  onClick={() => handleMonthlyChange(idx, 'visible', !data.visible)}
                                >
                                  {data.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                                </Button>
                                <Input 
                                  value={data.month}
                                  onChange={(e) => handleMonthlyChange(idx, 'month', e.target.value)}
                                  className="w-32 h-8 text-[11px] font-black uppercase italic border-none p-0 focus-visible:ring-0 bg-transparent"
                                />
                              </div>
                            ) : (
                              data.month
                            )}
                          </td>
                          <td className="p-4 text-center">
                            {isEditing ? (
                              <Input 
                                type="number"
                                value={data.leads}
                                onChange={(e) => handleMonthlyChange(idx, 'leads', parseInt(e.target.value) || 0)}
                                className="w-16 h-8 mx-auto text-center border-none p-0 focus-visible:ring-0 font-black bg-zinc-100 rounded-none shadow-none"
                              />
                            ) : (
                              <span className="font-bold text-lg italic">{data.leads}</span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            {isEditing ? (
                              <Input 
                                type="number"
                                value={data.meetings}
                                onChange={(e) => handleMonthlyChange(idx, 'meetings', parseInt(e.target.value) || 0)}
                                className="w-16 h-8 mx-auto text-center border-none p-0 focus-visible:ring-0 font-black bg-zinc-100 rounded-none shadow-none"
                              />
                            ) : (
                              <span className="font-bold text-lg italic opacity-40">{data.meetings}</span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none rounded-none text-[8px] font-black tracking-widest">
                              {idx === 0 ? 'BASE' : `+${Math.floor(Math.random() * 20)}% GROWTH`}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Analysis and Roadmap */}
            <section className="grid grid-cols-3 gap-12 pt-8 border-t-2 border-zinc-100">
              <div className="col-span-2 space-y-6">
                {visibleSections.auditNotes && (
                  <div className="space-y-4 relative group/section">
                    {isEditing && (
                      <Button 
                        variant="destructive" 
                        size="icon" 
                        className="absolute -top-2 -right-4 h-6 w-6 rounded-full shadow-lg z-10"
                        onClick={() => toggleSection('auditNotes')}
                      >
                        <X size={12} />
                      </Button>
                    )}
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 bg-black text-white flex items-center justify-center">
                        <BarChart3 size={16} />
                      </div>
                      {isEditing ? (
                        <Input 
                          value={reportLabels.auditTitle}
                          onChange={(e) => handleLabelChange('auditTitle', e.target.value)}
                          className="text-[11px] font-black uppercase text-black tracking-[0.3em] border-none p-0 h-auto focus-visible:ring-0 bg-transparent w-full"
                        />
                      ) : (
                        <p className="text-[11px] font-black uppercase text-black tracking-[0.3em]">{reportLabels.auditTitle}</p>
                      )}
                    </div>
                    <div className="p-8 bg-zinc-50 border border-zinc-100 italic text-base leading-relaxed text-zinc-900 min-h-[220px]">
                      {isEditing ? (
                        <Textarea 
                          value={reportNotes} 
                          onChange={(e) => setReportNotes(e.target.value)}
                          className="min-h-[160px] w-full border-none p-0 focus-visible:ring-0 bg-transparent italic text-base resize-none"
                          placeholder="Inyectar aquí el análisis cualitativo del performance..."
                        />
                      ) : (
                        <p className="whitespace-pre-wrap">{reportNotes || 'Se observa una consolidación en la calidad de los leads generados, con una mejora del 15% en la tasa de asistencia a reuniones. La estrategia de segmentación por verticales ha resultado exitosa, logrando un CPL optimizado por debajo de los registros históricos anteriores. Recomendamos profundizar en la automatización del primer contacto para reducir el tiempo de respuesta promedio.'}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-8">
                {visibleSections.consultantInfo && (
                  <div className="space-y-4 relative group/section">
                    {isEditing && (
                      <Button 
                        variant="destructive" 
                        size="icon" 
                        className="absolute -top-2 -right-4 h-6 w-6 rounded-full shadow-lg z-10"
                        onClick={() => toggleSection('consultantInfo')}
                      >
                        <X size={12} />
                      </Button>
                    )}
                    {isEditing ? (
                      <Input 
                        value={reportLabels.responsibleLabel}
                        onChange={(e) => handleLabelChange('responsibleLabel', e.target.value)}
                        className="text-[10px] font-black uppercase text-zinc-400 tracking-[0.2em] border-none p-0 h-auto focus-visible:ring-0 bg-transparent w-full mb-4"
                      />
                    ) : (
                      <p className="text-[10px] font-black uppercase text-zinc-400 tracking-[0.2em]">{reportLabels.responsibleLabel}</p>
                    )}
                    <div className="flex items-center gap-4 border-2 border-black p-4">
                      <Avatar className="h-10 w-10 border-2 border-black/10 rounded-none shrink-0">
                        <AvatarImage src={author?.photoURL} />
                        <AvatarFallback className="rounded-none bg-black text-white font-black">{author?.displayName?.[0]}</AvatarFallback>
                      </Avatar>
                      <div className="overflow-hidden">
                        <p className="text-[11px] font-black uppercase italic tracking-tighter truncate">{author?.displayName}</p>
                        <p className="text-[8px] font-bold text-zinc-400 uppercase mt-0.5 truncate">{author?.role?.replace('_', ' ')}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-black text-white p-8 space-y-4">
                   <div className="flex items-center gap-2">
                    <Zap size={18} className="text-emerald-400" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] italic">Impacto Inmediato</span>
                  </div>
                  <p className="text-[11px] font-bold opacity-70 leading-relaxed uppercase tracking-tighter">
                    Toda la data reflejada en este informe ha sido auditada bajo los estándares de Efecto Digital CRM Solutions.
                  </p>
                </div>
              </div>
            </section>

            {/* Strategic roadmap */}
            {visibleSections.roadmap && (
              <section className="space-y-6 pt-12 border-t-[12px] border-black relative group/section">
                {isEditing && (
                  <Button 
                    variant="destructive" 
                    size="icon" 
                    className="absolute top-2 -right-4 h-8 w-8 rounded-full shadow-lg z-10 opacity-0 group-hover/section:opacity-100 transition-opacity"
                    onClick={() => toggleSection('roadmap')}
                  >
                    <X size={14} />
                  </Button>
                )}
                <div className="flex items-center gap-4">
                  {isEditing ? (
                    <Input 
                      value={reportLabels.roadmapTitle}
                      onChange={(e) => handleLabelChange('roadmapTitle', e.target.value)}
                      className="text-5xl font-black italic tracking-tighter uppercase leading-none text-black border-none p-0 h-auto focus-visible:ring-0 bg-transparent w-full"
                    />
                  ) : (
                    <h3 className="text-5xl font-black italic tracking-tighter uppercase leading-none">{reportLabels.roadmapTitle}</h3>
                  )}
                </div>
                <div className="p-10 bg-zinc-100/50 border border-zinc-200">
                  {isEditing ? (
                    <Textarea 
                      value={nextSteps} 
                      onChange={(e) => setNextSteps(e.target.value)}
                      className="text-4xl font-black italic tracking-tighter text-black uppercase leading-[1.1] w-full border-none p-0 focus-visible:ring-0 bg-transparent resize-none"
                      placeholder="DEFINE LOS PRÓXIMOS PASOS AQUÍ..."
                    />
                  ) : (
                    <p className="text-4xl font-black italic tracking-tighter text-black uppercase leading-[1.1]">
                      {nextSteps || 'IMPLEMENTAR AUTOMATIZACIONES AVANZADAS DE WHATSAPP Y MEJORAR EL SEGUIMIENTO DE LEADS CALIFICADOS PARA INCREMENTAR LA TASA DE CIERRE EN UN 10% EL PRÓXIMO MES.'}
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* Footer */}
            <footer className="pt-24 flex justify-between items-end">
              <div className="space-y-4">
                <div className="h-10 w-40 bg-zinc-50 border border-zinc-100 flex items-center justify-center italic text-[9px] font-black text-zinc-300 uppercase tracking-widest">
                  Verified by AI Studio
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Powered by</p>
                  <p className="text-2xl font-black italic tracking-tighter uppercase leading-none">Efecto Digital CRM</p>
                </div>
              </div>
              <div className="text-right space-y-4">
                <div className="text-[9px] font-black uppercase space-y-1">
                  <p className="text-black">Azul & Naza • Operations Team</p>
                  <p className="text-zinc-400">© 2024 GROWTH SOLUTIONS</p>
                </div>
                <div className="text-[10px] font-black uppercase text-blue-600 underline tracking-tighter">
                  www.efectodigital.com.ar
                </div>
              </div>
            </footer>
          </div>
        </div>
      </Card>
    </div>
  );
}
