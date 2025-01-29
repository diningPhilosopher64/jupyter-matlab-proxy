# Copyright 2025 The MathWorks, Inc.

from abc import ABC, abstractmethod

# Abstract Action class which other actions are meant to implement.
class ActionCommand(ABC):
    @abstractmethod
    async def execute(self, comm, data):
        pass

    def get_code(self, *args):
        pass
