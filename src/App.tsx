import React, { useState, useEffect } from 'react';
import { auth, db, loginWithGoogle, logout, isFirebaseConfigured } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, orderBy, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
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
import { Toaster } from 'sonner';
import { toast } from 'sonner';

// Components (will be created in separate files)
import LeadList from './components/LeadList';
import DashboardStats from './components/DashboardStats';
import LeadForm from './components/LeadForm';
import UserManagement from './components/UserManagement';
import ClientSelector from './components/ClientSelector';
import TeamView from './components/TeamView';
import MeetingAgenda from './components/MeetingAgenda';
import FollowUpCenter from './components/FollowUpCenter';
import LeadDetails from './components/LeadDetails';
import { Briefcase, Target, User as UserIcon, Lock, ShieldCheck, Mail } from 'lucide-react';

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
        const allClients: Client[] = stored ? JSON.parse(stored) : [];
        // Filter out the "Mi Primer Lead Flow" or similar placeholders
        setClients(allClients.filter(c => 
          !c.name.toLowerCase().includes('mi primer lead') && 
          !c.name.toLowerCase().includes('lead flow')
        ));
      };
      updateClients();
      window.addEventListener('demo-clients-updated', updateClients);
      return () => window.removeEventListener('demo-clients-updated', updateClients);
    } else {
      const unsubscribe = onSnapshot(collection(db, 'clients'), (snapshot) => {
        const allClients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
        // Explicitly filter out the unwanted placeholder if it exists in Firestore
        setClients(allClients.filter(c => 
          !c.name.toLowerCase().includes('mi primer lead') && 
          !c.name.toLowerCase().includes('lead flow')
        ));
      });
      return () => unsubscribe();
    }
  }, [isDemoMode]);

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
      
      if (!selectedClientId && !isStaff) {
        setLeads([]);
        setMeetings([]);
        return;
      }

      const lQuery = selectedClientId 
        ? query(collection(db, 'leads'), where('clientId', '==', selectedClientId))
        : query(collection(db, 'leads'));
        
      const mQuery = selectedClientId
        ? query(collection(db, 'meetings'), where('clientId', '==', selectedClientId))
        : query(collection(db, 'meetings'));

      const unsubL = onSnapshot(lQuery, (snap) => {
        setLeads(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead)));
      });

      const unsubM = onSnapshot(mQuery, (snap) => {
        setMeetings(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
      });

      return () => {
        unsubL();
        unsubM();
      };
    }
  }, [selectedClientId, isDemoMode, profile?.role]);

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
      // This is a bit more complex for a single useEffect, but we can nest snapshots or use a combined state
      const mQuery = query(collection(db, 'meetings'), where('status', '==', 'pending'));
      const lQuery = query(collection(db, 'leads'), where('isActive', '==', true));

      const unsubM = onSnapshot(mQuery, (mSnap) => {
        const meetings = mSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const mNotifs = checkMeetings(meetings);
        
        // We'll update notifications by merging with existing ones of other types
        setNotifications(prev => [
          ...prev.filter(n => n.type !== 'meeting'),
          ...mNotifs
        ]);
      });

      const unsubL = onSnapshot(lQuery, (lSnap) => {
        const leads = lSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead));
        const fNotifs = checkFollowUps(leads);
        
        setNotifications(prev => [
          ...prev.filter(n => n.type !== 'follow_up'),
          ...fNotifs
        ]);
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
      const unsubscribe = onSnapshot(doc(db, 'clients', selectedClientId), (doc) => {
        if (doc.exists()) {
          setSelectedClient({ id: doc.id, ...doc.data() } as Client);
        }
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
        // High-reliability search in Firestore
        try {
          const usersRef = collection(db, 'users');
          const querySnap = await getDocs(usersRef);
          const allUsers = querySnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
          
          foundProfile = allUsers.find(u => 
            (u.username?.toLowerCase() === lowerUsername || u.email?.toLowerCase() === lowerUsername) && 
            u.password === credentials.password
          ) || null;
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
          setProfile(foundProfile);
          toast.success(`Bienvenido, ${foundProfile.displayName}`);
        }
      } else if (!isDemoMode && isFirebaseConfigured) {
        // If not found in demo, try a query by username in Firebase
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('username', '==', lowerUsername), where('password', '==', credentials.password));
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
          const data = { uid: querySnap.docs[0].id, ...querySnap.docs[0].data() } as UserProfile;
          if (data.isActive) {
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

  if (!user && !profile && !isDemoMode) {
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
                    onClick={loginWithGoogle}
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

            <nav className="flex-1 space-y-2">
              {profile?.role !== 'client' && (profile?.role === 'director' || profile?.role === 'account_manager' || profile?.role === 'setter' || profile?.role === 'commercial') && (
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
              )}

              {selectedClient && (
                <div className="pt-4 mt-4 border-t border-border">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-4 px-2">
                    Navegación Cliente
                  </p>
                  <SidebarItem 
                    icon={<LayoutDashboard size={18} />} 
                    label="Escritorio" 
                    active={activeTab === 'dashboard'} 
                    onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }} 
                  />
                  <SidebarItem 
                    icon={<Users size={18} />} 
                    label="Leads / Contactos" 
                    active={activeTab === 'leads'} 
                    onClick={() => { setActiveTab('leads'); setIsMobileMenuOpen(false); }} 
                  />
                  <SidebarItem 
                    icon={<Calendar size={18} />} 
                    label="Agenda" 
                    active={activeTab === 'meetings'} 
                    onClick={() => { setActiveTab('meetings'); setIsMobileMenuOpen(false); }} 
                  />
                  <SidebarItem 
                    icon={<Clock size={18} />} 
                    label="Seguimientos" 
                    active={activeTab === 'leads' && leadViewMode === 'followup'} 
                    onClick={() => { 
                      setActiveTab('leads'); 
                      setLeadViewMode('followup');
                      setIsMobileMenuOpen(false); 
                    }} 
                  />
                </div>
              )}

              {(profile?.role === 'director' || profile?.role === 'account_manager') && (
                <SidebarItem 
                  icon={<Settings size={18} />} 
                  label="Gestión de Accesos" 
                  active={activeTab === 'settings'} 
                  onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }} 
                />
              )}
            </nav>

            <div className="mt-auto pt-6 border-t border-border">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                <Avatar className="h-10 w-10 border-2 border-primary">
                  <AvatarFallback className="bg-primary text-white font-bold">
                    {profile?.displayName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-bold">{profile?.displayName}</p>
                  <p className="truncate text-[10px] text-muted-foreground uppercase font-semibold">{profile?.role}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={handleLogout} className="text-destructive">
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
          {profile?.role !== 'client' && (profile?.role === 'director' || profile?.role === 'account_manager' || profile?.role === 'setter' || profile?.role === 'commercial') && (
            <SidebarItem 
              icon={<Users size={18} />} 
              label="Equipo" 
              active={activeTab === 'team'} 
              onClick={() => {
                setActiveTab('team');
                setSelectedClientId('');
              }} 
            />
          )}

          {selectedClient && (
            <div className="px-6 py-4 mt-2 border-t border-border">
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-4">
                {profile?.role === 'client' ? 'Mi Espacio' : 'Cliente Activo'}
              </p>
              <div className="flex items-center gap-2 mb-6 bg-secondary p-2 rounded-lg border border-border">
                <Briefcase size={14} className="text-primary" />
                <span className="text-xs font-bold truncate">{selectedClient.name}</span>
              </div>
              
                  <div className="space-y-1 -mx-6">
                    <SidebarItem 
                      icon={<LayoutDashboard size={18} />} 
                      label="Escritorio" 
                      active={activeTab === 'dashboard'} 
                      onClick={() => setActiveTab('dashboard')} 
                    />
                    <SidebarItem 
                      icon={<Users size={18} />} 
                      label="Leads / Contactos" 
                      active={activeTab === 'leads' && leadViewMode !== 'followup'} 
                      onClick={() => {
                        setActiveTab('leads');
                        setLeadViewMode('table');
                      }} 
                    />
                    <SidebarItem 
                      icon={<Calendar size={18} />} 
                      label="Agenda Reuniones" 
                      active={activeTab === 'meetings'} 
                      onClick={() => setActiveTab('meetings')} 
                    />
                    <SidebarItem 
                      icon={<Clock size={18} />} 
                      label="Seguimientos" 
                      active={activeTab === 'leads' && leadViewMode === 'followup'} 
                      onClick={() => { 
                        setActiveTab('leads'); 
                        setLeadViewMode('followup');
                      }} 
                    />
                  </div>
            </div>
          )}

          {(profile?.role === 'director' || profile?.role === 'account_manager') && (
            <SidebarItem 
              icon={<Settings size={18} />} 
              label="Gestión de Accesos" 
              active={activeTab === 'settings'} 
              onClick={() => setActiveTab('settings')} 
            />
          )}
        </nav>

        <div className="border-t p-4 border-border">
          <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
            <div className="h-10 w-10 overflow-hidden rounded-full bg-background border-2 border-primary">
              {profile?.photoURL ? (
                <img src={profile.photoURL} alt={profile.displayName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-primary text-white">
                  {profile?.displayName.charAt(0)}
                </div>
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-bold">{profile?.displayName}</p>
              <p className="truncate text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{profile?.role}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
              <LogOut size={16} />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b bg-card px-4 md:px-8 border-border">
          <div className="flex items-center gap-4">
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
          </div>
          <div className="flex items-center gap-4">
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
            
            {profile?.role !== 'client' && (profile?.role === 'director' || profile?.role === 'setter' || profile?.role === 'account_manager' || profile?.role === 'commercial') && (
              <Button onClick={() => setIsLeadFormOpen(true)} className="gap-2 font-semibold">
                <Plus size={18} />
                <span>Nuevo Lead</span>
              </Button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === 'dashboard' && <DashboardStats profile={profile} isDemoMode={isDemoMode} clientId={selectedClientId} />}
          {activeTab === 'leads' && (
            <LeadList 
              profile={profile} 
              isDemoMode={isDemoMode} 
              clientId={selectedClientId} 
              targetId={targetTaskId}
              onTargetProcessed={() => setTargetTaskId(null)}
              onLeadClick={handleOpenLeadDetails}
              initialViewMode={leadViewMode}
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
          {activeTab === 'settings' && (profile?.role === 'director' || profile?.role === 'account_manager' || profile?.role === 'commercial') && <UserManagement isDemoMode={isDemoMode} currentProfile={profile} />}
          {activeTab === 'team' && profile?.role !== 'client' && (profile?.role === 'director' || profile?.role === 'account_manager' || profile?.role === 'setter' || profile?.role === 'commercial') && (
            <TeamView 
              onClientSelect={setSelectedClientId} 
              onTabChange={setActiveTab}
              isDemoMode={isDemoMode}
              profile={profile}
            />
          )}
        </div>
      </main>

      <LeadForm 
        open={isLeadFormOpen} 
        onOpenChange={setIsLeadFormOpen} 
        isDemoMode={isDemoMode} 
        clientId={selectedClientId}
      />
      {selectedLeadForDetail && (
        <LeadDetails 
          lead={selectedLeadForDetail} 
          open={isDetailsOpen} 
          onOpenChange={setIsDetailsOpen} 
          profile={profile}
          isDemoMode={isDemoMode}
        />
      )}
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
