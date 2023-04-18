/** @odoo-module **/

import { FormController } from "@web/views/form/form_controller";

export class ResourceFormController extends FormController {
    /**
     * @override
     */
    get archiveDialogProps() {
        let result = super.archiveDialogProps;
        result.body = this.env._t("Archiving this resource will transform all of its future shifts into open shifts. Are you sure you want to continue?");
        return result;
    }
}
