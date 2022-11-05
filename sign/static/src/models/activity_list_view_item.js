/** @odoo-module **/

import { Patch } from '@mail/model';

Patch({
    name: 'ActivityListViewItem',
    fields: {
        hasMarkDoneButton: {
            compute() {
                if (this.activity.category === 'sign_request') {
                    return false;
                }
                return this._super();
            },
        },
    },
    recordMethods: {
        async onClickRequestSign() {
            const reloadFunc = this.reloadFunc;
            const webRecord = this.webRecord;
            const activity = this.activity;
            const thread = activity.thread;
            this.activityListViewOwner.popoverViewOwner.delete();
            await activity.requestSignature();
            if (reloadFunc) {
                reloadFunc();
            }
            if (thread.exists()) {
                webRecord.model.load({ resId: thread.id });
            }
        },
    },
});
