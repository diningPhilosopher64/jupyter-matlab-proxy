// Copyright 2025 The MathWorks, Inc.

// Abstract Action class which other actions are meant to implement.

export abstract class BaseAction {
    protected blocking: boolean = false;

    abstract execute(data: any): void;
    abstract onMsg(data: any): void;
    abstract getActionName(): string;
}
