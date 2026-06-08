import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { UserProfile, Client, Lead, Meeting } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button, buttonVariants } from './ui/button';
import { 
  Users, 
  Briefcase, 
  TrendingUp, 
  History as HistoryIcon,
  Calendar, 
  ChevronRight, 
  Target,
  CheckCircle2,
  Clock,
  Search,
  User as UserIcon,
  Crown,
  Medal,
  Trophy,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PieChart as PieIcon,
  Info,
  FileText
} from 'lucide-react';
import { format, parseISO, isBefore, isAfter, subMonths, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, getClientStatusBadgeColor, getClientStatusLabel } from '../lib/utils';
import { Input } from './ui/input';
import { useMemo } from 'react';
import ClientReportGenerator from './ClientReportGenerator';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LineChart,
  Line
} from 'recharts';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

interface TeamPerformanceProps {
  isDemoMode?: boolean;
  profile: UserProfile | null;
  onClientSelect: (clientId: string) => void;
  onTabChange: (tab: string) => void;
}

export default function TeamPerformance({ isDemoMode, profile, onClientSelect, onTabChange }: TeamPerformanceProps) {
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [allMeetings, setAllMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState<UserProfile | null>(null);
  const [reportClient, setReportClient] = useState<Client | null>(null);

  // Reusable Client Card Component
  const ClientCard = ({ client, memberUid }: { client: any, memberUid: string, key?: string }) => {
    const clientLeads = allLeads.filter(l => l.clientId === client.id);
    const clientMeetings = allMeetings.filter(m => m.clientId === client.id);
    const closed = clientLeads.filter(l => l.status === 'closed-won').length;
    const held = clientMeetings.filter(m => m.status === 'completed').length;
    const isActive = !client.status || ['onboarding', 'active', 'paused'].includes(client.status);
    const duration = getDurationString(client.contractStartDate, client.contractEndDate);
    
    // Percentage between meetings and closures
    const meetingsToClosures = held > 0 ? Math.round((closed / held) * 100) : 0;

    // Format Start Date safely
    let formattedStartDate = '---';
    if (client.contractStartDate) {
      try {
        formattedStartDate = format(parseISO(client.contractStartDate), "dd/MM/yyyy");
      } catch (e) {
        formattedStartDate = client.contractStartDate;
      }
    } else if (client.createdAt) {
      try {
        formattedStartDate = format(parseISO(client.createdAt), "dd/MM/yyyy");
      } catch (e) {
        formattedStartDate = '---';
      }
    }

    // Filter and sort scheduled/pending meetings (upcoming)
    const scheduledMeetings = clientMeetings
      .filter(m => m.status === 'pending' || m.status === 'reschedule')
      .sort((a, b) => new Date(`${a.date}T${a.time || '00:00'}`).getTime() - new Date(`${b.date}T${b.time || '00:00'}`).getTime());

    return (
      <Card className={cn(
        "group border rounded-[2rem] shadow-none bg-card transition-all duration-500 overflow-hidden",
        isActive
          ? "border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5" 
          : "border-border/10 opacity-75 grayscale contrast-75 hover:opacity-100 hover:grayscale-0 hover:contrast-100 hover:shadow-lg hover:shadow-primary/5"
      )}>
        <div className="p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className={cn(
                "h-16 w-16 rounded-3xl flex items-center justify-center border transition-transform group-hover:scale-105 duration-500 shrink-0",
                isActive 
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" 
                  : "bg-muted text-muted-foreground border-border/40"
              )}>
                {isActive ? <TrendingUp size={28} /> : <HistoryIcon size={28} />}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h4 className="font-black text-xl text-foreground uppercase italic tracking-tighter leading-none">{client.name}</h4>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {client.status && (
                      <Badge className={cn("border-none text-[8px] font-black px-2 py-0.5 rounded-md", getClientStatusBadgeColor(client.status))}>
                        {getClientStatusLabel(client.status)}
                      </Badge>
                    )}
                    <Badge className={cn(
                      "border-none text-[8px] font-black px-2 py-0.5 rounded-md",
                      client.accountManagerId === memberUid ? "bg-blue-500/10 text-blue-600 border border-blue-500/20" : "bg-purple-500/10 text-purple-600 border border-purple-500/20"
                    )}>
                      {client.accountManagerId === memberUid ? 'ACCOUNT' : 'SETTER'}
                    </Badge>
                    {!isActive && (
                      <Badge className="border-none text-[8px] font-black px-2 py-0.5 rounded-md bg-muted text-muted-foreground uppercase italic">
                        Histórico / Viejo
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2">
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] italic">
                    PLAN: {client.planName || 'STANDARD'}
                  </p>
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/30 hidden md:block" />
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                    <Calendar size={12} className="opacity-50 text-emerald-500" />
                    Fecha Inicio: <span className="text-foreground font-black">{formattedStartDate}</span>
                  </p>
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/30 hidden md:block" />
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                    <Clock size={12} className="opacity-50 text-amber-500" />
                    Antigüedad: <span className="text-foreground font-black">{duration}</span>
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <Button 
                variant="default" 
                size="sm" 
                className="rounded-xl h-10 px-6 text-[10px] font-black uppercase tracking-widest bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 text-white transition-all scale-105 active:scale-95"
                onClick={(e) => {
                  e.stopPropagation();
                  setReportClient(client);
                }}
              >
                <FileText size={14} className="mr-2" /> Descargar Informe Total
              </Button>
              <div className="bg-muted/30 px-4 py-2 rounded-xl border border-border/10 text-right">
                 <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Próxima Renov.</p>
                 <p className="text-[10px] font-black italic text-primary">
                   {client.renewalDate ? format(parseISO(client.renewalDate), "dd/MM/yy") : 
                    (client.contractEndDate ? format(parseISO(client.contractEndDate), "dd/MM/yy") : 'En revisión')}
                 </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-xl h-10 px-4 text-[10px] font-black uppercase tracking-widest border-primary/20 hover:bg-primary hover:text-white transition-colors"
                onClick={() => {
                   onClientSelect(client.id);
                   onTabChange('dashboard');
                }}
              >
                Abrir Espacio <ArrowUpRight size={14} className="ml-2" />
              </Button>
            </div>
          </div>

          {(client.feedback || client.nextSteps) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {client.feedback && (
                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                  <p className="text-[8px] font-black uppercase text-primary/60 tracking-widest mb-2">Análisis de Campaña</p>
                  <p className="text-[11px] leading-relaxed italic text-muted-foreground">"{client.feedback}"</p>
                </div>
              )}
              {client.nextSteps && (
                <div className="p-4 bg-muted/20 rounded-2xl border border-border/10">
                  <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest mb-2">Próximos Pasos</p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground flex items-start gap-2">
                    <ArrowUpRight size={12} className="mt-0.5 shrink-0 text-primary" />
                    {client.nextSteps}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Scheduled Meetings List */}
          {scheduledMeetings.length > 0 && (
            <div className="mt-6 p-5 bg-amber-500/5 rounded-3xl border border-amber-500/10">
              <p className="text-[9px] font-black uppercase text-amber-600 dark:text-amber-500 tracking-wider mb-3 flex items-center gap-1.5">
                <Calendar className="animate-pulse text-amber-500" size={14} />
                Próximas Reuniones Agendadas ({scheduledMeetings.length})
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {scheduledMeetings.slice(0, 3).map((meeting) => {
                  let meetingDateStr = '---';
                  try {
                    meetingDateStr = format(parseISO(meeting.date), "EEEE dd 'de' MMMM", { locale: es });
                  } catch {
                    meetingDateStr = meeting.date;
                  }
                  meetingDateStr = meetingDateStr.charAt(0).toUpperCase() + meetingDateStr.slice(1);

                  return (
                    <div key={meeting.id} className="flex items-center justify-between p-3.5 bg-card/60 rounded-2xl border border-border/40 hover:border-amber-500/30 transition-all shadow-sm">
                      <div className="space-y-0.5">
                        <p className="text-[11px] font-black text-foreground uppercase tracking-tight leading-normal">{meeting.leadName}</p>
                        <p className="text-[9px] font-bold text-muted-foreground">{meetingDateStr}</p>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1">
                        <Badge variant="outline" className="text-[9px] font-black border-amber-500/20 text-amber-600 dark:text-amber-500 bg-amber-500/5 px-2 py-0.5 rounded-md">
                          {meeting.time || '--- hs'}
                        </Badge>
                        {meeting.meetingLink && (
                          <a 
                            href={meeting.meetingLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[8px] font-black text-primary hover:underline uppercase flex items-center gap-0.5"
                          >
                            Ir a sala ↗
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 mt-8 pt-8 border-t border-border/30">
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Leads Totales</p>
              <p className="text-2xl font-black text-foreground">{clientLeads.length}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Reuniones</p>
              <div className="flex items-baseline gap-2 flex-wrap">
                <p className="text-2xl font-black text-foreground">{held}</p>
                <p className="text-[8px] font-black text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded leading-none">TOTAL: {clientMeetings.length}</p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Cierres (Won)</p>
              <p className="text-2xl font-black text-emerald-500">{closed}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Reuniones vs Cierres</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-black text-primary">{meetingsToClosures}%</p>
                <div className="w-12 h-1 bg-muted rounded-full overflow-hidden self-center">
                   <div className="bg-primary h-full" style={{ width: `${meetingsToClosures}%` }} />
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Renovaciones</p>
              <div className="flex flex-col gap-1 mt-1">
                <span className="text-lg font-black text-primary leading-tight">
                  {client.renewalCount || 0}
                </span>
                {client.renewalStatus === 'will_renew' && (
                  <Badge className="border-none bg-emerald-500/10 text-emerald-500 text-[8px] font-black px-1.5 py-0.5 w-fit rounded">
                    SÍ, RENUEVA
                  </Badge>
                )}
                {client.renewalStatus === 'will_not_renew' && (
                  <Badge className="border-none bg-rose-500/10 text-rose-500 text-[8px] font-black px-1.5 py-0.5 w-fit rounded">
                    NO RENUEVA
                  </Badge>
                )}
                {(!client.renewalStatus || client.renewalStatus === 'unknown') && (
                  <Badge className="border-none bg-amber-500/10 text-amber-500 text-[8px] font-black px-1.5 py-0.5 w-fit rounded">
                    EN REVISIÓN
                  </Badge>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Status ROI</p>
              <Badge className={cn(
                "text-[9px] font-black mt-2 border-none",
                closed > 2 ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
              )}>
                {closed > 2 ? 'RENTABLE' : 'EN DESARROLLO'}
              </Badge>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  useEffect(() => {
    if (isDemoMode) {
      const storedUsers = localStorage.getItem('demo-users');
      const storedClients = localStorage.getItem('demo-clients');
      const storedLeads = localStorage.getItem('demo-leads');
      const storedMeetings = localStorage.getItem('demo-meetings');

      const users = storedUsers ? JSON.parse(storedUsers) : [];
      setTeamMembers(users.filter((u: any) => u.role !== 'client'));
      setAllClients(storedClients ? JSON.parse(storedClients) : []);
      setAllLeads(storedLeads ? JSON.parse(storedLeads) : []);
      setAllMeetings(storedMeetings ? JSON.parse(storedMeetings) : []);
      setLoading(false);
    } else {
      const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
        setTeamMembers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)).filter(u => u.role !== 'client'));
      }, (error) => handleFirestoreError(error, OperationType.GET, 'users'));

      const unsubClients = onSnapshot(collection(db, 'clients'), (snap) => {
        setAllClients(snap.docs.map(d => ({ id: d.id, ...d.data() } as Client)));
      }, (error) => handleFirestoreError(error, OperationType.GET, 'clients'));

      const unsubLeads = onSnapshot(collection(db, 'leads'), (snap) => {
        setAllLeads(snap.docs.map(d => ({ id: d.id, ...d.data() } as Lead)));
      }, (error) => handleFirestoreError(error, OperationType.GET, 'leads'));

      const unsubMeetings = onSnapshot(collection(db, 'meetings'), (snap) => {
        setAllMeetings(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
      }, (error) => handleFirestoreError(error, OperationType.GET, 'meetings'));

      setLoading(false);
      return () => {
        unsubUsers();
        unsubClients();
        unsubLeads();
        unsubMeetings();
      };
    }
  }, [isDemoMode]);

  // Stats calculation
  const getDurationString = (start?: string, end?: string) => {
    if (!start) return 'N/A';
    const startDate = parseISO(start);
    const endDate = end ? parseISO(end) : new Date();
    
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) return `${diffDays} días`;
    const months = Math.floor(diffDays / 30);
    const remainingDays = diffDays % 30;
    
    if (months < 12) {
      return remainingDays > 0 ? `${months}m ${remainingDays}d` : `${months} meses`;
    }
    
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    return remainingMonths > 0 ? `${years}a ${remainingMonths}m` : `${years} años`;
  };

  // Global Statistics
  const globalStats = useMemo(() => {
    const active = allClients.filter(c => !c.status || ['onboarding', 'active', 'paused'].includes(c.status)).length;
    const historical = allClients.filter(c => c.status && ['completed', 'cancelled'].includes(c.status)).length;
    const leadsCount = allLeads.length;
    const meetingsCount = allMeetings.length;
    const renewals = allClients.reduce((acc, c) => acc + (c.renewalCount || 0), 0);
    const renewedClientsCount = allClients.filter(c => (c.renewalCount || 0) > 0).length;
    const amClientsCount = allClients.filter(c => !!c.accountManagerId).length;
    const setterClientsCount = allClients.filter(c => !!c.setterId).length;

    // Monthly data for chart
    const chartData = Array.from({ length: 6 }).map((_, i) => {
      const date = subMonths(new Date(), 5 - i);
      const monthLabel = format(date, 'MMM');
      const startOfMonthDate = startOfMonth(date);
      
      const monthLeads = allLeads.filter(l => isAfter(new Date(l.createdAt), startOfMonthDate)).length;
      const monthMeetings = allMeetings.filter(m => isAfter(new Date(m.createdAt), startOfMonthDate)).length;

      return {
        month: monthLabel,
        leads: monthLeads,
        meetings: monthMeetings
      };
    });

    return {
      active,
      historical,
      leads: leadsCount,
      meetings: meetingsCount,
      renewals,
      renewedClientsCount,
      amClientsCount,
      setterClientsCount,
      chartData
    };
  }, [allClients, allLeads, allMeetings]);

  const getMemberStats = (memberUid: string) => {
    const member = teamMembers.find(u => u.uid === memberUid);
    const amClientsRaw = allClients.filter(c => c.accountManagerId === memberUid);
    const setterClientsRaw = allClients.filter(c => c.setterId === memberUid);
    const memberClients = [...new Set([...amClientsRaw, ...setterClientsRaw])];
    
    // Categorize by status
    const filterActive = (clients: typeof allClients) => clients.filter(c => {
      if (c.status) return ['onboarding', 'active', 'paused'].includes(c.status);
      return true;
    });
    
    const filterHistorical = (clients: typeof allClients) => clients.filter(c => {
      if (c.status) return ['completed', 'cancelled'].includes(c.status);
      return false;
    });

    const activeClients = filterActive(memberClients);
    const historicalClients = filterHistorical(memberClients);

    const amActive = filterActive(amClientsRaw);
    const setterActive = filterActive(setterClientsRaw);

    const memberLeads = allLeads.filter(l => 
      l.lastActionAuthorId === memberUid || 
      l.assignedSetterId === memberUid || 
      l.assignedCommercialId === memberUid
    );
    const memberMeetings = allMeetings.filter(m => m.scheduledBy === member?.displayName);
    const won = memberLeads.filter(l => l.status === 'closed-won').length;
    const held = memberMeetings.filter(m => m.status === 'completed').length;
    
    const totalRenewals = memberClients.reduce((acc, c) => acc + (c.renewalCount || 0), 0);

    const convRate = memberLeads.length > 0 ? Math.round((won / memberLeads.length) * 100) : 0;
    const showRate = memberMeetings.length > 0 ? Math.round((held / memberMeetings.length) * 100) : 0;
    const closingRate = held > 0 ? Math.round((won / held) * 100) : 0;

    // Weighted Score
    const score = (convRate * 0.4) + (showRate * 0.4) + (Math.min(20, memberLeads.length / 5) * 1) + (totalRenewals * 2);

    return {
      member,
      activeClients,
      historicalClients,
      amActive,
      setterActive,
      totalLeads: memberLeads.length,
      totalMeetings: memberMeetings.length,
      closedWon: won,
      heldMeetings: held,
      meetingAttendanceRate: showRate,
      conversionRate: convRate,
      closingRate,
      totalRenewals,
      score: Math.round(score)
    };
  };

  const filteredMembers = teamMembers.filter(m => 
    m.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.role || '').toLowerCase().includes(searchTerm.toLowerCase().replace(' ', '_'))
  );

  const leaderboard = useMemo(() => {
    return filteredMembers.map(member => {
      return getMemberStats(member.uid);
    }).sort((a, b) => b.score - a.score)
      .map((item, index) => ({ ...item, rank: index + 1 }));
  }, [filteredMembers, allClients, allLeads, allMeetings]);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'];

  if (loading) {
    return (
      <div className="p-10 flex flex-col items-center justify-center space-y-4 h-full">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Analizando rendimiento del equipo...</p>
      </div>
    );
  }

  if (filteredMembers.length === 0 && !selectedMember) {
    return (
      <div className="p-8 space-y-8 bg-background max-w-[1600px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-4xl font-black tracking-tighter text-foreground uppercase italic leading-none">Histórico de Performance</h2>
            <p className="text-[10px] font-black text-muted-foreground uppercase opacity-70 tracking-[0.3em] mt-2">ANÁLISIS DE CAMPAÑAS Y RENDIMIENTO POR EMPLEADO</p>
          </div>
          <div className="relative w-full md:w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input 
              placeholder="Buscar miembro del equipo..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-11 bg-card border-border/50 text-xs font-bold rounded-xl shadow-none focus-visible:ring-primary/20"
            />
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-20 bg-card/40 rounded-[2rem] border border-dashed border-border/60">
          <Users size={48} className="text-muted-foreground mb-4 opacity-20" />
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">No se encontraron miembros del equipo</p>
          <p className="text-[10px] text-muted-foreground/60 mt-1 uppercase">Asegúrate de que el personal tenga roles asignados correctamente</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 bg-background max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-foreground uppercase italic leading-none">Histórico de Performance</h2>
          <p className="text-[10px] font-black text-muted-foreground uppercase opacity-70 tracking-[0.3em] mt-2">ANÁLISIS DE CAMPAÑAS Y RENDIMIENTO POR EMPLEADO</p>
        </div>
        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger 
              className={cn(
                buttonVariants({ variant: 'default', size: 'sm' }),
                "rounded-xl h-11 px-6 text-[10px] font-black uppercase tracking-widest bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 text-white transition-all hover:scale-105 active:scale-95"
              )}
            >
              <FileText size={16} className="mr-2" /> Descargar Informe de Cliente
            </PopoverTrigger>
            <PopoverContent className="w-80 bg-card border-border/40 p-4 rounded-2xl shadow-2xl" align="end">
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Generar Reporte Completo</p>
                  <p className="text-[9px] text-muted-foreground uppercase font-bold">Selecciona un cliente de la lista para ver su informe editable</p>
                </div>
                <div className="max-h-[300px] overflow-y-auto space-y-1 pr-2">
                  {allClients
                    .filter(c => !c.status || ['onboarding', 'active', 'paused'].includes(c.status))
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(c => (
                      <Button 
                        key={c.id} 
                        variant="ghost" 
                        className="w-full justify-between text-[11px] font-black uppercase py-6 h-auto rounded-xl hover:bg-emerald-500/10 hover:text-emerald-600 border border-transparent hover:border-emerald-500/20"
                        onClick={() => setReportClient(c)}
                      >
                        <div className="flex flex-col items-start gap-0.5">
                          <span>{c.name}</span>
                          <span className="text-[8px] opacity-60 font-bold">{c.planName || 'Plan Estándar'}</span>
                        </div>
                        <ArrowUpRight size={14} className="opacity-40" />
                      </Button>
                    ))
                  }
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <div className="relative w-full md:w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input 
              placeholder="Buscar miembro del equipo..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-11 bg-card border-border/50 text-xs font-bold rounded-xl shadow-none focus-visible:ring-primary/20"
            />
          </div>
        </div>
      </div>

      {!selectedMember ? (
        <div className="space-y-8 animate-in fade-in duration-1000">
          {/* Dashboard Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border border-border/40 bg-card/40 rounded-3xl p-6 shadow-none">
              <p className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em] mb-4">Cartera Activa</p>
              <div className="flex items-end justify-between">
                <div className="space-y-1">
                  <span className="text-4xl font-black tracking-tighter italic">{globalStats.active}</span>
                  <p className="text-[10px] font-bold text-emerald-500 uppercase">{globalStats.historical} HISTÓRICOS / BAJAS</p>
                </div>
                <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <Users size={20} />
                </div>
              </div>
            </Card>
            
            <Card className="border border-border/40 bg-card/40 rounded-3xl p-6 shadow-none">
              <p className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em] mb-4">Renovaciones</p>
              <div className="flex items-end justify-between">
                <div className="space-y-1">
                  <span className="text-4xl font-black tracking-tighter italic text-amber-500">{globalStats.renewals}</span>
                  <p className="text-[10px] font-bold text-amber-500 uppercase">{globalStats.renewedClientsCount} CLIENTES RENOVARON</p>
                </div>
                <div className="h-10 w-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <HistoryIcon size={20} />
                </div>
              </div>
            </Card>

            <Card className="border border-border/40 bg-card/40 rounded-3xl p-6 shadow-none">
              <p className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em] mb-4">Cuentas Account</p>
              <div className="flex items-end justify-between">
                <div className="space-y-1">
                  <span className="text-4xl font-black tracking-tighter italic text-blue-500">{globalStats.amClientsCount}</span>
                  <p className="text-[10px] font-bold text-blue-500 uppercase">GESTIÓN AM</p>
                </div>
                <div className="h-10 w-10 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <UserIcon size={20} />
                </div>
              </div>
            </Card>

            <Card className="border border-border/40 bg-card/40 rounded-3xl p-6 shadow-none">
              <p className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em] mb-4">Apoyo Setter</p>
              <div className="flex items-end justify-between">
                <div className="space-y-1">
                  <span className="text-4xl font-black tracking-tighter italic text-purple-500">{globalStats.setterClientsCount}</span>
                  <p className="text-[10px] font-bold text-purple-500 uppercase">APOYO OPERATIVO</p>
                </div>
                <div className="h-10 w-10 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                  <Target size={20} />
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Elite Leaderboard */}
            <Card className="lg:col-span-2 border border-border/40 bg-card/20 rounded-[2.5rem] p-8 shadow-none relative overflow-hidden">
               <div className="relative z-10 space-y-6">
                 <div>
                   <div className="flex items-center justify-between mb-1">
                     <h3 className="text-xl font-black italic tracking-tighter uppercase flex items-center gap-2">
                       <Crown className="text-amber-500" size={24} />
                       Ranking de Rendimiento
                     </h3>
                     <Popover>
                       <PopoverTrigger className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), "h-6 w-6 p-0 rounded-full opacity-40 hover:opacity-100 focus-visible:ring-0")}>
                         <Info size={12} />
                       </PopoverTrigger>
                       <PopoverContent className="w-64 bg-black border-border/40 p-4 rounded-2xl">
                         <div className="space-y-3">
                           <p className="text-[10px] font-black uppercase tracking-widest text-primary italic">Fórmula de Eficiencia</p>
                           <p className="text-[11px] leading-relaxed text-muted-foreground">
                             La puntuación se calcula ponderando tres KPIs clave para equilibrar calidad y volumen:
                           </p>
                           <ul className="space-y-2">
                             <li className="flex items-center justify-between">
                               <span className="text-[10px] font-bold uppercase">Conversión</span>
                               <span className="text-[10px] font-black text-emerald-500">40%</span>
                             </li>
                             <li className="flex items-center justify-between">
                               <span className="text-[10px] font-bold uppercase">Asistencia</span>
                               <span className="text-[10px] font-black text-amber-500">40%</span>
                             </li>
                             <li className="flex items-center justify-between">
                               <span className="text-[10px] font-bold uppercase">Volumen Leads</span>
                               <span className="text-[10px] font-black text-blue-500">20%</span>
                             </li>
                           </ul>
                         </div>
                       </PopoverContent>
                     </Popover>
                   </div>
                   <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">RANKING DE EFICIENCIA OPERATIVA</p>
                 </div>

                 <div className="space-y-3">
                   {leaderboard.map((item, index) => (
                     <div 
                       key={item.member?.uid} 
                       onClick={() => setSelectedMember(item.member || null)}
                       className="group flex items-center justify-between p-4 bg-muted/20 hover:bg-muted/40 border border-border/10 rounded-2xl transition-all cursor-pointer"
                     >
                        <div className="flex items-center gap-4">
                           <div className="relative">
                             <Avatar className="h-12 w-12 border-2 border-primary/20 p-0.5 bg-background">
                               <AvatarImage src={item.member?.photoURL} />
                               <AvatarFallback>{(item.member?.displayName || '??')[0]}</AvatarFallback>
                             </Avatar>
                             <div className={cn(
                               "absolute -top-2 -left-2 h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black shadow-lg border-2 border-background",
                               index === 0 ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"
                             )}>
                               {index + 1}
                             </div>
                           </div>
                           <div>
                             <p className="text-sm font-black uppercase italic tracking-tight">{item.member?.displayName}</p>
                             <div className="flex items-center gap-2 mt-0.5">
                               <span className="text-[9px] font-bold text-muted-foreground uppercase">{(item.member?.role || '').replace('_', ' ')}</span>
                               <span className="text-[8px] h-1 w-1 rounded-full bg-muted-foreground/30" />
                               <span className="text-[9px] font-black text-primary">{item.totalLeads} LEADS</span>
                             </div>
                           </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="text-center bg-primary/5 px-4 py-2 rounded-xl border border-primary/10">
                               <p className="text-[9px] font-black text-primary italic leading-none">{item.score}</p>
                               <p className="text-[7px] font-black text-muted-foreground uppercase mt-1">SCORE</p>
                            </div>
                           <ChevronRight className="text-muted-foreground opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition-all" size={20} />
                        </div>
                     </div>
                   ))}
                 </div>
               </div>
            </Card>

            {/* Comparison Logic */}
            <Card className="border border-border/40 bg-card/20 rounded-[2.5rem] p-8 shadow-none flex flex-col justify-between">
              <div className="space-y-8">
                <div>
                  <h3 className="text-xl font-black italic tracking-tighter uppercase">Rendimiento Mensual</h3>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">LEADS VS REUNIONES (ÚLTIMOS 6 MESES)</p>
                </div>

                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={globalStats.chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: 'currentColor' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: 'currentColor' }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#000', border: 'none', borderRadius: '12px', fontSize: '10px', color: '#fff' }}
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      />
                      <Bar dataKey="leads" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={16} name="Leads" />
                      <Bar dataKey="meetings" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={16} name="Meetings" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {leaderboard.map((item) => {
              const { member, amActive, setterActive, historicalClients, totalRenewals, conversionRate, score } = item;
              if (!member) return null;
              return (
                <Card 
                  key={member.uid} 
                  className="group border border-border/40 rounded-[2rem] shadow-none bg-card/40 backdrop-blur-sm overflow-hidden hover:border-primary/30 transition-all duration-500 cursor-pointer"
                  onClick={() => setSelectedMember(member)}
                >
                  <div className="p-8 space-y-6">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-14 w-14 border-2 border-primary/20 p-1 bg-background ring-4 ring-primary/5">
                        <AvatarImage src={member.photoURL} />
                        <AvatarFallback className="bg-secondary text-primary font-black text-lg">
                          {(member.displayName || '??').substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="text-lg font-black text-foreground uppercase italic tracking-tight">{member.displayName}</h3>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-primary/20 text-primary bg-primary/5">
                            {(member.role || '').replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-muted/30 rounded-2xl p-4 border border-border/20">
                        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest mb-2">Activos</p>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-bold text-muted-foreground uppercase opacity-60 italic">AM</span>
                            <span className="text-sm font-black">{amActive.length}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-bold text-muted-foreground uppercase opacity-60 italic">ST</span>
                            <span className="text-sm font-black">{setterActive.length}</span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-muted/30 rounded-2xl p-4 border border-border/20 flex flex-col justify-between">
                        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest mb-1">Histórico</p>
                        <p className="text-xl font-black text-foreground flex items-baseline gap-1 mt-auto">
                          {historicalClients.length}
                        </p>
                      </div>
                      <div className="bg-muted/30 rounded-2xl p-4 border border-border/20 flex flex-col justify-between">
                        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest mb-1">Renov.</p>
                        <p className="text-xl font-black text-primary flex items-baseline gap-1 mt-auto">
                          {totalRenewals}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Conversión</span>
                        <span className="text-xs font-black text-primary">{conversionRate}%</span>
                      </div>
                      <div className="w-full bg-muted/40 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-primary h-full" style={{ width: `${conversionRate}%` }} />
                      </div>
                    </div>

                    <Button variant="ghost" className="w-full group-hover:bg-primary group-hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300">
                      Ver Performance Detallada <ChevronRight size={14} className="ml-2" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-5 duration-500">
          <Button 
            variant="ghost" 
            onClick={() => setSelectedMember(null)}
            className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-transparent hover:text-primary p-0"
          >
            ← Volver al equipo
          </Button>

          {(() => {
            const stats = getMemberStats(selectedMember.uid);
            const { activeClients, amActive, setterActive, historicalClients, totalLeads, totalMeetings, closedWon, heldMeetings, meetingAttendanceRate, conversionRate, closingRate, totalRenewals } = stats;

            return (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Header / Sidebar info */}
                <div className="space-y-6">
                  <Card className="border border-border/40 rounded-[2rem] shadow-none bg-card/60 backdrop-blur-md overflow-hidden sticky top-8">
                    <div className="p-8 space-y-8">
                      <div className="flex flex-col items-center text-center space-y-4">
                        <Avatar className="h-24 w-24 border-4 border-primary/20 p-1 bg-background ring-8 ring-primary/5">
                          <AvatarImage src={selectedMember.photoURL} />
                          <AvatarFallback className="bg-secondary text-primary font-black text-3xl">
                            {(selectedMember.displayName || '??').substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="text-2xl font-black text-foreground uppercase italic tracking-tighter leading-none">{selectedMember.displayName}</h3>
                          <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mt-2 italic">{(selectedMember.role || '').replace('_', ' ')}</p>
                          <p className="text-[10px] font-bold text-muted-foreground mt-2">{selectedMember.email}</p>
                        </div>
                      </div>

                      {(() => {
                        const totalClients = activeClients.length + historicalClients.length;
                        const retentionRate = totalClients > 0 ? Math.round((activeClients.length / totalClients) * 100) : 100;

                        return (
                          <div className="grid grid-cols-1 gap-3">
                            {/* Total de clientes activos */}
                            <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border border-border/10">
                              <div className="flex items-center gap-3">
                                <Users size={18} className="text-emerald-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-foreground">Total de clientes activos</span>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-black text-emerald-500 italic">{activeClients.length}</span>
                                <p className="text-[8px] font-bold text-muted-foreground uppercase">{amActive.length} AM / {setterActive.length} SETTER</p>
                              </div>
                            </div>

                            {/* Total de renovaciones */}
                            <div className="flex items-center justify-between p-4 bg-primary/10 rounded-2xl border border-primary/20">
                              <div className="flex items-center gap-3">
                                <HistoryIcon className="text-primary" size={18} />
                                <span className="text-[10px] font-black uppercase tracking-widest text-foreground">Total de renovaciones</span>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-black text-primary italic">{totalRenewals}</span>
                                <p className="text-[8px] font-black uppercase text-primary">TOTAL RENOVS.</p>
                              </div>
                            </div>

                            {/* Total de clientes inactivos */}
                            <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border border-border/10">
                              <div className="flex items-center gap-3">
                                <Briefcase className="text-muted-foreground" size={18} />
                                <span className="text-[10px] font-black uppercase tracking-widest text-foreground">Total de clientes inactivos</span>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-black text-muted-foreground italic">{historicalClients.length}</span>
                                <p className="text-[8px] font-bold text-muted-foreground uppercase">CUENTAS HISTÓRICAS</p>
                              </div>
                            </div>

                            {/* Tasa de retención */}
                            <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border border-border/10">
                              <div className="flex items-center gap-3">
                                <TrendingUp className="text-blue-500" size={18} />
                                <span className="text-[10px] font-black uppercase tracking-widest text-foreground">Tasa de retencion</span>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-black text-blue-500 italic">{retentionRate}%</span>
                                <p className="text-[8px] font-bold text-muted-foreground uppercase">{activeClients.length} DE {totalClients} CUENTAS</p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Section: Active Clients details & Old Clients selector */}
                      <div className="pt-6 border-t border-border/15 space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-black uppercase tracking-widest text-primary italic">📋 Clientes Activos ({activeClients.length})</p>
                        </div>
                        
                        <div className="space-y-3">
                          {activeClients.length === 0 ? (
                            <p className="text-[10px] text-muted-foreground/60 italic text-center py-2">Sin clientes asignados en este rol</p>
                          ) : (
                            activeClients.map((client) => {
                              const clientMeetingsCou = allMeetings.filter(m => m.clientId === client.id && (m.status === 'scheduled' || m.status === 'pending' || m.status === 'reschedule')).length;
                              const clientDuration = getDurationString(client.contractStartDate, client.contractEndDate);
                              
                              return (
                                <div key={client.id} className="p-3 bg-muted/15 rounded-xl border border-border/10 space-y-1.5 hover:bg-muted/30 transition-colors">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-extrabold text-foreground tracking-tight truncate max-w-[145px] uppercase italic">
                                      {client.name}
                                    </span>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-5 w-5 hover:bg-primary/20 text-primary"
                                      onClick={() => {
                                        onClientSelect(client.id);
                                        onTabChange('dashboard');
                                      }}
                                      title="Abrir espacio de trabajo"
                                    >
                                      <ArrowUpRight size={12} />
                                    </Button>
                                  </div>
                                  
                                  <div className="space-y-1">
                                    {/* Duration / Start Date */}
                                    <p className="text-[9px] text-muted-foreground flex items-center gap-1.5">
                                      <Calendar size={10} className="text-emerald-500 shrink-0" />
                                      <span>Antigüedad: <span className="font-bold text-foreground">{clientDuration}</span></span>
                                    </p>
                                    
                                    {/* Renewals */}
                                    <div className="text-[9px] text-muted-foreground flex items-center justify-between gap-1">
                                      <span className="flex items-center gap-1.5">
                                        <HistoryIcon size={10} className="text-primary shrink-0" />
                                        <span>Renovaciones: <span className="font-bold text-foreground">{client.renewalCount || 0}</span></span>
                                      </span>
                                      {client.renewalStatus === 'will_renew' && (
                                        <span className="text-[8px] font-black text-emerald-500 uppercase">SÍ ✅</span>
                                      )}
                                      {client.renewalStatus === 'will_not_renew' && (
                                        <span className="text-[8px] font-black text-rose-500 uppercase">NO ❌</span>
                                      )}
                                      {(!client.renewalStatus || client.renewalStatus === 'unknown') && (
                                        <span className="text-[8px] font-black text-amber-500 uppercase">NEGOC. ⏳</span>
                                      )}
                                    </div>

                                    {/* Scheduled Meetings */}
                                    <p className="text-[9px] text-muted-foreground flex items-center gap-1.5">
                                      <Clock size={10} className="text-amber-500 shrink-0" />
                                      <span>Reuniones Agendadas: <span className="font-bold text-foreground">{clientMeetingsCou}</span></span>
                                    </p>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* Dropdown Popover for Old/Historical Clients */}
                        <div className="pt-2">
                          <Popover>
                            <PopoverTrigger 
                              className="w-full h-9 rounded-xl border border-dashed border-border/40 bg-muted/5 hover:bg-muted text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary/20"
                            >
                              <HistoryIcon size={12} className="opacity-75 text-primary" />
                              📁 Historial Viejos ({historicalClients.length})
                            </PopoverTrigger>
                            <PopoverContent align="center" className="w-64 p-0 overflow-hidden bg-card border border-border/40 shadow-xl rounded-2xl">
                              <div className="p-3.5 bg-muted/10 border-b border-border/20">
                                <p className="text-[9px] font-black uppercase tracking-widest text-primary italic">Historial de Clientes Viejos</p>
                                <p className="text-[9px] text-muted-foreground mt-0.5 leading-snug">Selecciona un cliente para abrir su panel directo.</p>
                              </div>
                              <div className="max-h-[180px] overflow-y-auto">
                                {historicalClients.length === 0 ? (
                                  <p className="p-4 text-center text-[10px] text-muted-foreground italic">Sin clientes inactivos en el historial</p>
                                ) : (
                                  historicalClients.map(oldClient => (
                                    <div 
                                      key={oldClient.id} 
                                      className="p-3 hover:bg-muted/50 border-b border-border/10 last:border-none cursor-pointer flex items-center justify-between transition-colors"
                                      onClick={() => {
                                        onClientSelect(oldClient.id);
                                        onTabChange('dashboard');
                                      }}
                                    >
                                      <div>
                                        <p className="text-xs font-black text-foreground italic uppercase tracking-tight">{oldClient.name}</p>
                                        <p className="text-[8px] text-muted-foreground uppercase font-semibold">PLAN: {oldClient.planName || 'STANDARD'}</p>
                                      </div>
                                      <span className="text-[8px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-black italic uppercase border border-border/15">
                                        Inactivo
                                      </span>
                                    </div>
                                  ))
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Main Content Areas */}
                <div className="lg:col-span-2 space-y-12">
                  {/* Account Manager Clients */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between pb-4 border-b border-border/10">
                      <div className="flex items-center gap-3">
                        <Briefcase size={24} className="text-blue-500" />
                        <div>
                          <h3 className="text-2xl font-black italic tracking-tighter uppercase leading-none">Clientes como Account</h3>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1 opacity-60">GESTIÓN DIRECTA DE CUENTAS</p>
                        </div>
                      </div>
                      <Badge className="bg-blue-500/10 text-blue-600 border-none px-4 py-1.5 text-lg font-black rounded-xl italic">
                        {amActive.length}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      {amActive.length > 0 ? (
                        amActive.map(client => (
                          <ClientCard key={client.id} client={client} memberUid={selectedMember.uid} />
                        ))
                      ) : (
                        <div className="py-10 text-center border-2 border-dashed border-border/30 rounded-[2.5rem] bg-muted/5 opacity-50">
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 italic">Sin clientes activos como AM</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Setter Clients */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between pb-4 border-b border-border/10">
                      <div className="flex items-center gap-3">
                        <Target size={24} className="text-purple-500" />
                        <div>
                          <h3 className="text-2xl font-black italic tracking-tighter uppercase leading-none">Clientes como Setter</h3>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1 opacity-60">APOYO EN PROSPECCIÓN</p>
                        </div>
                      </div>
                      <Badge className="bg-purple-500/10 text-purple-600 border-none px-4 py-1.5 text-lg font-black rounded-xl italic">
                        {setterActive.length}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      {setterActive.length > 0 ? (
                        setterActive.map(client => (
                          <ClientCard key={client.id} client={client} memberUid={selectedMember.uid} />
                        ))
                      ) : (
                        <div className="py-10 text-center border-2 border-dashed border-border/30 rounded-[2.5rem] bg-muted/5 opacity-50">
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 italic">Sin apoyo como Setter en cuentas activas</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Historical Clients */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between pb-4 border-b border-border/10">
                      <div className="flex items-center gap-3">
                        <HistoryIcon size={24} className="text-muted-foreground" />
                        <div>
                          <h3 className="text-2xl font-black italic tracking-tighter uppercase leading-none">Historial / Clientes Viejos</h3>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1 opacity-60">CUENTAS FINALIZADAS O DADAS DE BAJA</p>
                        </div>
                      </div>
                      <Badge className="bg-muted text-muted-foreground border-none px-4 py-1.5 text-lg font-black rounded-xl italic">
                        {historicalClients.length}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      {historicalClients.length > 0 ? (
                        historicalClients.map(client => (
                          <ClientCard key={client.id} client={client} memberUid={selectedMember.uid} />
                        ))
                      ) : (
                        <div className="py-10 text-center border-2 border-dashed border-border/30 rounded-[2.5rem] bg-muted/5 opacity-50 grayscale-0">
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 italic">Sin clientes en el historial histórico</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {reportClient && (
        <ClientReportGenerator 
          client={reportClient}
          leads={allLeads}
          meetings={allMeetings}
          author={profile}
          onClose={() => setReportClient(null)}
        />
      )}
    </div>
  );
}
