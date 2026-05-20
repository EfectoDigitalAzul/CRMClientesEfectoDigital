import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { LeadStatus, ClientStatus } from "../types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getClientStatusBadgeColor(status?: ClientStatus) {
  switch (status) {
    case 'onboarding': return 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
    case 'active': return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
    case 'paused': return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
    case 'completed': return 'bg-slate-500/10 text-slate-500 border border-slate-500/20';
    case 'cancelled': return 'bg-red-500/10 text-red-500 border border-red-500/20';
    default: return 'bg-muted text-muted-foreground border border-border';
  }
}

export function getClientStatusLabel(status?: ClientStatus) {
  switch (status) {
    case 'onboarding': return 'En Marcha';
    case 'active': return 'Activo';
    case 'paused': return 'Pausado';
    case 'completed': return 'Finalizado';
    case 'cancelled': return 'Cancelado';
    default: return 'Sin Estado';
  }
}

export function getStatusBadgeColor(status: LeadStatus) {
  switch (status) {
    case 'new': return 'bg-blue-950/30 text-blue-400 border border-blue-900/50';
    case 'contacted': return 'bg-indigo-950/30 text-indigo-400 border border-indigo-900/50';
    case 'follow-up': return 'bg-orange-950/30 text-orange-400 border border-orange-900/50';
    case 'meeting-scheduled': return 'bg-purple-950/30 text-purple-400 border border-purple-900/50';
    case 'closed-won': return 'bg-green-950/30 text-green-400 border border-green-900/50';
    case 'qualified': return 'bg-emerald-500 text-white border-2 border-emerald-400 animate-pulse-subtle';
    case 'closed-lost': return 'bg-red-950/30 text-red-400 border border-red-900/50';
    case 'reschedule': return 'bg-amber-950/30 text-amber-400 border border-amber-900/50';
    case 'not-interested': return 'bg-slate-900/50 text-slate-500 border border-slate-800';
    case 'future': return 'bg-sky-950/30 text-sky-400 border border-sky-900/50';
    default: return '';
  }
}

export function getStatusLabel(status: LeadStatus) {
  switch (status) {
    case 'new': return 'Nuevo';
    case 'contacted': return 'Contactado';
    case 'follow-up': return 'Seguimiento';
    case 'meeting-scheduled': return 'Reunión';
    case 'closed-won': return 'Ganado';
    case 'closed-lost': return 'Perdido';
    case 'qualified': return 'Calificada';
    case 'reschedule': return 'Reprogramar';
    case 'not-interested': return 'No interesado';
    case 'future': return 'A futuro';
    default: return status;
  }
}

export function formatDate(date: string | Date | any) {
  if (!date) return 'N/A';
  
  try {
    let d: Date;
    
    // Handle Firestore Timestamps
    if (typeof date === 'object' && date !== null && 'toDate' in date && typeof date.toDate === 'function') {
      d = date.toDate();
    } else if (typeof date === 'string') {
      // Handle YYYY-MM-DD or YYYY/MM/DD
      if (/^\d{4}[-/]\d{2}[-/]\d{2}/.test(date)) {
        const separator = date.includes('-') ? '-' : '/';
        const parts = date.split('T')[0].split(separator);
        return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
      }
      d = new Date(date);
    } else {
      d = date;
    }

    if (!(d instanceof Date) || isNaN(d.getTime())) return 'N/A';
    
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error("Error formatting date:", error, date);
    return 'N/A';
  }
}
