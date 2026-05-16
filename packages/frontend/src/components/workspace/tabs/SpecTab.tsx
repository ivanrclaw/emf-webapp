import React from 'react';
import SpecEditor from '../../../pages/SpecEditor';

interface SpecTabProps {
  projectId: string;
  metamodelId: string;
}

export function SpecTab({ projectId, metamodelId }: SpecTabProps) {
  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      <SpecEditor projectId={projectId} metamodelId={metamodelId} />
    </div>
  );
}

export default SpecTab;
