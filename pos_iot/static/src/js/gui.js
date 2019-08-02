odoo.define('pos_iot.gui', function (require) {
"use strict";

var gui = require('point_of_sale.gui');

gui.Gui.include({
    /**
     * Closes the shift of the payment terminal then closes the POS session
     * 
     * @override
     */
    close: function () {
        var self = this;
        var terminal = this.pos.iot_device_proxies.payment;
        if (this.pos.usePaymentTerminal()) {
            terminal.action({ messageType: 'CloseShift' })
                .finally(self._super.bind(self));
        } else {
            this._super();
        }
    },
});
});
