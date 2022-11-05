/** @odoo-module **/

import { Patch } from '@mail/model';

Patch({
    name: 'ActivityMenuView',
    recordMethods: {
        /**
         * @param {MouseEvent} ev
         */
        async onClickRequestDocument(ev) {
            this.update({ isOpen: false });
            this.env.services.action.doAction('documents.action_request_form');
        },
    },
});
