/** @odoo-module **/

import { one } from '@mail/model/model_field';
import { clear, insertAndReplace } from '@mail/model/model_field_command';
import { addFields, addRecordMethods } from '@mail/model/model_core';
import '@mail/models/thread_preview_view'; // ensure the model definition is loaded before the patch

addFields('ThreadPreviewView', {
    /**
     * Determines whether this thread preview view should have the swiper
     * feature, and if so contains the component managing this feature.
     */
    swiperView: one('SwiperView', {
        compute: '_computeSwiperView',
        inverse: 'threadPreviewViewOwner',
        isCausal: true,
    }),
});

addRecordMethods('ThreadPreviewView', {
    /**
     * @private
     * @returns {FieldCommand}
     */
    _computeSwiperView() {
        return (
            this.messaging.device.isSmall &&
            (
                (this.thread.isChatChannel && this.thread.isPinned) ||
                (this.thread.localMessageUnreadCounter > 0)
            )
        ) ? insertAndReplace() : clear();
    },
});
