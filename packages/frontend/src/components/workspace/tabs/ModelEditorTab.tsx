import React from 'react';
import ModelEditor from '../../../pages/ModelEditor';

interface ModelEditorTabProps {
  projectId: string;
  metamodelId: string;
  modelId: string;
}

export function ModelEditorTab({ projectId, metamodelId, modelId }: ModelEditorTabProps) {
  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      <ModelEditor projectId={projectId} metamodelId={metamodelId} modelId={modelId} />
    </div>
  );
}

export default ModelEditorTab;
