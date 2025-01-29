// Copyright 2025 The MathWorks, Inc.

import { PromiseDelegate, ReadonlyJSONValue } from '@lumino/coreutils';

import { CommService } from '../matlabCommunicationPlugin';
import { BaseAction } from './baseAction';
import { ActionTypes } from './actionTypes';
export class MatlabStatusAction extends BaseAction {
    private static status: any;
    blocking: boolean;
    private static blockingPromise: PromiseDelegate<ReadonlyJSONValue> | null;

    constructor (blocking: boolean) {
        super();
        this.blocking = blocking;
    }

    public static getStatus (): any {
        return MatlabStatusAction.status;
    }

    public getActionName () : string {
        return ActionTypes.MATLAB_STATUS;
    }

    public async execute (data: any): Promise<void> {
        if (!MatlabStatusAction.blockingPromise) {
            MatlabStatusAction.blockingPromise = new PromiseDelegate<ReadonlyJSONValue>();
        }

        console.log('MatlabStatusAction execute called with data ', data);
        this.fetchMatlabStatus();

        if (this.blocking) {
            console.log('This is a blocking action will wait for promise to resolve...');
            await MatlabStatusAction.blockingPromise.promise;
        }
        console.log('MatlabStatusAction execute completed');
    }

    public onMsg (data: any): void {
        console.log('Received data for matlab action from kernel ', data);
        MatlabStatusAction.status = data.matlabStatus;

        if (MatlabStatusAction.blockingPromise) {
            console.log('Resolved blocking promise...');
            MatlabStatusAction.blockingPromise.resolve(null);
            MatlabStatusAction.blockingPromise = null;
        }

        console.log('MatlabStatusAction onMsg completed');
    }

    private fetchMatlabStatus (): any {
        const comm = CommService.getService().getComm();
        if (!comm || comm.isDisposed) {
            console.error('Communication channel is not available');
            return false;
        }

        comm.send({
            action: 'matlab_status',
            data: {}
        });
    }
}
