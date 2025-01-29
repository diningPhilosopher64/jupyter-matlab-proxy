// Copyright 2025 The MathWorks, Inc.

import { PromiseDelegate, ReadonlyJSONValue } from '@lumino/coreutils';

import { CommService } from '../matlabCommunicationPlugin';
import { BaseAction } from './baseAction';
import { ActionTypes } from './actionTypes';

export class StartMatlabProxyAction extends BaseAction {
    blocking: boolean;
    private static blockingPromise: PromiseDelegate<ReadonlyJSONValue> | null;

    constructor (blocking: boolean) {
        super();
        this.blocking = blocking;
    }

    public getActionName () : string {
        return ActionTypes.START_MATLAB_PROXY;
    }

    public async execute (data: any): Promise<void> {
        if (!StartMatlabProxyAction.blockingPromise) {
            StartMatlabProxyAction.blockingPromise = new PromiseDelegate<ReadonlyJSONValue>();
        }

        console.log('StartMatlab execute action called with data ', data);
        this.sendStartMatlabRequest();

        if (this.blocking) {
            console.log('This is a blocking action will wait for promise to resolve...');
            await StartMatlabProxyAction.blockingPromise.promise;
        }
    }

    public onMsg (data: any): void {
        if ('error' in data && data.error) {
            console.error('Received error from kernel ', data.error);
            if (StartMatlabProxyAction.blockingPromise) {
                StartMatlabProxyAction.blockingPromise.reject({ reason: data.error });
                StartMatlabProxyAction.blockingPromise = null;
            }
            return;
        }
        if (StartMatlabProxyAction.blockingPromise) {
            StartMatlabProxyAction.blockingPromise.resolve(null);
            StartMatlabProxyAction.blockingPromise = null;
        }

        console.log('StartMatlab action onMsg completed');
    }

    private sendStartMatlabRequest (): void {
        const comm = CommService.getService().getComm();
        if (!comm || comm.isDisposed) {
            console.error('Communication channel is not available');
            return;
        }

        comm.send({
            action: ActionTypes.START_MATLAB_PROXY,
            data: { }
        });
    }
}
