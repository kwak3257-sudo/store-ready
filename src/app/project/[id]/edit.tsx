import { router, useLocalSearchParams } from 'expo-router';

import { ProjectForm } from '@/components/project-form';
import { Body, Screen } from '@/components/ui';
import { useProject } from '@/lib/projects';

export default function EditProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { project, update } = useProject(id);
  if (!project) return <Screen><Body>앱을 찾을 수 없어요.</Body></Screen>;

  return (
    <Screen>
      <ProjectForm
        initial={project}
        submitLabel="저장"
        onSubmit={(values) => {
          update(values);
          router.back();
        }}
      />
    </Screen>
  );
}
