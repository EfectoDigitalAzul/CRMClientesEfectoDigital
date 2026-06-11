import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, createFirebaseAuthUser, isFirebaseConfigured } from '../lib/firebase';
import { collection, onSnapshot, query, where, addDoc, deleteDoc, doc, updateDoc, orderBy, setDoc } from 'firebase/firestore';
import { UserProfile, Client, ClientHistoryNote, Attachment, ClientStatus } from '../types';
import { ROLE_PERMISSIONS } from '../lib/permissions';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  getStatusBadgeColor, 
  getStatusLabel, 
  getClientStatusBadgeColor,
  getClientStatusLabel,
  formatDate,
  cn 
} from '../lib/utils';
import { 
  differenceInDays, 
  isAfter, 
  isBefore, 
  parseISO, 
  format,
  startOfMonth,
  endOfMonth
} from 'date-fns';
import { 
  User, 
  Briefcase, 
  ChevronRight, 
  LayoutDashboard, 
  Users as UsersIcon, 
  Calendar,
  ChevronDown,
  Plus,
  Trash2,
  Globe,
  FolderOpen,
  Lock,
  Zap,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  StickyNote,
  Paperclip,
  File as FileIcon,
  X as XIcon,
  ExternalLink,
  BarChart3,
  RefreshCcw,
  Copy,
  Key,
  ShieldAlert,
  Edit
} from 'lucide-react';
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
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';

interface TeamViewProps {
  onClientSelect: (clientId: string) => void;
  onTabChange: (tab: string) => void;
  isDemoMode?: boolean;
  profile: UserProfile | null;
}

// Function to debounce Firestore updates
const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Helper for Popover DatePicker
import { DatePicker } from './ui/DatePicker';


const MOCK_AMS: UserProfile[] = [
  { uid: 'u-azul', email: 'azul@efectodigital.com.ar', displayName: 'Azul', role: 'director', isActive: true, createdAt: new Date().toISOString() },
  { uid: 'u-naza', email: 'nazareno@efectodigital.com.ar', displayName: 'Naza', role: 'account_manager', isActive: true, createdAt: new Date().toISOString() },
  { uid: 'u-mariana', email: 'mariana@efectodigital.com', displayName: 'Mariana', role: 'account_manager', isActive: true, createdAt: new Date().toISOString() },
];

const MOCK_CLIENTS: Client[] = [
  { 
    id: 'c1', 
    name: 'Cliente Alpha', 
    accountManagerId: 'u-azul', 
    availableTags: ['Pepito', 'Pepita'], 
    createdAt: new Date().toISOString(),
    planName: 'Starter',
    progress: 75,
    websiteUrl: 'https://alpha.com',
    contractStartDate: '2026-01-01',
    contractEndDate: '2026-12-31'
  },
  { 
    id: 'c2', 
    name: 'Cliente Beta', 
    accountManagerId: 'u-azul', 
    availableTags: ['Roberto', 'Roberta', 'Jona'], 
    createdAt: new Date().toISOString(),
    planName: 'Suscripción',
    progress: 30,
    contractStartDate: '2026-03-01',
    contractEndDate: '2026-06-01'
  },
  { id: 'c3', name: 'Cliente Gamma', accountManagerId: 'u-mariana', createdAt: new Date().toISOString() },
  { id: 'c4', name: 'Cliente Delta', accountManagerId: 'u-naza', createdAt: new Date().toISOString() },
];

const PRESET_PLANS = ['Starter', 'Suscripción', 'Autónomo'];

const calculateProgress = (startDate?: string, endDate?: string): number => {
  if (!startDate || !endDate) return 0;
  
  try {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const now = new Date();
    
    if (isBefore(now, start)) return 0;
    if (isAfter(now, end)) return 100;
    
    const totalDays = differenceInDays(end, start);
    const daysPassed = differenceInDays(now, start);
    
    if (totalDays <= 0) return 100;
    
    const progress = Math.round((daysPassed / totalDays) * 100);
    return Math.min(100, Math.max(0, progress));
  } catch (error) {
    return 0;
  }
};

const getDayName = () => {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return days[new Date().getDay()];
};

