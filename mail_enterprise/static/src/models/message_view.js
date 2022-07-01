/** @odoo-module **/

import { one } from '@mail/model/model_field';
import { clear, insertAndReplace } from '@mail/model/model_field_command';
import { addFields, addRecordMethods } from '@mail/model/model_core';
// ensure the model definition is loaded before the patch
import '@mail/models/message_view';

addFields('MessageView', {
    /**
     * Determines whether this message should have the swiper feature, and if so
     * contains the component managing this feature.
     */
    swiperView: one('SwiperView', {
        compute: '_computeSwiperView',
        inverse: 'messageViewOwner',
        isCausal: true,
    }),
});

addRecordMethods('MessageView', {
    /**
     * @private
     * @returns {FieldCommand}
     */
    _computeSwiperView() {
        return (
            this.messaging &&
            this.messaging.device &&
            this.messaging.device.isSmall &&
            this.message &&
            this.message.isNeedaction &&
            this.messageListViewMessageViewItemOwner &&
            this.messageListViewMessageViewItemOwner.messageListViewOwner.threadViewOwner.thread &&
            this.messageListViewMessageViewItemOwner.messageListViewOwner.threadViewOwner.thread === this.messaging.inbox
        ) ? insertAndReplace() : clear();
    },
});
