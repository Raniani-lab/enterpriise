/** @odoo-module **/

import { registerModel } from '@mail/model/model_core';
import { attr, one } from '@mail/model/model_field';
import { clear, replace } from '@mail/model/model_field_command';

registerModel({
    name: 'SwiperView',
    identifyingFields: [['messageViewOwner', 'notificationGroupViewOwner', 'threadNeedactionPreviewViewOwner', 'threadPreviewViewOwner']],
    recordMethods: {
        /**
         * Handles left swipe on this swiper view.
         */
        onLeftSwipe() {
            if (this.threadPreviewViewOwner) {
                this.threadPreviewViewOwner.thread.unpin();
            }
        },
        /**
         * Handles right swipe on this swiper view.
         */
        onRightSwipe() {
            if (this.messageViewOwner) {
                this.messageViewOwner.message.markAsRead();
            }
            if (this.notificationGroupViewOwner) {
                if (this.notificationGroupViewOwner.notificationGroup.notifications.length > 0) {
                    this.notificationGroupViewOwner.notificationGroup.notifyCancel();
                }
            }
            if (this.threadNeedactionPreviewViewOwner) {
                this.models['Message'].markAllAsRead([
                    ['model', '=', this.threadNeedactionPreviewViewOwner.thread.model],
                    ['res_id', '=', this.threadNeedactionPreviewViewOwner.thread.id],
                ]);
            }
            if (this.threadPreviewViewOwner) {
                if (this.threadPreviewViewOwner.thread.lastNonTransientMessage) {
                    this.threadPreviewViewOwner.thread.markAsSeen(this.threadPreviewViewOwner.thread.lastNonTransientMessage);
                }
            }
        },
        /**
         * @private
         * @returns {string|FieldCommand}
         */
        _computeComponentName() {
            if (this.messageViewOwner) {
                return 'Message';
            }
            if (this.notificationGroupViewOwner) {
                return 'NotificationGroup';
            }
            if (this.threadNeedactionPreviewViewOwner) {
                return 'ThreadNeedactionPreview';
            }
            if (this.threadPreviewViewOwner) {
                return 'ThreadPreview';
            }
            return clear();
        },
        /**
         * @private
         * @returns {boolean}
         */
        _computeHasLeftSwipe() {
            if (this.threadPreviewViewOwner) {
                return Boolean(
                    this.threadPreviewViewOwner.thread.isChatChannel &&
                    this.threadPreviewViewOwner.thread.isPinned
                );
            }
            return false;
        },
        /**
         * @private
         * @returns {boolean}
         */
        _computeHasRightSwipe() {
            if (this.messageViewOwner) {
                return true;
            }
            if (this.notificationGroupViewOwner) {
                return true;
            }
            if (this.threadNeedactionPreviewViewOwner) {
                return true;
            }
            if (this.threadPreviewViewOwner) {
                return this.threadPreviewViewOwner.thread.localMessageUnreadCounter > 0;
            }
            return false;
        },
        /**
         * @private
         * @returns {string|FieldCommand}
         */
        _computeLeftSwipeBackgroundColor() {
            if (this.threadPreviewViewOwner) {
                return 'bg-danger';
            }
            return clear();
        },
        /**
         * @private
         * @returns {string|FieldCommand}
         */
        _computeLeftSwipeIcon() {
            if (this.threadPreviewViewOwner) {
                return 'fa-times-circle';
            }
            return clear();
        },
        /**
         * @private
         * @returns {FieldCommand}
         */
        _computeRecord() {
            if (this.messageViewOwner) {
                return replace(this.messageViewOwner);
            }
            if (this.notificationGroupViewOwner) {
                return replace(this.notificationGroupViewOwner);
            }
            if (this.threadNeedactionPreviewViewOwner) {
                return replace(this.threadNeedactionPreviewViewOwner);
            }
            if (this.threadPreviewViewOwner) {
                return replace(this.threadPreviewViewOwner);
            }
            return clear();
        },
        /**
         * @private
         * @returns {string|FieldCommand}
         */
        _computeRightSwipeBackgroundColor() {
            if (this.messageViewOwner) {
                return 'bg-success';
            }
            if (this.notificationGroupViewOwner) {
                return 'bg-warning';
            }
            if (this.threadNeedactionPreviewViewOwner) {
                return 'bg-success';
            }
            if (this.threadPreviewViewOwner) {
                return 'bg-success';
            }
            return clear();
        },
        /**
         * @private
         * @returns {string|FieldCommand}
         */
        _computeRightSwipeIcon() {
            if (this.messageViewOwner) {
                return 'fa-check-circle';
            }
            if (this.notificationGroupViewOwner) {
                return 'fa-times-circle';
            }
            if (this.threadNeedactionPreviewViewOwner) {
                return 'fa-check-circle';
            }
            if (this.threadPreviewViewOwner) {
                return 'fa-check-circle';
            }
            return clear();
        },
    },
    fields: {
        componentName: attr({
            compute: '_computeComponentName',
            required: true,
        }),
        hasLeftSwipe: attr({
            compute: '_computeHasLeftSwipe',
            required: true,
        }),
        hasRightSwipe: attr({
            compute: '_computeHasRightSwipe',
            required: true,
        }),
        leftSwipeBackgroundColor: attr({
            compute: '_computeLeftSwipeBackgroundColor',
        }),
        leftSwipeIcon: attr({
            compute: '_computeLeftSwipeIcon',
        }),
        messageViewOwner: one('MessageView', {
            inverse: 'swiperView',
            readonly: true,
        }),
        notificationGroupViewOwner: one('NotificationGroupView', {
            inverse: 'swiperView',
            readonly: true,
        }),
        record: one('Record', {
            compute: '_computeRecord',
            readonly: true,
            required: true,
        }),
        rightSwipeBackgroundColor: attr({
            compute: '_computeRightSwipeBackgroundColor',
        }),
        rightSwipeIcon: attr({
            compute: '_computeRightSwipeIcon',
        }),
        threadNeedactionPreviewViewOwner: one('ThreadNeedactionPreviewView', {
            inverse: 'swiperView',
            readonly: true,
        }),
        threadPreviewViewOwner: one('ThreadPreviewView', {
            inverse: 'swiperView',
            readonly: true,
        }),
    },
});
