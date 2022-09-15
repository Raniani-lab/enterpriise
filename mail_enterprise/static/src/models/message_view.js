/** @odoo-module **/

import { one } from '@mail/model/model_field';
import { clear } from '@mail/model/model_field_command';
import { addFields } from '@mail/model/model_core';
// ensure the model definition is loaded before the patch
import '@mail/models/message_view';

addFields('MessageView', {
    /**
     * Determines whether this message should have the swiper feature, and if so
     * contains the component managing this feature.
     */
    swiperView: one('SwiperView', {
        compute() {
            return (
                this.messaging &&
                this.messaging.device &&
                this.messaging.device.isSmall &&
                this.message &&
                this.message.isNeedaction &&
                this.messageListViewItemOwner &&
                this.messageListViewItemOwner.messageListViewOwner.threadViewOwner.thread === this.messaging.inbox.thread
            ) ? {} : clear();
        },
        inverse: 'messageViewOwner',
    }),
});
