import React from 'react';
import OCLConstraintPage from '../../../pages/OCLConstraintPage';

interface OCLTabProps {
  projectId: string;
  metamodelId: string;
}

export function OCLTab({ projectId, metamodelId }: OCLTabProps) {
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '24px 32px' }}>
      <OCLConstraintPage projectId={projectId} metamodelId={metamodelId} />
    </div>
  );
}

export default OCLTab;
