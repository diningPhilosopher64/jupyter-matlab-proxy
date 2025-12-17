import * as matlabModule from '../../utils/matlab';
import { PageConfig } from '@jupyterlab/coreutils';
import { ActionFactory } from '../../plugins/actions/actionFactory';
import { ActionTypes } from '../../plugins/actions/actionTypes';
import { MatlabStatusAction } from '../../plugins/actions/matlabStatusAction';
import { ConvertAction } from '../../plugins/actions/convertAction';
import {
    displayOpenMatlabNotification,
    displayStartingMatlabNotification
} from '../../utils/notifications';

// Pull named functions from module
const {
    getMatlabUrl,
    getMatlabProxyStatus,
    startMatlab,
    waitForMatlabToStart,
    convertToLiveCodeAndOpenMatlab,
    openGeneratedFileInEditor,
    convertToLiveCode,
    waitForUserToSignin,
    sendConvertRequest
} = matlabModule;

jest.mock('@jupyterlab/coreutils', () => ({
    PageConfig: {
        getBaseUrl: jest.fn()
    }
}));

jest.mock('../../plugins/actions/actionFactory', () => ({
    ActionFactory: {
        createAction: jest.fn()
    }
}));

jest.mock('../../plugins/actions/matlabStatusAction', () => ({
    MatlabStatusAction: {
        getStatus: jest.fn()
    }
}));

jest.mock('../../plugins/actions/convertAction', () => ({
    ConvertAction: {
        getGeneratedLiveCodeFilePath: jest.fn()
    }
}));

jest.mock('../../utils/notifications', () => ({
    displayOpenMatlabNotification: jest.fn(),
    displayStartingMatlabNotification: jest.fn()
}));

const mockWindowOpen = jest.fn();
(global as any).window = { open: mockWindowOpen };

const mockedGetBaseUrl = PageConfig.getBaseUrl as jest.MockedFunction<typeof PageConfig.getBaseUrl>;
const mockedCreateAction = ActionFactory.createAction as jest.MockedFunction<typeof ActionFactory.createAction>;
const mockedMatlabStatusGet = MatlabStatusAction.getStatus as jest.MockedFunction<typeof MatlabStatusAction.getStatus>;
const mockedConvertGetPath = ConvertAction.getGeneratedLiveCodeFilePath as jest.MockedFunction<typeof ConvertAction.getGeneratedLiveCodeFilePath>;
const mockedDisplayOpenMatlab = displayOpenMatlabNotification as jest.MockedFunction<typeof displayOpenMatlabNotification>;
const mockedDisplayStarting = displayStartingMatlabNotification as jest.MockedFunction<typeof displayStartingMatlabNotification>;


