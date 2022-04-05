/** @odoo-module **/

import { _t } from 'web.core';
import { browser } from "@web/core/browser/browser";
import FormController from 'web.FormController';

const AppointmentInviteFormController = FormController.extend({
    custom_events: Object.assign({}, FormController.prototype.custom_events, {
        disable_save_copy_button: '_disableSaveCopyButton',
        enable_save_copy_button: '_enableSaveCopyButton',
    }),
    /**
     * Allows to save the invite and copy the url in the clipboard.
     * Display a warning message if the short_code format is not valid.
     * @override 
     */
    renderButtons: function ($node) {
        this._super(...arguments);
        if (!this.$buttons) {
            return;
        }
        this.$buttons.on('click', '.o_appointment_invite_copy_save', (ev) => {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            const data = this.renderer.state.data;
            const invalidFields = this.renderer.canBeSaved(this.renderer.state.id);
            if (!invalidFields.length) {
                browser.navigator.clipboard.writeText(data.book_url);
                this.model.save(this.handle).then(() => {
                    $(ev.currentTarget).popover({
                        placement: 'top',
                        content: _t('Copied!'),
                        trigger: 'manual',
                    }).popover('show');
                    _.delay(() => {
                        $(ev.currentTarget).popover('hide');
                    }, 800);
                });
            } else {
                this._notifyInvalidFields(invalidFields);
            }
        });
    },
    _disableSaveCopyButton: function (ev) {
        $(".o_appointment_invite_copy_save").prop('disabled', true);
    },
    _enableSaveCopyButton: function (ev) {
        $(".o_appointment_invite_copy_save").prop('disabled', false);
    },
});

export {
    AppointmentInviteFormController,
}
