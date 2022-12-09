/** @odoo-module */

import { PosGlobalState, register_payment_method } from "@point_of_sale/js/models";
import { PaymentIngenico, PaymentWorldline } from "@pos_iot/js/payment";
import DeviceProxy from "iot.DeviceProxy";
import PrinterProxy from "@pos_iot/js/printers";
import Registries from "@point_of_sale/js/Registries";

register_payment_method("ingenico", PaymentIngenico);
register_payment_method("worldline", PaymentWorldline);

const PosIotPosGlobalState = (PosGlobalState) =>
    class PosIotPosGlobalState extends PosGlobalState {
        constructor() {
            super(...arguments);
            // Declare the iot device objects in the constructor so that the first call
            // to update_customer_facing_display won't fail.
            this.env.proxy.iot_device_proxies = {};
            this.env.proxy.iot_boxes = [];
        }
        async _processData(loadedData) {
            await super._processData(...arguments);
            this._loadIotDevice(loadedData["iot.device"]);
            this.env.proxy.iot_boxes = loadedData["iot.box"];
        }
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
                        this.env.proxy.iot_device_proxies.scanners[device.identifier] =
                            new DeviceProxy(this, {
                                iot_ip: device.iot_ip,
                                identifier: device.identifier,
                            });
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
        }
        useIoTPaymentTerminal() {
            return (
                this.config &&
                this.config.use_proxy &&
                this.payment_methods.some(function (payment_method) {
                    return payment_method.terminal_proxy;
                })
            );
        }
    };
Registries.Model.extend(PosGlobalState, PosIotPosGlobalState);
