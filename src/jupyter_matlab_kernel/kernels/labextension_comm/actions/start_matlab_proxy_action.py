# Copyright 2025 The MathWorks, Inc.

from . import ActionCommand, ActionTypes

class StartMatlabProxyAction(ActionCommand):
    def __init__(self, kernel):
        self.kernel = kernel
        self.log = kernel.log

    def get_code(self):
        pass

    async def execute(self, comm, _):
        """Starts MATLAB proxy
        Args:
            comm (ipykernel.comm.Comm): IPYKernels' Commuincation object
        """
        try:
            # Start matlab-proxy only if you matlab is not assigned
            if not self.kernel.is_matlab_assigned:
                await self.kernel.start_matlab_proxy_and_comm_helper()

            self.log.info("StartMatlabProxy action successful")
            comm.send({"action": ActionTypes.START_MATLAB_PROXY.value, "error": None})

        except Exception as err:
            self.log.error(f"StartMatlabProxy action failed with error: {err}")
            comm.send(
                {"action": ActionTypes.START_MATLAB_PROXY.value, "error": str(err)}
            )
