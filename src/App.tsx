import React, { useState, useEffect } from 'react';
import { auth, db, loginWithGoogle, logout, isFirebaseConfigured, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, orderBy, getDocs, updateDoc, deleteDoc, limit } from 'firebase/firestore';
import { UserProfile, Lead, UserRole, Client, Meeting } from './types';
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Label } from './components/ui/label';
import { 
  Users, 
  LayoutDashboard, 
  LogOut, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  Bell, 
  Settings,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  Video,
  Play,
  Menu,
  X,
  MoreVertical,
  Sun,
  Moon
} from 'lucide-react';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger,
  PopoverHeader,
  PopoverTitle
} from './components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from './components/ui/avatar';
import { Input } from './components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter, 
  DialogDescription 
} from './components/ui/dialog';
import { Camera, Edit3, Loader2 } from 'lucide-react';
import { Toaster } from 'sonner';
import { toast } from 'sonner';
import { format, parseISO, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

// Components (will be created in separate files)
import LeadList from './components/LeadList';
import DashboardStats from './components/DashboardStats';
import LeadForm from './components/LeadForm';
import UserManagement from './components/UserManagement';
import ClientSelector from './components/ClientSelector';
import TeamView from './components/TeamView';
import TeamPerformance from './components/TeamPerformance';
import { ROLE_PERMISSIONS } from './lib/permissions';
import MeetingAgenda from './components/MeetingAgenda';
import FollowUpCenter from './components/FollowUpCenter';
import LeadDetails from './components/LeadDetails';
import ClientReportsDashboard from './components/ClientReportsDashboard';
import ClientTemplates from './components/ClientTemplates';
import TrashBin from './components/TrashBin';
import { PautaScorecardView } from './components/PautaScorecardView';
import TaskManager from './components/TaskManager';
import ClientWorkspaceHeader from './components/ClientWorkspaceHeader';
import { DatePicker } from './components/ui/DatePicker';
import { Briefcase, Target, User as UserIcon, Lock, ShieldCheck, Mail, History as HistoryIcon, Activity, BarChart3, ChartPie, FileCode, Trash2, ArrowLeft, Percent, Grid, List, RefreshCcw, Info, Megaphone, CheckSquare } from 'lucide-react';

const PRESET_AVATARS = [
  { name: 'Casual 1', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80' },
  { name: 'Casual 2', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80' },
  { name: 'Casual 3', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&h=120&q=80' },
  { name: 'Casual 4', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&h=120&q=80' },
  { name: 'Casual 5', url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=120&h=120&q=80' },
  { name: 'Casual 6', url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=120&h=120&q=80' },
  { name: 'Minimal Pink', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23ff758c"/><stop offset="100%" stop-color="%23ff7eb3"/></linearGradient></defs><rect width="100" height="100" fill="url(%23g)"/><circle cx="50" cy="40" r="18" fill="white" fill-opacity="0.85"/><path d="M22,82 C22,65 34,58 50,58 C66,58 78,65 78,82" fill="white" fill-opacity="0.85"/></svg>' },
  { name: 'Minimal Teal', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%232af598"/><stop offset="100%" stop-color="%23009efd"/></linearGradient></defs><rect width="100" height="100" fill="url(%23g)"/><circle cx="50" cy="40" r="18" fill="white" fill-opacity="0.85"/><path d="M22,82 C22,65 34,58 50,58 C66,58 78,65 78,82" fill="white" fill-opacity="0.85"/></svg>' },
  { name: 'Minimal Purple', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23a18cd1"/><stop offset="100%" stop-color="%23fbc2eb"/></linearGradient></defs><rect width="100" height="100" fill="url(%23g)"/><circle cx="50" cy="40" r="18" fill="white" fill-opacity="0.85"/><path d="M22,82 C22,65 34,58 50,58 C66,58 78,65 78,82" fill="white" fill-opacity="0.85"/></svg>' },
  { name: 'Minimal Orange', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23ff9a9e"/><stop offset="100%" stop-color="%23fecfef"/></linearGradient></defs><rect width="100" height="100" fill="url(%23g)"/><circle cx="50" cy="40" r="18" fill="white" fill-opacity="0.85"/><path d="M22,82 C22,65 34,58 50,58 C66,58 78,65 78,82" fill="white" fill-opacity="0.85"/></svg>' },
];

const getRoleLabel = (role: UserRole) => {
  switch (role) {
    case 'director': return 'Director';
    case 'account_manager': return 'Account Manager';
    case 'designer': return 'Diseñador';
    case 'copywriter': return 'Copywriter';
    case 'setter': return 'Setter';
    case 'commercial': return 'Commercial';
    case 'client': return 'Cliente';
    default: return role;
  }
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [leadViewMode, setLeadViewMode] = useState<'table' | 'kanban' | 'followup'>('table');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loginTab, setLoginTab] = useState<string>('credentials');

  const [selectedLeadForDetail, setSelectedLeadForDetail] = useState<Lead | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const handleOpenLeadDetails = (lead: Lead) => {
    setSelectedLeadForDetail(lead);
    setIsDetailsOpen(true);
  };
  
  useEffect(() => {
    (window as any).setActiveTab = (tab: string) => {
      if (tab === 'follow-ups') {
        setActiveTab('leads');
        setLeadViewMode('followup');
      } else {
        setActiveTab(tab);
      }
    };
    (window as any).setLeadViewMode = setLeadViewMode;
    (window as any).isDemoMode = isDemoMode;
  }, [isDemoMode]);

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLeadFormOpen, setIsLeadFormOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [targetTaskId, setTargetTaskId] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [clientFilterStatus, setClientFilterStatus] = useState<'all' | 'active' | 'inactive' | 'last_month' | 'pauta'>('all');
  const [selectedAMFilter, setSelectedAMFilter] = useState<string>('all');
  const [customRenewalEndDate, setCustomRenewalEndDate] = useState<string>('');
  const [clientViewMode, setClientViewMode] = useState<'grid' | 'table'>('table');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  // States for Client Card & Renewal Card Dialog from the clients grid
  const [clientToViewFicha, setClientToViewFicha] = useState<Client | null>(null);
  const [editedPlanName, setEditedPlanName] = useState('Standard');
  const [editedContractStartDate, setEditedContractStartDate] = useState('');
  const [editedContractEndDate, setEditedContractEndDate] = useState('');
  const [editedRenewalCount, setEditedRenewalCount] = useState(0);
  const [editedRenewalStatus, setEditedRenewalStatus] = useState<'unknown' | 'will_renew' | 'will_not_renew'>('unknown');
  const [editedContractReconsultDate, setEditedContractReconsultDate] = useState('');
  const [editedNotes, setEditedNotes] = useState('');
  const [editedHasPautaService, setEditedHasPautaService] = useState(false);
  const [editedMetaAdAccountId, setEditedMetaAdAccountId] = useState('');
  const [editedMetaAccessToken, setEditedMetaAccessToken] = useState('');
  const [editedPautaTargetCPL, setEditedPautaTargetCPL] = useState<string>('');
  const [editedPautaCurrency, setEditedPautaCurrency] = useState<'ARS' | 'USD' | 'EUR' | 'MXN' | 'CLP' | 'COP'>('ARS');
  const [isSavingFicha, setIsSavingFicha] = useState(false);

  const handleOpenFicha = (client: Client) => {
    setClientToViewFicha(client);
    setEditedPlanName(client.planName || 'Standard');
    setEditedContractStartDate(client.contractStartDate || '');
    setEditedContractEndDate(client.contractEndDate || '');
    setEditedRenewalCount(client.renewalCount || 0);
    setEditedRenewalStatus(client.renewalStatus || 'unknown');
    setEditedContractReconsultDate(client.contractReconsultDate || '');
    setEditedNotes(client.notes || '');
    setEditedHasPautaService(client.hasPautaService || false);
    setEditedMetaAdAccountId(client.metaAdAccountId || '');
    setEditedMetaAccessToken(client.metaAccessToken || '');
    setEditedPautaTargetCPL(client.pautaTargetCPL ? String(client.pautaTargetCPL) : '');
    setEditedPautaCurrency(client.pautaCurrency || 'ARS');
  };

  const handleEndDateChange = (newDate: string) => {
    setEditedContractEndDate(newDate);
    // If the contract end date (vencimiento) is extended to a later date, we automatically register a renewal
    if (clientToViewFicha && clientToViewFicha.contractEndDate && newDate) {
      if (newDate > clientToViewFicha.contractEndDate) {
        const diffCount = (clientToViewFicha.renewalCount || 0) + 1;
        if (editedRenewalCount < diffCount) {
          setEditedRenewalCount(diffCount);
          setEditedRenewalStatus('will_renew');
          toast.success(`Se detectó una extensión en la fecha de vencimiento: se incrementó el acumulado (+1) y se marcó como 'Sí, renueba'.`);
        }
      }
    }
  };

  const handleSaveFicha = async () => {
    if (!clientToViewFicha) return;
    setIsSavingFicha(true);
    try {
      const updatedClient: Client = {
        ...clientToViewFicha,
        planName: editedPlanName,
        contractStartDate: editedContractStartDate,
        contractEndDate: editedContractEndDate,
        renewalCount: editedRenewalCount,
        renewalStatus: editedRenewalStatus,
        contractReconsultDate: editedContractReconsultDate,
        notes: editedNotes,
        hasPautaService: editedHasPautaService,
        metaAdAccountId: editedMetaAdAccountId,
        metaAccessToken: editedMetaAccessToken,
        pautaTargetCPL: editedPautaTargetCPL ? Number(editedPautaTargetCPL) : undefined,
        pautaCurrency: editedPautaCurrency,
      };

      if (isDemoMode) {
        const stored = localStorage.getItem('demo-clients');
        const demoClients = stored ? JSON.parse(stored) : [];
        const updatedList = demoClients.map((c: any) => c.id === clientToViewFicha.id ? updatedClient : c);
        localStorage.setItem('demo-clients', JSON.stringify(updatedList));
        setClients(updatedList);
        if (selectedClient?.id === updatedClient.id) {
          setSelectedClient(updatedClient);
        }
        window.dispatchEvent(new CustomEvent('demo-clients-updated'));
      } else {
        const { id, ...data } = updatedClient as any;
        await updateDoc(doc(db, 'clients', clientToViewFicha.id), data);
        if (selectedClient?.id === updatedClient.id) {
          setSelectedClient(updatedClient);
        }
      }

      toast.success("Ficha del cliente y datos de renovación guardados con éxito.");
      setClientToViewFicha(null);
    } catch (error) {
      console.error("Error al guardar ficha:", error);
      toast.error("Ocurrió un error al intentar actualizar la ficha.");
    } finally {
      setIsSavingFicha(false);
    }
  };

  // Profile settings states and handlers
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editedDisplayName, setEditedDisplayName] = useState('');
  const [editedPhotoURL, setEditedPhotoURL] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const handleOpenProfileModal = () => {
    if (profile) {
      setEditedDisplayName(profile.displayName || '');
      setEditedPhotoURL(profile.photoURL || '');
      setIsProfileModalOpen(true);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 350 * 1024) {
      toast.error('La imagen es demasiado grande. Selecciona una menor a 350KB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setEditedPhotoURL(event.target.result);
        toast.success('Miniatura cargada. Guarda para confirmar.');
      }
    };
    reader.onerror = () => {
      toast.error('Error al leer el archivo');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    if (!editedDisplayName.trim()) {
      toast.error('El nombre no puede estar vacío');
      return;
    }

    setIsSavingProfile(true);

    try {
      const updatedProfile = {
        ...profile!,
        displayName: editedDisplayName,
        photoURL: editedPhotoURL,
      };

      if (isDemoMode) {
        const stored = localStorage.getItem('demo-users');
        if (stored) {
          const demoUsers = JSON.parse(stored);
          const index = demoUsers.findIndex((u: any) => u.uid === profile?.uid);
          if (index !== -1) {
            demoUsers[index].displayName = editedDisplayName;
            demoUsers[index].photoURL = editedPhotoURL;
            localStorage.setItem('demo-users', JSON.stringify(demoUsers));
          }
        }
        setProfile(updatedProfile);
        window.dispatchEvent(new CustomEvent('demo-users-updated'));
        toast.success('Perfil actualizado correctamente');
        setIsProfileModalOpen(false);
      } else {
        if (profile?.uid) {
          await updateDoc(doc(db, 'users', profile.uid), {
            displayName: editedDisplayName,
            photoURL: editedPhotoURL
          });
          
          setProfile(updatedProfile);
          toast.success('Perfil actualizado correctamente');
          setIsProfileModalOpen(false);
        } else {
          throw new Error('ID de usuario no encontrado');
        }
      }
    } catch (error: any) {
      console.error("Error al actualizar perfil:", error);
      toast.error(`Error al guardar: ${error.message || error}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const [navigationHistory, setNavigationHistory] = useState<Array<{ tab: string; clientId: string; leadViewMode: 'table' | 'kanban' | 'followup' }>>([]);
  const isBackNavigating = React.useRef(false);

  useEffect(() => {
    if (!profile) {
      setNavigationHistory([]);
    } else {
      setNavigationHistory([{ tab: activeTab, clientId: selectedClientId, leadViewMode }]);
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    
    if (isBackNavigating.current) {
      isBackNavigating.current = false;
      return;
    }

    setNavigationHistory(prev => {
      const last = prev[prev.length - 1];
      if (last && last.tab === activeTab && last.clientId === selectedClientId && last.leadViewMode === leadViewMode) {
        return prev;
      }
      const newHistory = [...prev, { tab: activeTab, clientId: selectedClientId, leadViewMode }];
      if (newHistory.length > 30) {
        newHistory.shift();
      }
      return newHistory;
    });
  }, [activeTab, selectedClientId, leadViewMode, profile]);

  const goBack = () => {
    if (navigationHistory.length <= 1) return;
    
    isBackNavigating.current = true;
    
    const previousState = navigationHistory[navigationHistory.length - 2];
    
    setNavigationHistory(prev => {
      const copy = [...prev];
      copy.pop(); // remove current state
      return copy;
    });

    setActiveTab(previousState.tab);
    setSelectedClientId(previousState.clientId);
    setLeadViewMode(previousState.leadViewMode);
  };
  const [notifications, setNotifications] = useState<any[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  });

  const lastNotifiedCount = React.useRef(0);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (isDemoMode) {
      const updateClients = () => {
        const stored = localStorage.getItem('demo-clients');
        let allClients: Client[] = stored ? JSON.parse(stored) : [];
        let filtered = allClients.filter(c => 
          !c.name.toLowerCase().includes('mi primer lead') && 
          !c.name.toLowerCase().includes('lead flow')
        );
        if (profile && !ROLE_PERMISSIONS[profile.role]?.canViewClients) {
          if (profile.role === 'client') {
            filtered = filtered.filter(c => c.id === profile.assignedClientId);
          } else {
            filtered = filtered.filter(c => 
              c.accountManagerId === profile.uid || 
              c.setterId === profile.uid || 
              (c.sharedAccountManagerIds && c.sharedAccountManagerIds.includes(profile.uid))
            );
          }
        }
        setClients(filtered);
      };
      updateClients();
      window.addEventListener('demo-clients-updated', updateClients);
      return () => window.removeEventListener('demo-clients-updated', updateClients);
    } else {
      if (!user) return;
      const path = 'clients';
      const unsubscribe = onSnapshot(collection(db, path), (snapshot) => {
        const allClients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
        let filtered = allClients.filter(c => 
          !c.name.toLowerCase().includes('mi primer lead') && 
          !c.name.toLowerCase().includes('lead flow')
        );
        if (profile && !ROLE_PERMISSIONS[profile.role]?.canViewClients) {
          if (profile.role === 'client') {
            filtered = filtered.filter(c => c.id === profile.assignedClientId);
          } else {
            filtered = filtered.filter(c => 
              c.accountManagerId === profile.uid || 
              c.setterId === profile.uid || 
              (c.sharedAccountManagerIds && c.sharedAccountManagerIds.includes(profile.uid))
            );
          }
        }
        setClients(filtered);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      });
      return () => unsubscribe();
    }
  }, [isDemoMode, user, profile]);

  useEffect(() => {
    if (isDemoMode) {
      const updateUsers = () => {
        const stored = localStorage.getItem('demo-users');
        if (stored) {
          setAllUsers(JSON.parse(stored) as UserProfile[]);
        }
      };
      updateUsers();
      window.addEventListener('demo-users-updated', updateUsers);
      return () => window.removeEventListener('demo-users-updated', updateUsers);
    } else {
      if (!user) return;
      const path = 'users';
      const unsubscribe = onSnapshot(collection(db, path), (snapshot) => {
        const users = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
        setAllUsers(users);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      });
      return () => unsubscribe();
    }
  }, [isDemoMode, user]);

  useEffect(() => {
    if (profile && clients.length > 0) {
      if (!ROLE_PERMISSIONS[profile.role]?.canViewClients) {
        const isAllowed = clients.some(c => c.id === selectedClientId);
        if (!isAllowed) {
          // If they have an assigned client id, use it, otherwise fall back to first
          if (profile.assignedClientId) {
            setSelectedClientId(profile.assignedClientId);
          } else {
            setSelectedClientId(clients[0].id);
          }
        }
      } else {
        // Staff/users with multiple client access should start with NO client selected by default as requested.
      }
    }
  }, [clients, selectedClientId, profile]);

  useEffect(() => {
    if (isDemoMode) {
      const updateData = () => {
        const storedLeads = localStorage.getItem('demo-leads');
        const allLeads: Lead[] = storedLeads ? JSON.parse(storedLeads) : [];
        const filteredLeads = selectedClientId ? allLeads.filter(l => l.clientId === selectedClientId) : allLeads;
        setLeads(filteredLeads);

        const storedMeetings = localStorage.getItem('demo-meetings');
        const allMeetings: Meeting[] = storedMeetings ? JSON.parse(storedMeetings) : [];
        const filteredMeetings = selectedClientId ? allMeetings.filter(m => m.clientId === selectedClientId) : allMeetings;
        setMeetings(filteredMeetings);
      };
      
      updateData();
      window.addEventListener('demo-leads-updated', updateData);
      window.addEventListener('demo-meetings-updated', updateData);
      return () => {
        window.removeEventListener('demo-leads-updated', updateData);
        window.removeEventListener('demo-meetings-updated', updateData);
      };
    } else {
      const isStaff = profile?.role === 'director' || 
                      profile?.role === 'account_manager' || 
                      profile?.role === 'setter' || 
                      profile?.role === 'commercial' || 
                      profile?.email?.endsWith('@efectodigital.com.ar') || 
                      profile?.email?.endsWith('@efectodigital.com') ||
                      user?.email?.endsWith('@efectodigital.com.ar') ||
                      user?.email?.endsWith('@efectodigital.com');
      
      if (!user || (!selectedClientId && !isStaff)) {
        setLeads([]);
        setMeetings([]);
        return;
      }

      const lPath = 'leads';
      const mPath = 'meetings';
      const lQuery = selectedClientId 
        ? query(collection(db, lPath), where('clientId', '==', selectedClientId))
        : query(collection(db, lPath));
        
      const mQuery = selectedClientId
        ? query(collection(db, mPath), where('clientId', '==', selectedClientId))
        : query(collection(db, mPath));

      const unsubL = onSnapshot(lQuery, (snap) => {
        setLeads(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead)));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, lPath);
      });

      const unsubM = onSnapshot(mQuery, (snap) => {
        setMeetings(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, mPath);
      });

      return () => {
        unsubL();
        unsubM();
      };
    }
  }, [selectedClientId, isDemoMode, profile?.role, user]);

  useEffect(() => {
    if (!profile || clients.length === 0) return;

    // Filter clients assigned to this user
    const myClients = clients.filter(c => 
      c.accountManagerId === profile.uid || c.setterId === profile.uid
    );

    // If the user is a manager, they might want to see all, but Azul specifically asked for personal notifications
    const isDirector = profile.role === 'director';

    const checkMeetings = (allMeetings: any[]) => {
      const today = new Date().toISOString().split('T')[0];
      const todayMeetings = allMeetings.filter(m => {
        const mDate = m.date.split('T')[0];
        const isToday = mDate === today;
        const clientExists = clients.some(c => c.id === m.clientId);
        if (!clientExists) return false;

        const isMyClient = myClients.some(c => c.id === m.clientId) || (isDirector && myClients.length === 0);
        return isToday && isMyClient && m.status === 'pending';
      });

      return todayMeetings.map(m => {
        const client = clients.find(c => c.id === m.clientId);
        return {
          id: `meeting-${m.id}`,
          message: `Reunión hoy: ${m.leadName} (${client?.name || 'Cliente'}) a las ${m.time}`,
          type: 'meeting',
          createdAt: new Date().toISOString(),
          targetId: m.id,
          clientId: m.clientId
        };
      });
    };

    const checkFollowUps = (allLeads: Lead[]) => {
      const today = new Date().toISOString().split('T')[0];
      const pendingFollowUps = allLeads.filter(l => {
        if (!l.nextFollowUpDate || l.status === 'closed-won' || l.status === 'closed-lost') return false;
        
        // Rule: Stop if 3+ follow-ups and no interest/response
        const followUpCount = l.followUps?.length || 0;
        if (followUpCount >= 3 && (l.status === 'new' || l.status === 'contacted')) return false;

        const lDate = l.nextFollowUpDate.split('T')[0];
        const isTodayOrPast = lDate <= today;
        const clientExists = clients.some(c => c.id === l.clientId);
        if (!clientExists) return false;

        const isMyClient = myClients.some(c => c.id === l.clientId) || (isDirector && myClients.length === 0);
        
        // Only notify if it's their stage (Setter for setter stage, etc)
        const isMyStage = (profile.role === 'setter' && l.stage === 'setter') || 
                          (profile.role === 'commercial' && l.stage === 'commercial') ||
                          (profile.role === 'director' || profile.role === 'account_manager');

        return isTodayOrPast && isMyClient && isMyStage;
      });

      return pendingFollowUps.map(l => {
        const client = clients.find(c => c.id === l.clientId);
        return {
          id: `followup-${l.id}`,
          message: `Seguimiento pendiente: ${l.name} (${client?.name || 'Cliente'})`,
          type: 'follow_up',
          createdAt: new Date().toISOString(),
          targetId: l.id,
          clientId: l.clientId
        };
      });
    };

    if (isDemoMode) {
      const storedMeetings = localStorage.getItem('demo-meetings');
      const storedLeads = localStorage.getItem('demo-leads');
      
      const meetingNotifs = checkMeetings(storedMeetings ? JSON.parse(storedMeetings) : []);
      const followUpNotifs = checkFollowUps(storedLeads ? JSON.parse(storedLeads) : []);
      
      const combined = [...meetingNotifs, ...followUpNotifs];
      setNotifications(combined);
      
      if (combined.length > 0 && combined.length !== lastNotifiedCount.current) {
        toast.info(`Tienes ${combined.length} tareas para hoy`, {
          icon: <Clock size={18} />,
        });
        lastNotifiedCount.current = combined.length;
      }
    } else {
      // For real mode, we would need to listen to both collections
      if (!user || !profile) return;

      const mPath = 'meetings';
      const lPath = 'leads';
      const mQuery = query(collection(db, mPath), where('status', '==', 'pending'));
      const lQuery = query(collection(db, lPath), where('isActive', '==', true));

      const unsubM = onSnapshot(mQuery, (mSnap) => {
        const meetings = mSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const mNotifs = checkMeetings(meetings);
        
        // We'll update notifications by merging with existing ones of other types
        setNotifications(prev => [
          ...prev.filter(n => n.type !== 'meeting'),
          ...mNotifs
        ]);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, mPath);
      });

      const unsubL = onSnapshot(lQuery, (lSnap) => {
        const leads = lSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead));
        const fNotifs = checkFollowUps(leads);
        
        setNotifications(prev => [
          ...prev.filter(n => n.type !== 'follow_up'),
          ...fNotifs
        ]);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, lPath);
      });

      return () => {
        unsubM();
        unsubL();
      };
    }
  }, [profile, clients, isDemoMode]);

  useEffect(() => {
    if (isDemoMode) {
      const updateSelectedClient = () => {
        const stored = localStorage.getItem('demo-clients');
        const allClients: Client[] = stored ? JSON.parse(stored) : [];
        const client = allClients.find((c: Client) => c.id === selectedClientId);
        if (client) {
          setSelectedClient(client);
        } else if (selectedClientId === '' && profile?.role !== 'director') {
           // Si no hay ID y no es director, limpiar
           setSelectedClient(null);
        }
      };
      
      updateSelectedClient();
      window.addEventListener('demo-clients-updated', updateSelectedClient);
      return () => window.removeEventListener('demo-clients-updated', updateSelectedClient);
    }
    
    if (selectedClientId) {
      if (!user) return;
      const path = `clients/${selectedClientId}`;
      const unsubscribe = onSnapshot(doc(db, 'clients', selectedClientId), (doc) => {
        if (doc.exists()) {
          setSelectedClient({ id: doc.id, ...doc.data() } as Client);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      });
      return () => unsubscribe();
    } else {
      setSelectedClient(null);
    }
  }, [selectedClientId, isDemoMode, profile?.role]);

  useEffect(() => {
    if (selectedClientId && !selectedClient && clients.length > 0) {
      const found = clients.find(c => c.id === selectedClientId);
      if (found) setSelectedClient(found);
    }
  }, [selectedClientId, selectedClient, clients]);

  useEffect(() => {
    // Initialize demo users if not present to allow immediate login testing
    const stored = localStorage.getItem('demo-users');
    if (!stored) {
      const initialUsers = [
        { uid: 'u-azul', email: 'azul@efectodigital.com.ar', displayName: 'Azul', role: 'director' as UserRole, isActive: true, createdAt: new Date().toISOString(), username: 'azul', password: 'azul' },
        { uid: 'u-naza', email: 'nazareno@efectodigital.com.ar', displayName: 'Naza', role: 'account_manager' as UserRole, isActive: true, createdAt: new Date().toISOString(), username: 'naza', password: 'naza' },
        { uid: 'u-mariana', email: 'mariana@efectodigital.com', displayName: 'Mariana', role: 'account_manager' as UserRole, isActive: true, createdAt: new Date().toISOString(), username: 'mariana', password: 'mariana' },
        { uid: 'demo-director', email: 'director@efectodigital.com.ar', displayName: 'Director Efecto', role: 'director' as UserRole, isActive: true, createdAt: new Date().toISOString(), username: 'director', password: 'efecto2024' },
      ];
      localStorage.setItem('demo-users', JSON.stringify(initialUsers));
    }
  }, []);

  useEffect(() => {
    // Data Migration for Azul/Naza real accounts
    const storedUsers = localStorage.getItem('demo-users');
    const storedClients = localStorage.getItem('demo-clients');
    
    if (storedUsers) {
      let users = JSON.parse(storedUsers);
      let clients = storedClients ? JSON.parse(storedClients) : [];
      let needsUpdate = false;

      // Update Azul
      const azulIndex = users.findIndex((u: any) => u.email === 'azul@efectodigital.com.ar' || u.displayName === 'Azul');
      if (azulIndex !== -1 && users[azulIndex].uid !== 'u-azul') {
        const oldUid = users[azulIndex].uid;
        users[azulIndex].uid = 'u-azul';
        users[azulIndex].role = 'director'; // Ensure Azul is Director
        // Update his clients
        clients = clients.map((c: any) => ({
          ...c,
          accountManagerId: c.accountManagerId === oldUid ? 'u-azul' : c.accountManagerId,
          setterId: c.setterId === oldUid ? 'u-azul' : c.setterId
        }));
        needsUpdate = true;
      }

      // Update Naza
      const nazaIndex = users.findIndex((u: any) => u.email === 'nazareno@efectodigital.com.ar' || u.displayName === 'Naza');
      if (nazaIndex !== -1 && users[nazaIndex].uid !== 'u-naza') {
        const oldUid = users[nazaIndex].uid;
        users[nazaIndex].uid = 'u-naza';
        clients = clients.map((c: any) => ({
          ...c,
          accountManagerId: c.accountManagerId === oldUid ? 'u-naza' : c.accountManagerId,
          setterId: c.setterId === oldUid ? 'u-naza' : c.setterId
        }));
        needsUpdate = true;
      }

      if (needsUpdate) {
        localStorage.setItem('demo-users', JSON.stringify(users));
        localStorage.setItem('demo-clients', JSON.stringify(clients));
        
        // If current profile is being migrated, update it in state too
        if (profile) {
          const updatedMe = users.find((u: any) => u.email === profile.email);
          if (updatedMe) setProfile(updatedMe);
        }

        window.dispatchEvent(new CustomEvent('demo-users-updated'));
        window.dispatchEvent(new CustomEvent('demo-clients-updated'));
      }
    }

    // Safety timeout to ensure user never stays stuck on loading
    const timeout = setTimeout(() => {
      if (loading) setLoading(false);
    }, 3000);

    if (!isFirebaseConfigured) {
      setLoading(false);
      // No firebase listener in bypass mode
      return () => clearTimeout(timeout);
    }
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch or create user profile
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setProfile({ uid: userDoc.id, ...userDoc.data() } as UserProfile);
        } else {
          // Check if there's a profile with the same email but different ID (pre-created by director)
          const lowerEmail = currentUser.email?.toLowerCase();
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('email', '==', lowerEmail));
          const querySnap = await getDocs(q);
          
          if (!querySnap.empty && querySnap.docs[0].id !== currentUser.uid) {
            // Migrate the pre-created profile to the new Firebase UID
            const oldDoc = querySnap.docs[0];
            const oldUid = oldDoc.id;
            const profileData = oldDoc.data();
            const newProfile: UserProfile = {
              ...profileData,
              uid: currentUser.uid,
              displayName: profileData.displayName || currentUser.displayName || 'User',
              photoURL: currentUser.photoURL || profileData.photoURL || undefined,
            } as UserProfile;
            
            // 1. Create the new profile
            await setDoc(doc(db, 'users', currentUser.uid), newProfile);
            
            // 2. Update client assignments
            try {
              const clientsRef = collection(db, 'clients');
              
              // Find clients where this user was AM
              const qAm = query(clientsRef, where('accountManagerId', '==', oldUid));
              const snapAm = await getDocs(qAm);
              const amUpdates = snapAm.docs.map(d => updateDoc(d.ref, { accountManagerId: currentUser.uid }));
              
              // Find clients where this user was Setter
              const qSetter = query(clientsRef, where('setterId', '==', oldUid));
              const snapSetter = await getDocs(qSetter);
              const setterUpdates = snapSetter.docs.map(d => updateDoc(d.ref, { setterId: currentUser.uid }));
              
              await Promise.all([...amUpdates, ...setterUpdates]);
              console.log(`Migrated ${amUpdates.length + setterUpdates.length} client assignments from ${oldUid} to ${currentUser.uid}`);
            } catch (err) {
              console.error("Error migrating client assignments:", err);
            }

            // 3. Optional: delete old profile to avoid duplicates in team view
            try {
              await deleteDoc(doc(db, 'users', oldUid));
            } catch (err) {
              console.error("Error deleting old profile:", err);
            }

            setProfile(newProfile);
          } else {
            const isStaffEmail = lowerEmail?.endsWith('@efectodigital.com.ar') || lowerEmail?.endsWith('@efectodigital.com');
            const isAdminEmail = lowerEmail === 'azul@efectodigital.com.ar' || lowerEmail === 'nazareno@efectodigital.com.ar' || lowerEmail === 'mariana@efectodigital.com' || lowerEmail === 'mariana@efectodigital.com.ar' || lowerEmail === 'azul@efectodigital.com';
            const newProfile: UserProfile = {
              uid: currentUser.uid,
              email: lowerEmail || '',
              displayName: currentUser.displayName || 'User',
              role: isAdminEmail ? 'director' : (isStaffEmail ? 'account_manager' : 'setter'), 
              isActive: true,
              photoURL: currentUser.photoURL || undefined,
              createdAt: new Date().toISOString(),
            };
            await setDoc(doc(db, 'users', currentUser.uid), newProfile);
            setProfile(newProfile);
          }
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (profile?.role === 'client') {
      setActiveTab('dashboard');
      if (profile.assignedClientId) {
        setSelectedClientId(profile.assignedClientId);
      }
    } else if (profile) {
      // For non-clients, land on Team view by default upon login
      setActiveTab('team');
    }
  }, [profile]);

  // Clients can always view their leads page now, so redirect is not needed regardless of setter status
  useEffect(() => {
    // No redirect needed for clients here
  }, [profile, selectedClient, activeTab]);

  const handleNotificationClick = (n: any) => {
    if (n.clientId) {
      setSelectedClientId(n.clientId);
    }
    
    if (n.type === 'meeting') {
      setActiveTab('meetings');
    } else if (n.type === 'follow_up') {
      setActiveTab('leads');
    }
    
    setTargetTaskId(n.targetId);
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setProfile(null);
      setIsDemoMode(false);
      setSelectedClientId('');
      setSelectedClient(null);
      setCredentials({ username: '', password: '' });
      toast.success("Has cerrado sesión");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      // Fallback: clear local state even if logout fails
      setProfile(null);
      setIsDemoMode(false);
      setSelectedClientId('');
      setSelectedClient(null);
    }
  };

  const enterDemoMode = () => {
    setIsDemoMode(true);
    // Log in as Director for full access in demo
    const demoProfile: UserProfile = {
      uid: 'demo-1',
      email: 'director@efectodigital.com.ar',
      displayName: 'Director (Demo Local)',
      role: 'director',
      isActive: true,
      createdAt: new Date().toISOString()
    };
    setProfile(demoProfile);
    toast.warning("SISTEMA EN MODO DEMO: Los datos que ingreses NO se compartirán con el equipo. Usa el LOGIN DE GOOGLE para trabajar con datos reales.", { duration: 8000 });
  };

  if (loading && isFirebaseConfigured) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          <div className="flex flex-col items-center animate-pulse">
            <span className="text-xl font-black tracking-tighter text-primary">EFECTO DIGITAL</span>
            <span className="text-[8px] text-muted-foreground font-bold tracking-widest italic">CONECTANDO SISTEMAS...</span>
          </div>
        </div>
      </div>
    );
  }

  if (profile && profile.isActive === false) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-background p-4 text-center">
        <div className="h-20 w-20 bg-destructive/10 rounded-full flex items-center justify-center mb-6 border border-destructive/20 shadow-lg">
          <AlertCircle size={40} className="text-destructive" />
        </div>
        <h1 className="text-2xl font-black text-foreground mb-2">ACCESO RESTRINGIDO</h1>
        <p className="text-muted-foreground max-w-md mx-auto mb-8 font-medium">
          Tu cuenta ha sido desactivada. Si crees que esto es un error o necesitas recuperar el acceso, por favor contacta con el administrador de Efecto Digital.
        </p>
        <Button onClick={handleLogout} variant="outline" className="font-bold border-2">
          Cerrar Sesión
        </Button>
      </div>
    );
  }

  const handleCredentialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentials.username || !credentials.password) return;
    setIsLoggingIn(true);
    
    try {
      const lowerUsername = credentials.username.toLowerCase().trim();
      let foundProfile: UserProfile | null = null;
      
      const stored = localStorage.getItem('demo-users');
      if (isDemoMode || !isFirebaseConfigured) {
        if (!stored) {
          // Initialize if missing
          const initialUsers = [
            { uid: 'u-azul', email: 'azul@efectodigital.com.ar', displayName: 'Azul', role: 'director' as UserRole, isActive: true, createdAt: new Date().toISOString(), username: 'azul', password: 'azul' },
            { uid: 'u-naza', email: 'nazareno@efectodigital.com.ar', displayName: 'Naza', role: 'account_manager' as UserRole, isActive: true, createdAt: new Date().toISOString(), username: 'naza', password: 'naza' },
            { uid: 'u-mariana', email: 'mariana@efectodigital.com', displayName: 'Mariana', role: 'commercial' as UserRole, isActive: true, createdAt: new Date().toISOString(), username: 'mariana', password: 'mariana' },
            { uid: 'u-comercial', email: 'comercial@efectodigital.com.ar', displayName: 'Comercial Demo', role: 'commercial' as UserRole, isActive: true, createdAt: new Date().toISOString(), username: 'comercial', password: 'comercial' },
            { uid: 'demo-director', email: 'director@efectodigital.com.ar', displayName: 'Director Efecto', role: 'director' as UserRole, isActive: true, createdAt: new Date().toISOString(), username: 'director', password: 'efecto2024' },
          ];
          localStorage.setItem('demo-users', JSON.stringify(initialUsers));
          foundProfile = initialUsers.find(u => (u.username?.toLowerCase() === lowerUsername || u.email?.toLowerCase() === lowerUsername) && u.password === credentials.password) || null;
        } else {
          const demoUsers: UserProfile[] = JSON.parse(stored);
          foundProfile = demoUsers.find(u => (u.username?.toLowerCase() === lowerUsername || u.email?.toLowerCase() === lowerUsername) && u.password === credentials.password) || null;
        }
      } else {
        // High-reliability search in Firestore with restricted query to avoid listing full collection (unauthenticated)
        try {
          const usersRef = collection(db, 'users');
          let q;
          if (lowerUsername.includes('@')) {
            q = query(usersRef, where('email', '==', lowerUsername), limit(1));
          } else {
            q = query(usersRef, where('username', '==', lowerUsername), limit(1));
          }
          const querySnap = await getDocs(q);
          if (!querySnap.empty) {
            const docData = querySnap.docs[0].data() as any;
            if (docData && docData.password === credentials.password) {
              foundProfile = { uid: querySnap.docs[0].id, ...docData } as UserProfile;
            }
          }
        } catch (err) {
          console.error("Auth search error:", err);
          // Fallback to specific doc reads if search fails
          let snap = await getDoc(doc(db, 'users', `u-${lowerUsername}`));
          if (!snap.exists()) snap = await getDoc(doc(db, 'users', `u-staff-${lowerUsername}`));
          if (snap.exists()) {
            const data = { uid: snap.id, ...snap.data() } as UserProfile;
            if (data.password === credentials.password) foundProfile = data;
          }
        }
      }

      if (foundProfile) {
        if (!foundProfile.isActive) {
          toast.error("Tu cuenta está bloqueada");
        } else {
          if (!isFirebaseConfigured) {
            setIsDemoMode(true);
          }
          
          // Sincronizar con Firebase Auth si está disponible para tener token de seguridad activo
          if (isFirebaseConfigured && foundProfile.email && foundProfile.password) {
            try {
              console.log("Intentando iniciar sesión en Firebase Auth para sincronización:", foundProfile.email);
              await signInWithEmailAndPassword(auth, foundProfile.email, foundProfile.password);
              console.log("Sincronización exitosa con Firebase Auth.");
            } catch (authError: any) {
              console.warn("Error al sincronizar directamente, intentando registrar cuenta de Auth faltante:", authError);
              const isUserNotFound = authError.code === 'auth/user-not-found' || 
                                    authError.code === 'auth/invalid-credential' || 
                                    authError.message?.includes('user-not-found') ||
                                    authError.message?.includes('INVALID_LOGIN_CREDENTIALS');
              if (isUserNotFound) {
                try {
                  console.log("Registrando y autenticando usuario faltante en Firebase Auth...");
                  await createUserWithEmailAndPassword(auth, foundProfile.email, foundProfile.password);
                  console.log("Auto-registro exitoso.");
                } catch (regError: any) {
                  console.error("No se pudo auto-registrar el usuario en Firebase Auth:", regError);
                }
              }
            }
          }

          setProfile(foundProfile);
          toast.success(`Bienvenido, ${foundProfile.displayName}`);
        }
      } else if (!isDemoMode && isFirebaseConfigured) {
        // If not found in demo, try a query by username in Firebase
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('username', '==', lowerUsername), where('password', '==', credentials.password), limit(1));
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
          const data = { uid: querySnap.docs[0].id, ...querySnap.docs[0].data() } as UserProfile;
          if (data.isActive) {
            // Sincronizar con Firebase Auth para este caso también
            if (data.email && data.password) {
              try {
                console.log("Intentando iniciar sesión en Firebase Auth para sincronización:", data.email);
                await signInWithEmailAndPassword(auth, data.email, data.password);
                console.log("Sincronización exitosa con Firebase Auth.");
              } catch (authError: any) {
                console.warn("Error de sincronización, auto-registrando:", authError);
                const isUserNotFound = authError.code === 'auth/user-not-found' || 
                                      authError.code === 'auth/invalid-credential' || 
                                      authError.message?.includes('user-not-found') ||
                                      authError.message?.includes('INVALID_LOGIN_CREDENTIALS');
                if (isUserNotFound) {
                  try {
                    await createUserWithEmailAndPassword(auth, data.email, data.password);
                    console.log("Auto-registro exitoso.");
                  } catch (regError: any) {
                    console.error("Error al auto-registrar:", regError);
                  }
                }
              }
            }

            setProfile(data);
            toast.success(`Bienvenido, ${data.displayName}`);
          } else {
            toast.error("Tu cuenta está bloqueada");
          }
        } else {
          toast.error("Usuario o contraseña incorrectos");
        }
      } else {
        toast.error("Usuario o contraseña incorrectos");
      }
    } catch (error) {
      toast.error("Error al iniciar sesión");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const shouldShowLogin = !isDemoMode && isFirebaseConfigured ? (!user || !profile) : (!isDemoMode && !profile);
  if (shouldShowLogin) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0a0a0a] p-6 overflow-y-auto relative font-sans dark">
        {/* Subtle Background Accent */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="w-full max-w-md space-y-8 relative z-10">
          <div className="text-center space-y-4">
            <div className="inline-flex flex-col items-center mb-4 cursor-pointer" onClick={enterDemoMode}>
              <span className="text-5xl font-black leading-none tracking-tighter text-white font-montserrat">EFECTO</span>
              <span className="text-sm font-black text-primary tracking-[0.4em] font-montserrat ml-2">DIGITAL</span>
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-black text-white tracking-tight leading-tight">Portal de Operaciones</h1>
              <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest opacity-60">Acceso Privado para Equipo</p>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-2 backdrop-blur-xl shadow-2xl">
            <div className="space-y-6 p-4 sm:p-6 animate-in fade-in slide-in-from-top-4 duration-500">
              <form onSubmit={(e) => { e.preventDefault(); handleCredentialLogin(e); }} className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/80 ml-1">Usuario / Email</Label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 group-focus-within:text-primary transition-colors">
                      <UserIcon size={18} />
                    </div>
                    <input 
                      type="text"
                      placeholder="ej: naza_efecto" 
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-12 h-12 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all font-medium"
                      value={credentials.username}
                      onChange={e => setCredentials({...credentials, username: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/80 ml-1">Clave</Label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 group-focus-within:text-primary transition-colors">
                      <Lock size={18} />
                    </div>
                    <input 
                      type="password"
                      placeholder="••••••••" 
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-12 h-12 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all font-medium"
                      value={credentials.password}
                      onChange={e => setCredentials({...credentials, password: e.target.value})}
                    />
                  </div>
                </div>
                <Button 
                  type="submit"
                  className="w-full h-12 font-black bg-primary text-black hover:bg-primary/90 rounded-xl shadow-[0_0_30px_rgba(var(--primary),0.2)] transition-all active:scale-[0.98] mt-4"
                  disabled={isLoggingIn}
                >
                  {isLoggingIn ? 'AUTENTICANDO...' : 'INGRESAR AL PANEL'}
                </Button>

                <div className="pt-4 border-t border-white/5 text-center">
                  <button 
                    type="button"
                    onClick={async () => {
                      try {
                        await loginWithGoogle();
                      } catch (error: any) {
                        if (error.code !== 'auth/popup-closed-by-user') {
                          console.error("Google Login Error:", error);
                          toast.error("Error al iniciar sesión con Google");
                        }
                      }
                    }}
                    className="text-[10px] items-center gap-2 font-bold uppercase tracking-widest text-muted-foreground/60 hover:text-white transition-colors inline-flex"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.28.81-.56z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    O ingresar con Google Workspace
                  </button>
                </div>
              </form>
            </div>
          </div>
          
          <div className="text-center">
            <Button 
               variant="ghost" 
               onClick={enterDemoMode} 
               className="text-[9px] uppercase tracking-[0.5em] font-black text-muted-foreground/20 hover:text-primary transition-all"
            >
              Invitado (Modo Demo)
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const clientHasSetter = selectedClient ? (!!selectedClient.setterId && selectedClient.setterId.trim() !== '') : false;
  const showLeadsSection = true;
  const isStaff = profile?.role !== 'client' && (profile?.role === 'director' || profile?.role === 'setter' || profile?.role === 'account_manager' || profile?.role === 'commercial');

  const getContractStatusAlert = () => {
    if (!selectedClient || !selectedClient.contractEndDate) return null;
    
    try {
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      if (selectedClient.contractReconsultDate && selectedClient.contractReconsultDate.trim() !== '') {
        const reconsultDate = new Date(selectedClient.contractReconsultDate.replace(/-/g, '/'));
        reconsultDate.setHours(0, 0, 0, 0);
        if (now < reconsultDate) {
          return null;
        }
      }

      const endDate = new Date(selectedClient.contractEndDate.replace(/-/g, '/'));
      endDate.setHours(0, 0, 0, 0);
      
      const diffTime = endDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 30) {
        return {
          diffDays,
          isExpired: diffDays < 0,
          formattedDate: selectedClient.contractEndDate.split('-').reverse().join('/'),
          status: selectedClient.renewalStatus || 'unknown'
        };
      }
    } catch (e) {
      console.error("Error computing contract status", e);
    }
    
    return null;
  };

  const getDurationString = (start?: string, end?: string) => {
    if (!start) return '---';
    try {
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
    } catch {
      return '---';
    }
  };

  const calculateProgress = (startDate?: string, endDate?: string): number => {
    if (!startDate || !endDate) return 0;
    try {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      const now = new Date();
      
      if (now < start) return 0;
      if (now > end) return 100;
      
      const totalDays = differenceInDays(end, start);
      const daysPassed = differenceInDays(now, start);
      
      if (totalDays <= 0) return 100;
      
      const progress = Math.round((daysPassed / totalDays) * 100);
      return Math.min(100, Math.max(0, progress));
    } catch (error) {
      return 0;
    }
  };

  const handlePromoRenewal = async (status: 'will_renew' | 'will_not_renew', customEndDate?: string) => {
    if (!selectedClient) return;
    
    let nextEndDate = customEndDate || selectedClient.contractEndDate;
    if (status === 'will_renew' && !customEndDate && nextEndDate) {
      try {
        const d = new Date(nextEndDate.replace(/-/g, '/'));
        d.setMonth(d.getMonth() + 1);
        nextEndDate = d.toISOString().split('T')[0];
      } catch (e) {
        console.error(e);
      }
    }

    const updated: Client = {
      ...selectedClient,
      renewalStatus: status,
      ...(status === 'will_renew' ? {
        renewalCount: (selectedClient.renewalCount || 0) + 1,
        contractEndDate: nextEndDate
      } : {})
    };

    try {
      if (isDemoMode) {
        const stored = localStorage.getItem('demo-clients');
        if (stored) {
          const all: Client[] = JSON.parse(stored);
          const newList = all.map(c => c.id === selectedClient.id ? updated : c);
          localStorage.setItem('demo-clients', JSON.stringify(newList));
          window.dispatchEvent(new CustomEvent('demo-clients-updated'));
        }
      } else {
        await updateDoc(doc(db, 'clients', selectedClient.id), updated as any);
      }
      setSelectedClient(updated);
      toast.success(status === 'will_renew' ? "¡Renovación completada y fecha de contrato extendida por 1 mes!" : "Estado de renovación actualizado.");
    } catch (error) {
      toast.error("Error al registrar la renovación.");
    }
  };

  return (
    <div className="flex h-screen w-screen bg-background overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div 
            className="fixed inset-y-0 left-0 w-[280px] bg-card border-r border-border shadow-2xl p-6 flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex flex-col">
                <span className="text-xl font-black leading-none tracking-tighter text-primary font-montserrat">EFECTO</span>
                <span className="text-[10px] font-black text-muted-foreground tracking-[0.2em] font-montserrat">DIGITAL</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)}>
                <X size={20} />
              </Button>
            </div>

            <nav className="flex-1 space-y-1">
              {profile?.role !== 'client' ? (
                <>
                  <SidebarItem 
                    icon={<Briefcase size={18} />} 
                    label="Cartera de Clientes" 
                    active={activeTab === 'dashboard' && !selectedClientId} 
                    onClick={() => {
                      setActiveTab('dashboard');
                      setSelectedClientId('');
                      setIsMobileMenuOpen(false);
                    }} 
                  />
                  <SidebarItem 
                    icon={<CheckSquare size={18} />} 
                    label="Tareas & Pedidos" 
                    active={activeTab === 'tasks' && !selectedClientId} 
                    onClick={() => {
                      setActiveTab('tasks');
                      setSelectedClientId('');
                      setIsMobileMenuOpen(false);
                    }} 
                  />
                  <SidebarItem 
                    icon={<Users size={18} />} 
                    label="Equipo" 
                    active={activeTab === 'team'} 
                    onClick={() => {
                      setActiveTab('team');
                      setSelectedClientId('');
                      setIsMobileMenuOpen(false);
                    }} 
                  />
                  {profile?.role === 'director' && (
                    <SidebarItem 
                      icon={<BarChart3 size={18} />} 
                      label="Rendimiento" 
                      active={activeTab === 'performance'} 
                      onClick={() => {
                        setActiveTab('performance');
                        setSelectedClientId('');
                        setIsMobileMenuOpen(false);
                      }} 
                    />
                  )}
                  {(profile?.role === 'director' || profile?.role === 'account_manager') && (
                    <SidebarItem 
                      icon={<Settings size={18} />} 
                      label="Accesos & Roles" 
                      active={activeTab === 'settings'} 
                      onClick={() => { 
                        setActiveTab('settings'); 
                        setSelectedClientId('');
                        setIsMobileMenuOpen(false); 
                      }} 
                    />
                  )}
                  {profile?.role === 'director' && (
                    <SidebarItem 
                      icon={<Trash2 size={18} />} 
                      label="Papelera" 
                      active={activeTab === 'trash'} 
                      onClick={() => { 
                        setActiveTab('trash'); 
                        setSelectedClientId('');
                        setIsMobileMenuOpen(false); 
                      }} 
                    />
                  )}
                </>
              ) : (
                <>
                  <SidebarItem 
                    icon={<LayoutDashboard size={18} />} 
                    label="Escritorio" 
                    active={activeTab === 'dashboard'} 
                    onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }} 
                  />
                  <SidebarItem 
                    icon={<CheckSquare size={18} />} 
                    label="Mis Creativos & Tareas" 
                    active={activeTab === 'tasks'} 
                    onClick={() => { setActiveTab('tasks'); setIsMobileMenuOpen(false); }} 
                  />
                  <SidebarItem 
                    icon={<Calendar size={18} />} 
                    label="Agenda" 
                    active={activeTab === 'meetings'} 
                    onClick={() => { setActiveTab('meetings'); setIsMobileMenuOpen(false); }} 
                  />
                  {selectedClient?.hasPautaService && (
                    <SidebarItem 
                      icon={<Megaphone size={18} />} 
                      label="Pauta & Scorecard" 
                      active={activeTab === 'pauta'} 
                      onClick={() => { setActiveTab('pauta'); setIsMobileMenuOpen(false); }} 
                    />
                  )}
                </>
              )}
            </nav>

            <div className="mt-auto pt-6 border-t border-border">
              <div 
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleOpenProfileModal();
                }}
                className="flex items-center gap-3 p-3 bg-muted rounded-xl cursor-pointer hover:bg-muted-foreground/15 transition-all text-left group/profile"
                title="Editar Perfil"
              >
                <Avatar className="h-10 w-10 border-2 border-primary">
                  {profile?.photoURL ? (
                    <AvatarImage src={profile.photoURL} alt={profile.displayName} />
                  ) : null}
                  <AvatarFallback className="bg-primary text-white font-bold">
                    {profile?.displayName?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center gap-1">
                    <p className="truncate text-sm font-bold group-hover/profile:text-primary transition-colors">{profile?.displayName}</p>
                    <Edit3 size={10} className="text-muted-foreground opacity-0 group-hover/profile:opacity-100 transition-opacity" />
                  </div>
                  <p className="truncate text-[10px] text-muted-foreground uppercase font-semibold">{profile ? getRoleLabel(profile.role) : ''}</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLogout();
                  }} 
                  className="text-destructive hover:bg-destructive/10"
                >
                  <LogOut size={18} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar (Desktop) */}
      <aside className="hidden w-[220px] flex-col border-r bg-card md:flex">
        <div className="flex h-16 items-center px-6 py-8">
          <div className="flex items-center gap-2">
            <div className="flex flex-col">
              <span className="text-xl font-black leading-none tracking-tighter text-primary font-montserrat">EFECTO</span>
              <span className="text-[10px] font-black text-muted-foreground tracking-[0.2em] font-montserrat">DIGITAL</span>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 space-y-1 py-4">
          {profile?.role !== 'client' ? (
            <>
              <SidebarItem 
                icon={<Briefcase size={18} />} 
                label="Cartera de Clientes" 
                active={activeTab === 'dashboard' && !selectedClientId} 
                onClick={() => {
                  setActiveTab('dashboard');
                  setSelectedClientId('');
                }} 
              />
              <SidebarItem 
                icon={<CheckSquare size={18} />} 
                label="Tareas & Pedidos" 
                active={activeTab === 'tasks' && !selectedClientId} 
                onClick={() => {
                  setActiveTab('tasks');
                  setSelectedClientId('');
                }} 
              />
              <SidebarItem 
                icon={<Users size={18} />} 
                label="Equipo" 
                active={activeTab === 'team'} 
                onClick={() => {
                  setActiveTab('team');
                  setSelectedClientId('');
                }} 
              />
              {profile?.role === 'director' && (
                <SidebarItem 
                  icon={<BarChart3 size={18} />} 
                  label="Rendimiento" 
                  active={activeTab === 'performance'} 
                  onClick={() => {
                    setActiveTab('performance');
                    setSelectedClientId('');
                  }} 
                />
              )}
              {(profile?.role === 'director' || profile?.role === 'account_manager') && (
                <SidebarItem 
                  icon={<Settings size={18} />} 
                  label="Accesos & Roles" 
                  active={activeTab === 'settings'} 
                  onClick={() => {
                    setActiveTab('settings');
                    setSelectedClientId('');
                  }} 
                />
              )}
              {profile?.role === 'director' && (
                <SidebarItem 
                  icon={<Trash2 size={18} />} 
                  label="Papelera" 
                  active={activeTab === 'trash'} 
                  onClick={() => {
                    setActiveTab('trash');
                    setSelectedClientId('');
                  }} 
                />
              )}
            </>
          ) : (
            <>
              <SidebarItem 
                icon={<LayoutDashboard size={18} />} 
                label="Escritorio" 
                active={activeTab === 'dashboard'} 
                onClick={() => setActiveTab('dashboard')} 
              />
              <SidebarItem 
                icon={<CheckSquare size={18} />} 
                label="Mis Creativos & Tareas" 
                active={activeTab === 'tasks'} 
                onClick={() => setActiveTab('tasks')} 
              />
              <SidebarItem 
                icon={<Calendar size={18} />} 
                label="Agenda Reuniones" 
                active={activeTab === 'meetings'} 
                onClick={() => setActiveTab('meetings')} 
              />
              {selectedClient?.hasPautaService && (
                <SidebarItem 
                  icon={<Megaphone size={18} />} 
                  label="Pauta & Scorecard" 
                  active={activeTab === 'pauta'} 
                  onClick={() => setActiveTab('pauta')} 
                />
              )}
            </>
          )}
        </nav>

        <div className="border-t p-4 border-border">
          <div 
            onClick={handleOpenProfileModal}
            className="flex items-center gap-3 rounded-xl bg-muted p-3 cursor-pointer hover:bg-muted-foreground/15 transition-all text-left group/profile"
            title="Editar Perfil"
          >
            <div className="h-10 w-10 overflow-hidden rounded-full bg-background border-2 border-primary relative flex items-center justify-center shrink-0">
              {profile?.photoURL ? (
                <img src={profile.photoURL} alt={profile.displayName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-primary text-white font-bold">
                  {profile?.displayName?.charAt(0)}
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/profile:opacity-100 transition-opacity">
                <Camera size={12} className="text-white" />
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="flex items-center gap-1">
                <p className="truncate text-sm font-bold group-hover/profile:text-primary transition-colors">{profile?.displayName}</p>
                <Edit3 size={10} className="text-muted-foreground opacity-0 group-hover/profile:opacity-100 transition-opacity shrink-0" />
              </div>
              <p className="truncate text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{profile ? getRoleLabel(profile.role) : ''}</p>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={(e) => {
                e.stopPropagation();
                handleLogout();
              }} 
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
            >
              <LogOut size={16} />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b bg-card px-4 md:px-8 border-border">
          <div className="flex items-center gap-4">
            {navigationHistory.length > 1 && (
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-1.5 px-3 h-9 font-bold bg-card border-border text-foreground hover:bg-muted border text-xs shadow-sm transition-all flex items-center shrink-0"
                onClick={goBack}
              >
                <ArrowLeft size={14} className="text-primary" />
                <span className="hidden sm:inline">Atrás</span>
              </Button>
            )}

            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden" 
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={20} />
            </Button>

            <div className="relative w-[200px] md:w-[300px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text"
                placeholder="Buscar leads, empresas..."
                className="w-full bg-muted border border-border rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-foreground"
              />
            </div>

            {isStaff && (
              <div className="hidden md:block ml-2">
                <ClientSelector 
                  selectedClientId={selectedClientId} 
                  onClientChange={(id) => {
                    setSelectedClientId(id);
                    if (activeTab === 'team' || activeTab === 'performance' || activeTab === 'settings' || activeTab === 'trash') {
                      setActiveTab('dashboard');
                    }
                  }} 
                  isDemoMode={isDemoMode}
                  profile={profile}
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            {isStaff && selectedClient && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenFicha(selectedClient)}
                className="gap-1.5 px-3 h-9 font-bold bg-card border-border text-foreground hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/30 text-xs shadow-sm transition-all flex items-center shrink-0"
                title="Editar Ficha, Renovación y Servicio de Pauta"
              >
                <span>📇</span>
                <span className="hidden sm:inline">Ficha Cliente</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="h-9 w-9 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title={theme === 'dark' ? "Cambiar a modo día" : "Cambiar a modo noche"}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </Button>

            <Popover>
              <PopoverTrigger className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/20">
                <Bell size={20} className="pointer-events-none" />
                {notifications.length > 0 && (
                  <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-destructive animate-pulse"></span>
                )}
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0 overflow-hidden border border-border shadow-xl bg-card">
                <div className="p-4 border-b border-border bg-card">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">Notificaciones</span>
                    <span className="text-[10px] bg-secondary text-primary px-2 py-0.5 rounded-full uppercase font-bold border border-primary/20">Hoy</span>
                  </div>
                </div>
                <div className="max-h-[400px] overflow-y-auto bg-card">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-xs text-muted-foreground italic">
                      No tienes notificaciones pendientes
                    </div>
                  ) : (
                    notifications.map((n: any) => (
                      <div 
                        key={n.id} 
                        className="p-4 border-b border-border last:border-0 hover:bg-muted transition-colors cursor-pointer"
                        onClick={() => handleNotificationClick(n)}
                      >
                        <div className="flex gap-3">
                          <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-primary shrink-0 border border-primary/20">
                            <Calendar size={14} />
                          </div>
                          <div className="flex flex-col gap-1">
                            <p className="text-sm font-bold leading-tight text-foreground">{n.message}</p>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              <Clock size={10} />
                              <span>Hoy</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {notifications.length > 0 && (
                  <div className="p-2 border-t border-border bg-muted/30">
                    <Button variant="ghost" className="w-full text-[10px] font-bold h-8 hover:bg-card" onClick={() => setNotifications([])}>
                      Marcar todas como leídas
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
            
            {isStaff && activeTab === 'leads' && (
              <Button onClick={() => setIsLeadFormOpen(true)} className="gap-2 font-semibold">
                <Plus size={18} />
                <span>Nuevo Lead</span>
              </Button>
            )}
          </div>
        </header>

        {/* Client Workspace Sub-Header (Context Navigation) */}
        {selectedClient && (
          <ClientWorkspaceHeader
            client={selectedClient}
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab)}
            onBackToAgency={() => {
              setSelectedClientId('');
              setActiveTab('dashboard');
            }}
            onOpenFicha={() => handleOpenFicha(selectedClient)}
            profile={profile}
            leadViewMode={leadViewMode}
            onLeadViewModeChange={(mode) => {
              setLeadViewMode(mode);
              setActiveTab('leads');
            }}
          />
        )}

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {/* BANNER DE VENCIMIENTO DE CONTRATO (De 1 semana o menos) */}
          {(() => {
            const alert = getContractStatusAlert();
            if (!alert) return null;
            
            return (
              <div className={`mb-6 p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all animate-fade-in ${
                alert.isExpired 
                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-950 dark:text-rose-200' 
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-950 dark:text-amber-200'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg mt-0.5 ${alert.isExpired ? 'bg-rose-500/20' : 'bg-amber-500/20'}`}>
                    <AlertCircle size={18} className={alert.isExpired ? 'text-rose-500' : 'text-amber-500'} />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm tracking-tight text-foreground">
                      {alert.isExpired 
                        ? `El período del contrato con ${selectedClient?.name} venció el ${alert.formattedDate}`
                        : `El contrato con ${selectedClient?.name} termina pronto: el ${alert.formattedDate} (Inicia etapa de negociación)`}
                    </h4>
                    <p className="text-xs opacity-80 mt-1 text-muted-foreground">
                      {alert.isExpired 
                        ? `Expiró hace ${Math.abs(alert.diffDays)} ${Math.abs(alert.diffDays) === 1 ? 'día' : 'días'}.`
                        : `Falta ${alert.diffDays} ${alert.diffDays === 1 ? 'día' : 'días'} para finalizar. Se recomienda iniciar negociaciones.`}
                      {" "}¿Está confirmada la renovación? 
                      <span className="ml-1 font-extrabold">
                        {alert.status === 'will_renew' && '✅ Sí, renovado'}
                        {alert.status === 'will_not_renew' && '❌ No renovará'}
                        {alert.status === 'unknown' && '⏳ En negociación'}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center">
                  {alert.status !== 'will_renew' && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 shadow-none"
                        >
                          Sí, renovar
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-4 bg-card border border-border rounded-xl shadow-xl space-y-3" align="end">
                        <div className="space-y-1">
                          <h4 className="font-extrabold text-xs text-foreground uppercase tracking-wider">Confirmar Renovación</h4>
                          <p className="text-[10px] text-muted-foreground leading-snug">
                            Ingresa la fecha de finalización de la nueva prórroga de contrato. Por defecto es de 1 mes más.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase text-muted-foreground block">Nueva Fecha de Fin</label>
                          <DatePicker
                            date={customRenewalEndDate || (() => {
                              if (selectedClient?.contractEndDate) {
                                try {
                                  const d = new Date(selectedClient.contractEndDate.replace(/-/g, '/'));
                                  d.setMonth(d.getMonth() + 1);
                                  return d.toISOString().split('T')[0];
                                } catch {
                                  return '';
                                }
                              }
                              return '';
                            })()}
                            setDate={(newDate) => setCustomRenewalEndDate(newDate)}
                            label="Seleccionar fecha"
                          />
                        </div>
                        <Button
                          size="sm"
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 shadow-none"
                          onClick={() => {
                            const dateToUse = customRenewalEndDate || (() => {
                              if (selectedClient?.contractEndDate) {
                                try {
                                  const d = new Date(selectedClient.contractEndDate.replace(/-/g, '/'));
                                  d.setMonth(d.getMonth() + 1);
                                  return d.toISOString().split('T')[0];
                                } catch {}
                              }
                              return '';
                            })();
                            handlePromoRenewal('will_renew', dateToUse);
                            setCustomRenewalEndDate('');
                          }}
                        >
                          Confirmar Prórroga
                        </Button>
                      </PopoverContent>
                    </Popover>
                  )}
                  {alert.status === 'unknown' && selectedClient && (
                    <Popover>
                      <PopoverTrigger className="inline-flex items-center justify-center border border-amber-500/30 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-xs h-8 bg-transparent gap-1.5 px-3 py-1.5 rounded-md transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-amber-500/25">
                        <Calendar size={14} />
                        Volver a consultar
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-4 bg-card border border-border rounded-xl shadow-xl space-y-3" align="end">
                        <div className="space-y-1">
                          <h4 className="font-bold text-xs text-foreground">Postergar consulta</h4>
                          <p className="text-[10px] text-muted-foreground leading-snug">
                            Oculta este cartel y recuerda volver a consultar sobre la renovación en la fecha seleccionada.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <DatePicker
                            date={selectedClient.contractReconsultDate || ''}
                            setDate={async (newDate) => {
                              if (!selectedClient) return;
                              const updated: Client = {
                                ...selectedClient,
                                contractReconsultDate: newDate,
                                renewalStatus: 'unknown'
                              };
                              try {
                                if (isDemoMode) {
                                  const stored = localStorage.getItem('demo-clients');
                                  if (stored) {
                                    const all: Client[] = JSON.parse(stored);
                                    const newList = all.map(c => c.id === selectedClient.id ? updated : c);
                                    localStorage.setItem('demo-clients', JSON.stringify(newList));
                                    window.dispatchEvent(new CustomEvent('demo-clients-updated'));
                                  }
                                } else {
                                  await updateDoc(doc(db, 'clients', selectedClient.id), {
                                    contractReconsultDate: newDate,
                                    renewalStatus: 'unknown'
                                  });
                                }
                                setSelectedClient(updated);
                                toast.success(`Se agendó consultar de nuevo el ${newDate.split('-').reverse().join('/')}. El cartel se ocultará hasta ese día.`);
                              } catch (e: any) {
                                toast.error(`Error al agendar: ${e.message || e}`);
                              }
                            }}
                            label="Elegir fecha"
                          />
                        </div>
                        {selectedClient.contractReconsultDate && (
                          <div className="flex items-center justify-between gap-2 border-t border-border pt-2 mt-1">
                            <span className="text-[10px] text-muted-foreground truncate">
                              Agendado: {selectedClient.contractReconsultDate.split('-').reverse().join('/')}
                            </span>
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={async () => {
                                if (!selectedClient) return;
                                const updated: Client = {
                                  ...selectedClient,
                                  contractReconsultDate: ""
                                };
                                try {
                                  if (isDemoMode) {
                                    const stored = localStorage.getItem('demo-clients');
                                    if (stored) {
                                      const all: Client[] = JSON.parse(stored);
                                      const newList = all.map(c => c.id === selectedClient.id ? updated : c);
                                      localStorage.setItem('demo-clients', JSON.stringify(newList));
                                      window.dispatchEvent(new CustomEvent('demo-clients-updated'));
                                    }
                                  } else {
                                    await updateDoc(doc(db, 'clients', selectedClient.id), {
                                      contractReconsultDate: ""
                                    });
                                  }
                                  setSelectedClient(updated);
                                  toast.success('Fecha de re-consulta eliminada');
                                } catch (e: any) {
                                  toast.error(`Error: ${e.message || e}`);
                                }
                              }}
                              className="text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10 h-6 px-2"
                            >
                              Eliminar
                            </Button>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  )}
                  {alert.status !== 'will_not_renew' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePromoRenewal('will_not_renew')}
                      className="border-rose-500/30 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-xs h-8 bg-transparent"
                    >
                      No renueva
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* CLIENT QUICK META INFO BANNER */}
          {selectedClient && ['dashboard', 'templates', 'leads', 'meetings'].includes(activeTab) && (
            <div className="mb-8 p-6 bg-card border border-border/40 rounded-[2rem] shadow-sm backdrop-blur-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                
                {/* Left: Client name, status & plan */}
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-black text-xl italic shrink-0">
                    {selectedClient.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xl font-black text-foreground uppercase italic tracking-tighter leading-none">{selectedClient.name}</h3>
                      {selectedClient.status && (
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase border-none ${
                          ['completed', 'cancelled'].includes(selectedClient.status) 
                            ? 'bg-muted text-muted-foreground' 
                            : 'bg-emerald-500/10 text-emerald-500'
                        }`}>
                          {selectedClient.status === 'completed' || selectedClient.status === 'cancelled' ? '📁 Inactivo' : '● Activo'}
                        </span>
                      )}
                      <span className="text-[8px] font-black px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 uppercase italic">
                        PLAN: {selectedClient.planName || 'STANDARD'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {selectedClient.websiteUrl ? (
                        <a 
                          href={selectedClient.websiteUrl} 
                          target="_blank" 
                          referrerPolicy="no-referrer" 
                          className="text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 font-semibold"
                        >
                          🌐 {selectedClient.websiteUrl}
                        </a>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/60 italic">Sin sitio web cargado</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: The 3 requested widgets (Antigüedad, Renovaciones, Reuniones Agendadas) + Old Clients history popover */}
                <div className="flex flex-wrap items-stretch gap-4">
                  
                  {/* Antiquity/Fechas Widget */}
                  <div className="p-4 bg-muted/35 rounded-2xl border border-border/15 flex flex-col justify-center min-w-[150px]">
                    <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1">
                      <Calendar size={10} className="text-emerald-500" />
                      Antigüedad y Fechas
                    </span>
                    <span className="text-xs font-extrabold text-foreground leading-tight">
                      {getDurationString(selectedClient.contractStartDate, selectedClient.contractEndDate)}
                    </span>
                    <span className="text-[9px] text-muted-foreground/80 mt-1">
                      Inicio: {selectedClient.contractStartDate ? selectedClient.contractStartDate.split('-').reverse().join('/') : '---'}
                    </span>
                  </div>

                  {/* Renewals Widget */}
                  <div className="p-4 bg-muted/35 rounded-2xl border border-border/15 flex flex-col justify-center min-w-[150px]">
                    <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1">
                      <HistoryIcon size={10} className="text-primary" />
                      Renovaciones Contractuales
                    </span>
                    <span className="text-xs font-black text-foreground flex items-center gap-1.5 leading-none">
                      Acumulado: <span className="text-sm text-primary font-black italic">{selectedClient.renewalCount || 0}</span>
                    </span>
                    <div className="mt-1.5">
                      {selectedClient.renewalStatus === 'will_renew' && (
                        <span className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">
                          SÍ, RENUEVA ✅
                        </span>
                      )}
                      {selectedClient.renewalStatus === 'will_not_renew' && (
                        <span className="bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">
                          NO RENUEVA ❌
                        </span>
                      )}
                      {(!selectedClient.renewalStatus || selectedClient.renewalStatus === 'unknown') && (
                        <span className="bg-amber-500/15 text-amber-600 dark:text-amber-500 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">
                          EN NEGOCIACIÓN ⏳
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Scheduled Meetings Widget */}
                  <div className="p-4 bg-muted/35 rounded-2xl border border-border/15 flex flex-col justify-center min-w-[150px]">
                    <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1">
                      <Clock size={10} className="text-amber-500 animate-pulse" />
                      Reuniones Agendadas
                    </span>
                    <span className="text-sm font-black text-foreground italic flex items-baseline gap-1">
                      {meetings.filter(m => m.status === 'scheduled' || m.status === 'pending' || m.status === 'reschedule').length}
                      <span className="text-[8px] font-bold text-muted-foreground uppercase not-italic">agendadas</span>
                    </span>
                    <span className="text-[9px] text-muted-foreground/80 mt-1">
                      {meetings.length} reuniones en total
                    </span>
                  </div>

                  {/* Contract Progress Widget */}
                  <div className="p-4 bg-muted/35 rounded-2xl border border-border/15 flex flex-col justify-center min-w-[150px]">
                    <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1">
                      <Percent size={10} className="text-emerald-500" />
                      Porcentaje de Contrato
                    </span>
                    <span className="text-xs font-black text-foreground flex items-center gap-1.5 leading-none">
                      Progreso: <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 italic">{calculateProgress(selectedClient.contractStartDate, selectedClient.contractEndDate)}%</span>
                    </span>
                    {/* Tiny Progress Bar */}
                    <div className="w-full bg-muted/75 h-1.5 rounded-full mt-2 overflow-hidden border border-border/15">
                      <div 
                        className="bg-emerald-500 h-full rounded-full transition-all duration-300" 
                        style={{ width: `${calculateProgress(selectedClient.contractStartDate, selectedClient.contractEndDate)}%` }} 
                      />
                    </div>
                  </div>

                  {/* Pauta & Meta Ads Widget */}
                  <div className={`p-4 rounded-2xl border flex flex-col justify-center min-w-[155px] ${
                    selectedClient.hasPautaService 
                      ? 'bg-red-500/10 border-red-500/20' 
                      : 'bg-muted/35 border-border/15'
                  }`}>
                    <span className="text-[8px] font-black uppercase tracking-widest mb-1 flex items-center gap-1 text-red-600 dark:text-red-400">
                      <Megaphone size={10} />
                      Pauta & Meta Ads
                    </span>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-foreground leading-none">
                        {selectedClient.hasPautaService ? (
                          <span className="text-red-600 dark:text-red-400 font-extrabold flex items-center gap-1">
                            Activo {selectedClient.pautaTargetCPL ? `($${selectedClient.pautaTargetCPL})` : '✓'}
                          </span>
                        ) : (
                          <span className="text-muted-foreground font-semibold">No activado</span>
                        )}
                      </span>
                      <button
                        onClick={() => setActiveTab('pauta')}
                        className={`text-[9px] font-black uppercase px-2 py-1 rounded-md transition-all cursor-pointer border-none ${
                          selectedClient.hasPautaService
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                        }`}
                      >
                        {selectedClient.hasPautaService ? 'Ver Planilla' : 'Activar Pauta'}
                      </button>
                    </div>
                  </div>

                  {/* Historical Clients Shortcut Popup */}
                  {isStaff && (
                    <Popover>
                      <PopoverTrigger 
                        className="h-auto self-center rounded-2xl border border-dashed border-border/40 bg-muted/10 hover:bg-muted text-[10px] font-black uppercase tracking-wider px-4 py-3 flex items-center gap-1.5 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary/20"
                      >
                        <HistoryIcon size={14} className="opacity-75 text-primary" />
                        📁 Historial Viejos ({clients.filter(c => c.status && ['completed', 'cancelled'].includes(c.status)).length})
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-80 p-0 overflow-hidden bg-card border border-border/40 shadow-xl rounded-2xl">
                        <div className="p-4 bg-muted/10 border-b border-border/20">
                          <p className="text-[10px] font-black uppercase tracking-widest text-primary italic">Historial de Clientes Viejos / Históricos</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">Haz clic para ir directamente a su espacio de trabajo y ver su historial.</p>
                        </div>
                        <div className="max-h-[250px] overflow-y-auto">
                          {clients.filter(c => c.status && ['completed', 'cancelled'].includes(c.status)).length === 0 ? (
                            <p className="p-6 text-center text-xs text-muted-foreground italic">Sin clientes inactivos en el historial</p>
                          ) : (
                            clients.filter(c => c.status && ['completed', 'cancelled'].includes(c.status)).map(oldClient => (
                              <div 
                                key={oldClient.id} 
                                className="p-3.5 hover:bg-muted/50 border-b border-border/10 last:border-none cursor-pointer flex items-center justify-between transition-colors"
                                onClick={() => {
                                  setSelectedClientId(oldClient.id);
                                  setActiveTab('dashboard');
                                }}
                              >
                                <div className="space-y-0.5">
                                  <p className="text-xs font-extrabold text-foreground">{oldClient.name}</p>
                                  <p className="text-[9px] text-muted-foreground uppercase font-semibold">PLAN: {oldClient.planName || 'STANDARD'}</p>
                                </div>
                                <span className="text-[8px] bg-muted text-muted-foreground px-2 py-0.5 rounded font-black italic uppercase leading-none border border-border/25">
                                  Inactivo
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}

                </div>

              </div>
            </div>
          )}

          {['dashboard', 'templates', 'leads', 'meetings', 'pauta'].includes(activeTab) && !selectedClientId ? (
            <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 border-b border-border/20 pb-6">
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase text-primary tracking-widest italic">PANEL GENERAL</span>
                  <h2 className="text-3xl font-black text-foreground italic uppercase tracking-tighter">
                    Control de Clientes
                  </h2>
                  <p className="text-xs text-muted-foreground max-w-xl">
                    Visualiza y gestiona todos los espacios de trabajo de clientes activos, completados o inactivos. Monitorea el progreso de sus contratos, pauta publicitaria y renovaciones en tiempo real.
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 items-stretch sm:items-center">
                  <div className="relative shrink-0">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Buscar cliente o plan..."
                      value={clientSearchTerm}
                      onChange={(e) => setClientSearchTerm(e.target.value)}
                      className="pl-9 h-9 w-full sm:w-64 bg-card border-border shadow-none text-xs"
                    />
                    {clientSearchTerm && (
                      <button 
                        onClick={() => setClientSearchTerm('')} 
                        className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground text-xs font-bold font-sans"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  
                  <div className="flex bg-muted/50 p-1 rounded-lg border border-border/10 shrink-0 overflow-x-auto max-w-full no-scrollbar">
                    <button
                      onClick={() => setClientFilterStatus('all')}
                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all shrink-0 ${
                        clientFilterStatus === 'all'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Todos ({clients.length})
                    </button>
                    <button
                      onClick={() => setClientFilterStatus('active')}
                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all shrink-0 ${
                        clientFilterStatus === 'active'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Activos ({clients.filter(c => !c.status || !['completed', 'cancelled'].includes(c.status)).length})
                    </button>
                    <button
                      onClick={() => setClientFilterStatus('pauta')}
                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all flex items-center gap-1 shrink-0 ${
                        clientFilterStatus === 'pauta'
                          ? 'bg-red-600 text-white shadow-sm font-black'
                          : 'text-red-600 dark:text-red-400 hover:bg-red-500/10'
                      }`}
                    >
                      📢 Pauta ({clients.filter(c => c.hasPautaService).length})
                    </button>
                    <button
                      onClick={() => setClientFilterStatus('inactive')}
                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all shrink-0 ${
                        clientFilterStatus === 'inactive'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Inactivos ({clients.filter(c => c.status && ['completed', 'cancelled'].includes(c.status)).length})
                    </button>
                    <button
                      onClick={() => setClientFilterStatus('last_month')}
                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all flex items-center gap-1 shrink-0 ${
                        clientFilterStatus === 'last_month'
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'text-amber-500 hover:text-amber-600 bg-amber-500/5 hover:bg-amber-500/10'
                      }`}
                    >
                      ⚠️ Por Vencer ({
                        clients.filter(c => {
                          const isInactive = c.status && ['completed', 'cancelled'].includes(c.status);
                          if (isInactive || !c.contractEndDate) return false;
                          try {
                            const end = parseISO(c.contractEndDate);
                            const now = new Date();
                            now.setHours(0, 0, 0, 0);
                            const diffTime = end.getTime() - now.getTime();
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            return diffDays <= 30;
                          } catch {
                            return false;
                          }
                        }).length
                      })
                    </button>
                  </div>

                  {/* Account Manager Filter Dropdown */}
                  <div className="flex bg-muted/50 p-1 rounded-lg border border-border/10 items-center shrink-0">
                    <select
                      value={selectedAMFilter}
                      onChange={(e) => setSelectedAMFilter(e.target.value)}
                      className="px-2.5 py-1 bg-transparent text-[10px] font-bold focus:outline-none cursor-pointer text-foreground rounded-md transition-all border-none outline-none"
                    >
                      <option value="all" className="bg-card text-foreground font-sans">👤 Todos los AMs</option>
                      {allUsers
                        .filter(u => ['account_manager', 'director', 'commercial'].includes(u.role))
                        .map(am => (
                          <option key={am.uid} value={am.uid} className="bg-card text-foreground font-sans">
                            👤 {am.displayName || am.username}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* View Mode Toggle */}
                  <div className="flex bg-muted/50 p-1 rounded-lg border border-border/10 shrink-0">
                    <button
                      onClick={() => setClientViewMode('grid')}
                      className={`p-1.5 rounded-md transition-all ${
                        clientViewMode === 'grid'
                          ? 'bg-background text-primary shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      title="Vista Cuadrícula"
                    >
                      <Grid size={14} className="mx-0.5" />
                    </button>
                    <button
                      onClick={() => setClientViewMode('table')}
                      className={`p-1.5 rounded-md transition-all ${
                        clientViewMode === 'table'
                          ? 'bg-background text-primary shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      title="Vista Tabla"
                    >
                      <List size={14} className="mx-0.5" />
                    </button>
                  </div>

                </div>
              </div>

              {(() => {
                const filtered = clients.filter(client => {
                  const matchesSearch = client.name.toLowerCase().includes(clientSearchTerm.toLowerCase()) || 
                                        (client.planName || '').toLowerCase().includes(clientSearchTerm.toLowerCase());
                  const isInactive = client.status && ['completed', 'cancelled'].includes(client.status);
                  
                  const matchesStatus = 
                    clientFilterStatus === 'all' ||
                    (clientFilterStatus === 'active' && !isInactive) ||
                    (clientFilterStatus === 'pauta' && client.hasPautaService) ||
                    (clientFilterStatus === 'inactive' && isInactive) ||
                    (clientFilterStatus === 'last_month' && !isInactive && (() => {
                      if (!client.contractEndDate) return false;
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
                    })());

                  const matchesAM = 
                    selectedAMFilter === 'all' || 
                    client.accountManagerId === selectedAMFilter;

                  return matchesSearch && matchesStatus && matchesAM;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-16 bg-muted/10 border border-dashed border-border rounded-2xl p-6 animate-fade-in">
                      <p className="text-sm text-muted-foreground italic">No se encontraron clientes con los filtros seleccionados.</p>
                      {clientSearchTerm && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setClientSearchTerm('')} 
                          className="mt-3 text-xs"
                        >
                          Limpiar búsqueda
                        </Button>
                      )}
                    </div>
                  );
                }

                if (clientViewMode === 'table') {
                  return (
                    <div className="overflow-x-auto border border-border/40 rounded-2xl bg-card shadow-sm animate-fade-in">
                      <table className="w-full border-collapse text-left text-xs text-foreground">
                        <thead>
                          <tr className="border-b border-border/20 bg-muted/40 font-bold text-muted-foreground text-[10px] uppercase tracking-wider">
                            <th className="p-4 select-none">Cliente</th>
                            <th className="p-4 select-none">Account Manager (AM)</th>
                            <th className="p-4 select-none">Vigencia del Contrato</th>
                            <th className="p-4 w-44 select-none">Progreso de Contrato</th>
                            <th className="p-4 select-none">Renovaciones & Estado</th>
                            <th className="p-4 text-right select-none">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/10">
                          {filtered.map((client) => {
                            const isInactive = client.status && ['completed', 'cancelled'].includes(client.status);
                            const progress = calculateProgress(client.contractStartDate, client.contractEndDate);
                            const assignedAM = allUsers.find(u => u.uid === client.accountManagerId);

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

                            return (
                              <tr 
                                key={client.id}
                                className={`transition-all group border-l-2 ${
                                  isLastMonth 
                                    ? 'bg-amber-500/[0.04] dark:bg-amber-500/[0.03] border-l-amber-500 border-b border-border/10 hover:bg-amber-500/[0.08] dark:hover:bg-amber-500/[0.06]' 
                                    : 'hover:bg-muted/30 border-l-transparent border-b border-border/10'
                                }`}
                              >
                                <td className="p-4">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs italic shrink-0 ${
                                      isInactive 
                                        ? 'bg-muted text-muted-foreground border border-border/20' 
                                        : isLastMonth
                                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                          : 'bg-primary/10 text-primary border border-primary/20'
                                    }`}>
                                      {client.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="space-y-0.5">
                                      <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5 line-clamp-1">
                                        {client.name}
                                        {isLastMonth && (
                                          <span className="animate-pulse px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 leading-none inline-block shrink-0" title="Último mes de contrato - ¡Iniciar Negociaciones!">
                                            ⚠️ ÚLTIMO MES (NEGOCIACIÓN)
                                          </span>
                                        )}
                                      </h4>
                                      <div className="flex items-center gap-1 flex-wrap">
                                        <span className="text-[9px] font-black uppercase text-muted-foreground px-1.5 py-0.5 rounded bg-muted leading-none inline-block">
                                          PLAN: {client.planName || 'Standard'}
                                        </span>
                                        {client.hasPautaService && (
                                          <span className="text-[9px] font-black uppercase text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded leading-none inline-flex items-center gap-0.5">
                                            📢 Pauta
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                
                                <td className="p-4">
                                  {assignedAM ? (
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-7 h-7 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center shrink-0 border border-border/20">
                                        {assignedAM.photoURL ? (
                                          <img src={assignedAM.photoURL} alt={assignedAM.displayName} className="w-full h-full object-cover" referrerpolicy="no-referrer" />
                                        ) : (
                                          <span className="text-[10px] font-black text-primary">{assignedAM.displayName ? assignedAM.displayName.substring(0, 2).toUpperCase() : 'AM'}</span>
                                        )}
                                      </div>
                                      <div>
                                        <p className="font-bold text-xs text-foreground leading-tight">{assignedAM.displayName || assignedAM.username}</p>
                                        <p className="text-[9px] text-muted-foreground leading-none">{getRoleLabel(assignedAM.role)}</p>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 text-muted-foreground italic">
                                      <div className="w-7 h-7 rounded-full bg-muted/60 flex items-center justify-center shrink-0 border border-dashed border-border text-[9px] font-bold">
                                        ?
                                      </div>
                                      <span className="text-xs">Sin asignar</span>
                                    </div>
                                  )}
                                </td>
                                
                                <td className="p-4">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1.5 text-xs font-bold">
                                      <span className="text-muted-foreground text-[10px]">Fin:</span>
                                      <span>{client.contractEndDate ? client.contractEndDate.split('-').reverse().join('/') : '---'}</span>
                                      <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded-full border uppercase ${
                                        isInactive 
                                          ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' 
                                          : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                                      }`}>
                                        {isInactive ? 'Inactivo' : 'Activo'}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">
                                      Vigencia: {getDurationString(client.contractStartDate, client.contractEndDate)}
                                    </p>
                                  </div>
                                </td>
                                
                                <td className="p-4">
                                  <div className="space-y-1 max-w-[150px]">
                                    <div className="flex justify-between items-center text-[10px] font-bold">
                                      <span className="text-muted-foreground text-[8px] uppercase">Progreso</span>
                                      <span className="text-foreground font-mono">{progress}%</span>
                                    </div>
                                    <div className="w-full bg-muted-foreground/10 h-2 rounded-full overflow-hidden border border-border/10">
                                      <div 
                                        className={`h-full rounded-full transition-all duration-300 ${isInactive ? 'bg-muted-foreground/42' : 'bg-primary'}`} 
                                        style={{ width: `${progress}%` }} 
                                      />
                                    </div>
                                  </div>
                                </td>

                                <td className="p-4">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center gap-1 leading-none shrink-0" title="Renovaciones acumuladas">
                                        🔄 {client.renewalCount || 0}
                                      </span>
                                      {client.renewalStatus === 'will_renew' && (
                                        <span className="text-[9px] font-extrabold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded leading-none shrink-0">Sí, renueba ✅</span>
                                      )}
                                      {client.renewalStatus === 'will_not_renew' && (
                                        <span className="text-[9px] font-extrabold uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded leading-none shrink-0">No renueba ❌</span>
                                      )}
                                      {(!client.renewalStatus || client.renewalStatus === 'unknown') && (
                                        <span className="text-[9px] font-extrabold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-500 px-1.5 py-0.5 rounded leading-none shrink-0 font-sans">Negociación ⏳</span>
                                      )}
                                    </div>
                                    {client.renewalStatus === 'unknown' && client.contractReconsultDate && (
                                      <p className="text-[9px] text-muted-foreground leading-normal font-sans mt-0.5">
                                        Volver a consultar: <span className="font-extrabold text-foreground">{client.contractReconsultDate.split('-').reverse().join('/')}</span>
                                      </p>
                                    )}
                                    {client.notes && (
                                      <p className="text-[9.5px] italic text-muted-foreground max-w-[180px] truncate leading-none mt-0.5" title={client.notes}>
                                        💬 {client.notes}
                                      </p>
                                    )}
                                  </div>
                                </td>
                                
                                <td className="p-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {client.hasPautaService && (
                                      <button
                                        onClick={() => {
                                          setSelectedClientId(client.id);
                                          setActiveTab('pauta');
                                        }}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500 hover:text-white text-red-600 dark:text-red-400 transition-all text-xs font-bold cursor-pointer"
                                        title="Abrir Pauta & Scorecard"
                                      >
                                        📢 Pauta
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleOpenFicha(client)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-muted hover:bg-emerald-500/10 hover:text-emerald-500 text-muted-foreground transition-all text-xs font-bold cursor-pointer"
                                      title="Ver Ficha y Contrato"
                                    >
                                      📇 Ficha
                                    </button>
                                    <button
                                      onClick={() => setSelectedClientId(client.id)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted hover:bg-primary hover:text-white text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-all text-xs font-bold cursor-pointer"
                                    >
                                      Ingresar ➜
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                }

                // Grid view is default
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full pt-2 animate-fade-in">
                    {filtered.map((client) => {
                      const isInactive = client.status && ['completed', 'cancelled'].includes(client.status);
                      const progress = calculateProgress(client.contractStartDate, client.contractEndDate);
                      const assignedAM = allUsers.find(u => u.uid === client.accountManagerId);

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
                      
                      return (
                        <div 
                          key={client.id}
                          className={`flex flex-col justify-between p-5 rounded-[1.5rem] bg-card border transition-all text-left shadow-sm hover:shadow-md relative group overflow-hidden ${
                            isLastMonth 
                              ? 'border-amber-500/60 shadow-amber-500/5 bg-amber-500/[0.01]/7 hover:border-amber-500' 
                              : 'border-border/40 hover:border-primary/40'
                          }`}
                        >
                          {/* Accent Color Strip for Visual Hierarchy */}
                          <div className={`absolute top-0 left-0 right-0 h-[3px] ${
                            isInactive 
                              ? 'bg-muted-foreground/35' 
                              : isLastMonth
                                ? 'bg-amber-500'
                                : 'bg-primary'
                          }`} />
                          
                          <div className="space-y-4">
                            {/* Header Row */}
                            <div className="flex items-start justify-between gap-2 pt-1 font-sans">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs italic shrink-0 ${
                                  isInactive 
                                    ? 'bg-muted/80 text-muted-foreground border border-border/20' 
                                    : isLastMonth
                                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                      : 'bg-primary/10 text-primary border border-primary/20'
                                }`}>
                                  {client.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="space-y-0.5">
                                  <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5 flex-wrap">
                                    {client.name}
                                    {isLastMonth && (
                                      <span className="animate-pulse px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 leading-none inline-block shrink-0" title="Último mes de contrato - ¡Iniciar Negociaciones!">
                                        ⚠️ Último mes
                                      </span>
                                    )}
                                  </h4>
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span className="text-[9px] font-black uppercase text-muted-foreground px-1.5 py-0.5 rounded-md bg-muted leading-none inline-block">
                                      PLAN: {client.planName || 'Standard'}
                                    </span>
                                    {client.hasPautaService && (
                                      <span className="text-[9px] font-black uppercase text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-md leading-none inline-flex items-center gap-0.5">
                                        📢 Pauta Activa
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Status Badge */}
                              <span className={`text-[8.5px] font-black px-2 py-0.5 rounded-full select-none leading-none border uppercase ${
                                isInactive 
                                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' 
                                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                              }`}>
                                {isInactive ? 'Inactivo' : 'Activo'}
                              </span>
                            </div>

                            {/* Contract Details */}
                            <div className="space-y-2.5 bg-muted/30 p-3 rounded-xl border border-border/10 text-xs text-foreground">
                              <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                                <span>Inicio: <strong className="text-foreground">{client.contractStartDate ? client.contractStartDate.split('-').reverse().join('/') : '---'}</strong></span>
                                <span>Fin: <strong className="text-foreground">{client.contractEndDate ? client.contractEndDate.split('-').reverse().join('/') : '---'}</strong></span>
                              </div>
                              
                              <div className="space-y-1">
                                <div className="flex justify-between items-center text-[10px] font-bold">
                                  <span className="text-muted-foreground uppercase text-[8.5px]">Progreso de Contrato</span>
                                  <span className="text-foreground font-mono">{progress}%</span>
                                </div>
                                <div className="w-full bg-muted-foreground/10 h-2 rounded-full overflow-hidden border border-border/10">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-300 ${isInactive ? 'bg-muted-foreground/42' : 'bg-primary'}`} 
                                    style={{ width: `${progress}%` }} 
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Info de Renovación (Sincronizado con la Ficha) */}
                            <div className="p-3 bg-emerald-500/5 dark:bg-emerald-950/10 rounded-xl border border-emerald-500/10 text-xs space-y-1.5">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                                  🔄 Renovaciones Acumuladas:
                                </span>
                                <span className="font-black text-emerald-600 dark:text-emerald-400">
                                  {client.renewalCount || 0}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-muted-foreground font-medium">Estado de renovación:</span>
                                {client.renewalStatus === 'will_renew' && (
                                  <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded">
                                    Sí, renueba ✅
                                  </span>
                                )}
                                {client.renewalStatus === 'will_not_renew' && (
                                  <span className="bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded">
                                    No renueba ❌
                                  </span>
                                )}
                                {(!client.renewalStatus || client.renewalStatus === 'unknown') && (
                                  <span className="bg-amber-500/10 text-amber-600 dark:text-amber-500 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded">
                                    En negociación ⏳
                                  </span>
                                )}
                              </div>
                              {client.renewalStatus === 'unknown' && client.contractReconsultDate && (
                                <div className="text-[9px] text-muted-foreground flex justify-between pt-1 border-t border-border/10">
                                  <span>Volver a consultar:</span>
                                  <span className="font-extrabold text-foreground">
                                    {client.contractReconsultDate.split('-').reverse().join('/')}
                                  </span>
                                </div>
                              )}
                              {client.notes && (
                                <p className="text-[9.5px] italic text-muted-foreground line-clamp-1 border-t border-border/10 pt-1 mt-1 leading-normal" title={client.notes}>
                                  💬 {client.notes}
                                </p>
                              )}
                            </div>

                            {/* Assigned AM Highlight section */}
                            <div className="flex items-center gap-2 pt-2.5 border-t border-border/10 mt-1 justify-between text-xs">
                              <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-black">AM Asignado:</span>
                              {assignedAM ? (
                                <div className="flex items-center gap-1.5 bg-muted/40 px-2 py-1 rounded-lg border border-border/5">
                                  <div className="w-5 h-5 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center shrink-0">
                                    {assignedAM.photoURL ? (
                                      <img src={assignedAM.photoURL} alt={assignedAM.displayName} className="w-full h-full object-cover" referrerpolicy="no-referrer" />
                                    ) : (
                                      <span className="text-[10px] font-black text-primary">{assignedAM.displayName ? assignedAM.displayName.substring(0, 2).toUpperCase() : 'AM'}</span>
                                    )}
                                  </div>
                                  <span className="text-[11px] font-bold text-foreground truncate max-w-[100px]">{assignedAM.displayName || assignedAM.username}</span>
                                </div>
                              ) : (
                                <span className="text-[11px] text-muted-foreground italic">Sin asignar</span>
                              )}
                            </div>
                          </div>

                          {/* Footer Action */}
                          <div className="pt-4 mt-2 border-t border-border/10 flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleOpenFicha(client)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-muted hover:bg-emerald-500/10 hover:text-emerald-500 text-muted-foreground transition-all text-xs font-semibold cursor-pointer shrink-0"
                                title="Ver Ficha y Renovación"
                              >
                                📇 Ficha
                              </button>
                              {client.hasPautaService && (
                                <button
                                  onClick={() => {
                                    setSelectedClientId(client.id);
                                    setActiveTab('pauta');
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500 hover:text-white text-red-600 dark:text-red-400 transition-all text-xs font-bold cursor-pointer shrink-0"
                                  title="Ver Pauta & Scorecard"
                                >
                                  📢 Pauta
                                </button>
                              )}
                            </div>
                            <button
                              onClick={() => setSelectedClientId(client.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-muted hover:bg-primary hover:text-white text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-all text-xs font-bold cursor-pointer"
                            >
                              Ingresar ➜
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && <DashboardStats profile={profile} isDemoMode={isDemoMode} clientId={selectedClientId} />}
              {activeTab === 'tasks' && selectedClientId && (
                <div className="w-full max-w-7xl mx-auto px-4 py-4">
                  <TaskManager 
                    isDemoMode={isDemoMode} 
                    currentProfile={profile} 
                    clients={clients} 
                    users={allUsers} 
                    scopedClientId={selectedClientId} 
                  />
                </div>
              )}
              {activeTab === 'templates' && selectedClient && (
                <ClientTemplates client={selectedClient} isDemoMode={isDemoMode} />
              )}
              {activeTab === 'pauta' && selectedClient && (
                <PautaScorecardView 
                  client={selectedClient} 
                  profile={profile} 
                  isDemoMode={isDemoMode} 
                  leads={leads}
                  onUpdateClient={(updated) => {
                    setSelectedClient(updated);
                    setClients(prev => prev.map(c => c.id === updated.id ? updated : c));
                  }}
                />
              )}
              {activeTab === 'leads' && (
                <LeadList 
                  profile={profile} 
                  isDemoMode={isDemoMode} 
                  clientId={selectedClientId} 
                  targetId={targetTaskId}
                  onTargetProcessed={() => setTargetTaskId(null)}
                  onLeadClick={handleOpenLeadDetails}
                  initialViewMode={leadViewMode}
                  clientHasSetter={clientHasSetter}
                />
              )}
              {activeTab === 'meetings' && (
                <MeetingAgenda 
                  clientId={selectedClientId} 
                  isDemoMode={isDemoMode} 
                  profile={profile}
                  targetId={targetTaskId}
                  onTargetProcessed={() => setTargetTaskId(null)}
                />
              )}
            </>
          )}
          {activeTab === 'tasks' && !selectedClientId && (
            <div className="w-full max-w-7xl mx-auto px-4 py-8">
              <TaskManager 
                isDemoMode={isDemoMode} 
                currentProfile={profile} 
                clients={clients} 
                users={allUsers} 
              />
            </div>
          )}
          {activeTab === 'settings' && (profile?.role === 'director' || profile?.role === 'account_manager' || profile?.role === 'commercial') && <UserManagement isDemoMode={isDemoMode} currentProfile={profile} />}
          {activeTab === 'team' && profile?.role !== 'client' && (profile?.role === 'director' || profile?.role === 'account_manager' || profile?.role === 'setter' || profile?.role === 'commercial') && (
            <TeamView 
              onClientSelect={setSelectedClientId} 
              onTabChange={setActiveTab}
              isDemoMode={isDemoMode}
              profile={profile}
            />
          )}
          {activeTab === 'performance' && profile?.role === 'director' && (
            <TeamPerformance 
              isDemoMode={isDemoMode}
              profile={profile}
              onClientSelect={(clientId) => {
                setSelectedClientId(clientId);
                setActiveTab('dashboard');
              }}
              onTabChange={setActiveTab}
            />
          )}
          {activeTab === 'trash' && profile?.role === 'director' && (
            <TrashBin isDemoMode={isDemoMode} currentProfile={profile} />
          )}
        </div>
      </main>

      <LeadForm 
        open={isLeadFormOpen} 
        onOpenChange={setIsLeadFormOpen} 
        isDemoMode={isDemoMode} 
        clientId={selectedClientId}
        leads={leads}
        onViewLead={(lead) => handleOpenLeadDetails(lead)}
      />
      {selectedLeadForDetail && (
        <LeadDetails 
          lead={selectedLeadForDetail} 
          open={isDetailsOpen} 
          onOpenChange={setIsDetailsOpen} 
          profile={profile}
          isDemoMode={isDemoMode}
          clientHasSetter={clientHasSetter}
        />
      )}

      {/* Diálogo de Ficha del Cliente y Renovación */}
      <Dialog open={!!clientToViewFicha} onOpenChange={(open) => !open && setClientToViewFicha(null)}>
        <DialogContent className="sm:max-w-[520px] bg-card border border-border text-card-foreground">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-lg font-black uppercase tracking-tight text-foreground flex items-center gap-2">
              <span className="p-1 rounded-lg bg-primary/10 text-primary text-base">
                📇
              </span>
              Ficha del Cliente: {clientToViewFicha?.name}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs uppercase font-bold tracking-wider">
              Vigencia de contrato, planes activos y renovaciones.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2 max-h-[60vh] sm:max-h-[65vh] overflow-y-auto pr-2 px-1 w-full min-w-0">
            {/* Sección 1: Información General & Plan */}
            <div className="grid grid-cols-2 gap-4 border-b border-border/10 pb-4">
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label className="text-[10px] uppercase font-black tracking-wider text-muted-foreground">Plan del Cliente</Label>
                <input
                  type="text"
                  value={editedPlanName}
                  onChange={(e) => setEditedPlanName(e.target.value)}
                  placeholder="Ej. Standard, Premium, Gold..."
                  className="w-full px-3 py-1.5 h-9 text-xs rounded-lg border border-border bg-background text-foreground font-medium focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label className="text-[10px] uppercase font-black tracking-wider text-muted-foreground">Estado del Cliente</Label>
                <div className="h-9 flex items-center bg-muted/35 px-3 border border-border rounded-lg text-xs font-bold text-foreground capitalize">
                  {clientToViewFicha?.status || 'Activo'}
                </div>
              </div>
            </div>

            {/* Sección 2: Gestión de Contrato */}
            <div className="space-y-3 pb-4 border-b border-border/10">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Vigencia del Contrato
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Fecha Inicio</Label>
                  <DatePicker 
                    date={editedContractStartDate}
                    setDate={(d) => setEditedContractStartDate(d || '')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Fecha Fin / Vencimiento</Label>
                  <DatePicker 
                    date={editedContractEndDate}
                    setDate={(d) => handleEndDateChange(d || '')}
                  />
                </div>
              </div>
            </div>

            {/* Sección 3: Historial & Estado de Renovación */}
            <div className="space-y-3 bg-emerald-500/5 dark:bg-emerald-950/10 p-4 rounded-xl border border-emerald-500/10 dark:border-emerald-500/20">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <RefreshCcw className="w-3.5 h-3.5" />
                Historial de Renovaciones
              </h4>

              {/* Historial acumulado con botones de control */}
              <div className="flex items-center justify-between bg-background p-3 rounded-lg border border-border">
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Historial Acumulado:</span>
                  <span className="text-[9px] font-semibold text-muted-foreground block">
                    Se incrementa automáticamente al extender la fecha de vencimiento.
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditedRenewalCount(prev => Math.max(0, prev - 1))}
                    className="h-8 w-8 rounded-lg bg-muted text-foreground flex items-center justify-center font-bold text-sm border-none cursor-pointer hover:bg-muted/80"
                  >
                    -
                  </button>
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 w-10 text-center">
                    {editedRenewalCount || 0}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditedRenewalCount(prev => prev + 1);
                      setEditedRenewalStatus('will_renew');
                    }}
                    className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm border-none cursor-pointer hover:bg-emerald-700"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* ¿Se sabe si renueba el próximo período? */}
              <div className="space-y-1 pt-1">
                <Label className="text-[9px] uppercase font-bold text-muted-foreground block">¿Se sabe si renueba el próximo período?</Label>
                <select
                  value={editedRenewalStatus}
                  onChange={(e: any) => setEditedRenewalStatus(e.target.value)}
                  className="w-full h-9 text-xs bg-background border border-border rounded-lg px-2.5 focus:ring-1 focus:ring-primary focus:outline-none text-foreground font-sans font-medium"
                >
                  <option value="unknown">Por decidir / En negociación</option>
                  <option value="will_renew">Sí, renueba</option>
                  <option value="will_not_renew">No renueba</option>
                </select>
              </div>

              {editedRenewalStatus === "unknown" && (
                <div className="space-y-1.5 pt-1">
                  <Label className="text-[9px] uppercase font-bold text-muted-foreground">Fecha para volver a consultar</Label>
                  <DatePicker
                    date={editedContractReconsultDate}
                    setDate={(d) => setEditedContractReconsultDate(d || '')}
                    label="Elegir fecha de re-consulta"
                  />
                  <p className="text-[9px] text-muted-foreground leading-snug">
                    La advertencia de vencimiento se ocultará automáticamente hasta esta fecha de forma transitoria.
                  </p>
                </div>
              )}
            </div>

            {/* Sección: Servicio de Pauta & Meta Ads */}
            <div className="space-y-3 bg-red-500/5 dark:bg-red-950/10 p-4 rounded-xl border border-red-500/10 dark:border-red-500/20">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-black uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center gap-1.5">
                  <Megaphone className="w-3.5 h-3.5" />
                  Servicio de Pauta & Meta Ads
                </h4>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editedHasPautaService}
                    onChange={(e) => setEditedHasPautaService(e.target.checked)}
                    className="w-4 h-4 rounded text-red-600 focus:ring-red-500 border-border"
                  />
                  <span className="text-xs font-bold text-foreground">
                    {editedHasPautaService ? 'Servicio Activo ✅' : 'Activar Servicio'}
                  </span>
                </label>
              </div>

              <p className="text-[9.5px] text-muted-foreground leading-snug">
                Al activar esta opción, se habilitará la pestaña exclusiva de <strong>Pauta & Scorecard</strong> en el espacio de trabajo del cliente, con tabla semanal, cálculo de CPL y conexión a Meta Ads.
              </p>

              {editedHasPautaService && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-red-500/10 animate-fade-in">
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase font-bold text-muted-foreground">Moneda de Pauta</Label>
                    <select
                      value={editedPautaCurrency}
                      onChange={(e: any) => setEditedPautaCurrency(e.target.value)}
                      className="w-full h-8 text-xs bg-background border border-border rounded-lg px-2 text-foreground font-medium"
                    >
                      <option value="ARS">ARS ($ - Pesos Argentinos)</option>
                      <option value="USD">USD ($ - Dólares)</option>
                      <option value="EUR">EUR (€ - Euros)</option>
                      <option value="MXN">MXN ($ - Pesos Mexicanos)</option>
                      <option value="CLP">CLP ($ - Pesos Chilenos)</option>
                      <option value="COP">COP ($ - Pesos Colombianos)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase font-bold text-muted-foreground">CPL Objetivo</Label>
                    <input
                      type="number"
                      step="any"
                      placeholder="Ej. 1500"
                      value={editedPautaTargetCPL}
                      onChange={(e) => setEditedPautaTargetCPL(e.target.value)}
                      className="w-full h-8 px-2.5 text-xs rounded-lg border border-border bg-background text-foreground font-medium"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-[9px] uppercase font-bold text-muted-foreground">ID Cuenta Publicitaria Meta (Opcional)</Label>
                    <input
                      type="text"
                      placeholder="act_1234567890..."
                      value={editedMetaAdAccountId}
                      onChange={(e) => setEditedMetaAdAccountId(e.target.value)}
                      className="w-full h-8 px-2.5 text-xs rounded-lg border border-border bg-background text-foreground font-medium"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Sección 4: Notas Persistentes */}
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-black tracking-wider text-muted-foreground">Notas Internas & Renovación</Label>
              <textarea
                value={editedNotes}
                onChange={(e) => setEditedNotes(e.target.value)}
                placeholder="Agrega comentarios sobre el seguimiento o condiciones de renovación..."
                rows={3}
                className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground font-medium focus:ring-1 focus:ring-primary focus:outline-none resize-none"
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <button
              onClick={() => setClientToViewFicha(null)}
              className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-all rounded-lg cursor-pointer bg-transparent border-none"
              disabled={isSavingFicha}
            >
              Cerrar
            </button>
            <button
              onClick={handleSaveFicha}
              disabled={isSavingFicha}
              className="px-5 py-2 text-xs font-black uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/95 hover:shadow-lg transition-all rounded-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 border-none h-9"
            >
              {isSavingFicha ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar Ficha'
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo del Perfil de Usuario */}
      <Dialog open={isProfileModalOpen} onOpenChange={setIsProfileModalOpen}>
        <DialogContent className="sm:max-w-[420px] bg-card border border-border text-card-foreground p-6 shadow-xl relative rounded-xl overflow-hidden">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-primary" />
              Mi Perfil
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Actualiza tu nickname de usuario y tu foto de perfil.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-2 w-full min-w-0 overflow-hidden">
            {/* Vista Previa del Avatar */}
            <div className="flex flex-col items-center justify-center gap-3 text-center w-full">
              <div className="relative group/avatar cursor-pointer">
                <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-primary/20 bg-muted relative flex items-center justify-center">
                  {editedPhotoURL ? (
                    <img src={editedPhotoURL} alt="Vista previa avatar" className="h-full w-full object-cover" />
                  ) : (
                    <div className="text-3xl font-black text-muted-foreground">
                      {editedDisplayName ? editedDisplayName.charAt(0).toUpperCase() : '?'}
                    </div>
                  )}
                  {/* Hover Cap para Cargar Foto */}
                  <label htmlFor="modal-avatar-upload" className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-200 cursor-pointer text-white">
                    <Camera className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-semibold uppercase">Subir Foto</span>
                  </label>
                </div>
                <input 
                  type="file" 
                  id="modal-avatar-upload" 
                  accept="image/*" 
                  onChange={handleImageUpload} 
                  className="hidden" 
                />
              </div>
              <p className="text-[10px] text-muted-foreground font-bold uppercase transition-colors tracking-wide max-w-[260px] leading-relaxed mx-auto">
                Haz click en la imagen para subir tu propia foto
              </p>
            </div>

            {/* Presets de Avatar */}
            <div className="space-y-2 w-full min-w-0 overflow-hidden">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">O selecciona un avatar prediseñado</label>
              <div className="flex gap-2 py-1 w-full min-w-0 overflow-x-auto scrollbar-thin dark:scrollbar-thumb-neutral-800 scrollbar-thumb-neutral-200 pr-1">
                {PRESET_AVATARS.map((preset, idx) => {
                  const isSelected = editedPhotoURL === preset.url;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setEditedPhotoURL(preset.url)}
                      className={`relative flex-shrink-0 w-11 h-11 rounded-full overflow-hidden transition-all duration-200 hover:scale-105 active:scale-95 ${
                        isSelected 
                          ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-105' 
                          : 'opacity-70 hover:opacity-100 border border-border'
                      }`}
                    >
                      <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                      {isSelected && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4 text-primary bg-background rounded-full p-0.5" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Campos de Nombre y Datos */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="perfDisplayName" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Nickname / Nombre para Mostrar</Label>
                <div className="relative">
                  <Input 
                    id="perfDisplayName"
                    value={editedDisplayName}
                    onChange={(e) => setEditedDisplayName(e.target.value)}
                    placeholder="Escribe tu nickname"
                    maxLength={32}
                    className="font-semibold"
                  />
                </div>
              </div>

              {/* Datos de Solo Lectura */}
              <div className="bg-muted/50 p-3 rounded-lg border border-border/80 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Correo / Usuario</span>
                  <span className="font-mono font-medium text-foreground truncate max-w-[200px]" title={profile?.email}>{profile?.email}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Rol actual</span>
                  <span className="bg-primary/10 text-primary border border-primary/20 rounded px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                    {profile ? getRoleLabel(profile.role) : ''}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button 
              variant="outline" 
              onClick={() => setIsProfileModalOpen(false)}
              className="border-border text-foreground hover:bg-muted"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveProfile} 
              disabled={isSavingProfile || !editedDisplayName.trim()} 
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold flex items-center gap-1.5"
            >
              {isSavingProfile ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                'Guardar Cambios'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster position="top-right" theme={theme} />
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-3 px-6 py-3.5 text-sm transition-all relative ${
        active 
          ? 'text-primary font-bold bg-primary/5' 
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground font-medium'
      }`}
    >
      {active && (
        <div className="absolute left-0 top-0 h-full w-1 bg-primary rounded-r-full shadow-[2px_0_10px_rgba(var(--primary),0.5)]" />
      )}
      <div className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
        {icon}
      </div>
      <span>{label}</span>
    </button>
  );
}
