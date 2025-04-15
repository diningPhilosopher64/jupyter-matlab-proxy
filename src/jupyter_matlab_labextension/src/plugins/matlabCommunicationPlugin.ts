// Copyright 2025 The MathWorks, Inc.

import {
    JupyterFrontEnd,
    JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { DocumentRegistry } from '@jupyterlab/docregistry';
import {
    INotebookModel,
    INotebookTracker,
    NotebookPanel
} from '@jupyterlab/notebook';
import { KernelMessage } from '@jupyterlab/services';
import { JSONObject, JSONValue, Token } from '@lumino/coreutils';
import { DisposableDelegate } from '@lumino/disposable';
import { NotebookInfo } from '../utils/notebook';

// Add more action types as needed
type CommunicationData = {
  action: string;
  data: JSONValue;
};

// A unique token for the comm service
export const CommunicationService = new Token<any>(
    '@mathworks/MatlabCommPlugin'
);

export interface ICommunicationChannel {
  readonly commId: string;
  readonly targetName: string;
  readonly isDisposed: boolean;
  onMsg: (msg: KernelMessage.ICommMsgMsg) => void | PromiseLike<void>;
  onClose: (msg: KernelMessage.ICommCloseMsg) => void | PromiseLike<void>;
  close: (
    data?: JSONValue,
    metadata?: JSONObject,
    buffers?: (ArrayBuffer | ArrayBufferView)[]
  ) => void;
  send: (
    data: CommunicationData,
    metadata?: JSONObject,
    buffers?: (ArrayBuffer | ArrayBufferView)[],
    disposeOnDone?: boolean
  ) => void;
}
export interface ICommunicationService {
  getComm(notebookID: string): ICommunicationChannel;
}

class MatlabCommunicationExtension
implements
    DocumentRegistry.IWidgetExtension<NotebookPanel, INotebookModel>,
    ICommunicationService {
    private _comms = new Map<string, ICommunicationChannel>();
    createNew (
        panel: NotebookPanel,
        context: DocumentRegistry.IContext<INotebookModel>
    ): DisposableDelegate {
        panel.sessionContext.ready
            .then(async () => {
                const kernel = panel.sessionContext.session?.kernel;
                // If kernel is available, create channel and set up listeners.
                if (!kernel) {
                    console.log('Kernel not ready!');
                    return new DisposableDelegate(() => {});
                }

                const notebookInfo = new NotebookInfo();
                await notebookInfo.update(panel);

                if (!notebookInfo.isMatlabNotebook()) {
                    console.log('Not a MATLAB notebook, skipping communication setup');
                    return new DisposableDelegate(() => {});
                }

                console.log('MATLAB Communication plugin activated');

                // Create a unique channel name for this notebook
                const channelName =
          'matlab_comm_' + Math.random().toString(36).substring(2);
                console.log(
                    'Attempting to create communication with the kernel using channel name',
                    channelName
                );
                const comm = kernel.createComm(channelName);

                comm.open()
                    .done.then(() => {
                        console.log('Communication channel opened successfully');
                    })
                    .catch((error) => {
                        console.error('Error opening communication channel', error);
                    });

                console.log('Comm id ', comm.commId);

                // Listen for messages from the kernel
                comm.onMsg = (msg: KernelMessage.ICommMsgMsg) => {
                    const data = msg.content.data as CommunicationData;
                    console.log('Recieved data from ', data);
                };

                // Handle comm close
                comm.onClose = (msg) => {
                    console.log('Comm closed:', msg);
                };

                // this._comm = comm;
                this._comms.set(panel.id, comm);
                console.log('Comm creawted with props ', comm.commId, comm.targetName);

                // Clean up when notebook is disposed
                panel.disposed.connect(() => {
                    this._comms.delete(panel.id);
                });
            })
            .catch((error) => {
                console.error('Notebook panel was not ready', error);
            });

        return new DisposableDelegate(() => {
            this._comms.get(panel.id)?.close();
            this._comms.delete(panel.id);
        });
    }

    getComm (notebookId: string): ICommunicationChannel {
        const commChannel = this._comms.get(notebookId);
        if (!commChannel) {
            throw new Error(
                `No communication channel found for notebook ID: ${notebookId}`
            );
        }
        return commChannel;
    }

    deleteComms (): void {
        this._comms.clear();
    }
}

export const matlabCommPlugin: JupyterFrontEndPlugin<MatlabCommunicationExtension> =
  {
      id: '@mathworks/matlabCommPlugin',
      autoStart: true,
      requires: [INotebookTracker],
      provides: CommunicationService,
      activate: (app: JupyterFrontEnd): MatlabCommunicationExtension => {
          const matlabCommExtension = new MatlabCommunicationExtension();
          app.docRegistry.addWidgetExtension('Notebook', matlabCommExtension);

          // Dispose resources created by this plugin when the page unloads.
          // Need to add this seperately if the jupyterlab tab is closed directly.
          window.addEventListener('beforeunload', () => {
              matlabCommExtension.deleteComms();
          });

          return matlabCommExtension;
      }
  };
