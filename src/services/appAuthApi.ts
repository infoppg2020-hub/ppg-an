import {
  AdminOverviewData,
  AppUser,
  PublicConfig,
  SystemSettings,
  UserRole,
  UserStatus,
} from '../types/auth';

// Session token is held strictly in JS memory (never localStorage or sessionStorage)
let memorySessionToken: string | null = null;

export function getAppSessionToken(): string | null {
  return memorySessionToken;
}

export function clearAppSessionToken(): void {
  memorySessionToken = null;
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  requireAuthHeader = false
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (requireAuthHeader) {
    if (!memorySessionToken) {
      throw new Error('กรุณาเข้าสู่ระบบก่อนดำเนินการ');
    }
    headers.set('Authorization', `Bearer ${memorySessionToken}`);
  }

  const res = await fetch(path, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && requireAuthHeader) {
      memorySessionToken = null;
    }
    throw new Error(
      typeof data.error === 'string'
        ? data.error
        : `คำขอล้มเหลว (${res.status})`
    );
  }

  return data as T;
}

export async function fetchPublicConfig(): Promise<PublicConfig> {
  return apiRequest<PublicConfig>('/api/public/config', { method: 'GET' });
}

export async function claimAdminAccount(payload: {
  username: string;
  password: string;
  displayName?: string;
}): Promise<AppUser> {
  const res = await apiRequest<{ token: string; user: AppUser }>(
    '/api/auth/claim-admin',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
  memorySessionToken = res.token;
  return res.user;
}

export async function loginAppUser(payload: {
  username: string;
  password: string;
}): Promise<AppUser> {
  const res = await apiRequest<{ token: string; user: AppUser }>(
    '/api/auth/login',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
  memorySessionToken = res.token;
  return res.user;
}

export async function registerAppUser(payload: {
  username: string;
  password: string;
  displayName: string;
}): Promise<AppUser> {
  const res = await apiRequest<{ token: string; user: AppUser }>(
    '/api/auth/register',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
  memorySessionToken = res.token;
  return res.user;
}

export async function changeOwnPassword(payload: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await apiRequest<{ ok: boolean }>(
    '/api/auth/change-password',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    true
  );
}

export async function fetchAdminOverview(): Promise<AdminOverviewData> {
  return apiRequest<AdminOverviewData>(
    '/api/admin/overview',
    { method: 'GET' },
    true
  );
}

export async function adminCreateUser(payload: {
  username: string;
  displayName: string;
  password: string;
  role: UserRole;
}): Promise<AppUser> {
  const res = await apiRequest<{ user: AppUser }>(
    '/api/admin/users',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    true
  );
  return res.user;
}

export async function adminUpdateUser(
  userId: string,
  payload: {
    displayName?: string;
    role?: UserRole;
    status?: UserStatus;
    password?: string;
  }
): Promise<AppUser> {
  const res = await apiRequest<{ user: AppUser }>(
    `/api/admin/users/${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
    true
  );
  return res.user;
}

export async function adminDeleteUser(userId: string): Promise<void> {
  await apiRequest<{ ok: boolean }>(
    `/api/admin/users/${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
    true
  );
}

export async function adminUpdateSettings(
  settings: SystemSettings
): Promise<SystemSettings> {
  const res = await apiRequest<{ settings: SystemSettings }>(
    '/api/admin/settings',
    {
      method: 'PUT',
      body: JSON.stringify(settings),
    },
    true
  );
  return res.settings;
}
