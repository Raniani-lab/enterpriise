/** @odoo-module */

import { PosGlobalState, Product, register_payment_method } from "@point_of_sale/js/models";
import { PaymentIngenico, PaymentWorldline } from "@pos_iot/js/payment";
import DeviceProxy from "iot.DeviceProxy";
import { PrinterProxy } from "@pos_iot/js/printers";
import { patch } from "@web/core/utils/patch";
import { ErrorPopup } from "@point_of_sale/js/Popups/ErrorPopup";
import core from "web.core";

var _t = core._t;

register_payment_method("ingenico", PaymentIngenico);
register_payment_method("worldline", PaymentWorldline);

patch(PosGlobalState.prototype, "pos_iot.PosGlobalState", {
    setup() {
        this._super(...arguments);
        // Declare the iot device objects in the setup so that the first call
        // to update_customer_facing_display won't fail.
        this.env.proxy.iot_device_proxies = {};
        this.env.proxy.iot_boxes = [];
    },
    async _processData(loadedData) {
        await this._super(...arguments);
        this._loadIotDevice(loadedData["iot.device"]);
        this.env.proxy.iot_boxes = loadedData["iot.box"];
    },
    _loadIotDevice(devices) {
        for (const device of devices) {
            if (!this.env.proxy.iot_boxes.includes(device.iot_id[0])) {
                this.env.proxy.iot_boxes.push(device.iot_id[0]);
            }
            switch (device.type) {
                case "scale":
                    this.env.proxy.iot_device_proxies[device.type] = new DeviceProxy(this, {
                        iot_ip: device.iot_ip,
                        identifier: device.identifier,
                        manual_measurement: device.manual_measurement,
                    });
                    break;
                case "fiscal_data_module":
                case "display":
                    this.env.proxy.iot_device_proxies[device.type] = new DeviceProxy(this, {
                        iot_ip: device.iot_ip,
                        identifier: device.identifier,
                    });
                    break;
                case "printer":
                    this.env.proxy.iot_device_proxies[device.type] = new PrinterProxy(this, {
                        iot_ip: device.iot_ip,
                        identifier: device.identifier,
                    });
                    break;
                case "scanner":
                    if (!this.env.proxy.iot_device_proxies.scanners) {
                        this.env.proxy.iot_device_proxies.scanners = {};
                    }
                    this.env.proxy.iot_device_proxies.scanners[device.identifier] = new DeviceProxy(
                        this,
                        {
                            iot_ip: device.iot_ip,
                            identifier: device.identifier,
                        }
                    );
                    break;
                case "payment":
                    for (const pm of this.payment_methods) {
                        if (pm.iot_device_id[0] == device.id) {
                            // TODO: manufacturer is unused. Remove it?
                            pm.terminal_proxy = new DeviceProxy(this, {
                                iot_ip: device.iot_ip,
                                identifier: device.identifier,
                                manufacturer: device.manufacturer,
                            });
                        }
                    }
                    break;
            }
        }
    },
    useIoTPaymentTerminal() {
        return (
            this.config &&
            this.config.use_proxy &&
            this.payment_methods.some(function (payment_method) {
                return payment_method.terminal_proxy;
            })
        );
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
        return this._super(...arguments) && Boolean(this.pos.env.proxy.iot_device_proxies.scale);
    },
});
