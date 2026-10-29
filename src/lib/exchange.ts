import { supabase } from '@/lib/supabase';

/** Google requires this many testers opted in for this many days in a row before production access. */
export const REQUIRED_TESTERS = 12;
export const REQUIRED_DAYS = 14;

export type JoinStatus = 'requested' | 'added' | 'installed' | 'left';

export type BoardApp = {
  id: string;
  name: string;
  package_name: string;
  note: string;
  needed: number;
  created_at: string;
  testers: number;
  owner_gives: number;
  joined: boolean;
};

export type ExchangeApp = {
  id: string;
  project_id: string;
  name: string;
  package_name: string;
  note: string;
  needed: number;
  closed: boolean;
  created_at: string;
};

export type Join = {
  id: string;
  app_id: string;
  tester: string;
  status: JoinStatus;
  requested_at: string;
  installed_at: string | null;
  left_at: string | null;
};

export type MyJoin = Join & { app: Pick<ExchangeApp, 'name' | 'package_name' | 'note'>; days: string[] };
export type OwnerJoin = Join & { gmail: string | null; days: string[] };

export const optInUrl = (pkg: string) => `https://play.google.com/apps/testing/${pkg}`;
export const storeUrl = (pkg: string) => `https://play.google.com/store/apps/details?id=${pkg}`;

export const PACKAGE_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;

/** The calendar day in Korea, matching how the server records check-ins. */
export function koreanDay(date: Date = new Date()) {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function client() {
  if (!supabase) throw new Error('서버(Supabase)가 설정되지 않았습니다.');
  return supabase;
}

async function rpc(name: string, args?: object) {
  const { data, error } = await client().rpc(name, args);
  if (error) throw new Error(friendly(error.message));
  return data;
}

function friendly(message: string) {
  if (message.includes('set your gmail first')) return '먼저 테스트에 쓸 Gmail 주소를 저장해 주세요.';
  if (message.includes('cannot join this app')) return '이 앱에는 참여할 수 없어요.';
  if (message.includes('package_name')) return '패키지 이름 형식이 올바르지 않아요. 예: com.mycompany.myapp';
  if (message.includes('gmail')) return 'Gmail 주소 형식이 올바르지 않아요.';
  return message;
}

async function checkinDays(joinIds: string[]) {
  const byJoin = new Map<string, string[]>();
  if (!joinIds.length) return byJoin;
  const { data, error } = await client().from('exchange_checkins').select('join_id, day').in('join_id', joinIds);
  if (error) throw error;
  for (const row of data as { join_id: string; day: string }[]) {
    byJoin.set(row.join_id, [...(byJoin.get(row.join_id) ?? []), row.day]);
  }
  return byJoin;
}

export async function fetchMyGmail(userId: string): Promise<string | null> {
  const { data, error } = await client().from('tester_profiles').select('gmail').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data?.gmail ?? null;
}

export const saveGmail = (gmail: string) => rpc('exchange_set_gmail', { p_gmail: gmail });

export async function fetchMyApps(userId: string): Promise<(ExchangeApp & { joins: Join[] })[]> {
  const { data, error } = await client()
    .from('exchange_apps')
    .select('*, joins:exchange_joins(*)')
    .eq('owner', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as (ExchangeApp & { joins: Join[] })[];
}

export async function fetchOwnerApp(appId: string): Promise<{ app: ExchangeApp; joins: OwnerJoin[] }> {
  const db = client();
  const { data: app, error } = await db.from('exchange_apps').select('*').eq('id', appId).single();
  if (error) throw error;
  const { data: joins, error: joinError } = await db
    .from('exchange_joins')
    .select('*')
    .eq('app_id', appId)
    .order('requested_at');
  if (joinError) throw joinError;
  const testers = (joins as Join[]).map((j) => j.tester);
  const { data: profiles, error: profileError } = testers.length
    ? await db.from('tester_profiles').select('user_id, gmail').in('user_id', testers)
    : { data: [], error: null };
  if (profileError) throw profileError;
  const gmail = new Map((profiles as { user_id: string; gmail: string }[]).map((p) => [p.user_id, p.gmail]));
  const days = await checkinDays((joins as Join[]).map((j) => j.id));
  return {
    app: app as ExchangeApp,
    joins: (joins as Join[]).map((j) => ({ ...j, gmail: gmail.get(j.tester) ?? null, days: days.get(j.id) ?? [] })),
  };
}

export async function fetchMyJoins(userId: string): Promise<MyJoin[]> {
  const { data, error } = await client()
    .from('exchange_joins')
    .select('*, app:exchange_apps(name, package_name, note)')
    .eq('tester', userId)
    .neq('status', 'left')
    .order('requested_at', { ascending: false });
  if (error) throw error;
  const joins = data as (Join & { app: MyJoin['app'] })[];
  const days = await checkinDays(joins.map((j) => j.id));
  return joins.map((j) => ({ ...j, days: days.get(j.id) ?? [] }));
}

export async function fetchBoard(): Promise<BoardApp[]> {
  return ((await rpc('exchange_board')) ?? []) as BoardApp[];
}

export const registerApp = (projectId: string, name: string, packageName: string, note: string) =>
  rpc('exchange_register_app', { p_project_id: projectId, p_name: name, p_package: packageName, p_note: note });
export const setAppClosed = (appId: string, closed: boolean) => rpc('exchange_close_app', { p_app: appId, p_closed: closed });
export const joinApp = (appId: string) => rpc('exchange_join', { p_app: appId });
export const markAdded = (joinId: string) => rpc('exchange_mark_added', { p_join: joinId });
export const markInstalled = (joinId: string) => rpc('exchange_mark_installed', { p_join: joinId });
export const checkIn = (joinId: string) => rpc('exchange_checkin', { p_join: joinId });
export const leaveApp = (joinId: string) => rpc('exchange_leave', { p_join: joinId });

/** Number of consecutive days in a row, ending on `today`, present in `days`. */
export function dayStreak(days: string[], today = koreanDay()) {
  const set = new Set(days);
  let streak = 0;
  const cursor = new Date(`${today}T00:00:00Z`);
  while (set.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

/**
 * Where an app stands against Google's rule: how many testers are opted in now, and for how many
 * days in a row (ending today) at least `needed` testers have been opted in.
 */
export function testingProgress(joins: Join[], needed = REQUIRED_TESTERS, today = koreanDay()) {
  const active = (day: string) =>
    joins.filter(
      (j) =>
        j.installed_at &&
        koreanDay(new Date(j.installed_at)) <= day &&
        (!j.left_at || koreanDay(new Date(j.left_at)) > day),
    ).length;

  const testersNow = active(today);
  let streak = 0;
  const cursor = new Date(`${today}T00:00:00Z`);
  while (streak < 366 && active(cursor.toISOString().slice(0, 10)) >= needed) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return {
    testersNow,
    streak,
    ready: streak >= REQUIRED_DAYS,
    daysLeft: testersNow >= needed ? Math.max(0, REQUIRED_DAYS - streak) : null,
  };
}
