/** @odoo-module */

import { ActivityMenu } from "@mail/core/web/activity_menu";

import { patch } from '@web/legacy/js/core/utils';

patch(ActivityMenu.prototype, "documents", {
    async onClickRequestDocument() {
        document.body.click(); // hack to close dropdown
        this.env.services.action.doAction("documents.action_request_form");
    },
});
