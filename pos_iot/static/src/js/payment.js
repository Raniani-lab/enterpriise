odoo.define('pos_iot.payment', function (require) {
    "use strict";

var models = require('point_of_sale.models');
var core = require('web.core');
var screens = require('point_of_sale.screens');
var round_pr = require('web.utils').round_precision;

var _t = core._t;

models.load_fields('pos.payment.method', 'use_payment_terminal');

/** Payment Line
 *
 * @include
 */
var _pl_proto = models.Paymentline.prototype;
models.Paymentline = models.Paymentline.extend({
    /**
     * @override
     */
    initialize: function() {
        _pl_proto.initialize.apply(this, arguments);
        this.ticket = '';
    },
    /**
     * returns {string} payment status.
     */
    get_payment_status: function() {
        return this.payment_status;
    },

    /**
     * Set the new payment status .
     *
     * @param {string} value - new status.
     */
    set_payment_status: function(value) {
        this.payment_status = value;
    },
});

/** PoS Order
 *
 * @include
 */
models.Order = models.Order.extend({
    /**
     * Retrive the paymentline with the specified cid
     *
     * @param {String} cid 
     */
    get_paymentline: function (cid) {
        var lines = this.get_paymentlines();
        return lines.find(function (line) {
            return line.cid === cid;
        });
    },
    /**
     * @override
     * Only account the payment lines with status `done` to check if the order is fully payd.
     */
    get_total_paid: function() {
        return round_pr(this.paymentlines.reduce((function(sum, paymentLine) {
            if (paymentLine.get_payment_status()) {
                if (['done'].includes(paymentLine.get_payment_status())) {
                    sum += paymentLine.get_amount();
                }
            } else {
                sum += paymentLine.get_amount();
            }
            return sum;
        }), 0), this.pos.currency.rounding);
    },
    /**
     * Stops a payment on the terminal if one is running
     */
    stop_payment: function () {
        var lines = this.get_paymentlines();
        var line = lines.find(function (line) {
            var status = line.get_payment_status();
            return status && !['done', 'reversed', 'reversing', 'pending', 'retry'].includes(status);
        });
        if (line) {
            line.set_payment_status('waitingCancel');
            this.pos.gui.screen_instances.payment.send_payment_cancel();
        }
    },
});

/** Paymentscreen Widget
 *
 * @include
 */
screens.PaymentScreenWidget.include({
    /**
     * @override
     * link the proper functions to buttons for payment terminals
     * send_payment_request, Force_payment_done and cancel_payment.
     */
    render_paymentlines: function() {
        var self = this;
        this._super();
        var order = this.pos.get_order();
        if (!order) {
            return;
        }
        this.$el.find('.send_payment_request').click(function () {
            var line = self.pos.get_order().get_paymentline($(this).data('cid'));
            self.send_payment_request($(this).data('cid'));
            line.set_payment_status('waiting');
            self.render_paymentlines();
            self.payment_timer = setTimeout ( function () {
                line.set_payment_status('timeout');
            }, 8000);
            self.query_terminal();
        });
        this.$el.find('.send_payment_cancel').click(function () {
            var line = self.pos.get_order().get_paymentline($(this).data('cid'));
            self.send_payment_cancel();
            line.set_payment_status('waitingCancel');
            clearTimeout(self.payment_timer);
            self.render_paymentlines();
        });
        this.$el.find('.send_force_done').click(function () {
            var line = self.pos.get_order().get_paymentline($(this).data('cid'));
            line.set_payment_status('done');
            clearTimeout(self.payment_timer);
            self.order_changes();
            self.render_paymentlines();
        });
        this.$el.find('.send_payment_reverse').click(function () {
            var line = self.pos.get_order().get_paymentline($(this).data('cid'));
            self.send_payment_reverse($(this).data('cid'));
            line.set_payment_status('reversing');
            self.render_paymentlines();
            self.query_terminal();
        });
    },
    /**
     * Queries the status of the current payment after 3 seconds if no update
     * has been received. If an update has been received, the time should be
     * reset.
     */
    query_terminal: function () {
        var self = this;
        this.payment_update = setTimeout(function () {
            self.terminal.action({messageType: 'QueryStatus'});
        }, 3000);
    },
    /**
     * @override
     * If the selected payment method is linked to a payment terminal with an active payment line
     * linked to it, An error should be shown.
     */
    click_paymentmethods: function(id) {
        if (this.pos.get_order().get_paymentlines()
                .some(function(pl) {
                    if (pl.payment_status) {
                        return !['done', 'reversed'].includes(pl.payment_status);
                    }
                })) {
            this.gui.show_popup('error',{
                'title': _t('Error'),
                'body':  _t('There is already an electronic payment in progress.'),
            });
        } else {
            this._super(id);
            if (this.pos.payment_methods_by_id[id].use_payment_terminal === true) {
                if (this.pos.iot_device_proxies['payment']) {
                    this.terminal = this.pos.iot_device_proxies['payment'];
                    this.pos.get_order().selected_paymentline.set_payment_status('pending');
                } else {
                    this._showErrorConfig();
                }
            }
            this.render_paymentlines();
            this.order_changes();
        }
    },
    /**
     * @override
     * After closing the payment screen, stop longpolling.
     */
    close: function() {
        this._super();
        clearTimeout(this.payment_timer);
        this.pos.get_order().stop_payment();
    },
    /**
     *
     * @override
     */
    watch_order_changes: function () {
        if (this.old_order) {
            this.old_order.stop_payment();
        }
        this._super();
    },
    /**
     * @override
     * Disable changing amount on paymentlines with running or done payments on a Payment Terminal.
     */
    payment_input: function(input) {
        if (!this.terminal || 
            !['done', 'force_done', 'waitingCard', 'waiting', 'reversing', 'reversed'].includes(this.pos.get_order().selected_paymentline.get_payment_status())) {
            this._super(input);
        }
    },
    /**
     * @override
     * If an paymentline with a payment terminal linked to it is removed, the terminal should get a
     * cancel request.
     */
    click_delete_paymentline: function(cid) {
        var lines = this.pos.get_order().get_paymentlines();
        for ( var i = 0; i < lines.length; i++ ) {
            if (lines[i].cid === cid && ['waitingCard', 'timeout'].includes(lines[i].get_payment_status())) {
                // When a user deletes a payment line that wasn't started, we
                // don't need to send the cancel command. If other payments are
                // being processed, they won't be canceled.
                this.send_payment_cancel();
                clearTimeout(this.payment_timer);
            }
        }
        this._super(cid);
    },
    /**
     * Function ran when Device status changes.
     *
     * @param {Object} data.Response
     * @param {Object} data.Stage
     * @param {Object} data.Ticket
     * @param {Object} data.device_id
     * @param {Object} data.owner
     * @param {Object} data.session_id
     * @param {Object} data.value
     */
    _onValueChange: function (order, data) {
        clearTimeout(this.payment_update);
        var line = order.get_paymentline(data.cid);
        if (data.owner && data.owner !== this.pos.iot_device_proxies.payment._iot_longpolling._session_id) {
            return;
        }
        if (line && data.Response === 'Approved') {
            line.set_payment_status('done');
            clearTimeout(this.payment_timer);
            this.order_changes();
            this.terminal.remove_listener();
            if (line && data.Reversal) {
                line.reversal = true;
            }
        } else if (line && data.Stage === 'WaitingForCard' && line.get_payment_status() !== 'waitingCancel') {
            line.set_payment_status('waitingCard');
        } else if (line && data.Response === 'Reversed') {
            line.set_payment_status('reversed');
            line.set_amount(0);
            this.order_changes();
            this.terminal.remove_listener();
        } else if (line && data.Error) {
            if (line.get_payment_status() !== 'waitingCancel') {
                this.gui.show_popup('error',{
                    'title': _t('Payment terminal error'),
                    'body':  _t(data.Error),
                });
            }
            this.terminal.remove_listener();
            if (line.get_payment_status() === 'reversing') {
                line.set_payment_status('done');
            } else {
                line.set_payment_status('retry');
            }
        } else if (line && data.Stage !== 'WaitingForCard') {
            if (['timeout', 'waitingCard', 'waitingCancel'].includes(line.get_payment_status())) {
                this.terminal.remove_listener();
                line.set_payment_status('retry');
            }
        }
        if (line && data.processing) {
            this.query_terminal();
        }
        if (data.Ticket) {
            line.ticket += data.Ticket.replace(/\n/g, "<br />");
        }
        if (data.TicketMerchant && this.pos.proxy.receipt) {
            this.pos.proxy.printer.print_receipt("<div class='pos-receipt'><div class='pos-payment-terminal-receipt'>" + data.TicketMerchant.replace(/\n/g, "<br />") + "</div></div>");
        }
        this.render_paymentlines();
    },
    send_payment_request: function (cid) {
        this.terminal.add_listener(this._onValueChange.bind(this, this.pos.get_order()));
        this.pos.get_order().get_paymentlines().forEach(function (line) {
            // Other payment lines cannot be reversed anymore
            line.reversal = false;
        });
        var data = {
            messageType: 'Transaction',
            TransactionID: parseInt(this.pos.get_order().uid.replace(/-/g, '')),
            cid: cid,
            amount: Math.round(this.pos.get_order().get_paymentline(cid).amount*100),
            currency: this.pos.currency.name,
            language: this.pos.user.lang.split('_')[0],
        };
        this.send_request(data);
    },
    send_payment_cancel: function () {
        var data = {
            messageType: 'Cancel',
            reason: 'manual'
        };
        this.send_request(data);
    },
    send_payment_reverse: function (cid) {
        this.terminal.add_listener(this._onValueChange.bind(this, this.pos.get_order()));
        var data = {
            messageType: 'Reversal',
            TransactionID: parseInt(this.pos.get_order().uid.replace(/-/g, '')),
            cid: cid,
            amount: Math.round(this.pos.get_order().get_paymentline(cid).amount*100),
            currency: this.pos.currency.name,
        };
        this.send_request(data);
    },
    send_request: function (data) {
        var self = this;
        this.terminal.action(data)
            .then(self._onActionResult.bind(self))
            .guardedCatch(self._onActionFail.bind(self));
    },
    _onActionResult: function (data) {
        if (data.result === false) {
            this.gui.show_popup('error',{
                    'title': _t('Connection to terminal failed'),
                    'body':  _t('Please check if the terminal is still connected.'),
                });
            var lines = this.pos.get_order().get_paymentlines();
            for ( var i = 0; i < lines.length; i++ ) {
                if (lines[i].payment_status === 'waiting') {
                    lines[i].set_payment_status('force_done');
                    break;
                }
            }
            this.render_paymentlines();
        }
    },
    _onActionFail: function () {
        this.gui.show_popup('error',{
                'title': _t('Connection to IoT Box failed'),
                'body':  _t('Please check if the IoT Box is still connected.'),
            });
        var lines = this.pos.get_order().get_paymentlines();
        for ( var i = 0; i < lines.length; i++ ) {
            if (lines[i].payment_status === 'waiting') {
                lines[i].set_payment_status('force_done');
                break;
            }
        }
        this.render_paymentlines();
    },
    _showErrorConfig: function () {
        this.gui.show_popup('error',{
                'title': _t('Configuration of payment terminal failed'),
                'body':  _t('You must select a payment terminal in your POS config.'),
            });
    },
    /**
     * @override
     */
    compute_extradue: function (order) {
        var lines = order.get_paymentlines();
        var due   = order.get_due();
        if (due && lines.length && lines[lines.length - 1].payment_status === 'reversed') {
            // If the last line has status 'reversed' we always need to show the
            // remaining amount to pay
            return due;
        } else {
            this._super(order);
        }
    }
});

var posmodel_super = models.PosModel.prototype;
models.PosModel = models.PosModel.extend({
    /**
     * Opens the shift on the payment terminal
     * 
     * @override
     */
    after_load_server_data: function () {
        var self = this;
        var res = posmodel_super.after_load_server_data.apply(this, arguments);
        if (this.usePaymentTerminal()) {
            res.then(function () {
                self.iot_device_proxies.payment.action({ 
                    messageType: 'OpenShift',
                    language: self.user.lang.split('_')[0],
                });
            });
        }
        return res;
    },
    /**
     * Checks if a payment terminal should be used (A terminal has been selected
     * in the config and a payment method needs a terminal)
     * @returns {boolean}
     */
    usePaymentTerminal: function () {
        return this.config && this.config.use_proxy
            && this.iot_device_proxies && this.iot_device_proxies.payment
            && this.payment_methods.some(function (payment_method) {
                return payment_method.use_payment_terminal;
            });
    },
});
});
