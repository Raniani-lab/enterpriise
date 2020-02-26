odoo.define('event_barcode.EventScanView', function (require) {
"use strict";

var AbstractAction = require('web.AbstractAction');
var core = require('web.core');
var Dialog = require('web.Dialog');

var _t = core._t;
var QWeb = core.qweb;


// load widget with main barcode scanning View
var EventScanView = AbstractAction.extend({
    contentTemplate: 'event_barcode_template',
    events: {
        'click .o_event_select_attendee': '_onClickSelectAttendee',
        'click .o_event_previous_menu': '_onClickPrevious',
    },

    /**
     * @override
     */
    init: function(parent, action) {
        this._super.apply(this, arguments);
        this.action = action;
    },
    /**
     * @override
     */
    willStart: function() {
        var self = this;
        return this._super().then(function() {
            return self._rpc({
                route: '/event_barcode/event',
                params: {
                    event_id: self.action.context.active_id
                }
            }).then(function (result) {
                self.data = result;
            });
        });
    },
    /**
     * @override
     */
    start: function() {
        core.bus.on('barcode_scanned', this, this._onBarcodeScanned);
    },
    /**
     * @override
     */
    destroy: function () {
        core.bus.off('barcode_scanned', this, this._onBarcodeScanned);
        this._super();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {string} barcode
     */
    _onBarcodeScanned: function(barcode) {
        var self = this;
        this._rpc({
            route: '/event_barcode/register_attendee',
            params: {
                barcode: barcode,
                event_id: self.action.context.active_id
            }
        }).then(function(result) {
            if (result.error && result.error === 'invalid_ticket') {
                self.do_warn(_t("Warning"), 'This ticket is not valid');
            } else {
                self.registrationId = result.id;
                new Dialog(self, self._createSummaryModal(result)).open();
            }
        });
    },

    _createSummaryModal: function(result) {
        return {
            title: _t('Registration Summary'),
            size: 'medium',
            $content: QWeb.render('event_registration_summary', {
                'registration': result
            }),
            buttons: this._buildButtons(result.status === 'need_manual_confirmation')
        }
    },

    _buildButtons: function(need_manual_confirmation) {
        var self = this;
        var buttons = [];
        if (need_manual_confirmation) {
            buttons.push({
                text: _t('Confirm'),
                close: true,
                classes: 'btn-primary',
                click: function() {
                    self._onManualConfirm();
                }
            }, {
                text: _t('Close'),
                close: true,
                classes: 'btn-secondary'
            });
        } else {
            buttons.push({text: _t('Close'), close: true, classes: 'btn-primary'});
        }
        buttons.push({
            text: _t('Print'),
            click: function () {
                self._onPrintPdf();
            }
        }, {
            text: _t('View'),
            close: true,
            click: function() {
                self._onViewRegistration();
            }
        });
        return buttons;
    },

    _onManualConfirm: function() {
        var self = this;
        this._rpc({
            model: 'event.registration',
            method: 'action_set_done',
            args: [this.registrationId]
        }).then(function () {
            self.do_notify(_t("Success"), _t("Registration confirmed"))
        })
    },

    _onPrintPdf: function() {
        this.do_action({
            type: 'ir.actions.report',
            report_type: 'qweb-pdf',
            report_name: `event.event_registration_report_template_badge/${this.registrationId}`,
        });
    },

    _onViewRegistration: function() {
        this.do_action({
            type: 'ir.actions.act_window',
            res_model: 'event.registration',
            res_id: this.registrationId,
            views: [[false, 'form']],
            target: 'current'
        });
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickSelectAttendee: function() {
        this.do_action('event_barcode.act_event_registration_from_barcode', {
            additional_context: {
                active_id: this.action.context.active_id,
            },
        });
    },

    _onClickPrevious: function(ev) {
        ev.preventDefault();
        return this.do_action({
            type: 'ir.actions.act_window',
            res_model: 'event.event',
            res_id: this.action.context.active_id,
            views: [[false, 'form']],
            view_mode: 'form',
            target: 'current',
        });
    },
});

core.action_registry.add('even_barcode.scan_view', EventScanView);

return EventScanView;

});
