/** @odoo-module **/

import { clear, one, registerPatch } from '@mail/model';

registerPatch({
    name: 'MessageView',
    fields: {
        /**
         * Determines whether this message should have the swiper feature, and
         * if so contains the component managing this feature.
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
    },
});
