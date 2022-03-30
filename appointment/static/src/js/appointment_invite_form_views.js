/** @odoo-module **/

import FormView from 'web.FormView';
import viewRegistry from 'web.view_registry';
import { AppointmentInviteFormController } from './appointment_invite_form_controller.js';
import { AppointmentInviteFormRenderer } from './appointment_invite_form_renderer.js';

const AppointmentInviteFormView = FormView.extend({
    config: Object.assign({}, FormView.prototype.config, {
        Controller: AppointmentInviteFormController,
        Renderer: AppointmentInviteFormRenderer,
    }),
});

viewRegistry.add('appointment_invite_view_form', AppointmentInviteFormView);

export {
    AppointmentInviteFormView,
}
