// Copyright 2025 The MathWorks, Inc.

import { PromiseDelegate, ReadonlyJSONValue } from '@lumino/coreutils';

import { ICommunicationChannel } from '../matlabCommunicationPlugin';
import { BaseAction } from './baseAction';
import { ActionTypes } from './actionTypes';

export class CheckFileExistsAction extends BaseAction {
    blocking: boolean;
    private static blockingPromise: PromiseDelegate<ReadonlyJSONValue> | null;
    private static fileExists: boolean = false;

    constructor (blocking: boolean) {
        super();
        this.blocking = blocking;
    }

    public getActionName (): string {
        return ActionTypes.CHECK_FILE_EXISTS;
    }

    public static getFileExistsStatus (): boolean {
        return CheckFileExistsAction.fileExists;
    }

    public async execute (data: any, comm: ICommunicationChannel): Promise<void> {
        if (!('mlxFilePath' in data)) {
            console.error('Missing data for executing CheckFileExists action...');
            return;
        }

        if (!CheckFileExistsAction.blockingPromise) {
            CheckFileExistsAction.blockingPromise =
        new PromiseDelegate<ReadonlyJSONValue>();
        }

        if (this.sendCheckFileExistsRequest(data.mlxFilePath, comm)) {
            console.log('\n in execute ', comm);
            console.log('Successfully sent check file exists request to kernel');
        } else {
            console.error('Failed to send check file exists request to kernel');
        }

        if (this.blocking) {
            console.log(
                'CheckFileExists blocking action will wait for promise to resolve...'
            );
            await CheckFileExistsAction.blockingPromise.promise;
        }

        console.log('CheckFileExistsAction execute completed');
    }

    public onMsg (data: any, _: ICommunicationChannel): void {
        if ('error' in data && data.error) {
            console.error('Received error from kernel ', data.error);
            if (CheckFileExistsAction.blockingPromise) {
                CheckFileExistsAction.blockingPromise.reject({ reason: data.error });
                CheckFileExistsAction.blockingPromise = null;
            }
            return;
        }
        CheckFileExistsAction.fileExists = data.exists;

        if (CheckFileExistsAction.blockingPromise) {
            CheckFileExistsAction.blockingPromise.resolve(null);
            CheckFileExistsAction.blockingPromise = null;
        }

        console.log('CheckFileExistsAction onMsg completed');
    }

    private sendCheckFileExistsRequest (
        filePath: string,
        comm: ICommunicationChannel
    ): boolean {
    // const comm = CommService.getService().getComm();
        if (!comm || comm.isDisposed) {
            console.error('Communication channel is not available');
            return false;
        }

        if (!filePath) {
            console.error('File path is not available');
            return false;
        }

        comm.send({
            action: ActionTypes.CHECK_FILE_EXISTS,
            data: {
                mlxFilePath: filePath
            }
        });
        return true;
    }
}
