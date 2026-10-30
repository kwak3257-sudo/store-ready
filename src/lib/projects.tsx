import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/lib/auth';
import { clearPhotos, discardPhotos } from '@/lib/photos';
import { applySync, syncProjects, Tombstones } from '@/lib/sync';
import { AppProject, EMPTY_DATA_USAGE } from '@/lib/types';

const STORAGE_KEY = 'store-ready/projects/v1';
const TOMBSTONES_KEY = 'store-ready/deleted/v1';
/** The account whose projects are on this phone, so a different login does not inherit them. */
const OWNER_KEY = 'store-ready/owner/v1';
const SYNC_DELAY_MS = 2000;

export type SyncStatus =
  | { state: 'off' }
  | { state: 'syncing' }
  | { state: 'synced'; at: Date }
  | { state: 'error'; message: string };

type NewProject = Pick<
  AppProject,
  | 'name'
  | 'oneLiner'
  | 'features'
  | 'category'
  | 'targetUsers'
  | 'stores'
  | 'appKind'
  | 'dataUsage'
  | 'developerName'
  | 'contactEmail'
>;

type ProjectsContextValue = {
  projects: AppProject[];
  loaded: boolean;
  createProject: (input: NewProject) => AppProject;
  updateProject: (id: string, patch: Partial<AppProject>) => void;
  deleteProject: (id: string) => void;
  sync: SyncStatus;
  syncNow: () => void;
  /** Forgets every project, deletion record and photo on this phone. */
  clearLocal: () => Promise<void>;
};

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<AppProject[]>([]);
  const [tombstones, setTombstones] = useState<Tombstones>({});
  const [owner, setOwner] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [sync, setSync] = useState<SyncStatus>({ state: 'off' });
  const userId = useAuth().session?.user.id ?? null;

  useEffect(() => {
    AsyncStorage.multiGet([STORAGE_KEY, TOMBSTONES_KEY, OWNER_KEY])
      .then(([[, raw], [, deleted], [, ownerId]]) => {
        if (raw) setProjects(JSON.parse(raw) as AppProject[]);
        if (deleted) setTombstones(JSON.parse(deleted) as Tombstones);
        setOwner(ownerId);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(projects)).catch(() => {});
  }, [projects, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(TOMBSTONES_KEY, JSON.stringify(tombstones)).catch(() => {});
  }, [tombstones, loaded]);

  // Projects made before the first login join that account; a different account starts empty.
  useEffect(() => {
    if (!loaded || !userId || owner === userId) return;
    if (owner) {
      setProjects([]);
      setTombstones({});
    }
    setOwner(userId);
    AsyncStorage.setItem(OWNER_KEY, userId).catch(() => {});
  }, [loaded, userId, owner]);

  const latest = useRef({ projects, tombstones });
  latest.current = { projects, tombstones };
  const running = useRef(false);
  const again = useRef(false);

  const runSync = useCallback(async () => {
    if (!userId) return;
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    setSync({ state: 'syncing' });
    try {
      do {
        again.current = false;
        const result = await syncProjects(userId, latest.current.projects, latest.current.tombstones);
        const applied = applySync(latest.current.projects, latest.current.tombstones, result);
        if (applied.changed) setProjects(applied.projects);
        if (result.confirmedTombstones.length) {
          setTombstones((prev) => {
            const next = { ...prev };
            result.confirmedTombstones.forEach((id) => delete next[id]);
            return next;
          });
        }
      } while (again.current);
      setSync({ state: 'synced', at: new Date() });
    } catch (e) {
      setSync({ state: 'error', message: e instanceof Error ? e.message : String(e) });
    } finally {
      running.current = false;
    }
  }, [userId]);

  const ready = loaded && Boolean(userId) && owner === userId;

  // Sync shortly after each change, so typing does not upload every keystroke.
  useEffect(() => {
    if (!ready) {
      setSync({ state: 'off' });
      return;
    }
    const timer = setTimeout(runSync, SYNC_DELAY_MS);
    return () => clearTimeout(timer);
  }, [ready, projects, tombstones, runSync]);

  // Pick up edits made on another phone when coming back to the app.
  useEffect(() => {
    if (!ready) return;
    const sub = AppState.addEventListener('change', (s) => s === 'active' && runSync());
    return () => sub.remove();
  }, [ready, runSync]);

  const createProject = useCallback((input: NewProject) => {
    const now = new Date().toISOString();
    const project: AppProject = {
      ...input,
      dataUsage: { ...EMPTY_DATA_USAGE, ...input.dataUsage },
      id: newId(),
      screenshots: [],
      screenshotBackground: '#208AEF',
      checklist: {},
      createdAt: now,
      updatedAt: now,
    };
    setProjects((prev) => [project, ...prev]);
    return project;
  }, []);

  const updateProject = useCallback((id: string, patch: Partial<AppProject>) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p)),
    );
  }, []);

  const deleteProject = useCallback((id: string) => {
    const doomed = latest.current.projects.find((p) => p.id === id);
    if (doomed) discardPhotos(doomed.screenshots);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setTombstones((prev) => ({ ...prev, [id]: new Date().toISOString() }));
  }, []);

  const syncNow = useCallback(() => {
    runSync();
  }, [runSync]);

  const clearLocal = useCallback(async () => {
    setProjects([]);
    setTombstones({});
    setOwner(null);
    clearPhotos();
    await AsyncStorage.multiRemove([STORAGE_KEY, TOMBSTONES_KEY, OWNER_KEY]).catch(() => {});
  }, []);

  return (
    <ProjectsContext.Provider
      value={{ projects, loaded, createProject, updateProject, deleteProject, sync, syncNow, clearLocal }}>
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error('useProjects must be used inside ProjectsProvider');
  return ctx;
}

export function useProject(id: string | undefined) {
  const { projects, updateProject, loaded } = useProjects();
  const project = projects.find((p) => p.id === id);
  const update = useCallback((patch: Partial<AppProject>) => id && updateProject(id, patch), [id, updateProject]);
  return { project, update, loaded };
}
