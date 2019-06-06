odoo.define('pos_iot.payment', function (require) {
    "use strict";

var models = require('point_of_sale.models');
var core = require('web.core');
var screens = require('point_of_sale.screens');
var round_pr = require('web.utils').round_precision;

var _t = core._t;

models.load_fields('account.journal', 'use_payment_terminal');

/** Payment Line
 *
 * @include
 */
var _pl_proto = models.Paymentline.prototype;
models.Paymentline = models.Paymentline.extend({
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
        var line = order.selected_paymentline;
        if (line && line.get_payment_status()) {
            this.$el.find('.send_payment_request').click(function () {
                self.send_payment_request();
                line.set_payment_status('waiting');
                self.render_paymentlines();
                self.payment_timer = setTimeout ( function () {
                    line.set_payment_status('timeout');
                }, 8000);
            });
            this.$el.find('.send_payment_cancel').click(function () {
                self.send_payment_cancel();
                line.set_payment_status('waitingCancel');
                clearTimeout(self.payment_timer);
                self.render_paymentlines();
            });
            this.$el.find('.send_force_done').click(function () {
                line.set_payment_status('done');
                clearTimeout(self.payment_timer);
                self.order_changes();
                self.render_paymentlines();
            });
        }
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
                        return !['done'].includes(pl.payment_status);
                    }
                })) {
            this.gui.show_popup('error',{
                'title': _t('Error'),
                'body':  _t('There is already an electronic payment in progress.'),
            });
        } else {
            this._super(id);
            var cashregister = _.find(this.pos.cashregisters, function(cr) {
                return cr.journal_id[0] === id;
            });
            if (cashregister.journal.use_payment_terminal === true) {
                if (this.pos.iot_device_proxies['payment']) {
                    this.terminal = this.pos.iot_device_proxies['payment'];
                    this.terminal.add_listener(this._onValueChange.bind(this));
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
        if (this.terminal) {
            this.terminal.remove_listener();
            clearTimeout(this.payment_timer);
        }
    },
    /**
     * @override
     * Disable changing amount on paymentlines with running or done payments on a Payment Terminal.
     */
    payment_input: function(input) {
        if (!this.terminal || 
            !['done', 'force_done', 'waitingCard', 'waiting'].includes(this.pos.get_order().selected_paymentline.get_payment_status())) {
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
            if (lines[i].cid === cid && lines[i].get_payment_status()) {
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
    _onValueChange: function (data) {
        var line = this.pos.get_order().selected_paymentline;
        if (line && data.Response === 'Approved') {
            line.set_payment_status('done');
            clearTimeout(this.payment_timer);
            if (data.Ticket !== false) {
                line.ticket = data.Ticket.replace(/\n/g, "<br />");
            }
            this.order_changes();
            this.terminal.remove_listener();
        } else if (line && data.Stage === 'WaitingForCard' && line.get_payment_status() !== 'waitingCancel') {
            line.set_payment_status('waitingCard');
        } else if (line && data.Error) {
            this.gui.show_popup('error',{
                    'title': _t('Payment terminal error'),
                    'body':  _t(data.Error),
                });
            line.set_payment_status('retry');
        } else if (line && data.Stage !== 'WaitingForCard') {
            if (['timeout', 'waitingCard', 'waitingCancel'].includes(line.get_payment_status())) {
                line.set_payment_status('retry');
            }
        }
        this.render_paymentlines();
    },
    send_payment_request: function () {
        var data = {
            messageType: 'Transaction',
            TransactionID: parseInt(this.pos.get_order().selected_paymentline.order.uid.replace(/-/g, '')),
            amount: Math.round(this.pos.get_order().selected_paymentline.amount*100),
            currency: this.pos.currency.name
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
            if (this.pos.get_order().selected_paymentline) {
                this.pos.get_order().selected_paymentline.set_payment_status('force_done');
            }
            this.render_paymentlines();
        }
    },
    _onActionFail: function () {
        this.gui.show_popup('error',{
                'title': _t('Connection to IoT Box failed'),
                'body':  _t('Please check if the IoT Box is still connected.'),
            });
        if (this.pos.get_order().selected_paymentline) {
            this.pos.get_order().selected_paymentline.set_payment_status('force_done');
        }
        this.render_paymentlines();
    },
    _showErrorConfig: function () {
        this.gui.show_popup('error',{
                'title': _t('Configuration of payment terminal failed'),
                'body':  _t('You must select a payment terminal in your POS config.'),
            });
    },
});
});
