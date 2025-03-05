// Copyright 2025 The MathWorks, Inc.

import { PromiseDelegate, ReadonlyJSONValue } from '@lumino/coreutils';
import { Notification } from '@jupyterlab/apputils';
import { ICommunicationChannel } from '../matlabCommunicationPlugin';
import { BaseAction } from './baseAction';
import { ActionTypes } from './actionTypes';

export class ConvertAction extends BaseAction {
    blocking: boolean;
    private static blockingPromise: PromiseDelegate<ReadonlyJSONValue> | null;

    constructor (blocking: boolean) {
        super();
        this.blocking = blocking;
    }

    public getActionName () : string {
        return ActionTypes.CONVERT;
    }

    public async execute (data: any, comm: ICommunicationChannel): Promise<void> {
        if (!('action' in data) || data.action !== 'convert' || !('ipynbFilePath' in data) || !('mlxFilePath' in data)) {
            console.error('action, ipynbFilePath or mlxFilePath missing in data:', data);
            return;
        }

        const timeout = 50000;
        if (!ConvertAction.blockingPromise) {
            ConvertAction.blockingPromise = new PromiseDelegate<ReadonlyJSONValue>();
        }

        Notification.promise(ConvertAction.blockingPromise.promise, {
            pending: {
                message: (() : string => {
                    if (this.sendConvertRequest(data.ipynbFilePath, data.mlxFilePath, comm)) {
                        console.log('Successfully sent convert request to MATLAB');
                    } else {
                        console.error('Failed to send convert request to MATLAB');
                    }

                    setTimeout(() => {
                        // If the conversion takes more than 50000ms, throw error
                        if (ConvertAction.blockingPromise) {
                            ConvertAction.blockingPromise.reject({ reason: 'Conversion process timed out' });
                        }
                    }, timeout);

                    return 'Waiting for conversion to complete...';
                })(),
                options: { autoClose: false }
            },
            success: {
                message: (): string => {
                    ConvertAction.blockingPromise = null;
                    return 'Conversion successful';
                },
                options: { autoClose: 3000 }
            },
            error: { message: () => 'Failed conversion' }
        });

        if (this.blocking) {
            console.log('This is a blocking action will wait for promise to resolve...');
            await ConvertAction.blockingPromise.promise;
        }
        console.log('ConvertAction execute completed');
    }

    public onMsg (data: any, _: ICommunicationChannel): void {
        if ('error' in data && data.error) {
            console.error('Received error from kernel ', data.error);
            if (ConvertAction.blockingPromise) {
                ConvertAction.blockingPromise.reject(new Error(data.error));
                ConvertAction.blockingPromise = null;
            }
            return;
        }

        // Resolve the promise to update the Notification on the UI to 'success' state.
        if ('mlxFilePath' in data) {
            if (ConvertAction.blockingPromise) {
                console.log('mlxFilePath in data. resolving promise..');
                // The promise resolved here will allow the execute() function to complete
                ConvertAction.blockingPromise.resolve(null);

                // Set this to null inorder to not reject the promise after timeout.
                ConvertAction.blockingPromise = null;
            }
        } else {
            const errMsg = 'Did not receive mlxFilePath in data from kernel';
            console.error(errMsg);
            if (ConvertAction.blockingPromise) {
                ConvertAction.blockingPromise.reject(new Error(errMsg));
                ConvertAction.blockingPromise = null;
            }
        }

        console.log('ConvertAction onMsg completed');
    }

    private sendConvertRequest (ipynbFilePath: string, mlxFilePath: string, comm:ICommunicationChannel): boolean {
        if (!comm || comm.isDisposed) {
            console.error('Communication channel is not available');
            return false;
        }

        if (!ipynbFilePath) {
            console.error('File path is not available');
            return false;
        }

        comm.send({
            action: 'convert',
            data: {
                ipynbFilePath,
                mlxFilePath
            }
        });
        return true;
    }
}
