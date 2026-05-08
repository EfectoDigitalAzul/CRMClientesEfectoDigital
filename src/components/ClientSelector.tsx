import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc } from 'firebase/firestore';
import { Client, UserProfile } from '../types';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './ui/select';
import { Button } from './ui/button';
import { Plus, Briefcase } from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';

interface ClientSelectorProps {
  selectedClientId: string;
  onClientChange: (clientId: string) => void;
  isDemoMode?: boolean;
  profile: UserProfile | null;
}

const MOCK_CLIENTS: Client[] = [];

export default function ClientSelector({ selectedClientId, onClientChange, isDemoMode, profile }: ClientSelectorProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [isNewClientOpen, setIsNewClientOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isDemoMode) {
      const loadClients = () => {
        const stored = localStorage.getItem('demo-clients');
        let allClients: Client[] = [];
        if (stored) {
          allClients = JSON.parse(stored);
        } else {
          allClients = MOCK_CLIENTS;
          localStorage.setItem('demo-clients', JSON.stringify(MOCK_CLIENTS));
        }

        // Filter out placeholders
        allClients = allClients.filter(c => 
          !c.name.toLowerCase().includes('mi primer lead') && 
          !c.name.toLowerCase().includes('lead flow')
        );

        // Filter based on role in demo mode
        if (profile?.role === 'client' && profile.assignedClientId) {
          setClients(allClients.filter(c => c.id === profile.assignedClientId));
        } else if (profile?.role === 'account_manager') {
          setClients(allClients.filter(c => c.accountManagerId === profile.uid));
        } else {
          setClients(allClients);
        }
      };

      loadClients();
      window.addEventListener('demo-clients-updated', loadClients);
      return () => window.removeEventListener('demo-clients-updated', loadClients);
    }

    const q = query(collection(db, 'clients'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
      
      // Filter out placeholders
      clientsData = clientsData.filter(c => 
        !c.name.toLowerCase().includes('mi primer lead') && 
        !c.name.toLowerCase().includes('lead flow')
      );

      // Filter based on role - All team members with @efectodigital should ideally see all clients unless restricted
      const isStaff = profile?.email?.endsWith('@efectodigital.com.ar') || 
                      profile?.email?.endsWith('@efectodigital.com') ||
                      profile?.role === 'director' || 
                      profile?.role === 'account_manager' || 
                      profile?.role === 'setter';
      
      if (profile?.role === 'client' && profile.assignedClientId) {
        clientsData = clientsData.filter(c => c.id === profile.assignedClientId);
      } else if (!isStaff && profile?.role === 'account_manager') {
        clientsData = clientsData.filter(c => c.accountManagerId === profile.uid);
      }

      setClients(clientsData);
      
      // If no client selected and we have clients, select the first one
      if (!selectedClientId && clientsData.length > 0) {
        onClientChange(clientsData[0].id);
      }
    });

    return () => unsubscribe();
  }, [isDemoMode, profile]);

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;
    setLoading(true);
    try {
      const newClient = {
        name: newClientName,
        createdAt: new Date().toISOString(),
        accountManagerId: profile?.role === 'account_manager' ? profile.uid : undefined,
      };

      if (isDemoMode) {
        const demoClients = JSON.parse(localStorage.getItem('demo-clients') || JSON.stringify([]));
        const clientWithId = { ...newClient, id: Math.random().toString(36).substr(2, 9) };
        demoClients.push(clientWithId);
        localStorage.setItem('demo-clients', JSON.stringify(demoClients));
        setClients(demoClients);
        onClientChange(clientWithId.id);
        window.dispatchEvent(new CustomEvent('demo-clients-updated'));
      } else {
        const docRef = await addDoc(collection(db, 'clients'), newClient);
        onClientChange(docRef.id);
      }

      toast.success("Nuevo Lead Flow creado");
      setIsNewClientOpen(false);
      setNewClientName('');
    } catch (error) {
      toast.error("Error al crear Lead Flow");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedClientId} onValueChange={onClientChange}>
        <SelectTrigger className="w-[200px] h-9 bg-muted border-border shadow-none font-bold text-xs text-foreground">
          <div className="flex items-center gap-2">
            <Briefcase size={14} className="text-primary" />
            <SelectValue placeholder="Seleccionar Cliente" />
          </div>
        </SelectTrigger>
        <SelectContent className="bg-popover border-border">
          {clients.length === 0 && (
            <div className="p-2 text-[10px] text-muted-foreground italic text-center">
              No hay clientes asignados
            </div>
          )}
          {clients.map((client) => (
            <SelectItem key={client.id} value={client.id} className="text-xs font-medium focus:bg-muted focus:text-foreground">
              {client.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {profile?.role !== 'client' && (
        <Button 
          variant="outline" 
          size="icon" 
          className="h-9 w-9 border-border bg-muted shadow-none hover:bg-muted/70"
          onClick={() => setIsNewClientOpen(true)}
        >
          <Plus size={16} className="text-primary" />
        </Button>
      )}

      <Dialog open={isNewClientOpen} onOpenChange={setIsNewClientOpen}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border text-card-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">Crear Nuevo Lead Flow</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="clientName" className="text-foreground font-medium">Nombre del Cliente / Proyecto</Label>
              <Input 
                id="clientName" 
                value={newClientName} 
                onChange={(e) => setNewClientName(e.target.value)} 
                placeholder="Ej: Inmobiliaria XYZ"
                className="bg-muted border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewClientOpen(false)} className="border-border text-foreground hover:bg-muted font-bold">Cancelar</Button>
            <Button onClick={handleCreateClient} disabled={loading || !newClientName.trim()} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
              {loading ? "Creando..." : "Crear Lead Flow"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
