# Copyright 2025 The MathWorks, Inc.

from ipykernel.comm import Comm


class LabExtensionCommunication:
    def __init__(self, kernel):
        self.comms = {}
        self.kernel = kernel
        self.log = kernel.log

    def comm_open(self, stream, ident, msg):
        """Handler to execute when labextension sends a message with 'comm_open' type ."""
        content = msg["content"]
        comm_id = content["comm_id"]
        target_name = content["target_name"]
        self.log.debug(
            f"Received comm_open message with id: {comm_id} and target_name: {target_name}"
        )
        comm = Comm(comm_id=comm_id, primary=False, target_name=target_name)
        self.comms[comm_id] = comm
        self.log.info("Successfully created communication channel with labextension")

    async def comm_msg(self, stream, ident, msg):
        """Handler to execute when labextension sends a message with 'comm_msg' type."""

        content = msg["content"]
        data = content["data"]
        action_type = data["action"]
        data = data["data"]
        comm_id = content["comm_id"]
        comm = self.comms.get(comm_id)

        if not comm:
            self.log.error(
                "Received comm_msg but no communication channel is available"
            )
            raise Exception("No Communcation channel available")

        self.log.debug(
            f"Received action_type:{action_type} with data:{data} from the lab extension"
        )

    def comm_close(self, stream, ident, msg):
        """Handler to execute when labextension sends a message with 'comm_close' type."""
        content = msg["content"]
        comm_id = content["comm_id"]
        comm = self.comms.get(comm_id)

        if comm:
            self.log.info(f"Comm closed with id: {comm_id}")
            del self.comms[comm_id]

        else:
            self.log.warning(f"Attempted to close unknown comm_id: {comm_id}")
