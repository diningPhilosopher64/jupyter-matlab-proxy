from . import ActionCommand

class UnknownAction(ActionCommand):
    def __init__(self, kernel):
        self.kernel = kernel
        self.log = kernel.log

    def get_code(self):
        pass

    async def execute(self, mwi_comm_helper, comm, data):
        raise Exception("Unknown action")
