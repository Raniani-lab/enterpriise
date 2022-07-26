/** @odoo-module **/

import { addRecordMethods } from '@mail/model/model_core';
import '@mail/models/activity_menu_view'; // ensure the model definition is loaded before the patch

addRecordMethods('ActivityMenuView', {
    /**
     * @param {MouseEvent} ev
     */
    async onClickRequestDocument(ev) {
        this.update({ isOpen: false });
        this.env.services.action.doAction('documents.action_request_form');
    },
});
