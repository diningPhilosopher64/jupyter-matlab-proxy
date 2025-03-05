// Copyright 2025 The MathWorks, Inc.

import { ICommunicationChannel } from '../matlabCommunicationPlugin';

// Abstract Action class which other actions are meant to implement.

export abstract class BaseAction {
    protected blocking: boolean = false;

    abstract execute(data: any, comm: ICommunicationChannel): void;
    abstract onMsg(data: any, comm: ICommunicationChannel): void;
    abstract getActionName(): string;
}
