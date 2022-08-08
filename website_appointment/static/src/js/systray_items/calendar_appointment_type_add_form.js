/** @odoo-module **/

import { NewContentFormController } from '@website/js/new_content_form';
import viewRegistry from 'web.view_registry';
import FormView from 'web.FormView';

const AddAppointmentTypeFormController = NewContentFormController.extend({
    /**
     * @override
     */
    _getPath(state) {
        return `/appointment/${state.data.id}`;
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
