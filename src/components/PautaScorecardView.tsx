import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Client, UserProfile, PautaScorecard, PautaWeekData, Lead } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import {
  Megaphone,
  Calendar,
  RefreshCw,
  Sparkles,
  Download,
  Settings,
  TrendingUp,
  DollarSign,
  Users,
  Target,
  CheckCircle2,
  AlertCircle,
  Copy,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Link2,
  ExternalLink,
  Edit3
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import * as XLSX from 'xlsx';

interface PautaScorecardViewProps {
  client: Client;
  profile: UserProfile | null;
  isDemoMode?: boolean;
  leads?: Lead[];
  onUpdateClient?: (updatedClient: Client) => void;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function getDefaultWeekRanges(year: number, month: number) {
  // month: 1-12
  const daysInMonth = new Date(year, month, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  const m = pad(month);

  return {
    week1: { start: `01/${m}`, end: `07/${m}`, fullStart: `${year}-${m}-01`, fullEnd: `${year}-${m}-07` },
    week2: { start: `08/${m}`, end: `14/${m}`, fullStart: `${year}-${m}-08`, fullEnd: `${year}-${m}-14` },
    week3: { start: `15/${m}`, end: `21/${m}`, fullStart: `${year}-${m}-15`, fullEnd: `${year}-${m}-21` },
    week4: { start: `22/${m}`, end: `${daysInMonth}/${m}`, fullStart: `${year}-${m}-22`, fullEnd: `${year}-${m}-${pad(daysInMonth)}` },
  };
}

const emptyWeekData: PautaWeekData = {
  formSpend: 0,
  formLeads: 0,
  formContacted: 0,
  formOpportunities: 0,
  formMeetings: 0,
  formSales: 0,
  wppSpend: 0,
  wppLeads: 0,
  wppContacted: 0,
  wppOpportunities: 0,
  wppMeetings: 0,
  wppSales: 0,
};

export function PautaScorecardView({
  client,
  profile,
  isDemoMode = false,
  leads = [],
  onUpdateClient,
}: PautaScorecardViewProps) {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1); // 1-12

  const docId = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  const defaultRanges = useMemo(() => getDefaultWeekRanges(selectedYear, selectedMonth), [selectedYear, selectedMonth]);

  const [scorecard, setScorecard] = useState<PautaScorecard>({
    id: docId,
    clientId: client.id,
    month: selectedMonth,
    year: selectedYear,
    weeks: {
      week1: { ...emptyWeekData, startDate: defaultRanges.week1.start, endDate: defaultRanges.week1.end },
      week2: { ...emptyWeekData, startDate: defaultRanges.week2.start, endDate: defaultRanges.week2.end },
      week3: { ...emptyWeekData, startDate: defaultRanges.week3.start, endDate: defaultRanges.week3.end },
      week4: { ...emptyWeekData, startDate: defaultRanges.week4.start, endDate: defaultRanges.week4.end },
    },
    updatedAt: new Date().toISOString(),
  });

  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isMetaModalOpen, setIsMetaModalOpen] = useState(false);
  const [isSyncingMeta, setIsSyncingMeta] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Meta Settings Form State
  const [metaAccountId, setMetaAccountId] = useState(client.metaAdAccountId || '');
  const [metaAccessToken, setMetaAccessToken] = useState(client.metaAccessToken || '');
  const [targetCPL, setTargetCPL] = useState(client.pautaTargetCPL?.toString() || '');
  const [currency, setCurrency] = useState(client.pautaCurrency || 'ARS');

  // Load Scorecard from Firestore or LocalStorage
  useEffect(() => {
    setLoading(true);
    const scorecardRef = doc(db, 'clients', client.id, 'pautaScorecards', docId);

    if (isDemoMode) {
      const stored = localStorage.getItem(`demo-scorecard-${client.id}-${docId}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setScorecard(parsed);
        } catch {
          initializeDefaultScorecard();
        }
      } else {
        initializeDefaultScorecard();
      }
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(scorecardRef, (snapshot) => {
      if (snapshot.exists()) {
        setScorecard(snapshot.data() as PautaScorecard);
      } else {
        initializeDefaultScorecard();
      }
      setLoading(false);
    }, (error) => {
      console.warn("Firestore onSnapshot error in Scorecard:", error);
      handleFirestoreError(error, OperationType.GET, `clients/${client.id}/pautaScorecards/${docId}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [client.id, docId, isDemoMode]);

  const initializeDefaultScorecard = () => {
    setScorecard({
      id: docId,
      clientId: client.id,
      month: selectedMonth,
      year: selectedYear,
      weeks: {
        week1: { ...emptyWeekData, startDate: defaultRanges.week1.start, endDate: defaultRanges.week1.end },
        week2: { ...emptyWeekData, startDate: defaultRanges.week2.start, endDate: defaultRanges.week2.end },
        week3: { ...emptyWeekData, startDate: defaultRanges.week3.start, endDate: defaultRanges.week3.end },
        week4: { ...emptyWeekData, startDate: defaultRanges.week4.start, endDate: defaultRanges.week4.end },
      },
      updatedAt: new Date().toISOString(),
    });
  };

  // Debounced save
  const saveScorecard = useCallback(async (updated: PautaScorecard) => {
    setSavingStatus('saving');
    try {
      if (isDemoMode) {
        localStorage.setItem(`demo-scorecard-${client.id}-${docId}`, JSON.stringify(updated));
      } else {
        await setDoc(doc(db, 'clients', client.id, 'pautaScorecards', docId), updated, { merge: true });
      }
      setSavingStatus('saved');
      setTimeout(() => setSavingStatus('idle'), 2500);
    } catch (e) {
      console.error("Error saving scorecard:", e);
      toast.error("Error al guardar cambios en la planilla de pauta.");
      setSavingStatus('idle');
    }
  }, [client.id, docId, isDemoMode]);

  const handleCellChange = (
    weekKey: 'week1' | 'week2' | 'week3' | 'week4',
    field: keyof PautaWeekData,
    value: any
  ) => {
    setScorecard((prev) => {
      const numVal = typeof value === 'number' ? value : Number(value) || 0;
      const updatedWeek = {
        ...prev.weeks[weekKey],
        [field]: typeof value === 'string' && (field === 'startDate' || field === 'endDate' || field === 'notes') ? value : Math.max(0, numVal),
      };

      const updatedScorecard: PautaScorecard = {
        ...prev,
        weeks: {
          ...prev.weeks,
          [weekKey]: updatedWeek,
        },
        updatedAt: new Date().toISOString(),
        updatedBy: profile?.displayName || profile?.email || 'Usuario',
      };

      saveScorecard(updatedScorecard);
      return updatedScorecard;
    });
  };

  // Month navigation
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  // Currency Formatter
  const currencySymbol = currency === 'USD' ? 'US$' : currency === 'EUR' ? '€' : '$';
  const formatMoney = (amount: number) => {
    if (!amount || isNaN(amount)) return `${currencySymbol}0`;
    return `${currencySymbol}${amount.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  const formatPct = (val: number, total: number) => {
    if (!total || total === 0 || isNaN(val)) return '0%';
    const pct = Math.round((val / total) * 100);
    return `${pct}%`;
  };

  // Math Calculations for Summary Month
  const w1 = scorecard.weeks.week1 || emptyWeekData;
  const w2 = scorecard.weeks.week2 || emptyWeekData;
  const w3 = scorecard.weeks.week3 || emptyWeekData;
  const w4 = scorecard.weeks.week4 || emptyWeekData;

  // Form Summary
  const totalFormSpend = (w1.formSpend || 0) + (w2.formSpend || 0) + (w3.formSpend || 0) + (w4.formSpend || 0);
  const totalFormLeads = (w1.formLeads || 0) + (w2.formLeads || 0) + (w3.formLeads || 0) + (w4.formLeads || 0);
  const totalFormContacted = (w1.formContacted || 0) + (w2.formContacted || 0) + (w3.formContacted || 0) + (w4.formContacted || 0);
  const totalFormOpps = (w1.formOpportunities || 0) + (w2.formOpportunities || 0) + (w3.formOpportunities || 0) + (w4.formOpportunities || 0);
  const totalFormMeetings = (w1.formMeetings || 0) + (w2.formMeetings || 0) + (w3.formMeetings || 0) + (w4.formMeetings || 0);
  const totalFormSales = (w1.formSales || 0) + (w2.formSales || 0) + (w3.formSales || 0) + (w4.formSales || 0);
  const totalFormCPL = totalFormLeads > 0 ? totalFormSpend / totalFormLeads : 0;

  // Wpp Summary
  const totalWppSpend = (w1.wppSpend || 0) + (w2.wppSpend || 0) + (w3.wppSpend || 0) + (w4.wppSpend || 0);
  const totalWppLeads = (w1.wppLeads || 0) + (w2.wppLeads || 0) + (w3.wppLeads || 0) + (w4.wppLeads || 0);
  const totalWppContacted = (w1.wppContacted || 0) + (w2.wppContacted || 0) + (w3.wppContacted || 0) + (w4.wppContacted || 0);
  const totalWppOpps = (w1.wppOpportunities || 0) + (w2.wppOpportunities || 0) + (w3.wppOpportunities || 0) + (w4.wppOpportunities || 0);
  const totalWppMeetings = (w1.wppMeetings || 0) + (w2.wppMeetings || 0) + (w3.wppMeetings || 0) + (w4.wppMeetings || 0);
  const totalWppSales = (w1.wppSales || 0) + (w2.wppSales || 0) + (w3.wppSales || 0) + (w4.wppSales || 0);
  const totalWppCPL = totalWppLeads > 0 ? totalWppSpend / totalWppLeads : 0;

  // Combined Totals
  const grandTotalSpend = totalFormSpend + totalWppSpend;
  const grandTotalLeads = totalFormLeads + totalWppLeads;
  const grandTotalCPL = grandTotalLeads > 0 ? grandTotalSpend / grandTotalLeads : 0;
  const grandTotalSales = totalFormSales + totalWppSales;
  const grandTotalMeetings = totalFormMeetings + totalWppMeetings;

  // Sincronizar con CRM Leads (Auto-calculate comercial funnel based on lead status & creation date)
  const handleAutoFillFromCRM = () => {
    if (!leads || leads.length === 0) {
      toast.info("No hay leads registrados en el CRM para este cliente.");
      return;
    }

    const clientLeads = leads.filter(l => l.clientId === client.id && !l.isDeleted);
    if (clientLeads.length === 0) {
      toast.info("No se encontraron leads asociados a este cliente en el CRM.");
      return;
    }

    const pad = (n: number) => String(n).padStart(2, '0');
    const m = pad(selectedMonth);

    // Date bounds for the 4 weeks
    const ranges = [
      { key: 'week1', start: new Date(`${selectedYear}-${m}-01T00:00:00`), end: new Date(`${selectedYear}-${m}-07T23:59:59`) },
      { key: 'week2', start: new Date(`${selectedYear}-${m}-08T00:00:00`), end: new Date(`${selectedYear}-${m}-14T23:59:59`) },
      { key: 'week3', start: new Date(`${selectedYear}-${m}-15T00:00:00`), end: new Date(`${selectedYear}-${m}-21T23:59:59`) },
      { key: 'week4', start: new Date(`${selectedYear}-${m}-22T00:00:00`), end: new Date(`${selectedYear}-${m}-31T23:59:59`) },
    ] as const;

    const newWeeks = { ...scorecard.weeks };
    let totalProcessed = 0;

    ranges.forEach(({ key, start, end }) => {
      const weekLeads = clientLeads.filter(l => {
        if (!l.createdAt) return false;
        try {
          const leadDate = new Date(l.createdAt);
          return leadDate >= start && leadDate <= end;
        } catch {
          return false;
        }
      });

      // Split into Form vs WPP based on tag, sector or interest
      const formLeadsList = weekLeads.filter(l => !l.tag?.toLowerCase().includes('wpp') && !l.interest?.toLowerCase().includes('whatsapp'));
      const wppLeadsList = weekLeads.filter(l => l.tag?.toLowerCase().includes('wpp') || l.interest?.toLowerCase().includes('whatsapp'));

      // If no tag differentiation, assign to form by default or divide
      const isFormDefault = formLeadsList.length > 0 || wppLeadsList.length === 0;

      const fLeads = isFormDefault ? formLeadsList : [];
      const wLeads = isFormDefault ? wppLeadsList : weekLeads;

      const countContacted = (list: Lead[]) => list.filter(l => l.status !== 'new' && l.status !== 'not-interested').length;
      const countOpps = (list: Lead[]) => list.filter(l => ['qualified', 'meeting-scheduled', 'follow-up', 'closed-won'].includes(l.status)).length;
      const countMeetings = (list: Lead[]) => list.filter(l => ['meeting-scheduled', 'closed-won'].includes(l.status) || (l.meetings && l.meetings.length > 0)).length;
      const countSales = (list: Lead[]) => list.filter(l => l.status === 'closed-won').length;

      newWeeks[key] = {
        ...newWeeks[key],
        formLeads: fLeads.length > 0 ? fLeads.length : newWeeks[key].formLeads,
        formContacted: fLeads.length > 0 ? countContacted(fLeads) : newWeeks[key].formContacted,
        formOpportunities: fLeads.length > 0 ? countOpps(fLeads) : newWeeks[key].formOpportunities,
        formMeetings: fLeads.length > 0 ? countMeetings(fLeads) : newWeeks[key].formMeetings,
        formSales: fLeads.length > 0 ? countSales(fLeads) : newWeeks[key].formSales,

        wppLeads: wLeads.length > 0 ? wLeads.length : newWeeks[key].wppLeads,
        wppContacted: wLeads.length > 0 ? countContacted(wLeads) : newWeeks[key].wppContacted,
        wppOpportunities: wLeads.length > 0 ? countOpps(wLeads) : newWeeks[key].wppOpportunities,
        wppMeetings: wLeads.length > 0 ? countMeetings(wLeads) : newWeeks[key].wppMeetings,
        wppSales: wLeads.length > 0 ? countSales(wLeads) : newWeeks[key].wppSales,
      };

      totalProcessed += weekLeads.length;
    });

    const updatedScorecard: PautaScorecard = {
      ...scorecard,
      weeks: newWeeks,
      updatedAt: new Date().toISOString(),
      updatedBy: `${profile?.displayName || 'Usuario'} (CRM Auto-sync)`
    };

    setScorecard(updatedScorecard);
    saveScorecard(updatedScorecard);
    toast.success(`¡Sincronización completada! Se procesaron ${totalProcessed} leads del CRM en las 4 semanas.`);
  };

  // Meta Ads API Sync Action
  const handleSyncMeta = async () => {
    setIsSyncingMeta(true);
    const accountId = (client.metaAdAccountId || metaAccountId || '').trim();
    const token = (client.metaAccessToken || metaAccessToken || '').trim();

    if (!accountId) {
      setIsSyncingMeta(false);
      toast.error("Debes ingresar el ID de Cuenta Publicitaria de Meta (ej. act_752127200756905).");
      return;
    }

    if (!token) {
      setIsSyncingMeta(false);
      toast.error("Debes ingresar el Meta Access Token para consultar la API de Meta Ads.");
      return;
    }

    try {
      // Call backend proxy route to avoid CORS and get precise weekly breakdown
      const res = await fetch("/api/meta/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          accessToken: token,
          year: selectedYear,
          month: selectedMonth,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Error al conectar con la API de Meta Ads");
      }

      const { weeks, totalSpend, totalLeads, cleanAccountId } = data;

      if (!weeks) {
        throw new Error("Formato de respuesta inválido de Meta Insights");
      }

      const updatedWeeks = {
        week1: {
          ...scorecard.weeks.week1,
          formSpend: Number(weeks.week1?.formSpend ?? 0),
          formLeads: Number(weeks.week1?.formLeads ?? 0),
          wppSpend: Number(weeks.week1?.wppSpend ?? 0),
          wppLeads: Number(weeks.week1?.wppLeads ?? 0),
          syncedWithMeta: !weeks.week1?.isFuture,
          lastMetaSync: weeks.week1?.isFuture ? undefined : new Date().toISOString(),
        },
        week2: {
          ...scorecard.weeks.week2,
          formSpend: Number(weeks.week2?.formSpend ?? 0),
          formLeads: Number(weeks.week2?.formLeads ?? 0),
          wppSpend: Number(weeks.week2?.wppSpend ?? 0),
          wppLeads: Number(weeks.week2?.wppLeads ?? 0),
          syncedWithMeta: !weeks.week2?.isFuture,
          lastMetaSync: weeks.week2?.isFuture ? undefined : new Date().toISOString(),
        },
        week3: {
          ...scorecard.weeks.week3,
          formSpend: Number(weeks.week3?.formSpend ?? 0),
          formLeads: Number(weeks.week3?.formLeads ?? 0),
          wppSpend: Number(weeks.week3?.wppSpend ?? 0),
          wppLeads: Number(weeks.week3?.wppLeads ?? 0),
          syncedWithMeta: !weeks.week3?.isFuture,
          lastMetaSync: weeks.week3?.isFuture ? undefined : new Date().toISOString(),
        },
        week4: {
          ...scorecard.weeks.week4,
          formSpend: Number(weeks.week4?.formSpend ?? 0),
          formLeads: Number(weeks.week4?.formLeads ?? 0),
          wppSpend: Number(weeks.week4?.wppSpend ?? 0),
          wppLeads: Number(weeks.week4?.wppLeads ?? 0),
          syncedWithMeta: !weeks.week4?.isFuture,
          lastMetaSync: weeks.week4?.isFuture ? undefined : new Date().toISOString(),
        },
      };

      const updatedScorecard: PautaScorecard = {
        ...scorecard,
        weeks: updatedWeeks,
        updatedAt: new Date().toISOString(),
        updatedBy: `${profile?.displayName || 'Usuario'} (Meta Ads: ${cleanAccountId})`,
      };

      setScorecard(updatedScorecard);
      saveScorecard(updatedScorecard);

      // Also persist token/accountId to client if they were not saved
      if (token !== client.metaAccessToken || accountId !== client.metaAdAccountId) {
        const updatedClient: Client = {
          ...client,
          metaAdAccountId: accountId,
          metaAccessToken: token,
        };
        if (isDemoMode) {
          const stored = localStorage.getItem('demo-clients');
          const demoClients = stored ? JSON.parse(stored) : [];
          const updatedList = demoClients.map((c: any) => c.id === client.id ? updatedClient : c);
          localStorage.setItem('demo-clients', JSON.stringify(updatedList));
        } else {
          setDoc(doc(db, 'clients', client.id), updatedClient, { merge: true }).catch(console.error);
        }
        if (onUpdateClient) onUpdateClient(updatedClient);
      }

      setIsMetaModalOpen(false);
      toast.success(
        `¡Sincronización con Meta exitosa! Total período: $${(totalSpend || 0).toLocaleString('es-AR')} y ${totalLeads || 0} leads.`
      );

      const hasFutureWeeks = Object.values(weeks).some((w: any) => w.isFuture);
      if (hasFutureWeeks) {
        toast.info("Las semanas futuras quedaron en $0 ya que sus fechas aún no han transcurrido.");
      }
    } catch (e: any) {
      console.error("Error sincronizando con Meta:", e);
      toast.error(`Error al sincronizar con Meta Ads: ${e.message || e}`);
    } finally {
      setIsSyncingMeta(false);
    }
  };

  // Quick Activate Pauta Service
  const handleQuickActivatePauta = async () => {
    try {
      const updatedClient: Client = {
        ...client,
        hasPautaService: true,
        pautaCurrency: client.pautaCurrency || 'ARS',
      };

      if (isDemoMode) {
        const stored = localStorage.getItem('demo-clients');
        const demoClients = stored ? JSON.parse(stored) : [];
        const updatedList = demoClients.map((c: any) => c.id === client.id ? updatedClient : c);
        localStorage.setItem('demo-clients', JSON.stringify(updatedList));
        window.dispatchEvent(new CustomEvent('demo-clients-updated'));
      } else {
        await setDoc(doc(db, 'clients', client.id), updatedClient, { merge: true });
      }

      if (onUpdateClient) {
        onUpdateClient(updatedClient);
      }
      toast.success("¡Servicio de Pauta activado exitosamente para este cliente!");
    } catch (e: any) {
      toast.error(`Error al activar pauta: ${e.message || e}`);
    }
  };

  // Save Client Meta Settings
  const handleSaveSettings = async () => {
    try {
      const updatedClient: Client = {
        ...client,
        metaAdAccountId: metaAccountId,
        metaAccessToken: metaAccessToken,
        pautaTargetCPL: targetCPL ? Number(targetCPL) : undefined,
        pautaCurrency: currency as any,
      };

      if (isDemoMode) {
        const stored = localStorage.getItem('demo-clients');
        const demoClients = stored ? JSON.parse(stored) : [];
        const updatedList = demoClients.map((c: any) => c.id === client.id ? updatedClient : c);
        localStorage.setItem('demo-clients', JSON.stringify(updatedList));
      } else {
        await setDoc(doc(db, 'clients', client.id), updatedClient, { merge: true });
      }

      if (onUpdateClient) {
        onUpdateClient(updatedClient);
      }

      toast.success("Configuración de Meta Ads y CPL objetivo guardada.");
      setIsSettingsOpen(false);
    } catch (e: any) {
      toast.error(`Error al guardar configuración: ${e.message || e}`);
    }
  };

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    const data = [
      ['KODEAR / EFECTO DIGITAL - SCORECARD DE PAUTA'],
      [`Cliente: ${client.name}`, `Mes: ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`, `Moneda: ${currency}`],
      [],
      ['CAMPAÑAS DE FORM'],
      [
        'Responsable', 'Variables',
        `Semana 1 (${w1.startDate || '1 al 7'})`, '%',
        `Semana 2 (${w2.startDate || '8 al 14'})`, '%',
        `Semana 3 (${w3.startDate || '15 al 21'})`, '%',
        `Semana 4 (${w4.startDate || '22 al fin'})`, '%',
        'Resumen Mes', '% Total'
      ],
      ['Paid', 'Inversión total hasta la fecha', w1.formSpend, '', w2.formSpend, '', w3.formSpend, '', w4.formSpend, '', totalFormSpend, ''],
      ['Paid', 'CPL total a la fecha', w1.formLeads > 0 ? (w1.formSpend / w1.formLeads) : 0, '', w2.formLeads > 0 ? (w2.formSpend / w2.formLeads) : 0, '', w3.formLeads > 0 ? (w3.formSpend / w3.formLeads) : 0, '', w4.formLeads > 0 ? (w4.formSpend / w4.formLeads) : 0, '', totalFormCPL, ''],
      ['Paid', 'Leads total a la fecha', w1.formLeads, '100%', w2.formLeads, '100%', w3.formLeads, '100%', w4.formLeads, '100%', totalFormLeads, '100%'],
      ['Comercial', 'Leads Contactados', w1.formContacted, formatPct(w1.formContacted, w1.formLeads), w2.formContacted, formatPct(w2.formContacted, w2.formLeads), w3.formContacted, formatPct(w3.formContacted, w3.formLeads), w4.formContacted, formatPct(w4.formContacted, w4.formLeads), totalFormContacted, formatPct(totalFormContacted, totalFormLeads)],
      ['Comercial', 'Oportunidades / calidad', w1.formOpportunities, formatPct(w1.formOpportunities, w1.formLeads), w2.formOpportunities, formatPct(w2.formOpportunities, w2.formLeads), w3.formOpportunities, formatPct(w3.formOpportunities, w3.formLeads), w4.formOpportunities, formatPct(w4.formOpportunities, w4.formLeads), totalFormOpps, formatPct(totalFormOpps, totalFormLeads)],
      ['Comercial', 'Reuniones pactadas', w1.formMeetings, formatPct(w1.formMeetings, w1.formLeads), w2.formMeetings, formatPct(w2.formMeetings, w2.formLeads), w3.formMeetings, formatPct(w3.formMeetings, w3.formLeads), w4.formMeetings, formatPct(w4.formMeetings, w4.formLeads), totalFormMeetings, formatPct(totalFormMeetings, totalFormLeads)],
      ['Comercial', 'Ventas', w1.formSales, formatPct(w1.formSales, w1.formLeads), w2.formSales, formatPct(w2.formSales, w2.formLeads), w3.formSales, formatPct(w3.formSales, w3.formLeads), w4.formSales, formatPct(w4.formSales, w4.formLeads), totalFormSales, formatPct(totalFormSales, totalFormLeads)],
      [],
      ['CAMPAÑAS DE WHATSAPP'],
      [
        'Responsable', 'Variables',
        `Semana 1 (${w1.startDate || '1 al 7'})`, '%',
        `Semana 2 (${w2.startDate || '8 al 14'})`, '%',
        `Semana 3 (${w3.startDate || '15 al 21'})`, '%',
        `Semana 4 (${w4.startDate || '22 al fin'})`, '%',
        'Resumen Mes', '% Total'
      ],
      ['Paid', 'Inversión total hasta la fecha', w1.wppSpend, '', w2.wppSpend, '', w3.wppSpend, '', w4.wppSpend, '', totalWppSpend, ''],
      ['Paid', 'CPL total a la fecha', w1.wppLeads > 0 ? (w1.wppSpend / w1.wppLeads) : 0, '', w2.wppLeads > 0 ? (w2.wppSpend / w2.wppLeads) : 0, '', w3.wppLeads > 0 ? (w3.wppSpend / w3.wppLeads) : 0, '', w4.wppLeads > 0 ? (w4.wppSpend / w4.wppLeads) : 0, '', totalWppCPL, ''],
      ['Paid', 'Leads total a la fecha', w1.wppLeads, '100%', w2.wppLeads, '100%', w3.wppLeads, '100%', w4.wppLeads, '100%', totalWppLeads, '100%'],
      ['Comercial', 'Leads Contactados', w1.wppContacted, formatPct(w1.wppContacted, w1.wppLeads), w2.wppContacted, formatPct(w2.wppContacted, w2.wppLeads), w3.wppContacted, formatPct(w3.wppContacted, w3.wppLeads), w4.wppContacted, formatPct(w4.wppContacted, w4.wppLeads), totalWppContacted, formatPct(totalWppContacted, totalWppLeads)],
      ['Comercial', 'Oportunidades / calidad', w1.wppOpportunities, formatPct(w1.wppOpportunities, w1.wppLeads), w2.wppOpportunities, formatPct(w2.wppOpportunities, w2.wppLeads), w3.wppOpportunities, formatPct(w3.wppOpportunities, w3.wppLeads), w4.wppOpportunities, formatPct(w4.wppOpportunities, w4.wppLeads), totalWppOpps, formatPct(totalWppOpps, totalWppLeads)],
      ['Comercial', 'Visitas / Reuniones pactadas', w1.wppMeetings, formatPct(w1.wppMeetings, w1.wppLeads), w2.wppMeetings, formatPct(w2.wppMeetings, w2.wppLeads), w3.wppMeetings, formatPct(w3.wppMeetings, w3.wppLeads), w4.wppMeetings, formatPct(w4.wppMeetings, w4.wppLeads), totalWppMeetings, formatPct(totalWppMeetings, totalWppLeads)],
      ['Comercial', 'Ventas', w1.wppSales, formatPct(w1.wppSales, w1.wppLeads), w2.wppSales, formatPct(w2.wppSales, w2.wppLeads), w3.wppSales, formatPct(w3.wppSales, w3.wppLeads), w4.wppSales, formatPct(w4.wppSales, w4.wppLeads), totalWppSales, formatPct(totalWppSales, totalWppLeads)],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Pauta ${MONTH_NAMES[selectedMonth - 1]}`);
    XLSX.writeFile(wb, `Scorecard_Pauta_${client.name.replace(/\s+/g, '_')}_${selectedYear}_${selectedMonth}.xlsx`);
    toast.success("Planilla de Pauta exportada a Excel exitosamente.");
  };

  // Copy Summary text for WhatsApp/Slack
  const handleCopySummary = () => {
    const text = `📊 *SCORECARD DE PAUTA - ${client.name.toUpperCase()}*
🗓 *Mes:* ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}

💰 *Inversión Total:* ${formatMoney(grandTotalSpend)}
🎯 *Leads Totales:* ${grandTotalLeads} (Forms: ${totalFormLeads} | WPP: ${totalWppLeads})
📉 *CPL Promedio:* ${formatMoney(grandTotalCPL)}
🤝 *Reuniones / Visitas:* ${grandTotalMeetings} (${formatPct(grandTotalMeetings, grandTotalLeads)})
🏆 *Ventas Cerradas:* ${grandTotalSales} (${formatPct(grandTotalSales, grandTotalLeads)})

_Generado automáticamente desde la plataforma Efecto Digital_`;

    navigator.clipboard.writeText(text);
    toast.success("Resumen copiado al portapapeles listo para enviar por WhatsApp.");
  };

  const renderTableSection = (
    title: string,
    prefix: 'form' | 'wpp',
    meetingLabel: string,
    isFirst: boolean = true
  ) => {
    const spendKey = `${prefix}Spend` as keyof PautaWeekData;
    const leadsKey = `${prefix}Leads` as keyof PautaWeekData;
    const contactedKey = `${prefix}Contacted` as keyof PautaWeekData;
    const oppsKey = `${prefix}Opportunities` as keyof PautaWeekData;
    const meetingsKey = `${prefix}Meetings` as keyof PautaWeekData;
    const salesKey = `${prefix}Sales` as keyof PautaWeekData;

    const totSpend = prefix === 'form' ? totalFormSpend : totalWppSpend;
    const totLeads = prefix === 'form' ? totalFormLeads : totalWppLeads;
    const totContacted = prefix === 'form' ? totalFormContacted : totalWppContacted;
    const totOpps = prefix === 'form' ? totalFormOpps : totalWppOpps;
    const totMeetings = prefix === 'form' ? totalFormMeetings : totalWppMeetings;
    const totSales = prefix === 'form' ? totalFormSales : totalWppSales;
    const totCPL = prefix === 'form' ? totalFormCPL : totalWppCPL;

    const weeksList: ('week1' | 'week2' | 'week3' | 'week4')[] = ['week1', 'week2', 'week3', 'week4'];

    return (
      <div className="overflow-hidden rounded-xl border border-red-900/30 shadow-md bg-card mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              {/* Header Row */}
              <tr className="bg-[#b91c1c] text-white font-extrabold uppercase text-[11px] tracking-wider border-b border-red-950/20">
                <th className="p-3 text-center w-28 bg-[#991b1b] font-black border-r border-red-900/50" rowSpan={8}>
                  <div className="text-center font-black text-sm uppercase leading-tight">
                    {title}
                  </div>
                </th>
                <th className="p-2.5 text-left border-r border-red-800/40 w-24">Responsable</th>
                <th className="p-2.5 text-left border-r border-red-800/40 min-w-[180px]">Variables</th>

                {/* Week 1 */}
                <th className="p-2 text-center border-r border-red-800/40 min-w-[110px]">
                  <div className="leading-tight">Semana 1</div>
                  <div className="text-[9px] font-normal opacity-90">({w1.startDate || defaultRanges.week1.start} al {w1.endDate || defaultRanges.week1.end})</div>
                </th>
                <th className="p-2 text-center border-r border-red-800/40 w-14 bg-red-900/40">%</th>

                {/* Week 2 */}
                <th className="p-2 text-center border-r border-red-800/40 min-w-[110px]">
                  <div className="leading-tight">Semana 2</div>
                  <div className="text-[9px] font-normal opacity-90">({w2.startDate || defaultRanges.week2.start} al {w2.endDate || defaultRanges.week2.end})</div>
                </th>
                <th className="p-2 text-center border-r border-red-800/40 w-14 bg-red-900/40">%</th>

                {/* Week 3 */}
                <th className="p-2 text-center border-r border-red-800/40 min-w-[110px]">
                  <div className="leading-tight">Semana 3</div>
                  <div className="text-[9px] font-normal opacity-90">({w3.startDate || defaultRanges.week3.start} al {w3.endDate || defaultRanges.week3.end})</div>
                </th>
                <th className="p-2 text-center border-r border-red-800/40 w-14 bg-red-900/40">%</th>

                {/* Week 4 */}
                <th className="p-2 text-center border-r border-red-800/40 min-w-[110px]">
                  <div className="leading-tight">Semana 4</div>
                  <div className="text-[9px] font-normal opacity-90">({w4.startDate || defaultRanges.week4.start} al {w4.endDate || defaultRanges.week4.end})</div>
                </th>
                <th className="p-2 text-center border-r border-red-800/40 w-14 bg-red-900/40">%</th>

                {/* Resumen Mes */}
                <th className="p-2.5 text-center bg-[#7f1d1d] text-white min-w-[130px] font-black border-r border-red-900/50">
                  Resumen Mes
                </th>
                <th className="p-2 text-center bg-[#5c1414] text-white w-16 font-black">% Total</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border/20 text-foreground">
              {/* Row 1: Inversión */}
              <tr className="hover:bg-muted/30 transition-colors">
                <td className="p-2 font-bold text-muted-foreground border-r border-border/20">Paid</td>
                <td className="p-2 font-semibold text-foreground border-r border-border/20">Inversión total hasta la fecha</td>
                {weeksList.map((wk) => (
                  <React.Fragment key={`${wk}-spend`}>
                    <td className="p-1.5 border-r border-border/20">
                      <div className="relative flex items-center">
                        <span className="absolute left-2 text-[10px] text-muted-foreground font-mono">{currencySymbol}</span>
                        <input
                          type="number"
                          value={scorecard.weeks[wk][spendKey] || ''}
                          onChange={(e) => handleCellChange(wk, spendKey, e.target.value)}
                          placeholder="0"
                          className="w-full pl-6 pr-2 py-1 text-xs font-mono font-bold bg-transparent text-right rounded border border-transparent hover:border-border/50 focus:border-primary focus:bg-background focus:outline-none"
                        />
                      </div>
                    </td>
                    <td className="p-2 text-center border-r border-border/20 bg-muted/10 text-muted-foreground text-[10px]">---</td>
                  </React.Fragment>
                ))}
                <td className="p-2 text-right font-black font-mono bg-red-500/5 text-red-600 dark:text-red-400 border-r border-border/20">
                  {formatMoney(totSpend)}
                </td>
                <td className="p-2 text-center bg-red-500/5 text-muted-foreground text-[10px]">---</td>
              </tr>

              {/* Row 2: CPL Total */}
              <tr className="bg-muted/15 hover:bg-muted/30 transition-colors">
                <td className="p-2 font-bold text-muted-foreground border-r border-border/20">Paid</td>
                <td className="p-2 font-semibold text-foreground border-r border-border/20 flex items-center justify-between">
                  <span>CPL total a la fecha</span>
                  <span className="text-[9px] text-muted-foreground font-mono">auto</span>
                </td>
                {weeksList.map((wk) => {
                  const spend = Number(scorecard.weeks[wk][spendKey]) || 0;
                  const leads = Number(scorecard.weeks[wk][leadsKey]) || 0;
                  const cpl = leads > 0 ? spend / leads : 0;
                  const isGoal = client.pautaTargetCPL && cpl > 0 && cpl <= client.pautaTargetCPL;
                  const isHigh = client.pautaTargetCPL && cpl > client.pautaTargetCPL * 1.25;

                  return (
                    <React.Fragment key={`${wk}-cpl`}>
                      <td className="p-2 text-right font-mono font-bold border-r border-border/20">
                        <span className={isGoal ? 'text-emerald-600 dark:text-emerald-400' : isHigh ? 'text-rose-500' : 'text-foreground'}>
                          {formatMoney(cpl)}
                        </span>
                      </td>
                      <td className="p-2 text-center border-r border-border/20 bg-muted/10 text-muted-foreground text-[10px]">---</td>
                    </React.Fragment>
                  );
                })}
                <td className="p-2 text-right font-black font-mono bg-red-500/5 text-red-600 dark:text-red-400 border-r border-border/20">
                  {formatMoney(totCPL)}
                </td>
                <td className="p-2 text-center bg-red-500/5 text-muted-foreground text-[10px]">---</td>
              </tr>

              {/* Row 3: Leads Total */}
              <tr className="hover:bg-muted/30 transition-colors">
                <td className="p-2 font-bold text-muted-foreground border-r border-border/20">Paid</td>
                <td className="p-2 font-bold text-primary border-r border-border/20">Leads total a la fecha</td>
                {weeksList.map((wk) => (
                  <React.Fragment key={`${wk}-leads`}>
                    <td className="p-1.5 border-r border-border/20">
                      <input
                        type="number"
                        value={scorecard.weeks[wk][leadsKey] || ''}
                        onChange={(e) => handleCellChange(wk, leadsKey, e.target.value)}
                        placeholder="0"
                        className="w-full px-2 py-1 text-xs font-mono font-black text-right text-primary bg-primary/5 rounded border border-transparent hover:border-primary/30 focus:border-primary focus:bg-background focus:outline-none"
                      />
                    </td>
                    <td className="p-2 text-center border-r border-border/20 bg-primary/5 text-primary font-bold text-[10px]">100%</td>
                  </React.Fragment>
                ))}
                <td className="p-2 text-right font-black font-mono bg-primary/10 text-primary border-r border-border/20">
                  {totLeads}
                </td>
                <td className="p-2 text-center bg-primary/10 text-primary font-black text-[10px]">100%</td>
              </tr>

              {/* Row 4: Leads Contactados */}
              <tr className="hover:bg-muted/30 transition-colors">
                <td className="p-2 font-bold text-muted-foreground border-r border-border/20">Comercial</td>
                <td className="p-2 font-semibold text-foreground border-r border-border/20">Leads Contactados</td>
                {weeksList.map((wk) => {
                  const val = Number(scorecard.weeks[wk][contactedKey]) || 0;
                  const total = Number(scorecard.weeks[wk][leadsKey]) || 0;
                  return (
                    <React.Fragment key={`${wk}-contacted`}>
                      <td className="p-1.5 border-r border-border/20">
                        <input
                          type="number"
                          value={scorecard.weeks[wk][contactedKey] || ''}
                          onChange={(e) => handleCellChange(wk, contactedKey, e.target.value)}
                          placeholder="0"
                          className="w-full px-2 py-1 text-xs font-mono font-bold text-right bg-transparent rounded border border-transparent hover:border-border/50 focus:border-primary focus:bg-background focus:outline-none"
                        />
                      </td>
                      <td className="p-2 text-center border-r border-border/20 bg-muted/20 font-bold text-[10px] text-foreground font-mono">
                        {formatPct(val, total)}
                      </td>
                    </React.Fragment>
                  );
                })}
                <td className="p-2 text-right font-black font-mono bg-muted/40 border-r border-border/20">{totContacted}</td>
                <td className="p-2 text-center bg-muted/40 font-black font-mono text-[10px]">{formatPct(totContacted, totLeads)}</td>
              </tr>

              {/* Row 5: Oportunidades / Calidad */}
              <tr className="hover:bg-muted/30 transition-colors">
                <td className="p-2 font-bold text-muted-foreground border-r border-border/20">Comercial</td>
                <td className="p-2 font-semibold text-foreground border-r border-border/20">Oportunidades / calidad</td>
                {weeksList.map((wk) => {
                  const val = Number(scorecard.weeks[wk][oppsKey]) || 0;
                  const total = Number(scorecard.weeks[wk][leadsKey]) || 0;
                  return (
                    <React.Fragment key={`${wk}-opps`}>
                      <td className="p-1.5 border-r border-border/20">
                        <input
                          type="number"
                          value={scorecard.weeks[wk][oppsKey] || ''}
                          onChange={(e) => handleCellChange(wk, oppsKey, e.target.value)}
                          placeholder="0"
                          className="w-full px-2 py-1 text-xs font-mono font-bold text-right bg-transparent rounded border border-transparent hover:border-border/50 focus:border-primary focus:bg-background focus:outline-none"
                        />
                      </td>
                      <td className="p-2 text-center border-r border-border/20 bg-muted/20 font-bold text-[10px] text-foreground font-mono">
                        {formatPct(val, total)}
                      </td>
                    </React.Fragment>
                  );
                })}
                <td className="p-2 text-right font-black font-mono bg-muted/40 border-r border-border/20">{totOpps}</td>
                <td className="p-2 text-center bg-muted/40 font-black font-mono text-[10px]">{formatPct(totOpps, totLeads)}</td>
              </tr>

              {/* Row 6: Reuniones / Visitas pactadas */}
              <tr className="hover:bg-muted/30 transition-colors">
                <td className="p-2 font-bold text-muted-foreground border-r border-border/20">Comercial</td>
                <td className="p-2 font-semibold text-foreground border-r border-border/20">{meetingLabel}</td>
                {weeksList.map((wk) => {
                  const val = Number(scorecard.weeks[wk][meetingsKey]) || 0;
                  const total = Number(scorecard.weeks[wk][leadsKey]) || 0;
                  return (
                    <React.Fragment key={`${wk}-meetings`}>
                      <td className="p-1.5 border-r border-border/20">
                        <input
                          type="number"
                          value={scorecard.weeks[wk][meetingsKey] || ''}
                          onChange={(e) => handleCellChange(wk, meetingsKey, e.target.value)}
                          placeholder="0"
                          className="w-full px-2 py-1 text-xs font-mono font-bold text-right bg-transparent rounded border border-transparent hover:border-border/50 focus:border-primary focus:bg-background focus:outline-none"
                        />
                      </td>
                      <td className="p-2 text-center border-r border-border/20 bg-muted/20 font-bold text-[10px] text-foreground font-mono">
                        {formatPct(val, total)}
                      </td>
                    </React.Fragment>
                  );
                })}
                <td className="p-2 text-right font-black font-mono bg-muted/40 border-r border-border/20">{totMeetings}</td>
                <td className="p-2 text-center bg-muted/40 font-black font-mono text-[10px]">{formatPct(totMeetings, totLeads)}</td>
              </tr>

              {/* Row 7: Ventas */}
              <tr className="bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors font-bold">
                <td className="p-2 font-bold text-emerald-600 dark:text-emerald-400 border-r border-border/20">Comercial</td>
                <td className="p-2 font-bold text-emerald-600 dark:text-emerald-400 border-r border-border/20 flex items-center justify-between">
                  <span>Ventas cerradas</span>
                  <span>🏆</span>
                </td>
                {weeksList.map((wk) => {
                  const val = Number(scorecard.weeks[wk][salesKey]) || 0;
                  const total = Number(scorecard.weeks[wk][leadsKey]) || 0;
                  return (
                    <React.Fragment key={`${wk}-sales`}>
                      <td className="p-1.5 border-r border-border/20">
                        <input
                          type="number"
                          value={scorecard.weeks[wk][salesKey] || ''}
                          onChange={(e) => handleCellChange(wk, salesKey, e.target.value)}
                          placeholder="0"
                          className="w-full px-2 py-1 text-xs font-mono font-black text-right text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded border border-transparent hover:border-emerald-500/30 focus:border-emerald-500 focus:bg-background focus:outline-none"
                        />
                      </td>
                      <td className="p-2 text-center border-r border-border/20 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black text-[10px] font-mono">
                        {formatPct(val, total)}
                      </td>
                    </React.Fragment>
                  );
                })}
                <td className="p-2 text-right font-black font-mono bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-r border-border/20">
                  {totSales}
                </td>
                <td className="p-2 text-center bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-black font-mono text-[10px]">
                  {formatPct(totSales, totLeads)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 space-y-6 animate-fade-in">
      {/* Top Header & Context */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-border/20 pb-6">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-md bg-red-600 text-white font-black text-[9px] uppercase tracking-wider flex items-center gap-1 shadow-sm">
              <Megaphone size={11} />
              SCORECARD DE PAUTA
            </span>
            {client.hasPautaService ? (
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-[9px] uppercase flex items-center gap-1 border border-emerald-500/20">
                ✓ Servicio Activo
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold text-[9px] uppercase flex items-center gap-1 border border-amber-500/20">
                ⚠️ Servicio Desactivado
              </span>
            )}
            {client.metaAdAccountId && (
              <span className="px-2 py-0.5 rounded-md bg-blue-600/15 text-blue-600 dark:text-blue-400 font-bold text-[9px] uppercase flex items-center gap-1 border border-blue-600/20">
                <Link2 size={10} />
                Meta Ads: {client.metaAdAccountId}
              </span>
            )}
            <span className="text-xs text-muted-foreground font-semibold">
              Espacio de {client.name}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-foreground uppercase tracking-tight italic mt-1.5 flex items-center gap-2">
            Control de Pauta & Rendimiento Semanal
          </h2>
          <p className="text-xs text-muted-foreground max-w-2xl mt-0.5">
            Monitoreo continuo de inversión publicitaria, costo por lead (CPL), embudo de contacto y conversión en ventas por semanas.
          </p>
        </div>

        {/* Month Selector and Action Tools */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Saving Indicator */}
          <div className="text-[10px] font-bold px-2 py-1 rounded bg-muted text-muted-foreground flex items-center gap-1">
            {savingStatus === 'saving' && <RefreshCw size={10} className="animate-spin text-primary" />}
            {savingStatus === 'saved' && <CheckCircle2 size={10} className="text-emerald-500" />}
            <span>{savingStatus === 'saving' ? 'Guardando...' : savingStatus === 'saved' ? 'Guardado ✓' : 'Sincronizado'}</span>
          </div>

          {/* Month Navigator */}
          <div className="flex items-center bg-card border border-border rounded-xl p-1 shadow-sm">
            <button
              onClick={handlePrevMonth}
              className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer border-none bg-transparent"
              title="Mes Anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="px-3 text-center min-w-[130px]">
              <span className="font-extrabold text-xs text-foreground uppercase tracking-wide">
                {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
              </span>
            </div>
            <button
              onClick={handleNextMonth}
              className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer border-none bg-transparent"
              title="Mes Siguiente"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Actions */}
          <Button
            size="sm"
            onClick={() => setIsMetaModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-1.5 h-9 shadow-sm"
          >
            <Sparkles size={14} />
            <span className="hidden sm:inline">Sincronizar</span> Meta
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleAutoFillFromCRM}
            className="font-bold text-xs gap-1.5 h-9 bg-card border-border shadow-sm hover:bg-primary/10 hover:text-primary"
            title="Calcular automáticamente leads y conversiones desde el CRM"
          >
            <RefreshCw size={13} />
            <span className="hidden sm:inline">Auto-llenar</span> CRM
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportExcel}
            className="font-bold text-xs gap-1.5 h-9 bg-card border-border shadow-sm hover:bg-muted"
            title="Exportar a archivo Excel"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Excel</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopySummary}
            className="h-9 px-2 text-muted-foreground hover:text-foreground"
            title="Copiar resumen para WhatsApp o Slack"
          >
            <Copy size={15} />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsSettingsOpen(true)}
            className="h-9 px-2 text-muted-foreground hover:text-foreground"
            title="Configuración de Meta Ads y CPL"
          >
            <Settings size={15} />
          </Button>
        </div>
      </div>

      {/* Direct In-View Activation Banner if Pauta is not yet active */}
      {!client.hasPautaService && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-red-500/10 via-amber-500/10 to-red-500/5 border-2 border-dashed border-red-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xl">📢</span>
              <h3 className="text-sm sm:text-base font-black text-foreground uppercase tracking-tight">
                El servicio de Pauta Publicitaria está desactivado para este cliente
              </h3>
            </div>
            <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
              Al activarlo, se guardará en la ficha del cliente, permitiendo el cálculo de CPL, métricas de pauta en el panel general y la sincronización con Meta Ads.
            </p>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
            <Button
              onClick={handleQuickActivatePauta}
              className="bg-red-600 hover:bg-red-700 text-white font-black text-xs gap-2 px-5 py-2.5 h-auto shadow-md cursor-pointer w-full md:w-auto"
            >
              <Megaphone size={15} />
              Activar Servicio de Pauta Ahora
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsSettingsOpen(true)}
              className="bg-background text-foreground font-bold text-xs px-3 py-2.5 h-auto border-border"
              title="Ajustar Moneda, CPL y Meta Account ID"
            >
              <Settings size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* KPI Cards Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-[10px] uppercase font-black tracking-wider">
            <span>Inversión Total</span>
            <DollarSign size={13} className="text-red-500" />
          </div>
          <p className="text-lg sm:text-xl font-black font-mono text-foreground leading-tight">
            {formatMoney(grandTotalSpend)}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Form: {formatMoney(totalFormSpend)} | WPP: {formatMoney(totalWppSpend)}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-[10px] uppercase font-black tracking-wider">
            <span>Leads Totales</span>
            <Users size={13} className="text-primary" />
          </div>
          <p className="text-lg sm:text-xl font-black font-mono text-primary leading-tight">
            {grandTotalLeads}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {totalFormLeads} Forms + {totalWppLeads} WhatsApp
          </p>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-[10px] uppercase font-black tracking-wider">
            <span>CPL Promedio</span>
            <Target size={13} className="text-amber-500" />
          </div>
          <p className="text-lg sm:text-xl font-black font-mono text-foreground leading-tight">
            {formatMoney(grandTotalCPL)}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {client.pautaTargetCPL ? `Objetivo: ${formatMoney(client.pautaTargetCPL)}` : 'Sin meta fijada'}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-[10px] uppercase font-black tracking-wider">
            <span>Reuniones / Visitas</span>
            <Calendar size={13} className="text-blue-500" />
          </div>
          <p className="text-lg sm:text-xl font-black font-mono text-foreground leading-tight">
            {grandTotalMeetings}
          </p>
          <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
            {formatPct(grandTotalMeetings, grandTotalLeads)} conversión
          </p>
        </div>

        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 shadow-sm space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 text-[10px] uppercase font-black tracking-wider">
            <span>Ventas Cerradas</span>
            <TrendingUp size={13} className="text-emerald-600" />
          </div>
          <p className="text-lg sm:text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 leading-tight">
            {grandTotalSales}
          </p>
          <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
            {formatPct(grandTotalSales, grandTotalLeads)} de tasa de cierre
          </p>
        </div>
      </div>

      {/* Main Scorecard Tables */}
      <div>
        {renderTableSection("Campañas de form", "form", "Reuniones pactadas", true)}
        {renderTableSection("Campañas de wpp", "wpp", "Visitas / Reuniones pactadas", false)}
      </div>

      {/* Observaciones y Notas Estratégicas del Mes */}
      <Card className="border border-border shadow-sm bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
            <Edit3 size={15} className="text-primary" />
            Diagnóstico & Observaciones Semanales de Pauta
          </CardTitle>
          <CardDescription className="text-xs">
            Notas de optimización de anuncios, audiencias y comentarios del equipo comercial.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <textarea
            value={scorecard.notes || ''}
            onChange={(e) => {
              const val = e.target.value;
              setScorecard(prev => {
                const updated = { ...prev, notes: val, updatedAt: new Date().toISOString() };
                saveScorecard(updated);
                return updated;
              });
            }}
            placeholder="Escribe comentarios sobre las campañas, desvíos de CPL, creativos ganadores o cambios en el embudo comercial de este mes..."
            rows={3}
            className="w-full p-3 text-xs bg-background border border-border rounded-xl font-medium focus:ring-1 focus:ring-primary focus:outline-none resize-none text-foreground"
          />
        </CardContent>
      </Card>

      {/* Modal: Meta Ads Integration & Sync */}
      <Dialog open={isMetaModalOpen} onOpenChange={setIsMetaModalOpen}>
        <DialogContent className="sm:max-w-[480px] bg-card border border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-base font-black uppercase tracking-tight flex items-center gap-2">
              <span className="p-1 rounded-lg bg-blue-600/10 text-blue-600">
                <Sparkles size={16} />
              </span>
              Sincronización con Meta Marketing API
            </DialogTitle>
            <DialogDescription className="text-xs">
              Conecta automáticamente la cuenta publicitaria de {client.name} para importar la inversión gastada y los leads de cada semana.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-blue-600 dark:text-blue-400 text-[11px] uppercase tracking-wider">
                <CheckCircle2 size={13} />
                ¿Qué datos sincroniza?
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Importa el <strong>gasto exacto por período (spend)</strong>, los <strong>leads totales</strong> de las campañas de Facebook e Instagram y calcula automáticamente el <strong>CPL real</strong> semana a semana.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black text-muted-foreground">ID de Cuenta Publicitaria de Meta</Label>
              <Input
                type="text"
                value={metaAccountId}
                onChange={(e) => setMetaAccountId(e.target.value)}
                placeholder="Ej. act_123456789012345 o 123456789012345"
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black text-muted-foreground">Meta System User / Access Token (Opcional)</Label>
              <Input
                type="password"
                value={metaAccessToken}
                onChange={(e) => setMetaAccessToken(e.target.value)}
                placeholder="EAABw..."
                className="h-9 text-xs font-mono"
              />
              <p className="text-[9px] text-muted-foreground">
                Si no se provee un token directo, se utiliza la conexión autorizada de la agencia o el simulador de sincronización.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" size="sm" onClick={() => setIsMetaModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSyncMeta}
              disabled={isSyncingMeta}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-1.5"
            >
              {isSyncingMeta ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {isSyncingMeta ? 'Consultando Meta API...' : 'Sincronizar Ahora'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Scorecard & Pauta Settings */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-[440px] bg-card border border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-base font-black uppercase tracking-tight flex items-center gap-2">
              <Settings size={16} className="text-primary" />
              Configuración de Pauta del Cliente
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ajusta los parámetros financieros y credenciales de Meta para {client.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Moneda del Scorecard</Label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as any)}
                  className="w-full h-9 text-xs bg-background border border-border rounded-lg px-2.5 font-medium text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                >
                  <option value="ARS">ARS ($ - Pesos Arg)</option>
                  <option value="USD">USD (US$ - Dólar)</option>
                  <option value="EUR">EUR (€ - Euros)</option>
                  <option value="MXN">MXN ($ - Pesos Mex)</option>
                  <option value="CLP">CLP ($ - Pesos Chilenos)</option>
                  <option value="COP">COP ($ - Pesos Col)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">CPL Objetivo Máximo</Label>
                <Input
                  type="number"
                  value={targetCPL}
                  onChange={(e) => setTargetCPL(e.target.value)}
                  placeholder="Ej. 8500"
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">ID Cuenta Publicitaria (Meta Ads)</Label>
              <Input
                type="text"
                value={metaAccountId}
                onChange={(e) => setMetaAccountId(e.target.value)}
                placeholder="act_xxxxxxxxxxx"
                className="h-9 text-xs font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setIsSettingsOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSaveSettings} className="font-bold text-xs">
              Guardar Configuración
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
