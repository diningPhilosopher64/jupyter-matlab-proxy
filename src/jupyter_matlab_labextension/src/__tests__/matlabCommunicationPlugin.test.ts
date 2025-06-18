// Copyright 2025 The MathWorks, Inc.

// Mock dependencies from JupyterLab and other modules
jest.mock('@jupyterlab/services', () => ({
  KernelMessage: {
    createMessage: jest.fn()
  }
}));

jest.mock('@jupyterlab/notebook', () => ({
  NotebookPanel: jest.fn(),
}));

jest.mock('../utils/notebook', () => ({
  NotebookInfo: jest.fn().mockImplementation(() => ({
    update: jest.fn(),
    isMatlabNotebook: jest.fn(() => true),
  })),
}));

import { MatlabCommunicationExtension } from '../plugins/matlabCommunicationPlugin';
import { NotebookPanel } from '@jupyterlab/notebook';
import { DocumentRegistry } from '@jupyterlab/docregistry';

// Begin testing MatlabCommunicationExtension
describe('MatlabCommunicationExtension', () => {
  let panel: NotebookPanel;
  let context: DocumentRegistry.IContext<any>;
  let extension: MatlabCommunicationExtension;

  beforeEach(() => {
    jest.clearAllMocks();

    const notebookInfoMock = require('../utils/notebook').NotebookInfo;
    notebookInfoMock.mockImplementation(() => ({
      update: jest.fn(),
      isMatlabNotebook: jest.fn(() => true), // Reset to true for default behavior
    }));

    // Mock NotebookPanel and context
    panel = {
      id: 'notebook-1',
      sessionContext: {
        ready: Promise.resolve(),
        session: {
          kernel: {
            createComm: jest.fn(() => ({
              commId: "test-comm-id",
              targetName: 'matlab',
              onMsg: jest.fn(),
              onClose: jest.fn(),
              open: () => ({
                done: {
                  then: jest.fn().mockImplementation((cb) => cb()),
                  catch: jest.fn().mockImplementation((cb) => cb()),
                  // catch: jest.fn(),
                },
              }),
            })),
          },
        },
      },
      disposed: {
        connect: jest.fn(),
      },
    } as unknown as NotebookPanel;

    context = {} as DocumentRegistry.IContext<any>;

    extension = new MatlabCommunicationExtension();
  });

  it('should create a new communication channel for MATLAB notebooks', async () => {
    const disposable = extension.createNew(panel, context);

    // Wait for async operations to complete
    await panel.sessionContext.ready;

    const { kernel } = panel.sessionContext.session!;

     // Wait a bit more to ensure the async then block has executed
     await new Promise(resolve => setTimeout(resolve, 0));

   
    expect(kernel?.createComm).toHaveBeenCalled();
    expect(disposable.dispose).toBeDefined();
  });

  it('should not create a communication channel for non-MATLAB notebooks', async () => {
    const notebookInfoMock = require('../utils/notebook').NotebookInfo;
    notebookInfoMock.mockImplementation(() => ({
      update: jest.fn(),
      isMatlabNotebook: jest.fn(() => false),
    }));

    const disposable = extension.createNew(panel, context);

    await panel.sessionContext.ready;

    // Ensure no channel is created
    expect(panel.sessionContext.session!.kernel!.createComm).not.toHaveBeenCalled();
    expect(disposable.dispose).toBeDefined();
  });

  it('should clean up communication channels when the panel is disposed', async () => {
    const disposable = extension.createNew(panel, context);

    await panel.sessionContext.ready;
    
    // Wait for the async operations in createNew to complete
    await new Promise(resolve => setTimeout(resolve, 10));

    // Verify that a comm was created and stored
    // (We need to check this before disposal since getComm throws if not found)
    const { kernel } = panel.sessionContext.session!;
    expect(kernel?.createComm).toHaveBeenCalled();

    // Simulate panel disposal by calling the disposal callback that was connected
    // The panel.disposed.connect mock should have been called with a callback
    expect(panel.disposed.connect).toHaveBeenCalled();
    const disposalCallback = (panel.disposed.connect as jest.Mock).mock.calls[0][0];
    disposalCallback(); // Trigger the disposal

    // After disposal, the comm should be cleaned up
    expect(() => extension.getComm(panel.id)).toThrow();
    expect(disposable.dispose).toBeDefined();
  });

  it('should throw an error if getComm is called with an invalid notebook ID', async () => {
    // First, create a communication channel for a valid notebook
    extension.createNew(panel, context);
    await panel.sessionContext.ready;
    await new Promise(resolve => setTimeout(resolve, 0));

    // Verify that the valid notebook ID works (doesn't throw)
    expect(() => extension.getComm(panel.id)).not.toThrow();

    // Now test that an invalid ID throws the expected error
    expect(() => extension.getComm('invalid-id')).toThrowError(
      'No communication channel found for notebook ID: invalid-id'
    );
  });

  // it('should delete all communication channels during cleanup', () => {
  //   extension.deleteComms();
  //   expect(() => extension.getComm(panel.id)).toThrowError();
  // });
});