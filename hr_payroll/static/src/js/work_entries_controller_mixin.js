odoo.define('hr_payroll.WorkEntryPayrollControllerMixin', function (require) {
    'use strict';

    var core = require('web.core');
    var time = require('web.time');

    var _t = core._t;
    var QWeb = core.qweb;

    var WorkEntryPayrollControllerMixin = {
        /**
         * @override
         */
        updateButtons: function() {
            this._super.apply(this, arguments);

            if(!this.$buttons) {
                return;
            }

            var records = this._fetchRecords();
            var hasConflicts = records.some(function (record) { return record.state === 'conflict'; });
            var allValidated = records.every(function (record) { return record.state === 'validated'; });
            var generateButton = this.$buttons.find('.btn-payslip-generate');

            if (!allValidated && records.length !== 0) {
                generateButton.show();
                generateButton.replaceWith(this._renderGeneratePayslipButton(hasConflicts));
            } else {
                generateButton.hide();
            }
        },

        /*
            Private
        */
       _renderGeneratePayslipButton: function(disabled) {
            return $(QWeb.render('hr_work_entry.work_entry_button', {
                button_text: _t("Generate Payslips"),
                event_class: 'btn-payslip-generate',
                primary: true,
                disabled: disabled,
            })).on('click', this._onGeneratePayslips.bind(this));
       },

        _renderWorkEntryButtons: function() {
            let buttons = this._super.apply(this, arguments);
            return buttons.prepend(this._renderGeneratePayslipButton());
        },

        _generatePayslips: function () {
            this.do_action('hr_payroll.action_generate_payslips_from_work_entries', {
                additional_context: {
                    default_date_start: time.date_to_str(this.firstDay),
                    default_date_end: time.date_to_str(this.lastDay),
                },
            });
        },

        _onGeneratePayslips: function (e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            this._generatePayslips();
        },
    };

    return WorkEntryPayrollControllerMixin;

});
