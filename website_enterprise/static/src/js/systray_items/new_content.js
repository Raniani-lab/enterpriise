/** @odoo-module **/

import { NewContentModal, MODULE_STATUS } from '@website/systray_items/new_content';
import { patch } from "@web/core/utils/patch";
const { xml } = owl;

patch(NewContentModal.prototype, {
    setup() {
        super.setup();

        this.state.newContentElements.push({
            moduleName: 'website_appointment',
            moduleXmlId: 'base.module_website_appointment',
            status: MODULE_STATUS.NOT_INSTALLED,
            icon: xml`<i class="fa fa-calendar"/>`,
            title: this.env._t('Appointment Form'),
        });
    },
});
