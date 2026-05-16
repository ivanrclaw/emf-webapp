import React from 'react';
import ModelList from '../../../pages/ModelList';

interface ModelsTabProps {
  projectId: string;
  metamodelId: string;
}

export function ModelsTab({ projectId, metamodelId }: ModelsTabProps) {
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '24px 32px' }}>
      <ModelList projectId={projectId} metamodelId={metamodelId} />
    </div>
  );
}

export default ModelsTab;