describe('matlab utils', () => {
    let panel: any;
    let comm: any;

    beforeEach(() => {
        jest.clearAllMocks();

        panel = {
            context: {
                path: '/home/user/notebook.ipynb'
            }
        };

        comm = {};
    });

    // =========================================================
    // getMatlabUrl
    // =========================================================
    it('getMatlabUrl builds URL using PageConfig baseUrl', () => {
        mockedGetBaseUrl.mockReturnValue('http://localhost:8888/');

        const url = getMatlabUrl();

        expect(mockedGetBaseUrl).toHaveBeenCalled();
        expect(url).toBe('http://localhost:8888/matlab/default/index.html');
    });

    // =========================================================
    // getMatlabProxyStatus
    // =========================================================
    it('getMatlabProxyStatus executes MATLAB_STATUS action and returns status', async () => {
        const actionInstance = { execute: jest.fn().mockResolvedValue(undefined) };
        const fakeStatus = { matlab: { status: 'up' }, isLicensed: true };

        mockedCreateAction.mockReturnValue(actionInstance);
        mockedMatlabStatusGet.mockReturnValue(fakeStatus);

        const result = await getMatlabProxyStatus(panel, comm);

        expect(mockedCreateAction).toHaveBeenCalledWith(
            ActionTypes.MATLAB_STATUS,
            true,
            panel
        );
        expect(actionInstance.execute).toHaveBeenCalledWith(null, comm);
        expect(result).toBe(fakeStatus);
    });

    // =========================================================
    // startMatlab
    // =========================================================
    it('startMatlab sends START_MATLAB_PROXY and then gets status', async () => {
        const startAction = { execute: jest.fn().mockResolvedValue(undefined) };
        mockedCreateAction.mockReturnValue(startAction);

        const status = { matlab: { status: 'up' } };
        const getStatusSpy = jest
            .spyOn(matlabModule, 'getMatlabProxyStatus')
            .mockResolvedValue(status as any);

        const result = await startMatlab(panel, comm);

        expect(mockedCreateAction).toHaveBeenCalledWith(
            ActionTypes.START_MATLAB_PROXY,
            true,
            panel
        );
        expect(startAction.execute).toHaveBeenCalledWith(null, comm);
        expect(getStatusSpy).toHaveBeenCalledWith(panel, comm);
        expect(result).toBe(status);
    });

    // =========================================================
    // waitForMatlabToStart
    // =========================================================
    it('waitForMatlabToStart resolves when matlab status becomes up', async () => {
        const statusAction = { execute: jest.fn().mockResolvedValue(undefined) };
        mockedCreateAction.mockReturnValue(statusAction);

        // First call: not up, Second call: up
        mockedMatlabStatusGet
            .mockReturnValueOnce({ matlab: { status: 'starting' } } as any)
            .mockReturnValueOnce({ matlab: { status: 'up' } } as any);

        const notificationDelegate = {
            resolve: jest.fn(),
            reject: jest.fn()
        } as any;

        mockedDisplayStarting.mockReturnValue(notificationDelegate);

        await waitForMatlabToStart(1, comm, panel, 100);

        expect(statusAction.execute).toHaveBeenCalledTimes(2);
        expect(notificationDelegate.resolve).toHaveBeenCalled();
        expect(notificationDelegate.reject).not.toHaveBeenCalled();
    });

    it('waitForMatlabToStart rejects when timeout reached', async () => {
        const statusAction = { execute: jest.fn().mockResolvedValue(undefined) };
        mockedCreateAction.mockReturnValue(statusAction);

        // MATLAB never up
        mockedMatlabStatusGet.mockReturnValue({ matlab: { status: 'starting' } } as any);

        const notificationDelegate = {
            resolve: jest.fn(),
            reject: jest.fn()
        } as any;

        mockedDisplayStarting.mockReturnValue(notificationDelegate);

        // use tiny timeout so test doesn't hang
        await waitForMatlabToStart(1, comm, panel, 5);

        expect(notificationDelegate.reject).toHaveBeenCalled();
    });

    // =========================================================
    // convertToLiveCode
    // =========================================================
    it('convertToLiveCode executes CONVERT action and returns generated file path', async () => {
        const convertActionInstance = { execute: jest.fn().mockResolvedValue(undefined) };
        mockedCreateAction.mockReturnValue(convertActionInstance);
        mockedConvertGetPath.mockReturnValue('/home/user/notebook.mlx');

        const result = await convertToLiveCode(panel, comm, '/home/user/notebook.mlx');

        expect(mockedCreateAction).toHaveBeenCalledWith(
            ActionTypes.CONVERT,
            true,
            panel
        );
        expect(convertActionInstance.execute).toHaveBeenCalledWith(
            {
                ipynbFilePath: '/home/user/notebook.ipynb',
                liveCodeFilePath: '/home/user/notebook.mlx'
            },
            comm
        );
        expect(result).toBe('/home/user/notebook.mlx');
    });

    // =========================================================
    // openGeneratedFileInEditor
    // =========================================================
    it('openGeneratedFileInEditor executes EDIT action with proper payload', async () => {
        const editAction = { execute: jest.fn().mockResolvedValue(undefined) };
        mockedCreateAction.mockReturnValue(editAction);

        await openGeneratedFileInEditor(panel, comm, '/home/user/notebook.mlx');

        expect(mockedCreateAction).toHaveBeenCalledWith(
            ActionTypes.EDIT,
            true,
            panel
        );
        expect(editAction.execute).toHaveBeenCalledWith(
            {
                action: ActionTypes.EDIT,
                liveCodeFilePath: '/home/user/notebook.mlx'
            },
            comm
        );
    });

    // =========================================================
    // convertToLiveCodeAndOpenMatlab
    // =========================================================
    describe('convertToLiveCodeAndOpenMatlab', () => {
        beforeEach(() => {
            jest.useFakeTimers();
            mockedGetBaseUrl.mockReturnValue('http://localhost:8888/');
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('opens MATLAB and editor when generated file path is returned and shouldOpenMatlab=true', async () => {
            // Make convertToLiveCode return a generated path
            const convertSpy = jest
                .spyOn(matlabModule, 'convertToLiveCode')
                .mockResolvedValue('/home/user/notebook.mlx');

            const openEditorSpy = jest
                .spyOn(matlabModule, 'openGeneratedFileInEditor')
                .mockResolvedValue(undefined as any);

            await convertToLiveCodeAndOpenMatlab(
                panel,
                comm,
                '/home/user/notebook.mlx',
                true
            );

            expect(convertSpy).toHaveBeenCalled();
            expect(mockedDisplayOpenMatlab).toHaveBeenCalled();
            expect(openEditorSpy).toHaveBeenCalledWith(
                panel,
                comm,
                '/home/user/notebook.mlx'
            );

            // MATLAB tab opened after timeout
            expect(mockWindowOpen).not.toHaveBeenCalled();
            jest.runAllTimers();
            expect(mockWindowOpen).toHaveBeenCalledWith(
                'http://localhost:8888/matlab/default/index.html',
                '_blank'
            );
        });

        it('does not open MATLAB when shouldOpenMatlab=false', async () => {
            const convertSpy = jest
                .spyOn(matlabModule, 'convertToLiveCode')
                .mockResolvedValue('/home/user/notebook.mlx');

            const openEditorSpy = jest
                .spyOn(matlabModule, 'openGeneratedFileInEditor')
                .mockResolvedValue(undefined as any);

            await convertToLiveCodeAndOpenMatlab(
                panel,
                comm,
                '/home/user/notebook.mlx',
                false
            );

            expect(convertSpy).toHaveBeenCalled();
            expect(mockedDisplayOpenMatlab).not.toHaveBeenCalled();
            jest.runAllTimers();
            expect(mockWindowOpen).not.toHaveBeenCalled();
            expect(openEditorSpy).toHaveBeenCalledWith(
                panel,
                comm,
                '/home/user/notebook.mlx'
            );
        });

        it('does nothing when convertToLiveCode returns falsy', async () => {
            jest.spyOn(matlabModule, 'convertToLiveCode').mockResolvedValue('' as any);

            const openEditorSpy = jest
                .spyOn(matlabModule, 'openGeneratedFileInEditor')
                .mockResolvedValue(undefined as any);

            await convertToLiveCodeAndOpenMatlab(
                panel,
                comm,
                '/home/user/notebook.mlx',
                true
            );

            expect(mockedDisplayOpenMatlab).not.toHaveBeenCalled();
            jest.runAllTimers();
            expect(mockWindowOpen).not.toHaveBeenCalled();
            expect(openEditorSpy).not.toHaveBeenCalled();
        });
    });

    // =========================================================
    // waitForUserToSignin
    // =========================================================
    it('waitForUserToSignin resolves when isLicensed becomes true', async () => {
        const statusAction = { execute: jest.fn().mockResolvedValue(undefined) };
        mockedCreateAction.mockReturnValue(statusAction);

        mockedMatlabStatusGet
            .mockReturnValueOnce({ isLicensed: false } as any)
            .mockReturnValueOnce({ isLicensed: true } as any);

        const delegate: any = {
            resolve: jest.fn(),
            reject: jest.fn()
        };

        await waitForUserToSignin(1, comm, panel, delegate as any, 100);

        expect(statusAction.execute).toHaveBeenCalledTimes(2);
        expect(delegate.resolve).toHaveBeenCalled();
        expect(delegate.reject).not.toHaveBeenCalled();
    });

    it('waitForUserToSignin rejects when timeout reached', async () => {
        const statusAction = { execute: jest.fn().mockResolvedValue(undefined) };
        mockedCreateAction.mockReturnValue(statusAction);

        mockedMatlabStatusGet.mockReturnValue({ isLicensed: false } as any);

        const delegate: any = {
            resolve: jest.fn(),
            reject: jest.fn()
        };

        await waitForUserToSignin(1, comm, panel, delegate as any, 5);

        expect(delegate.reject).toHaveBeenCalled();
    });

    // =========================================================
    // sendConvertRequest
    // =========================================================
    it('sendConvertRequest returns false and logs error when comm is invalid', () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const result1 = sendConvertRequest({ foo: 'bar' }, null as any);
        const result2 = sendConvertRequest({ foo: 'bar' }, { isDisposed: true } as any);

        expect(result1).toBe(false);
        expect(result2).toBe(false);
        expect(errorSpy).toHaveBeenCalled();

        errorSpy.mockRestore();
    });

    it('sendConvertRequest sends action and returns true when comm is valid', () => {
        const send = jest.fn();
        const commObj = { isDisposed: false, send };

        const data = { some: 'data' };
        const result = sendConvertRequest(data, commObj as any);

        expect(result).toBe(true);
        expect(send).toHaveBeenCalledWith({
            action: ActionTypes.CONVERT,
            data
        });
    });
});
