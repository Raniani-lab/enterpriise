/** @odoo-module **/

import { registerModel } from '@mail/model/model_core';
import { one } from '@mail/model/model_field';
import { clear } from '@mail/model/model_field_command';

registerModel({
    name: 'ApprovalView',
    identifyingMode: 'xor',
    template: 'approvals.ApprovalView',
    recordMethods: {
        async onClickApprove() {
            if (!this.exists()) {
                return;
            }
            const chatter = this.activityViewOwner && this.activityViewOwner.activityBoxView.chatter;
            const reloadFunc = this.activityListViewItemOwner && this.activityListViewItemOwner.reloadFunc;
            const webRecord = this.activityListViewItemOwner && this.activityListViewItemOwner.webRecord;
            const thread = this.activity.thread;
            await this.activity.approval.approve();
            if (chatter && chatter.exists()) {
                chatter.reloadParentView();
            }
            if (reloadFunc) {
                reloadFunc();
            }
            if (webRecord) {
                webRecord.model.load({ resId: thread.id });
            }
        },
        async onClickRefuse() {
            if (!this.exists()) {
                return;
            }
            const chatter = this.activityViewOwner && this.activityViewOwner.activityBoxView.chatter;
            const reloadFunc = this.activityListViewItemOwner && this.activityListViewItemOwner.reloadFunc;
            const webRecord = this.activityListViewItemOwner && this.activityListViewItemOwner.webRecord;
            const thread = this.activity.thread;
            await this.activity.approval.refuse();
            if (chatter && chatter.exists()) {
                chatter.reloadParentView();
            }
            if (reloadFunc) {
                reloadFunc();
            }
            if (webRecord) {
                webRecord.model.load({ resId: thread.id });
            }
        },
    },
    fields: {
        activity: one('Activity', {
            compute() {
                if (this.activityViewOwner) {
                    return this.activityViewOwner.activity;
                }
                if (this.activityListViewItemOwner) {
                    return this.activityListViewItemOwner.activity;
                }
                return clear();
            }
        }),
        activityListViewItemOwner: one('ActivityListViewItem', {
            identifying: true,
            inverse: 'approvalView',
        }),
        activityViewOwner: one('ActivityView', {
            identifying: true,
            inverse: 'approvalView',
        }),
    },
});
