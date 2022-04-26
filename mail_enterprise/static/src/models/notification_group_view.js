/** @odoo-module **/

import { one } from '@mail/model/model_field';
import { clear, insertAndReplace } from '@mail/model/model_field_command';
import { addFields, addRecordMethods } from '@mail/model/model_core';
import '@mail/models/notification_group_view'; // ensure the model definition is loaded before the patch

addFields('NotificationGroupView', {
    /**
     * Determines whether this message should have the swiper feature, and if so
     * contains the component managing this feature.
     */
    swiperView: one('SwiperView', {
        compute: '_computeSwiperView',
        inverse: 'notificationGroupViewOwner',
        isCausal: true,
    }),
});

addRecordMethods('NotificationGroupView', {
    /**
     * @private
     * @returns {FieldCommand}
     */
    _computeSwiperView() {
        return (this.messaging.device.isSmall && this.notificationGroup.notifications.length) > 0 ? insertAndReplace() : clear();
    },
});
