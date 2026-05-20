import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, createFirebaseAuthUser, isFirebaseConfigured } from '../lib/firebase';
import { collection, onSnapshot, doc, updateDoc, query, orderBy, deleteDoc, setDoc } from 'firebase/firestore';
import { UserProfile, UserRole, Client } from '../types';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from './ui/table';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from './ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { Trash2, UserPlus, ShieldAlert, ShieldCheck, Edit, Trash, Users as UsersIcon } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

import { ROLE_PERMISSIONS } from '../lib/permissions';

interface UserManagementProps {
  isDemoMode?: boolean;
  currentProfile: UserProfile | null;
}

export default function UserManagement({ isDemoMode, currentProfile }: UserManagementProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<{ id: string; name: string } | null>(null);
  const [confirmStep, setConfirmStep] = useState(1);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [newUser, setNewUser] = useState({
    email: '',
    username: '',
    password: '',
    displayName: '',
    role: 'client' as UserRole,
    assignedClientId: ''
  });
  const [loading, setLoading] = useState(false);

  const permissions = currentProfile ? ROLE_PERMISSIONS[currentProfile.role] : null;

  useEffect(() => {
    if (isDemoMode) {
      const loadData = () => {
        const storedUsers = localStorage.getItem('demo-users');
        if (storedUsers) {
          const parsed = JSON.parse(storedUsers);
          // Migration: Ensure all demo users have isActive property
          const migrated = parsed.map((u: any) => u.isActive === undefined ? { ...u, isActive: true } : u);
          if (JSON.stringify(migrated) !== JSON.stringify(parsed)) {
            localStorage.setItem('demo-users', JSON.stringify(migrated));
            setUsers(migrated);
          } else {
            setUsers(parsed);
          }
        } else {
          const initialUsers = [
            { uid: 'u-azul', email: 'azul@efectodigital.com.ar', displayName: 'Azul', role: 'director' as UserRole, isActive: true, createdAt: new Date().toISOString(), username: 'azul', password: 'azul' },
            { uid: 'u-naza', email: 'nazareno@efectodigital.com.ar', displayName: 'Naza', role: 'account_manager' as UserRole, isActive: true, createdAt: new Date().toISOString(), username: 'naza', password: 'naza' },
            { uid: 'u-mariana', email: 'mariana@efectodigital.com', displayName: 'Mariana', role: 'commercial' as UserRole, isActive: true, createdAt: new Date().toISOString(), username: 'mariana', password: 'mariana' },
          ];
          setUsers(initialUsers);
          localStorage.setItem('demo-users', JSON.stringify(initialUsers));
        }

        const storedClients = localStorage.getItem('demo-clients');
        if (storedClients) {
          setClients(JSON.parse(storedClients));
        } else {
          const initialClients: Client[] = [];
          setClients(initialClients);
          localStorage.setItem('demo-clients', JSON.stringify(initialClients));
        }
      };

      loadData();
      window.addEventListener('demo-users-updated', loadData);
      window.addEventListener('demo-clients-updated', loadData);
      return () => {
        window.removeEventListener('demo-users-updated', loadData);
        window.removeEventListener('demo-clients-updated', loadData);
      };
    }
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const unsubscribeClients = onSnapshot(query(collection(db, 'clients'), orderBy('name')), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'clients');
    });

    return () => {
      unsubscribeUsers();
      unsubscribeClients();
    };
  }, [isDemoMode]);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      if (isDemoMode) {
        const stored = localStorage.getItem('demo-users');
        const demoUsers = stored ? JSON.parse(stored) : users;
        const updatedUsers = demoUsers.map((u: any) => u.uid === userId ? { ...u, role: newRole } : u);
        localStorage.setItem('demo-users', JSON.stringify(updatedUsers));
        setUsers(updatedUsers);
        window.dispatchEvent(new CustomEvent('demo-users-updated'));
      } else {
        await updateDoc(doc(db, 'users', userId), { role: newRole });
      }
      toast.success("Rol de usuario actualizado");
    } catch (error) {
      toast.error("Error al actualizar el rol");
    }
  };

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    try {
      if (isDemoMode) {
        const stored = localStorage.getItem('demo-users');
        const demoUsers = stored ? JSON.parse(stored) : users;
        const updatedUsers = demoUsers.map((u: any) => u.uid === userId ? { ...u, isActive: !currentStatus } : u);
        localStorage.setItem('demo-users', JSON.stringify(updatedUsers));
        setUsers(updatedUsers);
        window.dispatchEvent(new CustomEvent('demo-users-updated'));
      } else {
        await updateDoc(doc(db, 'users', userId), { isActive: !currentStatus });
      }
      toast.success(currentStatus ? "Usuario bloqueado" : "Usuario activado");
    } catch (error) {
      toast.error("Error al cambiar estado de acceso");
    }
  };

  const handleClientAssignment = async (userId: string, clientId: string) => {
    try {
      if (isDemoMode) {
        const stored = localStorage.getItem('demo-users');
        const demoUsers = stored ? JSON.parse(stored) : users;
        const updatedUsers = demoUsers.map((u: any) => u.uid === userId ? { ...u, assignedClientId: clientId } : u);
        localStorage.setItem('demo-users', JSON.stringify(updatedUsers));
        setUsers(updatedUsers);
        window.dispatchEvent(new CustomEvent('demo-users-updated'));
      } else {
        await updateDoc(doc(db, 'users', userId), { assignedClientId: clientId });
      }
      toast.success("Cliente asignado al usuario");
    } catch (error) {
      toast.error("Error al asignar cliente");
    }
  };

  const handleHandleAddUser = async () => {
    if (newUser.role !== 'client' && newUser.role !== 'director' && !newUser.email.endsWith('@efectodigital.com.ar') && !newUser.email.endsWith('@efectodigital.com')) {
      toast.error("El personal de equipo debe usar correo @efectodigital.com.ar o @efectodigital.com");
      return;
    }
    const lowerUsername = newUser.username.trim().toLowerCase();
    const lowerEmail = newUser.email.trim().toLowerCase();
    if (newUser.role === 'client' && (!lowerUsername || !newUser.password)) {
      toast.error("Usuario y contraseña son obligatorios para clientes");
      return;
    }
    if (!newUser.displayName) {
      toast.error("El nombre es obligatorio");
      return;
    }
    
    setLoading(true);
    try {
      const targetEmail = lowerEmail || (newUser.role === 'client' ? `${lowerUsername}@cliente.efectodigital.com.ar` : '');
      const targetPassword = newUser.password || 'Efecto2026!';
      
      let finalUid = newUser.role === 'client' ? `u-${lowerUsername}` : `u-staff-${lowerUsername || Math.random().toString(36).substr(2, 5)}`;
      
      if (!isDemoMode && isFirebaseConfigured) {
        try {
          console.log(`[CrearUsuario] Registrando en Firebase Auth para: ${targetEmail}`);
          const authUid = await createFirebaseAuthUser(targetEmail, targetPassword);
          console.log(`[CrearUsuario] Firebase Auth exitoso. UID generado: ${authUid}`);
          finalUid = authUid;
        } catch (authError: any) {
          console.error("[CrearUsuario] Error al crear usuario en Firebase Authentication:", authError);
          // Permitir continuar si ya existe, imprimiendo advertencia
          if (authError.code === 'auth/email-already-in-use' || authError.message?.includes('EMAIL_EXISTS')) {
            console.warn("[CrearUsuario] El correo electrónico ya está registrado en Firebase Auth. Intentando crear en Firestore con UID anterior.");
          } else {
            throw new Error(`Firebase Auth: ${authError.message || authError}`);
          }
        }
      }

      const userToCreate: any = {
        uid: finalUid,
        username: lowerUsername,
        password: newUser.password,
        email: targetEmail,
        displayName: newUser.displayName,
        role: newUser.role,
        isActive: true,
        createdAt: new Date().toISOString()
      };

      if (newUser.role === 'client' && newUser.assignedClientId) {
        userToCreate.assignedClientId = newUser.assignedClientId;
      }

      if (isDemoMode) {
        console.log(`[CrearUsuario] Modo demo activo. Guardando en localStorage.`);
        const stored = localStorage.getItem('demo-users');
        const demoUsers = stored ? JSON.parse(stored) : users;
        const updatedUsers = [...demoUsers, userToCreate];
        localStorage.setItem('demo-users', JSON.stringify(updatedUsers));
        setUsers(updatedUsers);
        window.dispatchEvent(new CustomEvent('demo-users-updated'));
      } else {
        // En Firebase real, creamos el documento. 
        console.log(`[CrearUsuario] Escribiendo perfil en Firestore para la colección 'users/${finalUid}':`, userToCreate);
        await setDoc(doc(db, 'users', finalUid), userToCreate);
        console.log(`[CrearUsuario] Escritura en Firestore completa.`);
      }
      
      toast.success("Perfil de acceso creado correctamente");
      setIsAddUserOpen(false);
      setNewUser({ email: '', username: '', password: '', displayName: '', role: 'client', assignedClientId: '' });
    } catch (error: any) {
      console.error("[CrearUsuario] ERROR CRÍTICO AL CREAR PERFIL:", error);
      toast.error(`Error al crear perfil: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    if (editingUser.role !== 'client' && editingUser.role !== 'director' && !editingUser.email.endsWith('@efectodigital.com.ar') && !editingUser.email.endsWith('@efectodigital.com')) {
      toast.error("El personal de equipo debe usar correo @efectodigital.com.ar o @efectodigital.com");
      return;
    }
    setLoading(true);
    try {
      const updatedUser: any = {
        ...editingUser,
        username: editingUser.username?.trim().toLowerCase() || '',
        email: editingUser.email?.trim().toLowerCase() || ''
      };
      
      // Clean any undefined properties to prevent Firestore crash
      Object.keys(updatedUser).forEach(key => {
        if (updatedUser[key] === undefined) {
          delete updatedUser[key];
        }
      });
      
      console.log(`[EditarUsuario] Actualizando perfil para UID: ${updatedUser.uid}`, updatedUser);
      
      if (isDemoMode) {
        const stored = localStorage.getItem('demo-users');
        const demoUsers = stored ? JSON.parse(stored) : users;
        const updatedUsers = demoUsers.map((u: any) => u.uid === updatedUser.uid ? updatedUser : u);
        localStorage.setItem('demo-users', JSON.stringify(updatedUsers));
        setUsers(updatedUsers);
        window.dispatchEvent(new CustomEvent('demo-users-updated'));
      } else {
        await updateDoc(doc(db, 'users', updatedUser.uid), updatedUser as any);
        console.log(`[EditarUsuario] Firestore actualizado para UID: ${updatedUser.uid}`);
      }
      toast.success("Perfil actualizado correctamente");
      setIsEditUserOpen(false);
    } catch (error: any) {
      console.error("[EditarUsuario] ERROR CRÍTICO AL EDITAR PERFIL:", error);
      toast.error(`Error al actualizar perfil: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = (userId: string, name: string) => {
    if (userId === currentProfile?.uid) {
      toast.error("No puedes eliminarte a ti mismo");
      return;
    }
    setDeleteConfirmUser({ id: userId, name });
    setConfirmStep(1);
  };

  const executeDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    
    try {
      if (isDemoMode) {
        const stored = localStorage.getItem('demo-users');
        const demoUsers = stored ? JSON.parse(stored) : users;
        const updatedUsers = demoUsers.filter((u: any) => u.uid !== deleteConfirmUser.id);
        localStorage.setItem('demo-users', JSON.stringify(updatedUsers));
        setUsers(updatedUsers);
        window.dispatchEvent(new CustomEvent('demo-users-updated'));
      } else {
        await deleteDoc(doc(db, 'users', deleteConfirmUser.id));
      }
      toast.success("Acceso eliminado");
      setDeleteConfirmUser(null);
      setConfirmStep(1);
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  return (
    <div className="space-y-4 bg-background text-foreground min-h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Gestión de Accesos</h2>
        <Button 
          onClick={() => setIsAddUserOpen(true)} 
          className="gap-2 font-bold bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <UserPlus size={18} />
          Crear Nuevo Acceso
        </Button>
      </div>

      <div className="space-y-8">
        {/* Sección de Equipo - Solo para perfiles con permiso canViewStaff */}
        {permissions?.canViewStaff && (
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2 px-1">
              <ShieldCheck size={14} />
              Personal de Equipo
            </h3>
            <div className="rounded-xl border border-border bg-card shadow-none overflow-hidden">
              <div className="overflow-x-auto overflow-y-hidden shadow-[inset_0_0_20px_rgba(0,0,0,0.02)]">
                <Table>
                <TableHeader className="bg-muted/50 border-b border-border">
                  <TableRow className="hover:bg-transparent border-b-border/50">
                    <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-wider">Usuario</TableHead>
                    <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-wider">Email</TableHead>
                    <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-wider">Estado</TableHead>
                    <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-wider">Rol</TableHead>
                    <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-wider">Bloqueo</TableHead>
                    <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-wider">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border/50">
                  {users.filter(u => u.role !== 'client').map((user) => (
                    <TableRow key={user.uid} className={`hover:bg-muted/10 border-b-border/30 transition-colors ${!user.isActive ? 'opacity-50 grayscale-[0.5]' : ''}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 border border-border">
                            <AvatarImage src={user.photoURL} />
                            <AvatarFallback className="bg-primary/20 text-primary">{user.displayName.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm text-foreground">{user.displayName}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                           <span className="text-muted-foreground text-xs font-medium">{user.email}</span>
                           {user.username && <span className="text-[10px] text-primary/70 font-bold">User: {user.username}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`capitalize text-[10px] font-bold border ${
                          user.isActive 
                            ? 'bg-green-500/10 text-green-500 border-green-500/30' 
                            : 'bg-destructive/10 text-destructive border-destructive/30'
                        }`}>
                          {user.isActive ? 'Activo' : 'Bloqueado'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={user.role} 
                          onValueChange={(value) => handleRoleChange(user.uid, value as UserRole)}
                          disabled={
                            (currentProfile?.role === 'setter' && user.role !== 'client') ||
                            (currentProfile?.role === 'account_manager' && user.role !== 'client') ||
                            user.uid === currentProfile?.uid
                          }
                        >
                          <SelectTrigger className="w-[120px] h-8 text-xs bg-muted border-border font-medium">
                            <SelectValue placeholder="Rol" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover border-border">
                            <SelectItem value="setter">Setter</SelectItem>
                            <SelectItem value="commercial">Comercial</SelectItem>
                            <SelectItem value="account_manager">AM</SelectItem>
                            <SelectItem value="director">Director</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-8 w-8 ${user.isActive ? 'text-muted-foreground hover:text-destructive' : 'text-green-500 hover:text-green-600'}`}
                          onClick={() => handleToggleActive(user.uid, !!user.isActive)}
                          title={user.isActive ? "Bloquear acceso" : "Activar acceso"}
                        >
                          {user.isActive ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => {
                              setEditingUser(user);
                              setIsEditUserOpen(true);
                            }}
                          >
                            <Edit size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteUser(user.uid, user.displayName)}
                          >
                            <Trash size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>
          </div>
        )}

        {/* Sección de Clientes */}
        <div className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2 px-1">
            <UsersIcon size={14} />
            Accesos a Clientes
          </h3>
          <div className="rounded-xl border border-border bg-card shadow-none overflow-hidden">
            <div className="overflow-x-auto overflow-y-hidden">
              <Table>
              <TableHeader className="bg-muted/50 border-b border-border">
                <TableRow className="hover:bg-transparent border-b-border/50">
                  <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-wider">Cliente/Empresa</TableHead>
                  <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-wider">Usuario / Email</TableHead>
                  <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-wider">Estado</TableHead>
                  <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-wider">Proyecto Asignado</TableHead>
                  <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-wider">Bloqueo</TableHead>
                  <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-wider">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/50">
                  {users.filter(u => {
                    const isClient = u.role === 'client';
                    if (!isClient) return false;
                    
                    // Directores y Comerciales ven todos los accesos de clientes
                    if (permissions?.canViewStaff) return true;
                    
                    // Account Managers ven accesos de clientes de sus propios proyectos
                    if (currentProfile?.role === 'account_manager') {
                      const client = clients.find(c => c.id === u.assignedClientId);
                      return client?.accountManagerId === currentProfile.uid;
                    }
                    return false;
                  }).map((user) => (
                  <TableRow key={user.uid} className={`hover:bg-muted/10 border-b-border/30 transition-colors ${!user.isActive ? 'opacity-50 grayscale-[0.5]' : ''}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 border border-border">
                          <AvatarFallback className="bg-primary/20 text-primary">{user.displayName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="font-bold text-sm text-foreground">{user.displayName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">{user.username || '---'}</span>
                        <span className="text-[10px] text-muted-foreground">{user.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`capitalize text-[10px] font-bold border ${
                        user.isActive 
                          ? 'bg-green-500/10 text-green-500 border-green-500/30' 
                          : 'bg-destructive/10 text-destructive border-destructive/30'
                      }`}>
                        {user.isActive ? 'Activo' : 'Bloqueado'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={user.assignedClientId || "none"} 
                        onValueChange={(value) => handleClientAssignment(user.uid, value === "none" ? "" : value)}
                      >
                        <SelectTrigger className="w-[160px] h-8 text-xs bg-muted border-border font-medium">
                          <SelectValue placeholder="Proyecto">
                            {clients.find(c => c.id === user.assignedClientId)?.name || (user.assignedClientId ? "ID: " + user.assignedClientId : "Seleccionar")}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          <SelectItem value="none" className="text-xs italic text-muted-foreground">Sin asignar</SelectItem>
                          {clients.filter(c => currentProfile?.role === 'director' || currentProfile?.role === 'commercial' || c.accountManagerId === currentProfile?.uid).map(c => (
                            <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 ${user.isActive ? 'text-muted-foreground hover:text-destructive' : 'text-green-500 hover:text-green-600'}`}
                        onClick={() => handleToggleActive(user.uid, !!user.isActive)}
                        title={user.isActive ? "Bloquear acceso" : "Activar acceso"}
                      >
                        {user.isActive ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => {
                            setEditingUser(user);
                            setIsEditUserOpen(true);
                          }}
                        >
                          <Edit size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteUser(user.uid, user.displayName)}
                        >
                          <Trash size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        </div>
      </div>

      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
        <DialogContent className="sm:max-w-[425px] bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Acceso</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="grid gap-2">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Tipo de Usuario</Label>
              <Select 
                value={newUser.role} 
                onValueChange={(v: UserRole) => setNewUser({...newUser, role: v, email: '', username: '', password: ''})}
              >
                <SelectTrigger className="bg-muted border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Cliente</SelectItem>
                  {currentProfile?.role === 'director' && (
                    <>
                      <SelectItem value="setter">Setter</SelectItem>
                      <SelectItem value="account_manager">Account Manager</SelectItem>
                      <SelectItem value="commercial">Comercial</SelectItem>
                      <SelectItem value="director">Director</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="username" className="text-xs uppercase font-bold text-muted-foreground">Usuario (Login)</Label>
              <Input 
                id="username" 
                placeholder="ej: naza_efecto" 
                value={newUser.username}
                onChange={e => setNewUser({...newUser, username: e.target.value})}
                className="bg-muted border-border"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pass" className="text-xs uppercase font-bold text-muted-foreground">Contraseña</Label>
              <Input 
                id="pass" 
                placeholder="Asigna una contraseña" 
                value={newUser.password}
                onChange={e => setNewUser({...newUser, password: e.target.value})}
                className="bg-muted border-border"
              />
            </div>

              <div className="grid gap-2">
                <Label htmlFor="email" className="text-xs uppercase font-bold text-muted-foreground">Email Personal (@efectodigital)</Label>
                <Input 
                  id="email" 
                  placeholder="ejemplo@efectodigital.com.ar" 
                  value={newUser.email}
                  onChange={e => setNewUser({...newUser, email: e.target.value})}
                  className="bg-muted border-border"
                />
              </div>

            <div className="grid gap-2">
              <Label htmlFor="name" className="text-xs uppercase font-bold text-muted-foreground">Nombre para mostrar / Empresa</Label>
              <Input 
                id="name" 
                placeholder="Ej: Mariana Rodríguez" 
                value={newUser.displayName}
                onChange={e => setNewUser({...newUser, displayName: e.target.value})}
                className="bg-muted border-border"
              />
            </div>
            {newUser.role === 'client' && (
              <div className="grid gap-2">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Asignar Proyecto</Label>
                <Select 
                  value={newUser.assignedClientId} 
                  onValueChange={v => setNewUser({...newUser, assignedClientId: v})}
                >
                  <SelectTrigger className="bg-muted border-border">
                    <SelectValue placeholder="Seleccionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                  {clients.filter(c => currentProfile?.role === 'director' || currentProfile?.role === 'commercial' || c.accountManagerId === currentProfile?.uid).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddUserOpen(false)} className="border-border">Cancelar</Button>
            <Button onClick={handleHandleAddUser} disabled={loading} className="bg-primary text-primary-foreground">
              {loading ? "Creando..." : "Crear Perfil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="sm:max-w-[425px] bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle>Editar Acceso: {editingUser?.displayName}</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
              <div className="grid gap-2">
                <Label htmlFor="edit-name" className="text-xs uppercase font-bold text-muted-foreground">Nombre / Empresa</Label>
                <Input 
                  id="edit-name" 
                  value={editingUser.displayName}
                  onChange={e => setEditingUser({...editingUser, displayName: e.target.value})}
                  className="bg-muted border-border"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="edit-user" className="text-xs uppercase font-bold text-muted-foreground">Usuario (Login)</Label>
                <Input 
                  id="edit-user" 
                  value={editingUser.username || ''}
                  onChange={e => setEditingUser({...editingUser, username: e.target.value})}
                  className="bg-muted border-border"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-pass" className="text-xs uppercase font-bold text-muted-foreground">Contraseña</Label>
                <Input 
                  id="edit-pass" 
                  value={editingUser.password || ''}
                  onChange={e => setEditingUser({...editingUser, password: e.target.value})}
                  className="bg-muted border-border"
                />
              </div>

              {editingUser.role !== 'client' && (
                <div className="grid gap-2">
                  <Label htmlFor="edit-email" className="text-xs uppercase font-bold text-muted-foreground">Email</Label>
                  <Input 
                    id="edit-email" 
                    value={editingUser.email}
                    onChange={e => setEditingUser({...editingUser, email: e.target.value})}
                    className="bg-muted border-border"
                  />
                </div>
              )}

              <div className="grid gap-2">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Rol</Label>
                <Select 
                  value={editingUser.role} 
                  onValueChange={(v: UserRole) => setEditingUser({...editingUser, role: v})}
                  disabled={editingUser.uid === currentProfile?.uid}
                >
                  <SelectTrigger className="bg-muted border-border text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">Cliente</SelectItem>
                    {currentProfile?.role === 'director' && (
                      <>
                        <SelectItem value="setter">Setter</SelectItem>
                        <SelectItem value="account_manager">AM</SelectItem>
                        <SelectItem value="commercial">Comercial</SelectItem>
                        <SelectItem value="director">Director</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditUserOpen(false)} className="border-border">Cancelar</Button>
            <Button onClick={handleUpdateUser} disabled={loading} className="bg-primary text-primary-foreground">
              {loading ? "Guardando..." : "Actualizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirmUser} onOpenChange={(open) => {
        if (!open) {
          setDeleteConfirmUser(null);
          setConfirmStep(1);
        }
      }}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border text-card-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">{confirmStep === 1 ? '¿Eliminar acceso?' : '¡ATENCIÓN! Confirmación final'}</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center">
            {confirmStep === 1 ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <Trash2 size={48} className="mx-auto text-destructive mb-4 opacity-20" />
                <p className="text-sm text-foreground">
                  ¿Estás seguro de que deseas eliminar permanentemente el acceso de <span className="font-bold">{deleteConfirmUser?.name}</span>?
                </p>
                <p className="text-xs text-muted-foreground mt-2">Esta persona ya no podrá ingresar a la plataforma.</p>
              </div>
            ) : (
              <div className="animate-in fade-in zoom-in duration-300">
                <div className="h-16 w-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4 border-2 border-destructive animate-pulse">
                  <ShieldAlert className="text-destructive" size={32} />
                </div>
                <p className="text-lg font-black text-destructive uppercase tracking-tighter">
                  ¡CONFIRMACIÓN FINAL!
                </p>
                <p className="text-sm text-foreground mt-2 font-medium">
                  Se eliminarán todos los datos del perfil de {deleteConfirmUser?.name}.
                </p>
                <p className="text-xs text-muted-foreground mt-1 italic">
                  Esta acción no se puede deshacer.
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => {
              setDeleteConfirmUser(null);
              setConfirmStep(1);
            }} className="border-border text-foreground hover:bg-muted font-bold">
              Cancelar
            </Button>
            {confirmStep === 1 ? (
              <Button variant="destructive" onClick={() => setConfirmStep(2)} className="font-bold">Siguiente paso</Button>
            ) : (
              <Button variant="destructive" onClick={executeDeleteUser} className="font-bold">Confirmar eliminación definitiva</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
