/** @odoo-module **/

import { EditInBackendSystray } from '@website/systray_items/edit_in_backend';
import { patch } from 'web.utils';

patch(EditInBackendSystray.prototype, 'website_appointment_edit_in_backend', {
    /**
     * @override
     */
    editInBackend(...args) {
        const { metadata: { mainObject } } = this.websiteService.currentWebsite;
        if (mainObject.model === 'appointment.type') {
            this.actionService.doAction('appointment.appointment_type_action');
            return;
        }
        return this._super(...args);
    }
});
