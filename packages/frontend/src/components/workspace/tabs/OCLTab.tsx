import OCLConstraintPage from '../../../pages/OCLConstraintPage';

interface OCLTabProps {
  projectId: string;
  metamodelId: string;
}

export function OCLTab({ projectId, metamodelId }: OCLTabProps) {
  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      <OCLConstraintPage projectId={projectId} metamodelId={metamodelId} />
    </div>
  );
}

export default OCLTab;
