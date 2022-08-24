/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { UpdateDeviceAccountControllerMixin } from 'web_mobile.mixins';
import { EmployeeProfileFormController } from "@hr/views/profile_form_view";

patch(EmployeeProfileFormController.prototype, 'employee_profile_include', UpdateDeviceAccountControllerMixin);
