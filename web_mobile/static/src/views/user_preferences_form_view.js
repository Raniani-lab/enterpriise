/** @odoo-module */

import { registry } from '@web/core/registry';
import { patch } from "@web/core/utils/patch";

import { formView } from '@web/views/form/form_view';
import { UpdateDeviceAccountControllerMixin } from 'web_mobile.mixins';

export class ResUsersPreferenceFormController extends formView.Controller {}
patch(ResUsersPreferenceFormController.prototype, "res_users_controller_mobile_mixin", UpdateDeviceAccountControllerMixin);

registry.category('views').add('res_users_preferences_form', {
    ...formView,
    Controller: ResUsersPreferenceFormController,
});
