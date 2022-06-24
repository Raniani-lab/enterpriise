/** @odoo-module **/

import FormController from 'web.FormController';
import viewRegistry from 'web.view_registry';
import FormView from 'web.FormView';

const AddAppointmentTypeFormController = FormController.extend({
    saveRecord() {
        return this._super.apply(this, arguments).then(() => {
            const state = this.model.get(this.handle);
            this.do_action({
                type: 'ir.actions.act_window_close',
                infos: { path: state.data.website_url },
            });
        });
    },
});

const AddAppointmentTypeFormView = FormView.extend({
    config: _.extend({}, FormView.prototype.config, {
        Controller: AddAppointmentTypeFormController,
    }),
});

viewRegistry.add('website_appointment_add_form', AddAppointmentTypeFormView);

export default {
    AddAppointmentTypeFormController: AddAppointmentTypeFormController,
    AddAppointmentTypeFormView: AddAppointmentTypeFormView,
};
