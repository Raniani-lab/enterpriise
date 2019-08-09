odoo.define('pos_iot.chrome', function (require) {
"use strict";

var chrome = require('point_of_sale.chrome');
var core = require('web.core');
var ProxyStatusWidget = require('point_of_sale.chrome').ProxyStatusWidget;

var _t = core._t;

ProxyStatusWidget.include({
    is_printer_connected: function (printer) {
        return printer && printer.status === 'connected' && printer.printers.indexOf(this.pos.iot_device_proxies.printer._identifier) >= 0;
    },
});

chrome.Chrome.include({
    balance_button_widget: {
        'name': 'balance_button',
        'widget': chrome.HeaderButtonWidget,
        'append': '.pos-rightheader',
        'args': {
            label: _t('Send Balance'),
            action: function () {
                this.chrome._sendBalance();
            }
        }
    },

    /**
     * Instanciates the Balance button
     * 
     * @override
     */
    build_widgets: function () {
        if (this.pos.useIoTPaymentTerminal()) {
            // Place it left to the Close button
            var close_button_index = _.findIndex(this.widgets, function (widget) {
                return widget.name === "close_button";
            });
            this.widgets.splice(close_button_index, 0, this.balance_button_widget);
        }
        this._super();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Sends an action to the terminal to perform a Balance operation
     *
     * @private
     */
    _sendBalance: function () {
        var self = this;
        var terminal = this.pos.iot_device_proxies.payment;
        terminal.add_listener(self._onValueChange.bind(self));
        terminal.action({ messageType: 'Balance' })
            .then(self._onTerminalActionResult.bind(self));
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Processes the return value of an action sent to the terminal
     *
     * @param {Object} data 
     * @param {boolean} data.result
     */
    _onTerminalActionResult: function (data) {
        if (data.result === false) {
            this.pos.gui.show_popup('error', {
                'title': _t('Connection to terminal failed'),
                'body':  _t('Please check if the terminal is still connected.'),
            });
        }
    },

    /**
     * Listens for changes from the payment terminal and prints receipts
     * destined to the merchant.
     *
     * @param {Object} data
     * @param {String} data.Error
     * @param {String} data.TicketMerchant
     */
    _onValueChange: function (data) {
        if (data.Error) {
            this.pos.gui.show_popup('error', {
                'title': _t('Terminal Error'),
                'body': data.Error,
            });
        } else if (data.TicketMerchant) {
            this.pos.proxy.printer.print_receipt("<div class='pos-receipt'><div class='pos-payment-terminal-receipt'>" + data.TicketMerchant.replace(/\n/g, "<br />") + "</div></div>");
        }
        this.pos.iot_device_proxies.payment.remove_listener();
    },
});

});
