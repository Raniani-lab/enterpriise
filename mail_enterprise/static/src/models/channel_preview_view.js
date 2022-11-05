/** @odoo-module **/

import { clear, one, registerPatch } from '@mail/model';

registerPatch({
    name: 'ChannelPreviewView',
    fields: {
        /**
         * Determines whether this thread preview view should have the swiper
         * feature, and if so contains the component managing this feature.
         */
        swiperView: one('SwiperView', {
            compute() {
                return (
                    this.messaging.device.isSmall &&
                    (
                        (this.thread.isChatChannel && this.thread.isPinned) ||
                        (this.channel.localMessageUnreadCounter > 0)
                    )
                ) ? {} : clear();
            },
            inverse: 'channelPreviewViewOwner',
        }),
    },
});
