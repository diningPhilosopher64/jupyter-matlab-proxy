// Copyright 2025 The MathWorks, Inc.

import { PromiseDelegate, ReadonlyJSONValue } from '@lumino/coreutils';

import { BaseAction } from './baseAction';
import { ActionTypes } from './actionTypes';
import { ICommunicationChannel } from '../matlabCommunicationPlugin';

export class EditAction extends BaseAction {
    blocking: boolean;
    private static blockingPromise: PromiseDelegate<ReadonlyJSONValue> | null;

    constructor (blocking: boolean) {
        super();
        this.blocking = blocking;
    }

    public getActionName (): string {
        return ActionTypes.EDIT;
    }

    public async execute (data: any, comm: ICommunicationChannel): Promise<void> {
        console.log('EditAction execute called with data ', data);

        // Send edit request to kernel only if mlxFilePath is available
        if ('mlxFilePath' in data) {
            this.sendEditRequest(data.mlxFilePath, comm);
        } else {
            const errMsg = 'mlxFilePath missing for sending edit request';
            console.error(errMsg);
            return;
        }

        if (!EditAction.blockingPromise) {
            EditAction.blockingPromise = new PromiseDelegate<ReadonlyJSONValue>();
        }

        if (this.blocking) {
            console.log(
                'This is a blocking action will wait for promise to resolve...'
            );
            await EditAction.blockingPromise.promise;
        }

        console.log('EditAction execute completed');
    }

    public onMsg (data: any, _: ICommunicationChannel): void {
        if ('error' in data && data.error) {
            console.error('Received error from kernel ', data.error);
            if (EditAction.blockingPromise) {
                EditAction.blockingPromise.reject({ reason: data.error });
            }
            return;
        }
        // Nothing to handle after sending the edit command to the kernel...
        if (EditAction.blockingPromise) {
            EditAction.blockingPromise.resolve(null);
        }

        console.log('EditAction onMsg completed');
    }

    private sendEditRequest (
        filePath: string,
        comm: ICommunicationChannel
    ): boolean {
        if (!comm || comm.isDisposed) {
            console.error('Communication channel is not available');
            return false;
        }

        if (!filePath) {
            console.error('File path is not available');
            return false;
        }

        comm.send({
            action: ActionTypes.EDIT,
            data: {
                mlxFilePath: filePath
            }
        });
        return true;
    }
}
