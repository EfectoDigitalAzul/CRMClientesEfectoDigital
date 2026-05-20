import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  TrendingUp, 
  Calendar, 
  Target, 
  ArrowUpRight, 
  ArrowDownRight,
  ChevronRight,
  Download,
  Eye,
  PieChart as PieIcon,
  Zap,
  BarChart3,
  Search
} from 'lucide-react';
import { Client, Lead, Meeting, UserProfile } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import ClientReportGenerator from './ClientReportGenerator';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';

interface ClientReportsDashboardProps {
  client: Client;
  leads: Lead[];
  meetings: Meeting[];
  profile: UserProfile | null;
  isDemoMode?: boolean;
}

export default function ClientReportsDashboard({ client, leads, meetings, profile, isDemoMode }: ClientReportsDashboardProps) {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);

  // Performance calculation for the client
  const stats = useMemo(() => {
    const clientLeads = leads.filter(l => l.clientId === client.id);
    const clientMeetings = meetings.filter(m => m.clientId === client.id);
    
    const wonLeads = clientLeads.filter(l => l.status === 'closed-won').length;
    const pendingMeetings = clientMeetings.filter(m => m.status === 'pending').length;
    
    return {
      leads: clientLeads.length,
      won: wonLeads,
      meetings: clientMeetings.length,
      pendingMeetings,
      efficiency: clientLeads.length > 0 ? Math.round((wonLeads / clientLeads.length) * 100) : 0
    };
  }, [client.id, leads, meetings]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-none rounded-full px-4 py-1 text-[10px] font-black uppercase tracking-[0.2em] italic">
            Centro de Inteligencia de Negocio
          </Badge>
          <h1 className="text-4xl font-black tracking-tighter text-foreground uppercase italic leading-none">Mis Informes de Performance</h1>
          <p className="text-sm font-medium text-muted-foreground">Monitorea el crecimiento de tu proyecto en tiempo real</p>
        </div>
        <div className="flex gap-2">
          <Button 
            className="rounded-2xl h-12 px-6 bg-primary text-black font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/20"
            onClick={() => setShowGenerator(true)}
          >
            <FileText size={18} className="mr-2" /> Ver Informe Completo
          </Button>
        </div>
      </div>

      {/* Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Leads Totales', value: stats.leads, icon: Target, trend: '+12%', color: 'text-blue-500' },
          { label: 'Ventas Cerradas', value: stats.won, icon: TrendingUp, trend: '+5%', color: 'text-emerald-500' },
          { label: 'Reuniones en Agenda', value: stats.pendingMeetings, icon: Calendar, trend: 'En curso', color: 'text-amber-500' },
          { label: 'Eficiencia Comercial', value: `${stats.efficiency}%`, icon: Zap, trend: '+2.4%', color: 'text-purple-500' }
        ].map((item, idx) => (
          <Card key={idx} className="bg-card/50 border-border/40 backdrop-blur-sm hover:border-primary/20 transition-all group rounded-3xl overflow-hidden">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-2 rounded-xl bg-muted group-hover:bg-primary/10 group-hover:${item.color} transition-colors`}>
                  <item.icon size={20} />
                </div>
                <Badge variant="outline" className="rounded-full text-[9px] font-bold uppercase tracking-widest border-border/50">
                  {item.trend}
                </Badge>
              </div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">{item.label}</p>
              <h3 className="text-3xl font-black tracking-tighter italic">{item.value}</h3>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Reports History */}
        <Card className="lg:col-span-2 bg-card/30 border-border/40 backdrop-blur-xl rounded-3xl overflow-hidden">
          <CardHeader className="p-8 border-b border-border/20">
            <CardTitle className="text-xl font-black italic uppercase tracking-tight flex items-center gap-3">
              <BarChart3 className="text-primary" />
              Historial de Auditorías Mensuales
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             <div className="divide-y divide-border/10">
                {[
                  { month: 'Mayo 2024', status: 'Finalizado', date: '14/05/2024', leads: stats.leads, icon: '📈' },
                  { month: 'Abril 2024', status: 'Archivado', date: '30/04/2024', leads: 42, icon: '🎯' },
                  { month: 'Marzo 2024', status: 'Archivado', date: '31/03/2024', leads: 38, icon: '🔥' }
                ].map((report, idx) => (
                  <div key={idx} className="flex items-center justify-between p-6 hover:bg-muted/50 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center text-xl grayscale group-hover:grayscale-0 transition-all">
                        {report.icon}
                      </div>
                      <div>
                        <p className="text-sm font-black uppercase italic tracking-tighter">{report.month}</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Generado el {report.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs font-black italic">{report.leads} Leads</p>
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-none rounded-none text-[8px] font-black uppercase">KPI OK</Badge>
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="rounded-full h-10 w-10 hover:bg-primary hover:text-black"
                        onClick={() => setShowGenerator(true)}
                      >
                        <Download size={18} />
                      </Button>
                    </div>
                  </div>
                ))}
             </div>
          </CardContent>
        </Card>

        {/* Agency Note / Roadmap */}
        <Card className="bg-black text-white rounded-3xl overflow-hidden border-none shadow-2xl">
          <CardContent className="p-8 space-y-6">
             <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-black">
                <Zap size={24} />
             </div>
             <div className="space-y-4">
               <h3 className="text-lg font-black italic uppercase tracking-tight text-emerald-400">Nota del Director</h3>
               <p className="text-sm font-medium leading-relaxed opacity-80 italic">
                 "Este mes hemos logrado un hito importante en la tasa de apertura de campañas. El enfoque para las próximas semanas será traccionar el volumen de leads hacia cierres de alto impacto. ¡Vamos por buen camino!"
               </p>
             </div>
             <div className="space-y-4 pt-6 border-t border-white/10">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Próximo Milestone</p>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-xs font-black uppercase italic">Auditoría de Conversión Q2</span>
                </div>
                <Button variant="outline" className="w-full border-white/20 text-white hover:bg-white hover:text-black rounded-xl text-[10px] font-black uppercase tracking-widest italic">
                  Contactar Estratega
                </Button>
             </div>
          </CardContent>
        </Card>
      </div>

      {showGenerator && (
        <ClientReportGenerator 
          client={client}
          leads={leads}
          meetings={meetings}
          author={profile}
          onClose={() => setShowGenerator(false)}
        />
      )}
    </div>
  );
}
