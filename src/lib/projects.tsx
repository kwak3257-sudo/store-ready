import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import { AppProject, EMPTY_DATA_USAGE } from '@/lib/types';

const STORAGE_KEY = 'store-ready/projects/v1';

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
};

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<AppProject[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setProjects(JSON.parse(raw) as AppProject[]);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(projects)).catch(() => {});
  }, [projects, loaded]);

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
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return (
    <ProjectsContext.Provider value={{ projects, loaded, createProject, updateProject, deleteProject }}>
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
