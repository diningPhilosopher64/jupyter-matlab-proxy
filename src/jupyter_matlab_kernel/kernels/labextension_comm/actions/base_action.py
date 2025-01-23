from abc import ABC, abstractmethod

class ActionCommand(ABC):
    @abstractmethod
    async def execute(self, comm, data):
        pass

    def get_code(self, *args):
        pass
