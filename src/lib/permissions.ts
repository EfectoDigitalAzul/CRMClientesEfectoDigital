
export type UserRole = 'director' | 'account_manager' | 'client';

export interface Permissions {
  canViewStaff: boolean;
  canManageStaff: boolean;
  canViewClients: boolean;
  canManageClients: boolean;
  canManagePermissions: boolean;
  canViewReports: boolean;
  canManageLeads: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, Permissions> = {
  director: {
    canViewStaff: true,
    canManageStaff: true,
    canViewClients: true,
    canManageClients: true,
    canManagePermissions: true,
    canViewReports: true,
    canManageLeads: true,
  },
  account_manager: {
    canViewStaff: true,
    canManageStaff: false,
    canViewClients: true,
    canManageClients: true,
    canManagePermissions: false,
    canViewReports: true,
    canManageLeads: true,
  },
  client: {
    canViewStaff: false,
    canManageStaff: false,
    canViewClients: false,
    canManageClients: false,
    canManagePermissions: false,
    canViewReports: false,
    canManageLeads: true, // They can view leads in their workspace
  },
};
