odoo.define('pos_iot.CloseSession', function (require) {
"use static";

var core = require('web.core');
var rpc = require('web.rpc');
var widgetRegistry = require('web.widget_registry');
var Widget = require('web.Widget');
var DeviceProxy = require('iot.widgets').DeviceProxy;
var PrinterProxy = require('pos_iot.Printer');
var AbstractAction = require('web.AbstractAction');

var _t = core._t;

var CloseSession = AbstractAction.extend({
    template: 'CloseSession',
    events: {
        'click': '_onClickCloseSession',
    },

    /**
     * @override
     */
    init: function (parent, record, options) {
        var res = this._super.apply(this, arguments);
        this.attrs = options.attrs;
        this.data = record.data;
        this.loaded = this.load(this.data.config_id.res_id)
        return res;
    },

    load: function (config_id) {
        var self = this;
        return rpc.query({
            model: 'pos.config',
            method: 'read',
            args: [[config_id], ['iotbox_id', 'proxy_ip', 'iface_payment_terminal', 'iface_printer_id']]
        }).then(function (config) {
            if (config[0].iface_payment_terminal) {
                self.iot_ip = config[0].proxy_ip;
                rpc.query({
                    model: 'iot.device',
                    method: 'search_read',
                    args: [
                        [['iot_id', '=', config[0].iotbox_id[0]]],
                        ['id', 'type', 'identifier'],
                    ],
                }).then(function (devices) {
                    devices.forEach(function (device) {
                        if (config[0].iface_printer_id && device.id === config[0].iface_printer_id[0]) {
                            self.printer = new PrinterProxy({
                                iot_ip: self.iot_ip,
                                identifier: device.identifier,
                            });
                        } else if (device.type === "payment") {
                            self.terminal = new DeviceProxy({
                                iot_ip: self.iot_ip,
                                identifier: device.identifier,
                            });
                        }
                    });
                });
            }
        });
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Calls the method specified in this.action on the current pos.session
     */
    _performAction: function () {
        var self = this;
        return this._rpc({
            model: 'pos.session',
            method: this.attrs.action,
            args: [this.data.id],
        }).then(function (action) {
            if(action){
                self.do_action(action);
            } else {
                self.trigger_up('reload');
            }
        });

    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Sends a Balance operation to the terminal if needed then performs the
     * closing action.
     */
    _onClickCloseSession: function () {
        var self = this;
        this.loaded.then(function () {
            if (self.terminal) {
                self.terminal.add_listener(self._onValueChange.bind(self));
                self.terminal.action({ messageType: 'Balance' })
                    .then(self._onTerminalActionResult.bind(self));
            } else {
                self._performAction();
            }
        });
    },

    /**
     * Processes the return value of an action sent to the terminal
     *
     * @param {Object} data
     * @param {boolean} data.result
     */
    _onTerminalActionResult: function (data) {
        if (data.result === false) {
            this.do_warn(_t('Connection to terminal failed'), _t('Please check if the terminal is still connected.'));
            this.terminal.remove_listener();
        }
    },

    /**
     * Listens for changes from the payment terminal, prints receipts destined
     * to the merchant then performs the closing action.
     *
     * @param {Object} data
     * @param {String} data.Error
     * @param {String} data.TicketMerchant
     */
    _onValueChange: function (data) {
        var self = this;

        if (data.Error) {
            this.do_warn(_t('Error performing balance'), data.Error);
            return;
        } else if (data.TicketMerchant && this.printer) {
            this.printer.print_receipt("<div class='pos-receipt'><div class='pos-payment-terminal-receipt'>" + data.TicketMerchant.replace(/\n/g, "<br />") + "</div></div>");
        }
        this.terminal.remove_listener();
        this._performAction();
    },
});

widgetRegistry.add('close_session', CloseSession);

});
