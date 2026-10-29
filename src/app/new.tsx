import { router } from 'expo-router';

import { ProjectForm } from '@/components/project-form';
import { Screen } from '@/components/ui';
import { useProjects } from '@/lib/projects';

export default function NewProjectScreen() {
  const { createProject } = useProjects();
  return (
    <Screen>
      <ProjectForm
        submitLabel="저장하고 시작하기"
        onSubmit={(values) => {
          const project = createProject(values);
          router.replace({ pathname: '/project/[id]', params: { id: project.id } });
        }}
      />
    </Screen>
  );
}
