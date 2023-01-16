/** @odoo-module */

import { PrinterMixin } from "@point_of_sale/js/printers";
import DeviceProxy from "iot.DeviceProxy";

export const PrinterProxy = DeviceProxy.extend(PrinterMixin, {
    init: function (parent, device, pos) {
        PrinterMixin.init.call(this, pos);
        this._super(parent, device);
    },
    open_cashbox: function () {
        var self = this;
        return this.action({ action: "cashbox" })
            .then(self._onIoTActionResult.bind(self))
            .guardedCatch(self._onIoTActionFail.bind(self));
    },
    send_printing_job: function (img) {
        return this.action({
            action: "print_receipt",
            receipt: img,
        });
    },
});
