/** @odoo-module **/

import FormRenderer from 'web.FormRenderer';

const AppointmentInviteFormRenderer = FormRenderer.extend({
    /**
     * @override
     */
    confirmChange: function () {
        const result = this._super(...arguments);
        this._checkAlertStatus();
        return result;
    },
     /**
     * @override
     */
    _renderView: function () {
        return this._super(...arguments).then(() => {
            const alertMessage = this.$el.find('.o_appointment_invite_disable_saving').not('.d-none, .o_invisible_modifier');
            if (alertMessage.length) {
                this.$el.find('.o_appointment_invite_copy_save').prop('disabled', true);
            }
        });
    },
    _checkAlertStatus: function () {
        const alertMessage = this.$el.find('.o_appointment_invite_disable_saving').not('.d-none, .o_invisible_modifier');
        if (alertMessage.length) {
            this.trigger_up('disable_save_copy_button');
        } else {
            this.trigger_up('enable_save_copy_button');
        }
    },
});

export {
    AppointmentInviteFormRenderer,
}
