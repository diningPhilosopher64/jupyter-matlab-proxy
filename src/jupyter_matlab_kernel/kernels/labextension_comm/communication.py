# Copyright 2025 The MathWorks, Inc.

from jupyter_matlab_kernel.kernels.labextension_comm.actions import ActionFactory
from ipykernel.comm import Comm


class LabExtensionCommunication:
    def __init__(self, kernel):
        self.comm = None
        self.kernel = kernel
        self.log = kernel.log

    def comm_open(self, stream, ident, msg):
        """Handler to execute when labextension sends a message with 'comm_open' type ."""
        content = msg["content"]
        comm_id = content["comm_id"]
        target_name = content["target_name"]
        self.log.info(
            f"Received comm_open message with id: {comm_id} and target_name: {target_name}"
        )
        self.comm = Comm(comm_id=comm_id, primary=False, target_name=target_name)
        self.log.info("Successfully created communication channel with labextension")

    async def comm_msg(self, stream, ident, msg):
        """Handler to execute when labextension sends a message with 'comm_msg' type."""
        if not self.comm:
            self.log.error(
                "Received comm_msg but no communication channel is available"
            )
            raise Exception("No Communcation channel available")

        content = msg["content"]
        data = content["data"]
        action_type = data["action"]
        data = data["data"]

        self.log.debug(
            f"Received action_type:{action_type} with data:{data} from the lab extension"
        )

        action = ActionFactory.create_action(action_type, self.kernel)
        self.log.debug(f"Action to execute is {action.__class__.__name__}")

        try:
            await action.execute(self.comm, content["data"])

        except Exception as err:
            self.log.error(f"Failed to execute action with exception: {err}")

    def comm_close(self, stream, ident, msg):
        """Handler to execute when labextension sends a message with 'comm_close' type."""
        content = msg["content"]
        comm_id = content["comm_id"]

        self.log.info(f"Comm closed with id: {comm_id}. Content is {content}")

        if self.comm and self.comm.comm_id == comm_id:
            self.comm = None

        else:
            self.log.warning(f"Attempted to close unknown comm_id: {comm_id}")
