
export type UserRole = 'director' | 'account_manager' | 'setter' | 'commercial' | 'designer' | 'copywriter' | 'client';

export interface Permissions {
  canViewStaff: boolean;
  canViewClients: boolean;
  canManagePermissions: boolean;
  canViewReports: boolean;
  canManageLeads: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, Permissions> = {
  director: {
    canViewStaff: true,
    canViewClients: true,
    canManagePermissions: true,
    canViewReports: true,
    canManageLeads: true,
  },
  commercial: {
    canViewStaff: true,
    canViewClients: true,
    canManagePermissions: true,
    canViewReports: true,
    canManageLeads: true,
  },
  account_manager: {
    canViewStaff: false,
    canViewClients: true,
    canManagePermissions: false,
    canViewReports: true,
    canManageLeads: true,
  },
  designer: {
    canViewStaff: false,
    canViewClients: true,
    canManagePermissions: false,
    canViewReports: false,
    canManageLeads: false,
  },
  copywriter: {
    canViewStaff: false,
    canViewClients: true,
    canManagePermissions: false,
    canViewReports: false,
    canManageLeads: false,
  },
  setter: {
    canViewStaff: false,
    canViewClients: false,
    canManagePermissions: false,
    canViewReports: false,
    canManageLeads: true,
  },
  client: {
    canViewStaff: false,
    canViewClients: false,
    canManagePermissions: false,
    canViewReports: false,
    canManageLeads: false,
  },
};
