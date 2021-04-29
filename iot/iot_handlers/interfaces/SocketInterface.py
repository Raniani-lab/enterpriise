import logging
import socket

from odoo import _
from odoo.addons.hw_drivers.interface import Interface

_logger = logging.getLogger(__name__)

socket_devices = {}

class SocketInterface(Interface):
    connection_type = 'socket'

    def __init__(self):
        super().__init__()
        self.open_socket(9000)

    def open_socket(self, port):
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.sock.bind(('', port))
        self.sock.listen()

    def get_devices(self):
        try:
            dev, addr = self.sock.accept()
            if addr and addr[0] not in socket_devices:
                socket_devices[addr[0]] = type('', (), {'dev': dev})
            return socket_devices
        except OSError:
            pass
