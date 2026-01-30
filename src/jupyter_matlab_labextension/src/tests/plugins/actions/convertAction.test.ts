// Copyright 2025 The MathWorks, Inc.

import { ConvertAction } from '../../../plugins/actions/convertAction';
import { ActionTypes } from '../../../plugins/actions/actionTypes';
import { ICommunicationChannel } from '../../../plugins/matlabCommunication';
import { displayConversionNotification } from '../../../utils/notifications';
import { PromiseDelegate } from '@lumino/coreutils';

jest.mock('../../../utils/notifications', () => ({
    displayConversionNotification: jest.fn()
}));

const mockedDisplayConversionNotification = displayConversionNotification as jest.MockedFunction<typeof displayConversionNotification>;

describe('ConvertAction', () => {
    let action: ConvertAction;
    let mockComm: ICommunicationChannel;

    beforeEach(() => {
        jest.clearAllMocks();
        action = new ConvertAction(false);
        mockComm = {
            commId: 'test-comm-id',
            targetName: 'matlab',
            isDisposed: false,
            send: jest.fn(),
            close: jest.fn(),
            open: jest.fn(),
            onMsg: null,
            onClose: null
        } as unknown as ICommunicationChannel;
    });

    describe('constructor', () => {
        it('should set blocking to true when passed true', () => {
            const blockingAction = new ConvertAction(true);
            expect(blockingAction.blocking).toBe(true);
        });

        it('should set blocking to false when passed false', () => {
            const nonBlockingAction = new ConvertAction(false);
            expect(nonBlockingAction.blocking).toBe(false);
        });
    });

    describe('getActionName', () => {
        it('should return CONVERT action type', () => {
            expect(action.getActionName()).toBe(ActionTypes.CONVERT);
        });
    });

    describe('getGeneratedLiveCodeFilePath', () => {
        it('should return liveCodeFilePath after onMsg is called with valid data', () => {
            action.onMsg({ liveCodeFilePath: '/path/to/file.mlx' }, mockComm);

            expect(ConvertAction.getGeneratedLiveCodeFilePath()).toBe('/path/to/file.mlx');
        });
    });

    describe('execute', () => {
        it('should call displayConversionNotification with correct parameters', async () => {
            const mockPromiseDelegate = {
                promise: Promise.resolve(),
                resolve: jest.fn(),
                reject: jest.fn()
            } as unknown as PromiseDelegate<any>;

            mockedDisplayConversionNotification.mockReturnValue(mockPromiseDelegate);

            const data = { ipynbFilePath: '/path/to/notebook.ipynb', liveCodeFilePath: '/path/to/file.mlx' };
            await action.execute(data, mockComm);

            expect(mockedDisplayConversionNotification).toHaveBeenCalledWith(
                data,
                mockComm,
                50000
            );
        });

        it('should wait for promise when blocking is true', async () => {
            const blockingAction = new ConvertAction(true);
            let promiseResolved = false;

            const mockPromiseDelegate = {
                promise: new Promise<void>((resolve) => {
                    setTimeout(() => {
                        promiseResolved = true;
                        resolve();
                    }, 10);
                }),
                resolve: jest.fn(),
                reject: jest.fn()
            } as unknown as PromiseDelegate<any>;

            mockedDisplayConversionNotification.mockReturnValue(mockPromiseDelegate);

            await blockingAction.execute({}, mockComm);

            expect(promiseResolved).toBe(true);
        });
    });

    describe('onMsg', () => {
        beforeEach(() => {
            const mockPromiseDelegate = {
                promise: Promise.resolve(),
                resolve: jest.fn(),
                reject: jest.fn()
            } as unknown as PromiseDelegate<any>;
            mockedDisplayConversionNotification.mockReturnValue(mockPromiseDelegate);
        });

        it('should update liveCodeFilePath when valid data is received', async () => {
            await action.execute({}, mockComm);

            action.onMsg({ liveCodeFilePath: '/path/to/generated.mlx' }, mockComm);

            expect(ConvertAction.getGeneratedLiveCodeFilePath()).toBe('/path/to/generated.mlx');
        });

        it('should log error when error is present in data', async () => {
            const errorSpy = jest.spyOn(console, 'error').mockImplementation();

            const mockPromiseDelegate = {
                promise: Promise.resolve(),
                resolve: jest.fn(),
                reject: jest.fn()
            } as unknown as PromiseDelegate<any>;
            mockedDisplayConversionNotification.mockReturnValue(mockPromiseDelegate);

            await action.execute({}, mockComm);
            action.onMsg({ error: 'Conversion failed' }, mockComm);

            expect(errorSpy).toHaveBeenCalledWith('Received error from kernel ', 'Conversion failed');

            errorSpy.mockRestore();
        });

        it('should log error when liveCodeFilePath is missing in data', async () => {
            const errorSpy = jest.spyOn(console, 'error').mockImplementation();

            const mockPromiseDelegate = {
                promise: Promise.resolve(),
                resolve: jest.fn(),
                reject: jest.fn()
            } as unknown as PromiseDelegate<any>;
            mockedDisplayConversionNotification.mockReturnValue(mockPromiseDelegate);

            await action.execute({}, mockComm);
            action.onMsg({}, mockComm);

            expect(errorSpy).toHaveBeenCalledWith('Did not receive liveCodeFilePath in data from kernel');

            errorSpy.mockRestore();
        });

        it('should resolve blocking promise when liveCodeFilePath is received', async () => {
            const resolveFn = jest.fn();
            const mockPromiseDelegate = {
                promise: Promise.resolve(),
                resolve: resolveFn,
                reject: jest.fn()
            } as unknown as PromiseDelegate<any>;
            mockedDisplayConversionNotification.mockReturnValue(mockPromiseDelegate);

            await action.execute({}, mockComm);
            action.onMsg({ liveCodeFilePath: '/path/to/file.mlx' }, mockComm);

            expect(resolveFn).toHaveBeenCalledWith(null);
        });

        it('should reject blocking promise when error is received', async () => {
            const rejectFn = jest.fn();
            const mockPromiseDelegate = {
                promise: Promise.resolve(),
                resolve: jest.fn(),
                reject: rejectFn
            } as unknown as PromiseDelegate<any>;
            mockedDisplayConversionNotification.mockReturnValue(mockPromiseDelegate);

            await action.execute({}, mockComm);
            action.onMsg({ error: 'Some error' }, mockComm);

            expect(rejectFn).toHaveBeenCalled();
        });
    });
});
