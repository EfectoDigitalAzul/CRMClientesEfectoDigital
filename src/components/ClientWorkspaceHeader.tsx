import React from 'react';
import { Client, UserProfile } from '../types';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Briefcase,
  ArrowLeft,
  Calendar,
  Users,
  Megaphone,
  CheckSquare,
  FileCode,
  Sparkles,
  ChevronRight,
  TrendingUp,
  CreditCard,
  Edit3
} from 'lucide-react';
import { parseISO } from 'date-fns';

interface ClientWorkspaceHeaderProps {
  client: Client;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onBackToAgency: () => void;
  onOpenFicha: () => void;
  profile: UserProfile | null;
  leadViewMode?: 'table' | 'followup';
  onLeadViewModeChange?: (mode: 'table' | 'followup') => void;
}

export default function ClientWorkspaceHeader({
  client,
  activeTab,
  onTabChange,
  onBackToAgency,
  onOpenFicha,
  profile,
  leadViewMode = 'table',
  onLeadViewModeChange
}: ClientWorkspaceHeaderProps) {
  const isClientUser = profile?.role === 'client';
  const isStaff = !isClientUser;
  const isInactive = client.status && ['completed', 'cancelled'].includes(client.status);

  // Contract expiration check
  const isLastMonth = (() => {
    if (isInactive || !client.contractEndDate) return false;
    try {
      const end = parseISO(client.contractEndDate);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const diffTime = end.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 30;
    } catch {
      return false;
    }
  })();

  const tabs: { id: string; label: string; icon: React.ReactNode; show: boolean }[] = [
    {
      id: 'dashboard',
      label: 'Escritorio & KPIs',
      icon: <TrendingUp size={15} />,
      show: true,
    },
    {
      id: 'tasks',
      label: isClientUser ? 'Mis Creativos & Tareas' : 'Tareas & Creativos',
      icon: <CheckSquare size={15} />,
      show: true,
    },
    {
      id: 'leads',
      label: 'Leads & CRM',
      icon: <Users size={15} />,
      show: !isClientUser || (profile as any)?.canViewLeads !== false,
    },
    {
      id: 'meetings',
      label: 'Agenda & Llamadas',
      icon: <Calendar size={15} />,
      show: true,
    },
    {
      id: 'pauta',
      label: 'Pauta & Scorecard',
      icon: <Megaphone size={15} />,
      show: Boolean(client.hasPautaService || isStaff),
    },
    {
      id: 'templates',
      label: 'Plantillas',
      icon: <FileCode size={15} />,
      show: Boolean(client.templatesEnabled && isStaff),
    },
  ];

  return (
    <div className="w-full bg-card border-b border-border/40 sticky top-0 z-20 backdrop-blur-md bg-card/95 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 space-y-3">
        {/* Top Row: Navigation Breadcrumb, Client Identity & Quick Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Breadcrumb & Client Badge */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {isStaff && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBackToAgency}
                className="h-8 px-2.5 text-xs font-bold gap-1.5 bg-background border-border hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all rounded-lg"
              >
                <ArrowLeft size={13} />
                <span className="hidden sm:inline">Clientes</span>
              </Button>
            )}

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center font-black text-xs">
                <Briefcase size={16} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black tracking-tight text-foreground flex items-center gap-1.5">
                    {client.name}
                  </h2>
                  <Badge
                    variant={isInactive ? 'secondary' : 'default'}
                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                      isInactive 
                        ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' 
                        : isLastMonth
                          ? 'bg-amber-500/15 text-amber-600 border border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                    }`}
                  >
                    {isInactive ? 'Inactivo' : isLastMonth ? '⚠️ Último Mes' : 'Activo'}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-2">
                  <span>Plan: <strong className="text-foreground">{client.planName || 'Standard'}</strong></span>
                  {client.hasPautaService && (
                    <span className="text-red-500 font-bold flex items-center gap-0.5">
                      • 📢 Pauta Meta Ads
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Right Side: Contract & Ficha Actions */}
          <div className="flex items-center gap-2">
            {isStaff && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenFicha}
                className="h-8 px-3 text-xs font-bold gap-1.5 bg-background border-border hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/30 transition-all rounded-lg"
              >
                <span>📇</span>
                <span>Ficha & Contrato</span>
              </Button>
            )}
          </div>
        </div>

        {/* Bottom Row: Tab Bar Nav */}
        <div className="flex items-center justify-between border-t border-border/20 pt-2 overflow-x-auto no-scrollbar gap-2">
          <div className="flex items-center gap-1 sm:gap-1.5">
            {tabs.filter(t => t.show).map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Sub-view switcher for Leads */}
          {activeTab === 'leads' && onLeadViewModeChange && (
            <div className="flex items-center bg-muted/40 p-0.5 rounded-lg border border-border/20 shrink-0 ml-2">
              <button
                onClick={() => onLeadViewModeChange('table')}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                  leadViewMode === 'table' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                📋 Tabla Leads
              </button>
              <button
                onClick={() => onLeadViewModeChange('followup')}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                  leadViewMode === 'followup' ? 'bg-card text-primary shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                ⏰ Seguimientos
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
