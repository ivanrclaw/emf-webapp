import React from 'react';
import CodeTemplatePage from '../../../pages/CodeTemplatePage';

interface CodeGenTabProps {
  projectId: string;
  metamodelId: string;
}

export function CodeGenTab({ projectId, metamodelId }: CodeGenTabProps) {
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '24px 32px' }}>
      <CodeTemplatePage projectId={projectId} metamodelId={metamodelId} />
    </div>
  );
}

export default CodeGenTab;
