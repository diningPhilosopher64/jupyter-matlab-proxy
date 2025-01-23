from jupyter_matlab_kernel.mwi_comm_helpers import MWICommHelper
from jupyter_matlab_kernel.kernels.labextension_comm.actions import ActionFactory
from ipykernel.comm import Comm


class LabExtensionCommunication:
    def __init__(self, kernel):
        self.comm = None
        self.kernel = kernel
        self.log = kernel.log

    def comm_open(self, stream, ident, msg):
        content = msg["content"]
        comm_id = content["comm_id"]
        target_name = content["target_name"]
        self.log.info(
            f"Received comm_open message with id: {comm_id} and target_name: {target_name}"
        )
        self.comm = Comm(comm_id=comm_id, primary=False, target_name=target_name)
        self.log.info("Created communication channel with lab extension")

    async def comm_msg(self, stream, ident, msg):
        if not self.comm:
            raise Exception("No Communcation channel available")

        content = msg["content"]
        data = content["data"]
        action_type = data["action"]
        data = data["data"]

        self.log.info(
            f"Received content  is \n {content}\naction:{action_type}\ndata:{data}"
        )

        action = ActionFactory.create_action(action_type, self.kernel)
        self.log.info(f"Action to execute is {action}")

        try:
            await action.execute(self.comm, content["data"])

        except Exception as err:
            self.log.error(f"Failed to execute action with exception: {err}")

    def comm_close(self, stream, ident, msg):
        # TODO: Need to call comm close in shutdown() method ?
        content = msg["content"]
        comm_id = content["comm_id"]

        self.log.info(f"Comm closed with id: {comm_id}. Content is {content}")

        if self.comm and self.comm.comm_id == comm_id:
            self.comm = None

        else:
            self.log.warning(f"Attempted to close unknown comm_id: {comm_id}")
