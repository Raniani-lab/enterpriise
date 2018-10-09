import evdev
from odoo.addons.hw_drivers.controllers.driver import USBDriver

class KeyboardUSBDriver(USBDriver):

    def supported(self):
        for cfg in self.dev:
            for itf in cfg:
                if itf.bInterfaceClass == 3 and itf.bInterfaceProtocol == 1:
                    return True
        return (getattr(self.dev, 'idVendor') == 0x046d and getattr(self.dev, 'idProduct') == 0xc31c) or (getattr(self.dev, 'idVendor') == 0x413d and getattr(self.dev, 'idProduct') == 0x2107)

    def value(self):
        return self.value

    def run(self):
        devices = [evdev.InputDevice(path) for path in evdev.list_devices()]
        for device in devices:
            if (self.dev.idVendor == device.info.vendor) and (self.dev.idProduct == device.info.product):
                path = device.path
        device = evdev.InputDevice(path)

        for event in device.read_loop():
            if event.type == evdev.ecodes.EV_KEY:
                data = evdev.categorize(event)
                if data.scancode == 96:
                    return {}
                elif data.scancode == 28:
                    self.value = ''
                elif data.keystate:
                    self.value += data.keycode.replace('KEY_','')
                    self.ping_value = data.keycode.replace('KEY_','')

    def action(self, action):
        pass