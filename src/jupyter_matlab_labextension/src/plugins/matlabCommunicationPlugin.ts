// Copyright 2025 The MathWorks, Inc.

import {
    JupyterFrontEnd,
    JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { DocumentRegistry } from '@jupyterlab/docregistry';
import { INotebookModel, NotebookPanel, INotebookTracker } from '@jupyterlab/notebook';
import { KernelMessage } from '@jupyterlab/services';
import { JSONObject, JSONValue, Token } from '@lumino/coreutils';
import { DisposableDelegate } from '@lumino/disposable';
import { ActionFactory } from './actions/actionFactory';

// Add more action types as needed
  type CommunicationData = {
    action: string;
    data: JSONValue;
  };

// A unique token for the comm service
export const ICommService = new Token<any>('@mathworks/MatlabCommPlugin');

// Dispose resources created by this plugin when the page unloads.
// Need to add this seperately if the jupyterlab tab is closed directly.
window.addEventListener('beforeunload', () => {
    disposeResources();
});

class MatlabCommunicationExtension implements DocumentRegistry.IWidgetExtension<NotebookPanel, INotebookModel> {
    createNew (panel: NotebookPanel, context: DocumentRegistry.IContext<INotebookModel>): DisposableDelegate {
        panel.sessionContext.ready.then(() => {
            const kernel = panel.sessionContext.session?.kernel;
            // If kernel is available, create channel and set up listeners.
            if (!kernel) {
                console.log('Kernel not ready!');
                return new DisposableDelegate(() => {});
            }
            // Create a unique channel name for this notebook
            const channelName = 'matlab_comm_' + Math.random().toString(36).substring(2);
            console.log('Attempting to create communication with the kernel using channel name', channelName);
            const comm = kernel.createComm(channelName);

            comm.open().done.then(() => {
                console.log('Communication channel opened successfully');
            }).catch(error => {
                console.error('Error opening communication channel', error);
            });

            // Listen for messages from the kernel
            comm.onMsg = (msg: KernelMessage.ICommMsgMsg) => {
                const data = msg.content.data as CommunicationData;
                console.log('Recieved data from ', data);

                const actionType = data!.action as string;
                const action = ActionFactory.createAction(actionType, false);

                // Execute onMsg handler for the current action after receiving the response from the kernel
                action.onMsg(data);
            };

            // Handle comm close
            comm.onClose = (msg) => {
                console.log('Comm closed:', msg);
            };

            const commService = CommService.getService();
            commService.setComm(comm);

            return new DisposableDelegate(() => {
                disposeResources();
            });
        }).catch(error => {
            console.error('Notebook panel was not ready', error);
        });

        return new DisposableDelegate(() => {
            disposeResources();
        });
    }
}

// TODO: Have a similar method as a part of the plugin so that it can be called in index.ts once while iterating
// over list of plugins.
function disposeResources () {
    const commService = CommService.getService();
    commService.getComm()?.close();
    commService.setComm(null);
}

export const matlabCommPlugin: JupyterFrontEndPlugin<void> = {
    id: '@mathworks/matlabCommPlugin',
    autoStart: true,
    requires: [INotebookTracker],
    provides: ICommService,
    activate: (app: JupyterFrontEnd, notebooks: INotebookTracker) => {
        const matlabCommExtension = new MatlabCommunicationExtension();
        app.docRegistry.addWidgetExtension('Notebook', matlabCommExtension);
        console.log('MATLAB Communication plugin activated');
    }
};

// Defining a common interface
export interface ICommunication {
    readonly commId: string;
    readonly targetName: string;
    readonly isDisposed: boolean;
    onMsg: (msg: KernelMessage.ICommMsgMsg) => void | PromiseLike<void>;
    onClose: (msg: KernelMessage.ICommCloseMsg) => void | PromiseLike<void>;
    close: (data?: JSONValue, metadata?: JSONObject, buffers?: (ArrayBuffer | ArrayBufferView)[]) => void;
    send: (data: CommunicationData, metadata?: JSONObject, buffers?: (ArrayBuffer | ArrayBufferView)[], disposeOnDone?: boolean) => void;
  }

export class CommService {
    // eslint-disable-next-line no-use-before-define
    private static instance: CommService;
    private _comm: ICommunication | null = null;

    public static getService (): CommService {
        if (!CommService.instance) {
            CommService.instance = new CommService();
        }
        return CommService.instance;
    }

    public setComm (comm: ICommunication | null): void {
        this._comm = comm;
    }

    public getComm (): ICommunication | null {
        return this._comm;
    }
}
