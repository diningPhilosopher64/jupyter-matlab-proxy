// Copyright 2025 The MathWorks, Inc.

import { BaseAction } from './baseAction';
import { ActionTypes } from './actionTypes';

export class ActionFactory {
    static createAction (actionType: string, blocking: boolean): BaseAction {
        switch (actionType) {
            case ActionTypes.DUMMY:
                throw new Error('Dummy action should not be called');

            default:
                throw new Error(`Unknown action type: ${actionType}`);
        }
    }
}
