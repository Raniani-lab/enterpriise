/** @odoo-module */

import { PosGlobalState, Product, register_payment_method } from "@point_of_sale/js/models";
import { PaymentIngenico, PaymentWorldline } from "@pos_iot/js/payment";
import { DeviceController } from "@iot/device_controller";
import { patch } from "@web/core/utils/patch";
import { ErrorPopup } from "@point_of_sale/js/Popups/ErrorPopup";
import { _t } from "@web/core/l10n/translation";

register_payment_method("ingenico", PaymentIngenico);
register_payment_method("worldline", PaymentWorldline);

patch(PosGlobalState.prototype, "pos_iot.PosGlobalState", {
    async _processData(loadedData) {
        await this._super(...arguments);
        this._loadIotDevice(loadedData["iot.device"]);
        this.hardwareProxy.iotBoxes = loadedData["iot.box"];
    },
    _loadIotDevice(devices) {
        const iotLongpolling = this.env.services.iot_longpolling;
        for (const device of devices) {
            // FIXME POSREF this seems like it can't work, we're pushing an id to an array of
            // objects expected to be of the form { ip, ip_url }, so this seems useless?
            if (!this.hardwareProxy.iotBoxes.includes(device.iot_id[0])) {
                this.hardwareProxy.iotBoxes.push(device.iot_id[0]);
            }
            const { deviceControllers } = this.hardwareProxy;
            const { type, identifier } = device;
            const deviceProxy = new DeviceController(iotLongpolling, device);
            if (type === "payment") {
                for (const pm of this.payment_methods) {
                    if (pm.iot_device_id[0] === device.id) {
                        pm.terminal_proxy = deviceProxy;
                    }
                }
            } else if (type === "scanner") {
                deviceControllers.scanners ||= {};
                deviceControllers.scanners[identifier] = deviceProxy;
            } else {
                deviceControllers[type] = deviceProxy;
            }
        }
    },
});

patch(Product.prototype, "pos_iot.Product", {
    async _onScaleNotAvailable() {
        await this.pos.env.services.popup.add(ErrorPopup, {
            title: _t("No Scale Detected"),
            body: _t(
                "It seems that no scale was detected.\nMake sure that the scale is connected and visible in the IoT app."
            ),
        });
    },
    get isScaleAvailable() {
        return this._super(...arguments) && Boolean(this.pos.hardwareProxy.deviceControllers.scale);
    },
});
