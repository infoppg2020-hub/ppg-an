export type UserRole = 'admin' | 'user';
export type UserStatus = 'active' | 'suspended';

export interface AppUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: number;
  lastLoginAt: number | null;
}

export interface SystemSettings {
  allowSelfRegistration: boolean;
  requireAuthForPlayback: boolean;
  defaultOfflineAutoCache: boolean;
  maxOfflineQuotaMb: number;
  announcementBanner: string;
}

export interface PublicConfig {
  adminClaimed: boolean;
  envPasscodeConfigured: boolean;
  settings: SystemSettings;
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  actor: string;
  action: string;
  detail: string;
}

export interface AdminOverviewData {
  users: AppUser[];
  settings: SystemSettings;
  auditLogs: AuditLogEntry[];
  stats: {
    totalUsers: number;
    activeUsers: number;
    suspendedUsers: number;
    adminCount: number;
  };
}