export default function TeamView({ onClientSelect, onTabChange, isDemoMode, profile }: TeamViewProps) {
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [showHistorical, setShowHistorical] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [isNewClientOpen, setIsNewClientOpen] = useState(false);
  const [isNewMemberOpen, setIsNewMemberOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientTags, setNewClientTags] = useState('');
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [selectedAMForNewClient, setSelectedAMForNewClient] = useState<string>('');
  const [selectedSetterForNewClient, setSelectedSetterForNewClient] = useState<string>('');
  const [selectedSharedAMsForNewClient, setSelectedSharedAMsForNewClient] = useState<string[]>([]);
  const [newClientStartDate, setNewClientStartDate] = useState('');
  const [newClientEndDate, setNewClientEndDate] = useState('');
  const [newClientStatus, setNewClientStatus] = useState<ClientStatus>('onboarding');
  const [creating, setCreating] = useState(false);
  const [deleteConfirmClient, setDeleteConfirmClient] = useState<{ id: string; name: string } | null>(null);
  const [confirmStep, setConfirmStep] = useState(1);
  const [savingNotes, setSavingNotes] = useState<{[key: string]: boolean}>({});
  const [historyNotes, setHistoryNotes] = useState<ClientHistoryNote[]>([]);
  const [newHistoryNote, setNewHistoryNote] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedAttachments, setSelectedAttachments] = useState<File[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // States for client portal access management
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [isCreatingClientAccess, setIsCreatingClientAccess] = useState(false);
  const [isEditingClientAccess, setIsEditingClientAccess] = useState(false);
  const [clientUsername, setClientUsername] = useState('');
  const [clientPassword, setClientPassword] = useState('');
  const [clientEmail, setClientEmail] = useState('');

  // Memoized debounced update function
  const debouncedUpdateNote = React.useCallback(
    debounce(async (clientId: string, note: string, allClients: Client[], isDemo: boolean) => {
      const clientToUpdate = allClients.find(c => c.id === clientId);
      if (!clientToUpdate) return;

      try {
        if (isDemo) {
          const updated = allClients.map(c => c.id === clientId ? { ...c, notes: note } : c);
          localStorage.setItem('demo-clients', JSON.stringify(updated));
          window.dispatchEvent(new CustomEvent('demo-clients-updated'));
        } else {
          await updateDoc(doc(db, 'clients', clientId), { notes: note });
        }
      } catch (error) {
        console.error("Error saving note:", error);
      } finally {
        setSavingNotes(prev => ({ ...prev, [clientId]: false }));
      }
    }, 1000),
    []
  );

  useEffect(() => {
    if (isDemoMode) {
      const loadClients = () => {
        const stored = localStorage.getItem('demo-clients');
        const allClients: Client[] = stored ? JSON.parse(stored) : MOCK_CLIENTS;
        // Filter out placeholders
        let filtered = allClients.filter(c => 
          !c.name.toLowerCase().includes('mi primer lead') && 
          !c.name.toLowerCase().includes('lead flow')
        );
        if (profile && !ROLE_PERMISSIONS[profile.role]?.canViewClients) {
          if (profile.role === 'client') {
            filtered = filtered.filter(c => c.id === profile.assignedClientId);
          } else {
            filtered = filtered.filter(c => c.accountManagerId === profile.uid || c.setterId === profile.uid);
          }
        }
        setClients(filtered);
      };

      const loadTeam = () => {
        const stored = localStorage.getItem('demo-users');
        if (stored) {
          const parsedUsers = JSON.parse(stored) as UserProfile[];
          setAllUsers(parsedUsers);
          const team = parsedUsers.filter(u => u.role === 'account_manager' || u.role === 'setter' || u.role === 'director' || u.role === 'commercial');
          const sorted = [...team].sort((a, b) => {
            if (a.uid === profile?.uid) return -1;
            if (b.uid === profile?.uid) return 1;
            return 0;
          });
          setTeamMembers(sorted);
          if (profile && sorted.some(u => u.uid === profile.uid) && !expandedMember) {
            setExpandedMember(profile.uid);
          }
        } else {
          setTeamMembers(MOCK_AMS);
          setAllUsers(MOCK_AMS);
          localStorage.setItem('demo-users', JSON.stringify(MOCK_AMS));
        }
      };

      loadClients();
      loadTeam();
      setLoading(false);

      window.addEventListener('demo-clients-updated', loadClients);
      window.addEventListener('demo-users-updated', loadTeam);
      return () => {
        window.removeEventListener('demo-clients-updated', loadClients);
        window.removeEventListener('demo-users-updated', loadTeam);
      };
    }

    const teamQuery = query(collection(db, 'users'));
    const teamUnsubscribe = onSnapshot(teamQuery, (snapshot) => {
      const users = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setAllUsers(users);
      
      const staff = users.filter(u => ['account_manager', 'setter', 'director', 'commercial'].includes(u.role));
      const sortedUsers = [...staff].sort((a, b) => {
        if (a.uid === profile?.uid) return -1;
        if (b.uid === profile?.uid) return 1;
        return 0;
      });
      setTeamMembers(sortedUsers);
      
      if (profile && sortedUsers.some(u => u.uid === profile.uid) && !expandedMember) {
        setExpandedMember(profile.uid);
      }
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const clientQuery = query(collection(db, 'clients'));
    const clientUnsubscribe = onSnapshot(clientQuery, (snapshot) => {
      const allClients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
      // Filter out placeholders
      let filtered = allClients.filter(c => 
        !c.name.toLowerCase().includes('mi primer lead') && 
        !c.name.toLowerCase().includes('lead flow')
      );
      if (profile && profile.role === 'client') {
        filtered = filtered.filter(c => c.id === profile.assignedClientId);
      }
      setClients(filtered);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, 'clients');
    });

    return () => {
      teamUnsubscribe();
      clientUnsubscribe();
    };
  }, [isDemoMode, profile]);

  useEffect(() => {
    if (!editingClient) {
      setHistoryNotes([]);
      return;
    }

    setLoadingHistory(true);
    if (isDemoMode) {
      const stored = localStorage.getItem(`demo-history-notes-${editingClient.id}`);
      setHistoryNotes(stored ? JSON.parse(stored) : []);
      setLoadingHistory(false);
    } else {
      const q = query(
        collection(db, 'clients', editingClient.id, 'historyNotes'),
        orderBy('createdAt', 'desc')
      );
      const unsub = onSnapshot(q, (snap) => {
        setHistoryNotes(snap.docs.map(d => ({ id: d.id, ...d.data() } as ClientHistoryNote)));
        setLoadingHistory(false);
      }, (error) => {
        setLoadingHistory(false);
        handleFirestoreError(error, OperationType.LIST, `clients/${editingClient.id}/historyNotes`);
      });
      return () => unsub();
    }
  }, [editingClient?.id, isDemoMode]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeAttachment = (index: number) => {
    setSelectedAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddHistoryNote = async () => {
    if (!editingClient || (!newHistoryNote.trim() && selectedAttachments.length === 0) || !profile) return;
    
    try {
      const attachments: Attachment[] = selectedAttachments.map(file => ({
        name: file.name,
        type: file.type,
        url: "#" // Simulated upload
      }));

      const noteData = {
        clientId: editingClient.id,
        content: newHistoryNote,
        authorId: profile.uid,
        authorName: profile.displayName,
        type: 'note',
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        attachments: attachments
      };

      if (isDemoMode) {
        const stored = localStorage.getItem(`demo-history-notes-${editingClient.id}`);
        const notes = stored ? JSON.parse(stored) : [];
        const newNoteWithId = { ...noteData, id: Math.random().toString(36).substr(2, 9) };
        const updated = [newNoteWithId, ...notes];
        localStorage.setItem(`demo-history-notes-${editingClient.id}`, JSON.stringify(updated));
        setHistoryNotes(updated);
      } else {
        await addDoc(collection(db, 'clients', editingClient.id, 'historyNotes'), noteData);
      }
      setNewHistoryNote('');
      setSelectedAttachments([]);
      toast.success("Nota añadida al histórico");
    } catch (err) {
      console.error("Error adding history note:", err);
      toast.error("Error al añadir la nota");
    }
  };

  const handleDeleteHistoryNote = async (noteId: string) => {
    if (!editingClient) return;
    try {
      if (isDemoMode) {
        const stored = localStorage.getItem(`demo-history-notes-${editingClient.id}`);
        const notes = stored ? JSON.parse(stored) : [];
        const updated = notes.filter((n: any) => n.id !== noteId);
        localStorage.setItem(`demo-history-notes-${editingClient.id}`, JSON.stringify(updated));
        setHistoryNotes(updated);
      } else {
        await deleteDoc(doc(db, 'clients', editingClient.id, 'historyNotes', noteId));
      }
      toast.success("Nota eliminada");
    } catch (err) {
      toast.error("Error al eliminar nota");
    }
  };

  // Force expand the member list for the logged in user
  useEffect(() => {
    if (profile && !expandedMember) {
      setExpandedMember(profile.uid);
    }
  }, [profile, expandedMember]);

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-12">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-slate-500 font-medium">Cargando equipo...</p>
        </div>
      </div>
    );
  }

  const handleClientClick = (clientId: string) => {
    onClientSelect(clientId);
    onTabChange('dashboard');
  };

  const handleUpdateClientStatus = async (clientId: string, newStatus: ClientStatus) => {
    try {
      if (isDemoMode) {
        const stored = localStorage.getItem('demo-clients');
        const demoClients = stored ? JSON.parse(stored) : MOCK_CLIENTS;
        const updatedList = demoClients.map((c: any) => c.id === clientId ? { ...c, status: newStatus } : c);
        localStorage.setItem('demo-clients', JSON.stringify(updatedList));
        setClients(updatedList);
        window.dispatchEvent(new CustomEvent('demo-clients-updated'));
      } else {
        await updateDoc(doc(db, 'clients', clientId), { status: newStatus });
      }
      toast.success(`Estado de cliente actualizado a ${getClientStatusLabel(newStatus)}`);
    } catch (err) {
      if (!isDemoMode) {
        handleFirestoreError(err, OperationType.UPDATE, `clients/${clientId}`);
      }
      console.error("Error updating client status:", err);
      toast.error("Error al actualizar estado");
    }
  };

  const handleCreateClient = async () => {
    if (!newClientName.trim() || !selectedAMForNewClient) return;
    setCreating(true);
    try {
      const tags = newClientTags.split(',').map(t => t.trim()).filter(t => t !== '');
      const newClient = {
        name: newClientName,
        status: newClientStatus,
        accountManagerId: selectedAMForNewClient,
        setterId: selectedSetterForNewClient || null,
        sharedAccountManagerIds: selectedSharedAMsForNewClient,
        availableTags: tags,
        contractStartDate: newClientStartDate || null,
        contractEndDate: newClientEndDate || null,
        createdAt: new Date().toISOString(),
      };

      if (isDemoMode) {
        const demoClients = JSON.parse(localStorage.getItem('demo-clients') || JSON.stringify(MOCK_CLIENTS));
        const clientWithId = { ...newClient, id: Math.random().toString(36).substr(2, 9) };
        demoClients.push(clientWithId);
        localStorage.setItem('demo-clients', JSON.stringify(demoClients));
        setClients(demoClients);
        window.dispatchEvent(new CustomEvent('demo-clients-updated'));
      } else {
        await addDoc(collection(db, 'clients'), newClient);
      }

      toast.success("Cliente sumado correctamente");
      setIsNewClientOpen(false);
      setNewClientName('');
      setNewClientStartDate('');
      setNewClientEndDate('');
      setNewClientTags('');
      setNewClientStatus('onboarding');
      setSelectedSharedAMsForNewClient([]);
    } catch (error) {
      toast.error("Error al sumar cliente");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateClient = async () => {
    if (!editingClient || !editingClient.name.trim() || !editingClient.accountManagerId) return;
    setCreating(true);
    try {
      const tags = newClientTags.split(',').map(t => t.trim()).filter(t => t !== '');
      const progress = calculateProgress(editingClient.contractStartDate, editingClient.contractEndDate);
      const updatedClient = {
        ...editingClient,
        availableTags: tags,
        accountManagerId: selectedAMForNewClient,
        setterId: selectedSetterForNewClient || null,
        sharedAccountManagerIds: selectedSharedAMsForNewClient,
        progress: progress,
      };

      if (isDemoMode) {
        const stored = localStorage.getItem('demo-clients');
        const demoClients = stored ? JSON.parse(stored) : MOCK_CLIENTS;
        const updatedList = demoClients.map((c: any) => c.id === editingClient.id ? updatedClient : c);
        localStorage.setItem('demo-clients', JSON.stringify(updatedList));
        setClients(updatedList);
        window.dispatchEvent(new CustomEvent('demo-clients-updated'));
      } else {
        const { id, ...data } = updatedClient as any;
        await updateDoc(doc(db, 'clients', id), data);
      }

      toast.success("Cliente actualizado correctamente");
      setEditingClient(null);
      setNewClientTags('');
      setSelectedSharedAMsForNewClient([]);
    } catch (error) {
      toast.error("Error al actualizar cliente");
    } finally {
      setCreating(false);
    }
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setNewClientTags(client.availableTags?.join(', ') || '');
    setSelectedAMForNewClient(client.accountManagerId || '');
    setSelectedSetterForNewClient(client.setterId || '');
    setSelectedSharedAMsForNewClient(client.sharedAccountManagerIds || []);
    setIsCreatingClientAccess(false);
    setIsEditingClientAccess(false);
  };

  const handlePrepareCreateClientUser = () => {
    if (!editingClient) return;
    const suggestedUsername = editingClient.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
    
    setClientUsername(suggestedUsername);
    setClientPassword(`Efecto${Math.floor(1000 + Math.random() * 9000)}!`);
    setClientEmail('');
    setIsCreatingClientAccess(true);
    setIsEditingClientAccess(false);
  };

  const handleSaveNewClientUser = async () => {
    if (!editingClient) return;
    const lowerUsername = clientUsername.trim().toLowerCase();
    const lowerEmail = clientEmail.trim().toLowerCase();
    
    if (!lowerUsername) {
      toast.error("El usuario es obligatorio");
      return;
    }
    if (!clientPassword) {
      toast.error("La contraseña es obligatoria");
      return;
    }

    setCreating(true);
    try {
      const targetEmail = lowerEmail || `${lowerUsername}@cliente.efectodigital.com.ar`;
      let finalUid = `u-${lowerUsername}`;

      if (!isDemoMode && isFirebaseConfigured) {
        try {
          const authUid = await createFirebaseAuthUser(targetEmail, clientPassword);
          finalUid = authUid;
        } catch (authError: any) {
          if (authError.code === 'auth/email-already-in-use' || authError.message?.includes('EMAIL_EXISTS')) {
            console.warn("Correo ya registrado en Firebase Auth.");
          } else {
            throw new Error(`Firebase Auth: ${authError.message || authError}`);
          }
        }
      }

      const userToCreate: UserProfile = {
        uid: finalUid,
        username: lowerUsername,
        password: clientPassword,
        email: targetEmail,
        displayName: editingClient.name,
        role: 'client',
        assignedClientId: editingClient.id,
        isActive: true,
        createdAt: new Date().toISOString()
      };

      if (isDemoMode) {
        const stored = localStorage.getItem('demo-users');
        const demoUsers = stored ? JSON.parse(stored) : [];
        demoUsers.push(userToCreate);
        localStorage.setItem('demo-users', JSON.stringify(demoUsers));
        setAllUsers(demoUsers);
        window.dispatchEvent(new CustomEvent('demo-users-updated'));
      } else {
        await setDoc(doc(db, 'users', finalUid), userToCreate as any);
      }

      toast.success("¡Acceso al portal creado correctamente!");
      setIsCreatingClientAccess(false);
    } catch (e: any) {
      console.error(e);
      toast.error(`Error al crear el acceso: ${e.message || e}`);
    } finally {
      setCreating(false);
    }
  };

  const handleEditClientUser = (user: UserProfile) => {
    setClientUsername(user.username || '');
    setClientPassword(user.password || '');
    setClientEmail(user.email || '');
    setIsEditingClientAccess(true);
    setIsCreatingClientAccess(false);
  };

  const handleSaveEditedClientUser = async () => {
    if (!editingClient) return;
    const originalUser = allUsers.find(u => u.role === 'client' && u.assignedClientId === editingClient.id);
    if (!originalUser) return;

    const lowerUsername = clientUsername.trim().toLowerCase();
    const lowerEmail = clientEmail.trim().toLowerCase();

    if (!lowerUsername) {
      toast.error("El usuario es obligatorio");
      return;
    }

    setCreating(true);
    try {
      const targetEmail = lowerEmail || `${lowerUsername}@cliente.efectodigital.com.ar`;
      const updatedUser = {
        ...originalUser,
        username: lowerUsername,
        password: clientPassword,
        email: targetEmail,
      };

      if (isDemoMode) {
        const stored = localStorage.getItem('demo-users');
        if (stored) {
          const demoUsers = JSON.parse(stored) as UserProfile[];
          const updated = demoUsers.map(u => u.uid === originalUser.uid ? updatedUser : u);
          localStorage.setItem('demo-users', JSON.stringify(updated));
          setAllUsers(updated);
          window.dispatchEvent(new CustomEvent('demo-users-updated'));
        }
      } else {
        await updateDoc(doc(db, 'users', originalUser.uid), {
          username: lowerUsername,
          password: clientPassword,
          email: targetEmail,
        });
      }

      toast.success("Accesos de cliente actualizados");
      setIsEditingClientAccess(false);
    } catch (e: any) {
      console.error(e);
      toast.error(`Error al guardar cambios: ${e.message || e}`);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleClientUserStatus = async (user: UserProfile) => {
    try {
      const newStatus = !user.isActive;
      if (isDemoMode) {
        const stored = localStorage.getItem('demo-users');
        if (stored) {
          const demoUsers = JSON.parse(stored) as UserProfile[];
          const updated = demoUsers.map(u => u.uid === user.uid ? { ...u, isActive: newStatus } : u);
          localStorage.setItem('demo-users', JSON.stringify(updated));
          setAllUsers(updated);
          window.dispatchEvent(new CustomEvent('demo-users-updated'));
        }
      } else {
        await updateDoc(doc(db, 'users', user.uid), {
          isActive: newStatus
        });
      }
      toast.success(newStatus ? "Acceso de cliente activado" : "Acceso de cliente bloqueado");
    } catch (e) {
      toast.error("Error al cambiar el estado del acceso");
    }
  };

  const handleCopyCredentials = (user: UserProfile) => {
    if (!editingClient) return;
    const loginUrl = window.location.origin;
    const message = `*🔑 Accesos al Portal de Clientes - Efecto Digital*\n\n¡Hola! Te compartimos tus accesos para ingresar a la plataforma y seguir en tiempo real el rendimiento de tu cuenta, leads e informes:\n\n📌 *Link de Ingreso:* ${loginUrl}\n👤 *Usuario:* \`${user.username || user.email}\`\n🔑 *Contraseña:* \`${user.password || '••••••••'}\`\n\nQue tengas un excelente día. ¡Seguimos sumando resultados! 🚀`;
    
    navigator.clipboard.writeText(message);
    toast.success("Credenciales listas para pegar y enviar por WhatsApp/Email");
  };

  const handleCreateMember = async () => {
    if (!newMemberName.trim() || !newMemberEmail.trim()) return;
    setCreating(true);
    try {
      const newMember: UserProfile = {
        uid: Math.random().toString(36).substr(2, 9),
        displayName: newMemberName,
        email: newMemberEmail,
        role: 'account_manager', // Unified role for team members
        isActive: true,
        createdAt: new Date().toISOString(),
      };

      if (isDemoMode) {
        const stored = localStorage.getItem('demo-users');
        const demoUsers = stored ? JSON.parse(stored) : MOCK_AMS;
        demoUsers.push(newMember);
        localStorage.setItem('demo-users', JSON.stringify(demoUsers));
        setTeamMembers(demoUsers.filter((u: any) => u.role === 'account_manager' || u.role === 'setter'));
        window.dispatchEvent(new CustomEvent('demo-users-updated'));
      } else {
        await addDoc(collection(db, 'users'), newMember);
      }

      toast.success("Miembro de equipo sumado");
      setIsNewMemberOpen(false);
      setNewMemberName('');
      setNewMemberEmail('');
    } catch (error) {
      toast.error("Error al sumar equipo");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteAction = async () => {
    if (!deleteConfirmClient) return;
    try {
      const deletedBy = profile?.displayName || profile?.email || 'Sistema';
      const deletedAt = new Date().toISOString();
      if (isDemoMode) {
        const stored = localStorage.getItem('demo-clients');
        const demoClients: Client[] = stored ? JSON.parse(stored) : clients;
        const updatedClients = demoClients.map(c => 
          c.id === deleteConfirmClient.id 
            ? { ...c, isDeleted: true, deletedAt, deletedBy } 
            : c
        );
        localStorage.setItem('demo-clients', JSON.stringify(updatedClients));
        setClients(updatedClients.filter(c => !c.isDeleted));
        window.dispatchEvent(new CustomEvent('demo-clients-updated'));
      } else {
        await updateDoc(doc(db, 'clients', deleteConfirmClient.id), {
          isDeleted: true,
          deletedAt,
          deletedBy
        });
      }
      toast.success("Cliente enviado a la papelera");
      setDeleteConfirmClient(null);
      setConfirmStep(1);
    } catch (error) {
      toast.error("Error al mover el cliente a la papelera");
    }
  };

  const handleDeleteClient = (clientId: string, clientName: string) => {
    setDeleteConfirmClient({ id: clientId, name: clientName });
    setConfirmStep(1);
  };

  const todayName = getDayName();
  const myClients = profile ? clients.filter(c => {
    const isOwnerByUID = c.accountManagerId === profile.uid || c.setterId === profile.uid;
    const assignedAM = teamMembers.find(m => m.uid === c.accountManagerId);
    const assignedSetter = teamMembers.find(m => m.uid === c.setterId);
    const isOwnerByEmail = (assignedAM?.email === profile.email) || (assignedSetter?.email === profile.email);
    return isOwnerByUID || isOwnerByEmail;
  }) : [];
  const urgenciesToday = myClients.filter(c => c.weeklyNotes?.[todayName]?.trim());

  const handleInlineNoteChange = (clientId: string, note: string) => {
    // Update local state immediately for UI responsiveness
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, notes: note } : c));
    setSavingNotes(prev => ({ ...prev, [clientId]: true }));
    
    // Call debounced Firestore update
    debouncedUpdateNote(clientId, note, clients, !!isDemoMode);
  };

  const renderClientRow = (client: Client, member: UserProfile) => {
    const isAM = client.accountManagerId === member.uid;
    const isSetter = client.setterId === member.uid;
    const isAuthorized = profile?.role === 'director' || 
                         client.accountManagerId === profile?.uid || 
                         client.setterId === profile?.uid || 
                         (client.sharedAccountManagerIds && client.sharedAccountManagerIds.includes(profile?.uid || ''));
                         
    return (
      <div key={client.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 hover:bg-muted/10 transition-colors group gap-4 md:gap-0">
        <div className="flex items-center gap-3 min-w-[200px]">
          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
            <Briefcase size={16} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-foreground">{client.name}</span>
              <Select 
                value={client.status || 'onboarding'} 
                onValueChange={(v) => handleUpdateClientStatus(client.id, v as ClientStatus)}
                disabled={!isAuthorized}
              >
                <SelectTrigger className={cn("h-5 min-w-[90px] px-2 text-[9px] font-black uppercase tracking-widest border-none shadow-none focus:ring-0", getClientStatusBadgeColor(client.status || 'onboarding'))}>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border min-w-[120px]">
                  {(['onboarding', 'active', 'paused', 'completed', 'cancelled'] as ClientStatus[]).map(s => (
                    <SelectItem key={s} value={s} className="text-[10px] font-bold uppercase tracking-wider">
                      {getClientStatusLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <div className="flex gap-2">
                {isAM && <span className="text-[9px] bg-secondary text-primary border border-primary/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-tight">AM</span>}
                {isSetter && <span className="text-[9px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 px-1.5 py-0.5 rounded font-bold uppercase tracking-tight">Setter</span>}
              </div>
              {client.planName && (
                <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                  <Briefcase size={10} />
                  {client.planName}
                </span>
              )}
              <div className="flex items-center gap-1.5 min-w-[60px]">
                <div className="flex-1 bg-muted rounded-full h-1 w-12 overflow-hidden border border-border/30">
                  <div className="bg-primary h-full rounded-full" style={{ width: `${calculateProgress(client.contractStartDate, client.contractEndDate)}%` }} />
                </div>
                <span className="text-[9px] font-bold text-muted-foreground line-clamp-1">{calculateProgress(client.contractStartDate, client.contractEndDate)}%</span>
              </div>
              <div className="hidden lg:flex items-center gap-2 text-[9px] font-bold text-muted-foreground/50 border-l border-border/50 pl-3">
                <span>{client.contractStartDate ? formatDate(client.contractStartDate) : '--/--/----'}</span>
                <span>-</span>
                <span>{client.contractEndDate ? formatDate(client.contractEndDate) : '--/--/----'}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex-1 min-w-[200px] max-w-[400px] mx-4 my-2 sm:my-0">
          <div className="relative group/note bg-secondary/30 dark:bg-muted/10 border border-border/50 rounded-lg p-2 transition-all hover:border-primary/30 group-focus-within/note:border-primary/50 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <StickyNote size={12} className="text-primary flex-shrink-0" />
                <span className="text-[10px] font-black uppercase text-primary tracking-widest leading-none">Nota de Seguimiento</span>
              </div>
              {savingNotes[client.id] && (
                <span className="text-[8px] font-bold text-muted-foreground animate-pulse uppercase">Guardando...</span>
              )}
            </div>
            <textarea 
              className="w-full min-h-[36px] max-h-[80px] text-[11px] bg-transparent border-none focus:ring-0 font-bold italic placeholder:text-muted-foreground/20 p-0 shadow-none text-foreground outline-none resize-none scrollbar-hide"
              placeholder={isAuthorized ? "Escribe algo importante sobre este cliente..." : "Acceso restringido para editar notas"}
              rows={1}
              value={client.notes || ''}
              disabled={!isAuthorized}
              onChange={(e) => handleInlineNoteChange(client.id, e.target.value)}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${target.scrollHeight}px`;
              }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 opacity-100 transition-opacity justify-end">
          {!isAuthorized ? (
            <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground/60 gap-1.5 bg-muted/20 border-border/50 py-1.5 px-3">
              <Lock size={11} className="text-muted-foreground/50" />
              Acceso Privado (Asignado)
            </Badge>
          ) : (
            <>
              <Button 
                variant="ghost" 
                size="sm" 
                title="Panel de Control"
                type="button"
                className="h-8 gap-2 text-[10px] font-black uppercase text-muted-foreground hover:text-primary hover:bg-secondary/50 border border-transparent hover:border-primary/20"
                onClick={() => handleClientClick(client.id)}
              >
                <LayoutDashboard size={14} className="text-muted-foreground/60" />
                Escritorio
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                title="Ver Leads"
                type="button"
                className="h-8 gap-2 text-[10px] font-black uppercase text-muted-foreground hover:text-primary hover:bg-secondary/50 border border-transparent hover:border-primary/20"
                onClick={() => {
                  onClientSelect(client.id);
                  onTabChange('leads');
                }}
              >
                <UsersIcon size={14} className="text-muted-foreground/60" />
                Leads
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                title="Cronograma"
                type="button"
                className="h-8 gap-2 text-[10px] font-black uppercase text-muted-foreground hover:text-primary hover:bg-secondary/50 border border-transparent hover:border-primary/20"
                onClick={() => {
                  onClientSelect(client.id);
                  onTabChange('meetings');
                }}
              >
                <Calendar size={14} className="text-muted-foreground/60" />
                Agenda
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                title="Informes de Rendimiento"
                type="button"
                className="h-8 gap-2 text-[10px] font-black uppercase text-muted-foreground hover:text-primary hover:bg-secondary/50 border border-transparent hover:border-primary/20"
                onClick={() => {
                  onClientSelect(client.id);
                  onTabChange('reports');
                }}
              >
                <BarChart3 size={14} className="text-muted-foreground/60" />
                Informes
              </Button>
            </>
          )}
          
          {(profile?.role === 'director' || profile?.role === 'commercial' || isAuthorized) && (
            <>
              <div className="h-4 w-px bg-border/40 mx-1" />

              <Button 
                variant="outline" 
                size="sm" 
                type="button"
                className="h-8 px-3 gap-2 text-[10px] font-black uppercase text-primary border-primary/20 hover:bg-primary hover:text-white transition-all shadow-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditClient(client);
                }}
              >
                <Zap size={13} fill="currentColor" /> 
                Ficha
              </Button>
              {(profile?.role === 'director' || (profile?.role === 'account_manager' && client.accountManagerId === profile.uid)) && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  type="button"
                  className="h-8 w-8 p-0 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClient(client.id, client.name);
                  }}
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const isManagementRole = profile?.role === 'director' || profile?.role === 'account_manager' || profile?.role === 'setter' || profile?.role === 'commercial';

  return (
    <div className="p-8 space-y-8 bg-background text-foreground min-h-full">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-black tracking-tighter text-foreground uppercase italic">Equipo Digital</h2>
          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">Gestión de Cuentas y Asignaciones</p>
        </div>
        <div className="flex gap-3">
          {(profile?.role === 'director' || profile?.role === 'account_manager' || profile?.role === 'commercial') && (
            <Button variant="outline" onClick={() => setIsNewMemberOpen(true)} className="gap-2 font-bold bg-card border-border text-foreground hover:bg-muted border-2">
              <User size={18} />
              Sumar Equipo
            </Button>
          )}
          {(profile?.role === 'director' || profile?.role === 'account_manager' || profile?.role === 'commercial') && (
            <Button onClick={() => setIsNewClientOpen(true)} className="gap-2 font-black bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_4px_14px_rgba(var(--primary),0.3)]">
              <Plus size={18} />
              Sumar Cliente
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
          <UsersIcon size={16} />
          Estructura del Equipo
        </h3>
        <div className="grid gap-4">
        {teamMembers.filter(m => !m.hideFromTeam).map((member) => {
          const amClients = clients.filter(c => c.accountManagerId === member.uid);
          const setterClients = clients.filter(c => c.setterId === member.uid);
          const isExpanded = expandedMember === member.uid;

          return (
            <Card key={member.uid} className="border border-border bg-card shadow-none overflow-hidden">
              <div 
                className={`flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors ${isExpanded ? 'bg-muted/20 border-b border-border/50' : ''}`}
                onClick={() => setExpandedMember(isExpanded ? null : member.uid)}
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-primary border border-primary/20">
                    <User size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                       <h3 className="font-bold text-foreground">{member.displayName}</h3>
                       {member.role === 'director' && <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[9px] font-bold uppercase">Directivo</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">AM</p>
                    <p className="text-sm font-bold text-primary">{amClients.length} Clientes</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Setter</p>
                    <p className="text-sm font-bold text-blue-400">{setterClients.length} Clientes</p>
                  </div>
                  {isExpanded ? <ChevronDown size={20} className="text-muted-foreground" /> : <ChevronRight size={20} className="text-muted-foreground" />}
                </div>
              </div>

              {isExpanded && (
                <CardContent className="p-0 bg-transparent">
                  {(() => {
                    const uniqueClients = [...amClients, ...setterClients].filter((c, i, self) => self.findIndex(t => t.id === c.id) === i);
                    const activeClients = uniqueClients.filter(c => !c.status || ['onboarding', 'active', 'paused'].includes(c.status));
                    const historicalClients = uniqueClients.filter(c => c.status && ['completed', 'cancelled'].includes(c.status));

                    if (uniqueClients.length === 0) {
                      return (
                        <div className="p-8 text-center text-xs text-muted-foreground italic">
                          No hay clientes asignados a este miembro
                        </div>
                      );
                    }

                    return (
                      <div className="divide-y divide-border/50">
                        {/* Active Clients */}
                        {activeClients.length > 0 ? (
                          activeClients.map((client) => renderClientRow(client, member))
                        ) : (
                          <div className="p-6 text-center text-xs text-muted-foreground italic bg-muted/5">
                            No hay clientes activos o en onboarding asignados
                          </div>
                        )}

                        {/* Collapsible Historical Clients */}
                        {historicalClients.length > 0 && (
                          <div className="p-4 bg-muted/10 border-t border-border/30">
                            <div className="flex justify-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                type="button"
                                className="text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-primary gap-2 hover:bg-secondary/50 border border-border/20 px-4 py-2 h-auto rounded-xl shadow-xs"
                                onClick={() => setShowHistorical(prev => ({ ...prev, [member.uid]: !prev[member.uid] }))}
                              >
                                {showHistorical[member.uid] ? 'Ocultar' : 'Mostrar'} {historicalClients.length} Clientes Históricos (Finalizados/Cancelados)
                              </Button>
                            </div>

                            {showHistorical[member.uid] && (
                              <div className="mt-4 divide-y divide-border/35 border-t border-border/20">
                                {historicalClients.map((client) => renderClientRow(client, member))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>

    <Dialog open={isNewClientOpen} onOpenChange={setIsNewClientOpen}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border text-card-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">Sumar Nuevo Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-2 px-1">
            <div className="space-y-2">
              <Label htmlFor="clientName" className="text-foreground font-medium">Nombre del Cliente</Label>
              <Input 
                id="clientName" 
                value={newClientName} 
                onChange={(e) => setNewClientName(e.target.value)} 
                placeholder="Ej: Inmobiliaria XYZ"
                className="bg-muted border-border"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground font-medium">Estado Inicial</Label>
              <Select value={newClientStatus} onValueChange={(v) => setNewClientStatus(v as ClientStatus)}>
                <SelectTrigger className="h-9 bg-muted border-border text-xs font-bold uppercase tracking-widest">
                  <SelectValue placeholder="Seleccionar Estado" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {(['onboarding', 'active', 'paused', 'completed', 'cancelled'] as ClientStatus[]).map(s => (
                    <SelectItem key={s} value={s} className="text-xs font-bold uppercase tracking-wider">
                      {getClientStatusLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientTags" className="text-foreground font-medium">Tags Predeterminados (Separados por coma)</Label>
              <Input 
                id="clientTags" 
                value={newClientTags} 
                onChange={(e) => setNewClientTags(e.target.value)} 
                placeholder="Ej: Pepito, Pepita, Jona"
                className="bg-muted border-border"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground font-medium">Asignar Account Manager *</Label>
              <div className="grid grid-cols-2 gap-2">
                {teamMembers.map(member => (
                  <Button
                    key={member.uid}
                    type="button"
                    variant={selectedAMForNewClient === member.uid ? 'default' : 'outline'}
                    className={`justify-start font-bold text-[10px] h-8 ${selectedAMForNewClient === member.uid ? 'bg-primary text-primary-foreground' : 'border-border text-foreground'}`}
                    onClick={() => setSelectedAMForNewClient(member.uid)}
                  >
                    <User size={12} className="mr-1" />
                    {member.displayName}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground font-medium">Asignar Setter (Opcional)</Label>
              <div className="grid grid-cols-2 gap-2">
                {teamMembers.map(member => (
                  <Button
                    key={member.uid}
                    type="button"
                    variant={selectedSetterForNewClient === member.uid ? 'default' : 'outline'}
                    className={`justify-start font-bold text-[10px] h-8 ${selectedSetterForNewClient === member.uid ? 'bg-blue-600 text-white' : 'border-border text-foreground'}`}
                    onClick={() => setSelectedSetterForNewClient(member.uid === selectedSetterForNewClient ? '' : member.uid)}
                  >
                    <User size={12} className="mr-1" />
                    {member.displayName}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground font-medium text-[#9955ff]">Account Managers de Soporte / Co-responsables (Opcional)</Label>
              <div className="grid grid-cols-2 gap-2">
                {teamMembers
                  .filter(member => member.uid !== selectedAMForNewClient && (member.role === 'account_manager' || member.role === 'director' || member.role === 'commercial'))
                  .map(member => {
                    const isSelected = selectedSharedAMsForNewClient.includes(member.uid);
                    return (
                      <Button
                        key={member.uid}
                        type="button"
                        variant={isSelected ? 'default' : 'outline'}
                        className={`justify-start font-bold text-[10px] h-8 transition-all ${isSelected ? 'bg-[#9955ff] hover:bg-[#9955ff]/90 text-white border-[#9955ff]' : 'border-border text-foreground'}`}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedSharedAMsForNewClient(selectedSharedAMsForNewClient.filter(id => id !== member.uid));
                          } else {
                            setSelectedSharedAMsForNewClient([...selectedSharedAMsForNewClient, member.uid]);
                          }
                        }}
                      >
                        <UsersIcon size={12} className="mr-1" />
                        {member.displayName}
                      </Button>
                    );
                  })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Fecha Inicio (Opcional)</Label>
                <DatePicker 
                  date={newClientStartDate} 
                  setDate={setNewClientStartDate} 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Fecha Fin (Opcional)</Label>
                <DatePicker 
                  date={newClientEndDate} 
                  setDate={setNewClientEndDate} 
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewClientOpen(false)} className="border-border text-foreground hover:bg-muted">Cancelar</Button>
            <Button onClick={handleCreateClient} disabled={creating || !newClientName.trim() || !selectedAMForNewClient} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
              {creating ? "Sumando..." : "Sumar Cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isNewMemberOpen} onOpenChange={setIsNewMemberOpen}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border text-card-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">Sumar Miembro al Equipo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-2 px-1">
            <div className="space-y-2">
              <Label htmlFor="memberName" className="text-foreground">Nombre Completo</Label>
              <Input 
                id="memberName" 
                value={newMemberName} 
                onChange={(e) => setNewMemberName(e.target.value)} 
                placeholder="Ej: Mariana Rodríguez"
                className="bg-muted border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="memberEmail" className="text-foreground">Email</Label>
              <Input 
                id="memberEmail" 
                type="email"
                value={newMemberEmail} 
                onChange={(e) => setNewMemberEmail(e.target.value)} 
                placeholder="mariana@efectodigital.com"
                className="bg-muted border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewMemberOpen(false)} className="border-border text-foreground hover:bg-muted font-bold">Cancelar</Button>
            <Button onClick={handleCreateMember} disabled={creating || !newMemberName.trim() || !newMemberEmail.trim()} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
              {creating ? "Sumando..." : "Sumar al Equipo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
        <DialogContent className="sm:max-w-[500px] bg-card border-border text-card-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground font-black uppercase tracking-tight">Ficha del Cliente: {editingClient?.name}</DialogTitle>
            <DialogDescription className="text-xs uppercase font-bold text-muted-foreground">Actualiza el perfil completo del cliente y asignaciones.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4 max-h-[75vh] overflow-y-auto pr-2 px-1">
            {/* Sección 1: Identificación y Plan */}
            <div className="grid grid-cols-2 gap-4 border-b border-border pb-6">
              <div className="space-y-2">
                <Label htmlFor="editClientName" className="text-[10px] uppercase font-bold text-muted-foreground">Nombre del Cliente / Empresa</Label>
                <Input 
                  id="editClientName" 
                  value={editingClient?.name || ''} 
                  onChange={(e) => setEditingClient(editingClient ? { ...editingClient, name: e.target.value } : null)} 
                  className="bg-muted border-border font-bold"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Estado Actual</Label>
                <Select value={editingClient?.status || 'onboarding'} onValueChange={(v) => setEditingClient(editingClient ? { ...editingClient, status: v as ClientStatus } : null)}>
                  <SelectTrigger className={cn("h-9 border-none font-black uppercase tracking-widest", getClientStatusBadgeColor(editingClient?.status || 'onboarding'))}>
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {(['onboarding', 'active', 'paused', 'completed', 'cancelled'] as ClientStatus[]).map(s => (
                      <SelectItem key={s} value={s} className="text-xs font-bold uppercase tracking-wider">
                        {getClientStatusLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Tipo de Plan</Label>
                <Select 
                  value={PRESET_PLANS.includes(editingClient?.planName || '') ? editingClient?.planName : (editingClient?.planName ? 'custom' : '')} 
                  onValueChange={(v) => {
                    if (v === 'custom') {
                      setEditingClient(editingClient ? {...editingClient, planName: ''} : null);
                    } else {
                      setEditingClient(editingClient ? {...editingClient, planName: v} : null);
                    }
                  }}
                >
                  <SelectTrigger className="h-9 text-xs bg-muted border-border">
                    <SelectValue placeholder="Seleccionar Plan" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {PRESET_PLANS.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                    <SelectItem value="custom">Otro / Personalizado...</SelectItem>
                  </SelectContent>
                </Select>
                {editingClient?.planName !== undefined && !PRESET_PLANS.includes(editingClient.planName) && (
                  <Input 
                    value={editingClient.planName} 
                    onChange={e => setEditingClient(editingClient ? {...editingClient, planName: e.target.value} : null)}
                    className="h-8 text-xs bg-muted border-border mt-1"
                    placeholder="Nombre del plan personalizado"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Progreso del Contrato</Label>
                <div className="h-9 flex items-center bg-muted rounded-md px-3 border border-border">
                  <span className="text-sm font-black text-primary">
                    {editingClient ? calculateProgress(editingClient.contractStartDate, editingClient.contractEndDate) : 0}%
                  </span>
                </div>
              </div>

              <div className="space-y-2 col-span-2">
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden border border-border/30">
                  <div 
                    className="bg-primary h-full transition-all duration-1000" 
                    style={{ width: `${editingClient ? calculateProgress(editingClient.contractStartDate, editingClient.contractEndDate) : 0}%` }}
                  />
                </div>
                <p className="text-[9px] text-muted-foreground mt-1 italic text-center">Calculado automáticamente entre fecha inicio y fin</p>
              </div>
            </div>

            {/* Sección 2: Fechas de Gestión */}
            <div className="grid grid-cols-2 gap-4 border-b border-border pb-6 bg-secondary/10 p-4 rounded-xl">
              <h4 className="col-span-2 text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                <Calendar size={14} />
                Gestión de Contrato
              </h4>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Fecha Inicio</Label>
                <DatePicker 
                  date={editingClient?.contractStartDate}
                  setDate={(d) => setEditingClient(editingClient ? {...editingClient, contractStartDate: d} : null)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Fecha Fin</Label>
                <DatePicker 
                  date={editingClient?.contractEndDate}
                  setDate={(d) => setEditingClient(editingClient ? {...editingClient, contractEndDate: d} : null)}
                />
              </div>
            </div>

            {/* Sección de Renovación */}
            <div className="grid grid-cols-2 gap-4 border-b border-border pb-6 bg-emerald-500/5 dark:bg-emerald-950/10 p-4 rounded-xl border border-emerald-500/20">
              <h4 className="col-span-2 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <RefreshCcw size={14} />
                Renovaciones de Contrato
              </h4>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Historial de Renovaciones</Label>
                <div className="h-9 flex items-center bg-muted rounded-md px-3 border border-border">
                  <span className="text-xs font-black text-foreground">
                    Acumulado: {editingClient?.renewalCount || 0} renovaciones
                  </span>
                </div>
              </div>
              <div className="space-y-2 flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const currentCount = editingClient?.renewalCount || 0;
                    let nextEndDate = editingClient?.contractEndDate;
                    if (nextEndDate) {
                      try {
                        const d = new Date(nextEndDate.replace(/-/g, '/'));
                        d.setMonth(d.getMonth() + 1);
                        nextEndDate = d.toISOString().split('T')[0];
                      } catch (e) {
                         console.error(e);
                      }
                    }
                    setEditingClient(editingClient ? {
                      ...editingClient,
                      renewalCount: currentCount + 1,
                      renewalStatus: 'will_renew',
                      contractEndDate: nextEndDate
                    } : null);
                    toast.success("¡Renovación agregada! Se incrementó el contador y se extendió la fecha fin por 1 mes.");
                  }}
                  className="w-full text-xs h-9 font-bold bg-emerald-600 hover:bg-emerald-700 text-white dark:text-white border-none shadow-none"
                >
                  <Plus size={14} className="mr-1" />
                  Sumar Renovación (+1)
                </Button>
              </div>
              <div className="col-span-2 space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">¿Se sabe si renueva el próximo período?</Label>
                <Select
                  value={editingClient?.renewalStatus || "unknown"}
                  onValueChange={(v: any) => setEditingClient(editingClient ? {...editingClient, renewalStatus: v} : null)}
                >
                  <SelectTrigger className="h-9 text-xs bg-background border-border">
                    <SelectValue placeholder="Estado de renovación" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="unknown">Por decidir / En negociación</SelectItem>
                    <SelectItem value="will_renew">Sí, renueva</SelectItem>
                    <SelectItem value="will_not_renew">No renueva</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editingClient?.renewalStatus === "unknown" && (
                <div className="col-span-2 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Fecha para volver a consultar</Label>
                  <DatePicker
                    date={editingClient?.contractReconsultDate}
                    setDate={(d) => setEditingClient(editingClient ? {...editingClient, contractReconsultDate: d} : null)}
                    label="Elegir fecha de re-consulta"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    El cartel de vencimiento de contrato se ocultará automáticamente hasta esta fecha de forma transitoria.
                  </p>
                </div>
              )}
            </div>

            {/* Sección 3: Configuración Técnica (LH2) */}
            <div className="grid grid-cols-2 gap-4 border-b border-border pb-6 bg-muted/20 p-4 rounded-xl">
              <h4 className="col-span-2 text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                <Zap size={14} />
                Configuración LH2
              </h4>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Perfil LH</Label>
                <Select 
                  value={editingClient?.lhProfile || ""} 
                  onValueChange={(v) => setEditingClient(editingClient ? {...editingClient, lhProfile: v} : null)}
                >
                  <SelectTrigger className="h-9 text-xs bg-background border-border">
                    <SelectValue placeholder="Seleccionar Perfil" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="LH Facu">LH Facu</SelectItem>
                    <SelectItem value="LH Naza">LH Naza</SelectItem>
                    <SelectItem value="LH Juani">LH Juani</SelectItem>
                    <SelectItem value="LH Otro">Otro / Nuevo...</SelectItem>
                  </SelectContent>
                </Select>
                {(editingClient?.lhProfile === 'LH Otro' || (editingClient?.lhProfile && !['LH Facu', 'LH Naza', 'LH Juani', 'LH Otro'].includes(editingClient.lhProfile))) && (
                   <Input 
                    value={editingClient?.lhProfile === 'LH Otro' ? '' : editingClient?.lhProfile} 
                    onChange={e => setEditingClient(editingClient ? {...editingClient, lhProfile: e.target.value} : null)}
                    className="h-8 text-xs bg-background border-border mt-1"
                    placeholder="Nombre del perfil personalizado"
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Fecha de Inicio de Campañas</Label>
                <DatePicker 
                  date={editingClient?.firstMeetingDate}
                  setDate={(d) => setEditingClient(editingClient ? {...editingClient, firstMeetingDate: d} : null)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Usuario LH</Label>
                <Input 
                  value={editingClient?.lhUser || ''} 
                  onChange={e => setEditingClient(editingClient ? {...editingClient, lhUser: e.target.value} : null)}
                  className="h-9 text-xs bg-background border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Password LH</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                  <Input 
                    value={editingClient?.lhPassword || ''} 
                    onChange={e => setEditingClient(editingClient ? {...editingClient, lhPassword: e.target.value} : null)}
                    className="h-9 text-xs bg-background border-border pl-9"
                    type="text"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2 col-span-2">
                <input 
                  type="checkbox" 
                  id="hasSetterEdit" 
                  checked={editingClient?.hasSetter || false} 
                  onChange={e => setEditingClient(editingClient ? {...editingClient, hasSetter: e.target.checked} : null)}
                  className="h-4 w-4 rounded border-border bg-background text-primary"
                />
                <Label htmlFor="hasSetterEdit" className="text-xs font-bold text-foreground cursor-pointer">¿Tiene Setter asignado?</Label>
              </div>
              <div className="flex items-center gap-2 pt-2 col-span-2">
                <input 
                  type="checkbox" 
                  id="templatesEnabledEdit" 
                  checked={editingClient?.templatesEnabled || false} 
                  onChange={e => setEditingClient(editingClient ? {...editingClient, templatesEnabled: e.target.checked} : null)}
                  className="h-4 w-4 rounded border-border bg-background text-primary"
                />
                <Label htmlFor="templatesEnabledEdit" className="text-xs font-bold text-foreground cursor-pointer">¿Habilitar plantillas de seguimiento/mensajes para este cliente?</Label>
              </div>
            </div>

            {/* Sección 4: Links y Accesos */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Web URL</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                  <Input 
                    value={editingClient?.websiteUrl || ''} 
                    onChange={e => setEditingClient(editingClient ? {...editingClient, websiteUrl: e.target.value} : null)}
                    className="h-9 text-xs bg-muted border-border pl-9"
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Drive URL</Label>
                <div className="relative">
                  <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                  <Input 
                    value={editingClient?.driveUrl || ''} 
                    onChange={e => setEditingClient(editingClient ? {...editingClient, driveUrl: e.target.value} : null)}
                    className="h-9 text-xs bg-muted border-border pl-9"
                    placeholder="Link Drive"
                  />
                </div>
              </div>
            </div>

            {/* Sección de Acceso al Portal de Cliente */}
            <div className="border border-border p-4 rounded-xl space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[#9955ff] flex items-center gap-2">
                <Key size={14} />
                Acceso del Cliente (Portal)
              </h4>

              {(() => {
                const clientUser = allUsers.find(u => u.role === 'client' && u.assignedClientId === editingClient?.id);
                
                if (isCreatingClientAccess) {
                  return (
                    <div className="bg-[#9955ff]/5 border border-[#9955ff]/20 rounded-lg p-3.5 space-y-3">
                      <div className="text-xs font-bold text-[#9955ff] flex items-center gap-1.5">
                        <Plus size={14} />
                        Configurar Nuevo Acceso para {editingClient?.name}
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="space-y-1">
                          <Label className="text-[9px] uppercase font-bold text-muted-foreground">Usuario / Login</Label>
                          <Input
                            value={clientUsername}
                            onChange={e => setClientUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                            placeholder="nombre_usuario"
                            className="h-8 text-xs bg-background border-border"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] uppercase font-bold text-muted-foreground">Contraseña</Label>
                          <Input
                            value={clientPassword}
                            onChange={e => setClientPassword(e.target.value)}
                            placeholder="Clave nueva"
                            className="h-8 text-xs bg-background border-border font-mono text-[#22c55e]"
                          />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-[9px] uppercase font-bold text-muted-foreground">Email de Notificaciones u Oficial (Opcional)</Label>
                          <Input
                            value={clientEmail}
                            onChange={e => setClientEmail(e.target.value)}
                            placeholder="correo@cliente.com"
                            className="h-8 text-xs bg-background border-border"
                          />
                          <p className="text-[9px] text-muted-foreground leading-snug">
                            Si se deja vacío usará: <strong>{clientUsername || 'usuario'}@cliente.efectodigital.com.ar</strong>
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[10px] font-bold"
                          onClick={() => setIsCreatingClientAccess(false)}
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 text-[10px] bg-primary text-primary-foreground font-black"
                          onClick={handleSaveNewClientUser}
                          disabled={creating}
                        >
                          {creating ? 'Guardando...' : 'Generar Acceso'}
                        </Button>
                      </div>
                    </div>
                  );
                }

                if (isEditingClientAccess && clientUser) {
                  return (
                    <div className="bg-muted/50 border border-border rounded-lg p-3.5 space-y-3">
                      <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Edit size={14} />
                        Modificar Credenciales de Acceso
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="space-y-1">
                          <Label className="text-[9px] uppercase font-bold text-muted-foreground">Usuario / Login</Label>
                          <Input
                            value={clientUsername}
                            onChange={e => setClientUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                            className="h-8 text-xs bg-background border-border"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] uppercase font-bold text-muted-foreground">Contraseña</Label>
                          <Input
                            value={clientPassword}
                            onChange={e => setClientPassword(e.target.value)}
                            className="h-8 text-xs bg-background border-border font-mono text-[#22c55e]"
                          />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-[9px] uppercase font-bold text-muted-foreground">Email</Label>
                          <Input
                            value={clientEmail}
                            onChange={e => setClientEmail(e.target.value)}
                            className="h-8 text-xs bg-background border-border"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[10px] font-bold"
                          onClick={() => setIsEditingClientAccess(false)}
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 text-[10px] bg-primary text-primary-foreground font-black"
                          onClick={handleSaveEditedClientUser}
                          disabled={creating}
                        >
                          {creating ? 'Guardando...' : 'Guardar Cambios'}
                        </Button>
                      </div>
                    </div>
                  );
                }

                if (clientUser) {
                  return (
                    <div className="bg-[#9955ff]/5 border border-[#9955ff]/15 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className={`h-2.5 w-2.5 rounded-full ${clientUser.isActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                          <span className="text-xs font-extrabold uppercase tracking-wide text-foreground">
                            {clientUser.isActive ? 'Acceso Habilitado' : 'Acceso Suspendido'}
                          </span>
                        </div>
                        <Badge className={`${clientUser.isActive ? 'bg-green-500/10 text-green-500 hover:bg-green-500/10' : 'bg-red-500/10 text-red-500 hover:bg-red-500/10'} uppercase text-[9px] font-bold border-none`}>
                          {clientUser.isActive ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-[11px] mt-1">
                        <div className="bg-background border border-border p-2 rounded-lg">
                          <span className="text-[9px] text-muted-foreground font-bold uppercase block mb-0.5">Usuario</span>
                          <span className="font-mono font-bold text-[#9955ff]">{clientUser.username || clientUser.email}</span>
                        </div>
                        <div className="bg-background border border-border p-2 rounded-lg">
                          <span className="text-[9px] text-muted-foreground font-bold uppercase block mb-0.5">Contraseña</span>
                          <span className="font-mono font-bold text-[#22c55e]">{clientUser.password || '••••••••'}</span>
                        </div>
                        <div className="col-span-2 bg-background border border-border p-2 rounded-lg">
                          <span className="text-[9px] text-muted-foreground font-bold uppercase block mb-0.5">Email Registrado</span>
                          <span className="font-mono text-foreground font-medium">{clientUser.email}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-[11px] font-bold border-border bg-background hover:bg-muted text-foreground px-3 gap-1"
                          onClick={() => handleCopyCredentials(clientUser)}
                        >
                          <Copy size={12} />
                          Copiar WhatsApp
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-[11px] font-bold border-border bg-background hover:bg-muted text-foreground px-3 gap-1"
                          onClick={() => handleEditClientUser(clientUser)}
                        >
                          <Edit size={12} />
                          Modificar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={`h-8 text-[11px] font-bold border-border bg-background hover:bg-muted px-3 gap-1 ${clientUser.isActive ? 'text-red-500 hover:bg-red-500/5' : 'text-green-500 hover:bg-green-500/5'}`}
                          onClick={() => handleToggleClientUserStatus(clientUser)}
                        >
                          <ShieldAlert size={12} />
                          {clientUser.isActive ? 'Bloquear' : 'Activar'}
                        </Button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="bg-amber-500/5 border border-dashed border-amber-500/30 rounded-xl p-4 space-y-3 flex flex-col items-center text-center">
                    <p className="text-[11px] text-muted-foreground max-w-sm">
                      Este cliente aún no tiene un usuario de ingreso creado. Genera su acceso para que pueda visualizar sus campañas, leads e informes de rendimiento.
                    </p>
                    <Button
                      type="button"
                      className="bg-primary hover:bg-primary/95 text-primary-foreground font-black text-xs h-9 gap-1.5"
                      onClick={handlePrepareCreateClientUser}
                    >
                      <Plus size={13} strokeWidth={3} />
                      Crear Acceso en un Click
                    </Button>
                  </div>
                );
              })()}
            </div>

            {/* Sección 6: Asignaciones de Equipo */}
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="editClientTags" className="text-[10px] uppercase font-bold text-muted-foreground">Tags Predeterminados</Label>
                <Input 
                  id="editClientTags" 
                  value={newClientTags} 
                  onChange={(e) => setNewClientTags(e.target.value)} 
                  placeholder="Separados por coma"
                  className="bg-muted border-border text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Account Manager Responsable *</Label>
                <div className="grid grid-cols-3 gap-2">
                  {teamMembers.map(member => (
                    <Button
                      key={member.uid}
                      type="button"
                      variant={selectedAMForNewClient === member.uid ? 'default' : 'outline'}
                      className={`justify-start font-bold text-[10px] h-8 px-2 ${selectedAMForNewClient === member.uid ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-foreground bg-muted/30'}`}
                      onClick={() => setSelectedAMForNewClient(member.uid)}
                    >
                      <User size={12} className="mr-1 flex-shrink-0" />
                      <span className="truncate">{member.displayName}</span>
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Setter Asignado (Opcional)</Label>
                <div className="grid grid-cols-3 gap-2">
                  {teamMembers.map(member => (
                    <Button
                      key={member.uid}
                      type="button"
                      variant={selectedSetterForNewClient === member.uid ? 'default' : 'outline'}
                      className={`justify-start font-bold text-[10px] h-8 px-2 ${selectedSetterForNewClient === member.uid ? 'bg-blue-600 text-white border-blue-600' : 'border-border text-foreground bg-muted/30'}`}
                      onClick={() => setSelectedSetterForNewClient(member.uid === selectedSetterForNewClient ? '' : member.uid)}
                    >
                      <User size={12} className="mr-1 flex-shrink-0" />
                      <span className="truncate">{member.displayName}</span>
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-[#9955ff]">Account Managers de Soporte / Co-responsables (Opcional)</Label>
                <div className="grid grid-cols-3 gap-2">
                  {teamMembers
                    .filter(member => member.uid !== selectedAMForNewClient && (member.role === 'account_manager' || member.role === 'director' || member.role === 'commercial'))
                    .map(member => {
                      const isSelected = selectedSharedAMsForNewClient.includes(member.uid);
                      return (
                        <Button
                          key={member.uid}
                          type="button"
                          variant={isSelected ? 'default' : 'outline'}
                          className={`justify-start font-bold text-[10px] h-8 px-2 transition-all ${isSelected ? 'bg-[#9955ff] text-white border-[#9955ff] hover:bg-[#9955ff]/90' : 'border-border text-foreground bg-muted/30'}`}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedSharedAMsForNewClient(selectedSharedAMsForNewClient.filter(id => id !== member.uid));
                            } else {
                              setSelectedSharedAMsForNewClient([...selectedSharedAMsForNewClient, member.uid]);
                            }
                          }}
                        >
                          <UsersIcon size={12} className="mr-1 flex-shrink-0" />
                          <span className="truncate">{member.displayName}</span>
                        </Button>
                      );
                    })}
                </div>
                <p className="text-[9px] text-muted-foreground italic leading-tight mt-1">
                  Los asesores seleccionados aquí podrán visualizar y co-gestionar el cliente por si necesitas que algún compañero te cubra.
                </p>
              </div>
            </div>

            {/* Sección 7: Histórico de Notas (Internal) */}
            <div className="space-y-4 pt-6 mt-6 border-t border-border">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                <StickyNote size={14} />
                Histórico de Notas (Interno Equipo)
              </h4>
              
              <div className="space-y-3">
                {selectedAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedAttachments.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-2 py-1 rounded-lg text-[9px] font-black text-primary uppercase">
                        <FileIcon size={10} />
                        <span className="truncate max-w-[120px]">{file.name}</span>
                        <button onClick={() => removeAttachment(idx)} className="hover:text-destructive transition-colors">
                          <XIcon size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="flex gap-2">
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                    multiple 
                  />
                  <div className="relative flex-1 flex">
                    <textarea 
                      value={newHistoryNote}
                      onChange={(e) => setNewHistoryNote(e.target.value)}
                      placeholder="Agregar nota sobre lo visto con el cliente..."
                      className="flex-1 min-h-[90px] bg-muted border border-border rounded-lg p-3 pr-10 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none resize-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.ctrlKey) {
                          handleAddHistoryNote();
                        }
                      }}
                    />
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      type="button"
                      className="absolute bottom-2 right-2 h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 border border-border/50"
                      onClick={() => fileInputRef.current?.click()}
                      title="Adjuntar archivos"
                    >
                      <Paperclip size={16} />
                    </Button>
                  </div>
                  <Button 
                    variant="default" 
                    size="icon" 
                    className="h-10 w-10 mt-auto shrink-0 shadow-lg shadow-primary/20" 
                    onClick={handleAddHistoryNote}
                    disabled={!newHistoryNote.trim() && selectedAttachments.length === 0}
                  >
                    <Plus size={20} />
                  </Button>
                </div>

                <div className="space-y-3 mt-4">
                  {loadingHistory ? (
                    <div className="flex justify-center py-4">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                    </div>
                  ) : historyNotes.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground italic text-center py-4">No hay notas históricas aún.</p>
                  ) : (
                    historyNotes.map((note) => (
                      <div key={note.id} className="group relative bg-muted/50 border border-border/50 rounded-xl p-3 hover:bg-muted transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-primary uppercase">{note.authorName}</span>
                            <span className="text-[9px] text-muted-foreground font-bold">{formatDate(note.date)}</span>
                          </div>
                          {profile?.role === 'director' && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteHistoryNote(note.id)}
                            >
                              <Trash2 size={12} />
                            </Button>
                          )}
                        </div>
                        <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                          {note.content}
                        </p>
                        {note.attachments && note.attachments.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2 border-t border-border/30 pt-3">
                            {note.attachments.map((file, i) => (
                              <div 
                                key={i}
                                className="flex items-center gap-2 bg-background border border-border/50 rounded-lg p-2 text-[10px] font-bold group/file transition-all hover:bg-muted"
                                title={file.name}
                              >
                                <FileIcon size={12} className="text-primary" />
                                <span className="truncate max-w-[140px] text-foreground/80">{file.name}</span>
                                {file.url !== '#' && (
                                  <a 
                                    href={file.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="p-1 hover:bg-primary/10 rounded transition-colors text-primary"
                                  >
                                    <ExternalLink size={10} />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="border-t border-border pt-4">
            <Button variant="outline" onClick={() => setEditingClient(null)} className="border-border text-foreground hover:bg-muted font-bold">Cancelar</Button>
            <Button onClick={handleUpdateClient} disabled={creating || !editingClient?.name.trim() || !selectedAMForNewClient} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold px-8">
              {creating ? "Guardando..." : "Guardar Ficha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirmClient} onOpenChange={(open) => {
        if (!open) {
          setDeleteConfirmClient(null);
          setConfirmStep(1);
        }
      }}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border text-card-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">{confirmStep === 1 ? '¿Eliminar cliente?' : '¡ATENCIÓN! Confirmación irreversible'}</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center">
            {confirmStep === 1 ? (
              <>
                <Trash2 size={48} className="mx-auto text-destructive mb-4 opacity-20" />
                <p className="text-sm text-foreground">
                  ¿Estás seguro de que deseas eliminar permanentemente al cliente <span className="font-bold">{deleteConfirmClient?.name}</span>?
                </p>
                <p className="text-xs text-muted-foreground mt-2">Se perderá toda la configuración asociada.</p>
              </>
            ) : (
              <>
                <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="text-destructive" size={24} />
                </div>
                <p className="text-sm font-bold text-destructive">
                  Esta acción eliminará TODOS los datos de {deleteConfirmClient?.name}.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  No podrás recuperar esta información después. ¿Estás absolutamente seguro?
                </p>
              </>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => {
              setDeleteConfirmClient(null);
              setConfirmStep(1);
            }} className="border-border text-foreground hover:bg-muted font-bold">
              Cancelar
            </Button>
            {confirmStep === 1 ? (
              <Button variant="destructive" onClick={() => setConfirmStep(2)} className="font-bold">Siguiente paso</Button>
            ) : (
              <Button variant="destructive" onClick={handleDeleteAction} className="font-bold">Confirmar eliminación definitiva</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
