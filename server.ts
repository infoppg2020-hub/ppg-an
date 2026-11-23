import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';

type UserRole = 'admin' | 'user';
type UserStatus = 'active' | 'suspended';

interface StoredUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  passwordHash: string;
  salt: string;
  createdAt: number;
  lastLoginAt: number | null;
}

interface SystemSettings {
  allowSelfRegistration: boolean;
  requireAuthForPlayback: boolean;
  defaultOfflineAutoCache: boolean;
  maxOfflineQuotaMb: number;
  announcementBanner: string;
}

interface AuditLogEntry {
  id: string;
  timestamp: number;
  actor: string;
  action: string;
  detail: string;
}

interface AppStore {
  adminClaimed: boolean;
  users: StoredUser[];
  settings: SystemSettings;
  auditLogs: AuditLogEntry[];
}

interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: number;
  lastLoginAt: number | null;
}

interface SessionPayload {
  sub: string;
  username: string;
  role: UserRole;
  iat: number;
  exp: number;
}

interface AuthedRequest extends Request {
  authUser?: PublicUser;
}

const PORT = Number(process.env.PORT) || 3000;
const SESSION_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

const DATA_DIR = path.resolve(process.cwd(), '.data');
const STORE_PATH = path.resolve(DATA_DIR, 'spotiflow-store.json');

if (!STORE_PATH.startsWith(DATA_DIR + path.sep)) {
  throw new Error('Invalid store path');
}

const DEFAULT_SETTINGS: SystemSettings = {
  allowSelfRegistration: true,
  requireAuthForPlayback: false,
  defaultOfflineAutoCache: true,
  maxOfflineQuotaMb: 2048,
  announcementBanner: '',
};

function getEnvAdminPasscode(): string {
  return (process.env.ADMIN_PASSCODE || '').trim();
}

function hashPassword(password: string, existingSalt?: string): {
  hash: string;
  salt: string;
} {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash: derived, salt };
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  if (!salt || !expectedHash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const target = Buffer.from(expectedHash, 'hex');
  if (candidate.length !== target.length) return false;
  return crypto.timingSafeEqual(candidate, target);
}

function verifyConstantPasscode(input: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(input).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function sanitizeUser(u: StoredUser): PublicUser {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  };
}

function loadStore(): AppStore {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_PATH)) {
    const initial: AppStore = {
      adminClaimed: false,
      users: [],
      settings: { ...DEFAULT_SETTINGS },
      auditLogs: [],
    };
    saveStore(initial);
    return initial;
  }

  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<AppStore>;
    return {
      adminClaimed: Boolean(parsed.adminClaimed),
      users: Array.isArray(parsed.users) ? parsed.users : [],
      settings: {
        ...DEFAULT_SETTINGS,
        ...(parsed.settings || {}),
      },
      auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
    };
  } catch {
    return {
      adminClaimed: false,
      users: [],
      settings: { ...DEFAULT_SETTINGS },
      auditLogs: [],
    };
  }
}

function saveStore(store: AppStore): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpPath = path.resolve(DATA_DIR, `spotiflow-store.${process.pid}.tmp`);
  if (!tmpPath.startsWith(DATA_DIR + path.sep)) {
    throw new Error('Invalid temp store path');
  }
  fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmpPath, STORE_PATH);
}

function appendAudit(
  store: AppStore,
  actor: string,
  action: string,
  detail: string
): void {
  const entry: AuditLogEntry = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    actor,
    action,
    detail,
  };
  store.auditLogs = [entry, ...store.auditLogs].slice(0, 120);
}

function signSessionToken(user: PublicUser): string {
  const now = Date.now();
  const payload: SessionPayload = {
    sub: user.id,
    username: user.username,
    role: user.role,
    iat: now,
    exp: now + SESSION_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}

function verifySessionToken(token: string, store: AppStore): PublicUser | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(body)
    .digest('base64url');

  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8')
    ) as SessionPayload;
    if (!payload.sub || !payload.exp || payload.exp <= Date.now()) {
      return null;
    }
    const found = store.users.find((u) => u.id === payload.sub);
    if (!found || found.status !== 'active') {
      return null;
    }
    return sanitizeUser(found);
  } catch {
    return null;
  }
}

