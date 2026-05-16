import { BrowserRouter, Routes, Route, useParams, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { WorkspaceProvider, useWorkspace } from './hooks/useWorkspace';
import { WorkspaceLayout } from './layouts/WorkspaceLayout';
import ToastProvider from './components/ToastProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import './App.css';

/**
 * Deep-link handler: when the user navigates to a specific URL
 * (e.g., /projects/:pid/metamodels/:mmid/edit), we open the
 * corresponding tab in the workspace.
 */
function DeepLinkRouter() {
  const { pid, mmid } = useParams<{ pid: string; mmid: string }>();
  const workspace = useWorkspace();

  useEffect(() => {
    if (pid && mmid) {
      workspace.setContext(pid, mmid);
      workspace.openTab({
        type: 'diagram',
        title: 'Diagram',
        projectId: pid,
        metamodelId: mmid,
        dirty: false,
        closable: true,
      });
    }
  }, [pid, mmid]); // eslint-disable-line react-hooks/exhaustive-deps

  return <WorkspaceLayout />;
}

function DeepLinkOCL() {
  const { pid, mmid } = useParams<{ pid: string; mmid: string }>();
  const workspace = useWorkspace();

  useEffect(() => {
    if (pid && mmid) {
      workspace.setContext(pid, mmid);
      workspace.openTab({
        type: 'ocl',
        title: 'OCL Constraints',
        projectId: pid,
        metamodelId: mmid,
        dirty: false,
        closable: true,
      });
    }
  }, [pid, mmid]); // eslint-disable-line react-hooks/exhaustive-deps

  return <WorkspaceLayout />;
}

function DeepLinkCode() {
  const { pid, mmid } = useParams<{ pid: string; mmid: string }>();
  const workspace = useWorkspace();

  useEffect(() => {
    if (pid && mmid) {
      workspace.setContext(pid, mmid);
      workspace.openTab({
        type: 'codegen',
        title: 'Code Generation',
        projectId: pid,
        metamodelId: mmid,
        dirty: false,
        closable: true,
      });
    }
  }, [pid, mmid]); // eslint-disable-line react-hooks/exhaustive-deps

  return <WorkspaceLayout />;
}

function DeepLinkModels() {
  const { pid, mmid } = useParams<{ pid: string; mmid: string }>();
  const workspace = useWorkspace();

  useEffect(() => {
    if (pid && mmid) {
      workspace.setContext(pid, mmid);
      workspace.openTab({
        type: 'models',
        title: 'Models',
        projectId: pid,
        metamodelId: mmid,
        dirty: false,
        closable: true,
      });
    }
  }, [pid, mmid]); // eslint-disable-line react-hooks/exhaustive-deps

  return <WorkspaceLayout />;
}

/**
 * Deep-link handler for model editing: opens a 'model-editor' tab
 * with the specific model ID from the URL.
 */
function DeepLinkModelEditor() {
  const { pid, mmid, modelId } = useParams<{ pid: string; mmid: string; modelId: string }>();
  const workspace = useWorkspace();

  useEffect(() => {
    if (pid && mmid && modelId) {
      workspace.setContext(pid, mmid);
      workspace.openTab({
        type: 'model-editor',
        title: 'Model Editor',
        projectId: pid,
        metamodelId: mmid,
        modelId,
        dirty: false,
        closable: true,
      });
    }
  }, [pid, mmid, modelId]); // eslint-disable-line react-hooks/exhaustive-deps

  return <WorkspaceLayout />;
}

function DeepLinkSpec() {
  const { pid, mmid } = useParams<{ pid: string; mmid: string }>();
  const workspace = useWorkspace();

  useEffect(() => {
    if (pid && mmid) {
      workspace.setContext(pid, mmid);
      workspace.openTab({
        type: 'spec',
        title: 'Graphical Spec',
        projectId: pid,
        metamodelId: mmid,
        dirty: false,
        closable: true,
      });
    }
  }, [pid, mmid]); // eslint-disable-line react-hooks/exhaustive-deps

  return <WorkspaceLayout />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <ToastProvider>
          <WorkspaceProvider>
            <Routes>
              {/* Deep links for backward compatibility */}
              <Route path="/projects/:pid/metamodels/:mmid/edit" element={<DeepLinkRouter />} />
              <Route path="/projects/:pid/metamodels/:mmid/models/:modelId/edit" element={<DeepLinkModelEditor />} />
              <Route path="/projects/:pid/metamodels/:mmid/constraints" element={<DeepLinkOCL />} />
              <Route path="/projects/:pid/metamodels/:mmid/templates" element={<DeepLinkCode />} />
              <Route path="/projects/:pid/metamodels/:mmid/models" element={<DeepLinkModels />} />
              <Route path="/projects/:pid/metamodels/:mmid/specs" element={<DeepLinkSpec />} />
              <Route path="/projects/:pid/metamodels/:mmid/specs/:specId" element={<DeepLinkSpec />} />

              {/* Default: workspace with welcome tab */}
              <Route path="*" element={<WorkspaceLayout />} />
            </Routes>
          </WorkspaceProvider>
        </ToastProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
