/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { updateAccountOnMobileDevice } from "@web_mobile/js/core/mixins";
import { EmployeeProfileController } from "@hr/views/profile_form_view";

patch(EmployeeProfileController.prototype, "employee_profile_include", {
    async onRecordSaved(record) {
        const _super = this._super;
        await updateAccountOnMobileDevice();
        return await _super(...arguments);
    },
});
