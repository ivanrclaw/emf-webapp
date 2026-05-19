import React from 'react';
import { CodeGenIDE } from '../../ide/CodeGenIDE';

interface CodeGenTabProps {
  projectId: string;
  metamodelId: string;
}

export function CodeGenTab({ projectId, metamodelId }: CodeGenTabProps) {
  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      <CodeGenIDE projectId={projectId} metamodelId={metamodelId} />
    </div>
  );
}

export default CodeGenTab;