function normalizeUsername(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

function isValidUsername(username: string): boolean {
  return /^[a-z0-9._-]{3,32}$/.test(username);
}

function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ' });
    return;
  }
  const token = authHeader.slice(7).trim();
  const store = loadStore();
  const user = verifySessionToken(token, store);
  if (!user) {
    res.status(401).json({ error: 'เซสชันหมดอายุหรือบัญชีถูกระงับ กรุณาเข้าสู่ระบบใหม่' });
    return;
  }
  req.authUser = user;
  next();
}

function requireAdmin(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.authUser || req.authUser.role !== 'admin') {
    res.status(403).json({ error: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่เข้าถึงส่วนนี้ได้' });
    return;
  }
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  // Ensure admin account entry exists in store when ADMIN_PASSCODE is configured via env
  const envPasscodeInit = getEnvAdminPasscode();
  if (envPasscodeInit) {
    const store = loadStore();
    const hasAdmin = store.users.some((u) => u.username === 'admin');
    if (!hasAdmin) {
      store.users.unshift({
        id: 'usr_admin',
        username: 'admin',
        displayName: 'ผู้ดูแลระบบ',
        role: 'admin',
        status: 'active',
        passwordHash: '',
        salt: '',
        createdAt: Date.now(),
        lastLoginAt: null,
      });
      saveStore(store);
    }
  }

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get('/api/public/config', (_req: Request, res: Response) => {
    const store = loadStore();
    const envConfigured = Boolean(getEnvAdminPasscode());
    res.json({
      adminClaimed: store.adminClaimed || envConfigured,
      envPasscodeConfigured: envConfigured,
      settings: store.settings,
    });
  });

  // One-time first-run bootstrap route to claim the initial `admin` password safely
  app.post('/api/auth/claim-admin', (req: Request, res: Response) => {
    const envPasscode = getEnvAdminPasscode();
    const store = loadStore();

    if (envPasscode) {
      res.status(409).json({
        error: 'รหัสผ่าน Admin ถูกกำหนดไว้ในระบบ Secrets แล้ว กรุณาเข้าสู่ระบบตามปกติ',
      });
      return;
    }
    if (store.adminClaimed) {
      res.status(409).json({
        error: 'บัญชีผู้ดูแลระบบถูกตั้งค่าไปแล้ว กรุณาเข้าสู่ระบบด้วยชื่อผู้ใช้ admin',
      });
      return;
    }

    const username = normalizeUsername(req.body?.username);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const displayName =
      typeof req.body?.displayName === 'string' && req.body.displayName.trim()
        ? req.body.displayName.trim().slice(0, 60)
        : 'ผู้ดูแลระบบ (Admin)';

    if (username !== 'admin') {
      res.status(400).json({ error: 'บัญชีเริ่มต้นต้องใช้ชื่อผู้ใช้ admin' });
      return;
    }
    if (password.length < 4 || password.length > 128) {
      res.status(400).json({ error: 'รหัสผ่านต้องมีความยาว 4–128 ตัวอักษร' });
      return;
    }

    const { hash, salt } = hashPassword(password);
    const existingIdx = store.users.findIndex((u) => u.username === 'admin');
    const adminUser: StoredUser = {
      id: 'usr_admin',
      username: 'admin',
      displayName,
      role: 'admin',
      status: 'active',
      passwordHash: hash,
      salt,
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
    };

    if (existingIdx >= 0) {
      store.users[existingIdx] = adminUser;
    } else {
      store.users.unshift(adminUser);
    }

    store.adminClaimed = true;
    appendAudit(store, 'admin', 'ADMIN_CLAIM', 'ตั้งรหัสผ่านผู้ดูแลระบบครั้งแรกเรียบร้อย');
    saveStore(store);

    const publicUser = sanitizeUser(adminUser);
    const token = signSessionToken(publicUser);
    res.status(201).json({ token, user: publicUser });
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const username = normalizeUsername(req.body?.username);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!username || !password) {
      res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
      return;
    }

    const store = loadStore();
    const envPasscode = getEnvAdminPasscode();

    // If ADMIN_PASSCODE env var is configured, it overrides any stored hash for `admin`
    if (username === 'admin' && envPasscode) {
      if (!verifyConstantPasscode(password, envPasscode)) {
        res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        return;
      }

      let adminRecord = store.users.find((u) => u.username === 'admin');
      if (!adminRecord) {
        adminRecord = {
          id: 'usr_admin',
          username: 'admin',
          displayName: 'ผู้ดูแลระบบ (Admin)',
          role: 'admin',
          status: 'active',
          passwordHash: '',
          salt: '',
          createdAt: Date.now(),
          lastLoginAt: Date.now(),
        };
        store.users.unshift(adminRecord);
      } else {
        adminRecord.role = 'admin';
        adminRecord.status = 'active';
        adminRecord.lastLoginAt = Date.now();
      }

      appendAudit(store, 'admin', 'LOGIN', 'ผู้ดูแลระบบเข้าสู่ระบบ');
      saveStore(store);

      const publicUser = sanitizeUser(adminRecord);
      const token = signSessionToken(publicUser);
      res.json({ token, user: publicUser });
      return;
    }

    const userRecord = store.users.find((u) => u.username === username);
    if (!userRecord || !verifyPassword(password, userRecord.salt, userRecord.passwordHash)) {
      res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
      return;
    }

    if (userRecord.status !== 'active') {
      res.status(403).json({ error: 'บัญชีนี้ถูกระงับการใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ' });
      return;
    }

    userRecord.lastLoginAt = Date.now();
    appendAudit(store, userRecord.username, 'LOGIN', 'เข้าสู่ระบบสำเร็จ');
    saveStore(store);

    const publicUser = sanitizeUser(userRecord);
    const token = signSessionToken(publicUser);
    res.json({ token, user: publicUser });
  });

  app.post('/api/auth/register', (req: Request, res: Response) => {
    const store = loadStore();
    if (!store.settings.allowSelfRegistration) {
      res.status(403).json({ error: 'ผู้ดูแลระบบปิดการสมัครสมาชิกใหม่ชั่วคราว' });
      return;
    }

    const username = normalizeUsername(req.body?.username);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const displayName =
      typeof req.body?.displayName === 'string' && req.body.displayName.trim()
        ? req.body.displayName.trim().slice(0, 60)
        : username;

    if (!isValidUsername(username)) {
      res.status(400).json({
        error: 'ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษ ตัวเลข หรือ . _ - ความยาว 3–32 ตัวอักษร',
      });
      return;
    }
    if (username === 'admin') {
      res.status(409).json({ error: 'ไม่สามารถใช้ชื่อผู้ใช้ admin สำหรับสมัครสมาชิกทั่วไปได้' });
      return;
    }
    if (password.length < 4 || password.length > 128) {
      res.status(400).json({ error: 'รหัสผ่านต้องมีความยาว 4–128 ตัวอักษร' });
      return;
    }
    if (store.users.some((u) => u.username === username)) {
      res.status(409).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' });
      return;
    }

    const { hash, salt } = hashPassword(password);
    const newUser: StoredUser = {
      id: `usr_${crypto.randomUUID().slice(0, 12)}`,
      username,
      displayName,
      role: 'user',
      status: 'active',
      passwordHash: hash,
      salt,
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
    };

    store.users.push(newUser);
    appendAudit(store, username, 'USER_REGISTER', `สมัครสมาชิกใหม่ (${displayName})`);
    saveStore(store);

    const publicUser = sanitizeUser(newUser);
    const token = signSessionToken(publicUser);
    res.status(201).json({ token, user: publicUser });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res: Response) => {
    res.json({ user: req.authUser });
  });

  app.post('/api/auth/change-password', requireAuth, (req: AuthedRequest, res: Response) => {
    const authUser = req.authUser!;
    const currentPassword =
      typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword =
      typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (authUser.username === 'admin' && getEnvAdminPasscode()) {
      res.status(400).json({
        error: 'รหัสผ่าน admin ถูกกำหนดผ่านตัวแปรสภาพแวดล้อม ADMIN_PASSCODE กรุณาแก้ไขที่หน้า Secrets',
      });
      return;
    }

    if (newPassword.length < 4 || newPassword.length > 128) {
      res.status(400).json({ error: 'รหัสผ่านใหม่ต้องมีความยาว 4–128 ตัวอักษร' });
      return;
    }

    const store = loadStore();
    const record = store.users.find((u) => u.id === authUser.id);
    if (!record || !verifyPassword(currentPassword, record.salt, record.passwordHash)) {
      res.status(401).json({ error: 'รหัสผ่านเดิมไม่ถูกต้อง' });
      return;
    }

    const { hash, salt } = hashPassword(newPassword);
    record.passwordHash = hash;
    record.salt = salt;
    appendAudit(store, authUser.username, 'PASSWORD_CHANGE', 'เปลี่ยนรหัสผ่านส่วนตัว');
    saveStore(store);

    res.json({ ok: true });
  });

  // Admin Console Routes
  app.get(
    '/api/admin/overview',
    requireAuth,
    requireAdmin,
    (_req: AuthedRequest, res: Response) => {
      const store = loadStore();
      const users = store.users.map(sanitizeUser);
      res.json({
        users,
        settings: store.settings,
        auditLogs: store.auditLogs,
        stats: {
          totalUsers: users.length,
          activeUsers: users.filter((u) => u.status === 'active').length,
          suspendedUsers: users.filter((u) => u.status === 'suspended').length,
          adminCount: users.filter((u) => u.role === 'admin').length,
        },
      });
    }
  );

  app.post(
    '/api/admin/users',
    requireAuth,
    requireAdmin,
    (req: AuthedRequest, res: Response) => {
      const username = normalizeUsername(req.body?.username);
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const displayName =
        typeof req.body?.displayName === 'string' && req.body.displayName.trim()
          ? req.body.displayName.trim().slice(0, 60)
          : username;
      const role: UserRole = req.body?.role === 'admin' ? 'admin' : 'user';

      if (!isValidUsername(username)) {
        res.status(400).json({
          error: 'ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษ ตัวเลข หรือ . _ - ความยาว 3–32 ตัวอักษร',
        });
        return;
      }
      if (password.length < 4 || password.length > 128) {
        res.status(400).json({ error: 'รหัสผ่านต้องมีความยาว 4–128 ตัวอักษร' });
        return;
      }

      const store = loadStore();
      if (store.users.some((u) => u.username === username)) {
        res.status(409).json({ error: 'ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว' });
        return;
      }

      const { hash, salt } = hashPassword(password);
      const created: StoredUser = {
        id: `usr_${crypto.randomUUID().slice(0, 12)}`,
        username,
        displayName,
        role,
        status: 'active',
        passwordHash: hash,
        salt,
        createdAt: Date.now(),
        lastLoginAt: null,
      };

      store.users.push(created);
      appendAudit(
        store,
        req.authUser!.username,
        'USER_CREATED',
        `สร้างบัญชี ${username} (${role})`
      );
      saveStore(store);

      res.status(201).json({ user: sanitizeUser(created) });
    }
  );

  app.patch(
    '/api/admin/users/:id',
    requireAuth,
    requireAdmin,
    (req: AuthedRequest, res: Response) => {
      const targetId = req.params.id;
      const store = loadStore();
      const target = store.users.find((u) => u.id === targetId);
      if (!target) {
        res.status(404).json({ error: 'ไม่พบผู้ใช้งานที่ต้องการแก้ไข' });
        return;
      }

      const nextDisplayName =
        typeof req.body?.displayName === 'string'
          ? req.body.displayName.trim().slice(0, 60)
          : undefined;
      const nextRole: UserRole | undefined =
        req.body?.role === 'admin' || req.body?.role === 'user'
          ? req.body.role
          : undefined;
      const nextStatus: UserStatus | undefined =
        req.body?.status === 'active' || req.body?.status === 'suspended'
          ? req.body.status
          : undefined;
      const nextPassword =
        typeof req.body?.password === 'string' && req.body.password.length > 0
          ? req.body.password
          : undefined;

      if (target.id === req.authUser!.id) {
        if (nextStatus === 'suspended') {
          res.status(400).json({ error: 'ไม่สามารถระงับบัญชีที่กำลังใช้งานอยู่ได้' });
          return;
        }
        if (nextRole === 'user') {
          res.status(400).json({ error: 'ไม่สามารถลดสิทธิ์ผู้ดูแลระบบของตนเองได้' });
          return;
        }
      }

      if (target.username === 'admin') {
        if (nextStatus === 'suspended' || nextRole === 'user') {
          res.status(400).json({ error: 'ไม่สามารถลดสิทธิ์หรือระงับบัญชีหลัก admin ได้' });
          return;
        }
        if (nextPassword && getEnvAdminPasscode()) {
          res.status(400).json({
            error: 'รหัสผ่าน admin ถูกควบคุมโดย ADMIN_PASSCODE ใน Secrets',
          });
          return;
        }
      }

      if (nextPassword !== undefined) {
        if (nextPassword.length < 4 || nextPassword.length > 128) {
          res.status(400).json({ error: 'รหัสผ่านใหม่ต้องมีความยาว 4–128 ตัวอักษร' });
          return;
        }
        const { hash, salt } = hashPassword(nextPassword);
        target.passwordHash = hash;
        target.salt = salt;
      }

      if (nextDisplayName) target.displayName = nextDisplayName;
      if (nextRole) target.role = nextRole;
      if (nextStatus) target.status = nextStatus;

      appendAudit(
        store,
        req.authUser!.username,
        'USER_UPDATED',
        `อัปเดตบัญชี ${target.username} (${target.role}, ${target.status})`
      );
      saveStore(store);

      res.json({ user: sanitizeUser(target) });
    }
  );

  app.delete(
    '/api/admin/users/:id',
    requireAuth,
    requireAdmin,
    (req: AuthedRequest, res: Response) => {
      const targetId = req.params.id;
      const store = loadStore();
      const target = store.users.find((u) => u.id === targetId);
      if (!target) {
        res.status(404).json({ error: 'ไม่พบผู้ใช้งานที่ต้องการลบ' });
        return;
      }
      if (target.id === req.authUser!.id || target.username === 'admin') {
        res.status(400).json({ error: 'ไม่สามารถลบบัญชีหลัก admin หรือบัญชีที่กำลังใช้งานอยู่ได้' });
        return;
      }

      store.users = store.users.filter((u) => u.id !== targetId);
      appendAudit(
        store,
        req.authUser!.username,
        'USER_DELETED',
        `ลบบัญชี ${target.username}`
      );
      saveStore(store);

      res.json({ ok: true });
    }
  );

  app.put(
    '/api/admin/settings',
    requireAuth,
    requireAdmin,
    (req: AuthedRequest, res: Response) => {
      const store = loadStore();
      const body = req.body || {};

      const quotaRaw = Number(body.maxOfflineQuotaMb);
      const maxOfflineQuotaMb =
        Number.isFinite(quotaRaw) && quotaRaw >= 128 && quotaRaw <= 32768
          ? Math.round(quotaRaw)
          : store.settings.maxOfflineQuotaMb;

      store.settings = {
        allowSelfRegistration:
          typeof body.allowSelfRegistration === 'boolean'
            ? body.allowSelfRegistration
            : store.settings.allowSelfRegistration,
        requireAuthForPlayback:
          typeof body.requireAuthForPlayback === 'boolean'
            ? body.requireAuthForPlayback
            : store.settings.requireAuthForPlayback,
        defaultOfflineAutoCache:
          typeof body.defaultOfflineAutoCache === 'boolean'
            ? body.defaultOfflineAutoCache
            : store.settings.defaultOfflineAutoCache,
        maxOfflineQuotaMb,
        announcementBanner:
          typeof body.announcementBanner === 'string'
            ? body.announcementBanner.trim().slice(0, 240)
            : store.settings.announcementBanner,
      };

      appendAudit(
        store,
        req.authUser!.username,
        'SETTINGS_UPDATED',
        'อัปเดตการตั้งค่าระบบเรียบร้อย'
      );
      saveStore(store);

      res.json({ settings: store.settings });
    }
  );

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr:
          process.env.DISABLE_HMR === 'true'
            ? false
            : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Spotiflow server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
