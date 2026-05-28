import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, where, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Client, Lead, UserProfile } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { Trash2, RotateCcw, AlertTriangle, Users, BookOpen, Calendar, UserRound } from 'lucide-react';
import { formatDate } from '../lib/utils';

interface TrashBinProps {
  isDemoMode: boolean;
  currentProfile: UserProfile | null;
}

export default function TrashBin({ isDemoMode, currentProfile }: TrashBinProps) {
  const [activeTab, setActiveTab] = useState<'clients' | 'leads'>('clients');
  const [deletedClients, setDeletedClients] = useState<Client[]>([]);
  const [deletedLeads, setDeletedLeads] = useState<Lead[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]); // For lead owner names
  const [loading, setLoading] = useState(true);

  // Load clients (both deleted and non-deleted, for dictionary resolution)
  useEffect(() => {
    if (isDemoMode) {
      const loadClients = () => {
        const stored = localStorage.getItem('demo-clients');
        const clients: Client[] = stored ? JSON.parse(stored) : [];
        setAllClients(clients);
        setDeletedClients(clients.filter(c => c.isDeleted === true));
      };
      loadClients();
      window.addEventListener('demo-clients-updated', loadClients);
      return () => window.removeEventListener('demo-clients-updated', loadClients);
    } else {
      const unsub = onSnapshot(collection(db, 'clients'), (snapshot) => {
        const clients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
        setAllClients(clients);
        setDeletedClients(clients.filter(c => c.isDeleted === true));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'clients');
      });
      return () => unsub();
    }
  }, [isDemoMode]);

  // Load deleted leads
  useEffect(() => {
    if (isDemoMode) {
      const loadLeads = () => {
        const stored = localStorage.getItem('demo-leads');
        const leads: Lead[] = stored ? JSON.parse(stored) : [];
        setDeletedLeads(leads.filter(l => l.isDeleted === true));
        setLoading(false);
      };
      loadLeads();
      window.addEventListener('demo-leads-updated', loadLeads);
      return () => window.removeEventListener('demo-leads-updated', loadLeads);
    } else {
      const unsub = onSnapshot(collection(db, 'leads'), (snapshot) => {
        const leads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead));
        setDeletedLeads(leads.filter(l => l.isDeleted === true));
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'leads');
      });
      return () => unsub();
    }
  }, [isDemoMode]);

  const handleRestoreClient = async (client: Client) => {
    try {
      if (isDemoMode) {
        const stored = localStorage.getItem('demo-clients');
        if (stored) {
          const clients: Client[] = JSON.parse(stored);
          const updated = clients.map(c => 
            c.id === client.id ? { ...c, isDeleted: false, deletedAt: undefined, deletedBy: undefined } : c
          );
          localStorage.setItem('demo-clients', JSON.stringify(updated));
          setDeletedClients(updated.filter(c => c.isDeleted === true));
          window.dispatchEvent(new CustomEvent('demo-clients-updated'));
        }
      } else {
        await updateDoc(doc(db, 'clients', client.id), {
          isDeleted: false,
          deletedAt: null,
          deletedBy: null
        });
      }
      toast.success(`Cliente ${client.name} restaurado correctamente`);
    } catch (e) {
      toast.error('Error al restaurar el cliente');
    }
  };

  const handleHardDeleteClient = async (client: Client) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar definitivamente al cliente "${client.name}"? Esta acción borrará todos sus datos permanentemente de la base de datos.`)) {
      return;
    }
    try {
      if (isDemoMode) {
        const stored = localStorage.getItem('demo-clients');
        if (stored) {
          const clients: Client[] = JSON.parse(stored);
          const updated = clients.filter(c => c.id !== client.id);
          localStorage.setItem('demo-clients', JSON.stringify(updated));
          setDeletedClients(updated.filter(c => c.isDeleted === true));
          window.dispatchEvent(new CustomEvent('demo-clients-updated'));
        }
      } else {
        await deleteDoc(doc(db, 'clients', client.id));
      }
      toast.success(`Cliente ${client.name} eliminado definitivamente`);
    } catch (e) {
      toast.error('Error al eliminar definitivamente el cliente');
    }
  };

  const handleRestoreLead = async (lead: Lead) => {
    try {
      if (isDemoMode) {
        const stored = localStorage.getItem('demo-leads');
        if (stored) {
          const leads: Lead[] = JSON.parse(stored);
          const updated = leads.map(l => 
            l.id === lead.id ? { ...l, isDeleted: false, deletedAt: undefined, deletedBy: undefined } : l
          );
          localStorage.setItem('demo-leads', JSON.stringify(updated));
          setDeletedLeads(updated.filter(l => l.isDeleted === true));
          window.dispatchEvent(new CustomEvent('demo-leads-updated'));
        }
      } else {
        await updateDoc(doc(db, 'leads', lead.id), {
          isDeleted: false,
          deletedAt: null,
          deletedBy: null
        });
      }
      toast.success(`Lead ${lead.name} restaurado correctamente`);
    } catch (e) {
      toast.error('Error al restaurar el lead');
    }
  };

  const handleHardDeleteLead = async (lead: Lead) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar definitivamente al lead "${lead.name}"? Se borrará permanentemente.`)) {
      return;
    }
    try {
      if (isDemoMode) {
        const stored = localStorage.getItem('demo-leads');
        if (stored) {
          const leads: Lead[] = JSON.parse(stored);
          const updated = leads.filter(l => l.id !== lead.id);
          localStorage.setItem('demo-leads', JSON.stringify(updated));
          setDeletedLeads(updated.filter(l => l.isDeleted === true));
          window.dispatchEvent(new CustomEvent('demo-leads-updated'));
        }
      } else {
        await deleteDoc(doc(db, 'leads', lead.id));
      }
      toast.success(`Lead ${lead.name} eliminado definitivamente`);
    } catch (e) {
      toast.error('Error al eliminar definitivamente el lead');
    }
  };

  const getClientNameOfLead = (clientId: string) => {
    const parent = allClients.find(c => c.id === clientId);
    return parent ? parent.name : 'Cliente desconocido';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
            <Trash2 className="text-destructive animate-pulse" size={24} />
            Papelera de Reciclaje
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Módulo de auditoría exclusivo para directores. Permite recuperar o purgar definitivamente clientes e interesados eliminados del sistema.
          </p>
        </div>
        
        <div className="flex bg-muted p-1 rounded-lg border border-border/60 self-start">
          <Button
            variant={activeTab === 'clients' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('clients')}
            className={`text-xs font-bold gap-1.5 h-8 px-4 ${activeTab === 'clients' ? 'bg-background shadow-sm text-foreground hover:bg-background' : 'text-muted-foreground'}`}
          >
            <Users size={14} />
            Clientes ({deletedClients.length})
          </Button>
          <Button
            variant={activeTab === 'leads' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('leads')}
            className={`text-xs font-bold gap-1.5 h-8 px-4 ${activeTab === 'leads' ? 'bg-background shadow-sm text-foreground hover:bg-background' : 'text-muted-foreground'}`}
          >
            <BookOpen size={14} />
            Leads ({deletedLeads.length})
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {activeTab === 'clients' ? (
          <Card className="border border-border shadow-sm">
            <CardHeader className="bg-muted/10 px-6 py-4 border-b border-border">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Users size={16} className="text-primary" />
                Clientes en Papelera ({deletedClients.length})
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                La eliminación de un cliente no es destructiva de inmediato. Restáurarlo para habilitar su visibilidad en todo el portal.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {deletedClients.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <span className="block text-3xl mb-2">🌿</span>
                  <p className="text-sm font-bold">¡La papelera de clientes está limpia!</p>
                  <p className="text-xs opacity-60 mt-1">No hay ningún registro de cliente bloqueado o eliminado.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                        <th className="pb-3">Cliente</th>
                        <th className="pb-3 hidden sm:table-cell">Eliminado el</th>
                        <th className="pb-3 hidden md:table-cell">Eliminado por</th>
                        <th className="pb-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 text-xs">
                      {deletedClients.map(client => (
                        <tr key={client.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-4">
                            <div className="font-extrabold text-foreground">{client.name}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">ID: {client.id}</div>
                          </td>
                          <td className="py-4 hidden sm:table-cell text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar size={12} />
                              {client.deletedAt ? formatDate(client.deletedAt) : 'Desconocido'}
                            </div>
                          </td>
                          <td className="py-4 hidden md:table-cell text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <UserRound size={12} />
                              {client.deletedBy || 'Sistema'}
                            </div>
                          </td>
                          <td className="py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRestoreClient(client)}
                                className="border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs h-8 gap-1.5"
                              >
                                <RotateCcw size={12} />
                                Restaurar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleHardDeleteClient(client)}
                                className="border-rose-500/30 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-xs h-8 gap-1.5"
                              >
                                <Trash2 size={12} />
                                Eliminar Definitivo
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border border-border shadow-sm">
            <CardHeader className="bg-muted/10 px-6 py-4 border-b border-border">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <BookOpen size={16} className="text-primary" />
                Leads en Papelera ({deletedLeads.length})
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                Prospectos y agendas que fueron descartados. Puedes restaurarlos a su respectivo cliente o eliminarlos de manera definitiva.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {deletedLeads.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <span className="block text-3xl mb-2 font-emoji">📨</span>
                  <p className="text-sm font-bold">¡La papelera de leads está limpia!</p>
                  <p className="text-xs opacity-60 mt-1">No hay prospectos en estado de restauración de papelera.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                        <th className="pb-3">Lead / Cliente Asignado</th>
                        <th className="pb-3 hidden sm:table-cell">Eliminado el</th>
                        <th className="pb-3 hidden md:table-cell">Eliminado por</th>
                        <th className="pb-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 text-xs">
                      {deletedLeads.map(lead => (
                        <tr key={lead.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-4">
                            <div className="font-extrabold text-foreground">{lead.name}</div>
                            <div className="text-[10px] text-primary mt-0.5 font-bold flex items-center gap-1">
                              <Users size={10} />
                              {getClientNameOfLead(lead.clientId)}
                            </div>
                          </td>
                          <td className="py-4 hidden sm:table-cell text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar size={12} />
                              {lead.deletedAt ? formatDate(lead.deletedAt) : 'Desconocido'}
                            </div>
                          </td>
                          <td className="py-4 hidden md:table-cell text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <UserRound size={12} />
                              {lead.deletedBy || 'Sistema'}
                            </div>
                          </td>
                          <td className="py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRestoreLead(lead)}
                                className="border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs h-8 gap-1.5"
                              >
                                <RotateCcw size={12} />
                                Restaurar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleHardDeleteLead(lead)}
                                className="border-rose-500/30 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-xs h-8 gap-1.5"
                              >
                                <Trash2 size={12} />
                                Eliminar Definitivo
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
