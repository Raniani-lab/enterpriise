/** @odoo-module **/

import { registry } from "@web/core/registry";
import { formView } from "@web/views/form/form_view";
import { ShareFormController } from "@documents/views/form/share_form_controller";

export const shareFormView = {
    ...formView,
    Controller: ShareFormController,
};

registry.category("views").add("documents_share_popup_form", shareFormView);
