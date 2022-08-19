/** @odoo-module **/

import { registry } from '@web/core/registry';
import { formView } from "@web/views/form/form_view";
import { FormController } from '@web/views/form/form_controller';
import { useService } from '@web/core/utils/hooks';
import { WarningDialog } from '@web/core/errors/error_dialogs';
import { DeviceController } from '../device_controller';

class IoTDeviceFormController extends FormController {
    setup() {
        super.setup();
        this.orm = useService('orm');
        this.iotLongpolling = useService('iot_longpolling');
    }
    /**
     * NOTE: Can't set the value of iotDevice in the constructor
     * because this.model.root is not yet set.
     */
    get iotDevice() {
        if (!this._iotDevice) {
            this._iotDevice = new DeviceController(this.iotLongpolling, {
                iot_ip: this.model.root.data.iot_ip,
                identifier: this.model.root.data.identifier,
            });
        }
        return this._iotDevice;
    }
    /**
     * @override
     */
    async save() {
        if (['keyboard', 'scanner'].includes(this.model.root.data.type)) {
            const data = await this.updateKeyboardLayout();
            if (data.result !== true) {
                this.dialogService.add(WarningDialog, {
                    title: this.env._t('Connection to device failed'),
                    message: this.env._t('Check if the device is still connected'),
                });
                // Original logic doesn't call super when reaching this branch.
                return;
            }
        } else if (this.model.root.data.type === 'display') {
            await this.updateDisplayUrl();
        }
        return super.save(...arguments);
    }
    /**
     * Send an action to the device to update the keyboard layout
     */
    async updateKeyboardLayout() {
        const keyboard_layout = this.model.root.data.keyboard_layout;
        const is_scanner = this.model.root.data.is_scanner;
        // IMPROVEMENT: Perhaps combine the call to update_is_scanner and update_layout in just one remote call to the iotbox.
        this.iotDevice.action({ action: 'update_is_scanner', is_scanner });
        if (keyboard_layout) {
            const [keyboard] = await this.orm.read('iot.keyboard.layout', [keyboard_layout[0]], ['layout', 'variant']);
            return this.iotDevice.action({
                action: 'update_layout',
                layout: keyboard.layout,
                variant: keyboard.variant,
            });
        } else {
            return this.iotDevice.action({ action: 'update_layout' });
        }
    }
    /**
     * Send an action to the device to update the screen url
     */
    updateDisplayUrl() {
        const display_url = this.model.root.data.display_url;
        return this.iotDevice.action({ action: 'update_url', url: display_url });
    }
}

export const iotDeviceFormView = {
    ...formView,
    Controller: IoTDeviceFormController,
};

registry.category('views').add('iot_device_form', iotDeviceFormView);
