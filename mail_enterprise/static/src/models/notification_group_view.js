/** @odoo-module **/

import { one } from '@mail/model/model_field';
import { clear } from '@mail/model/model_field_command';
import { addFields } from '@mail/model/model_core';
import '@mail/models/notification_group_view'; // ensure the model definition is loaded before the patch

addFields('NotificationGroupView', {
    /**
     * Determines whether this message should have the swiper feature, and if so
     * contains the component managing this feature.
     */
    swiperView: one('SwiperView', {
        compute() {
            return (this.messaging.device.isSmall && this.notificationGroup.notifications.length) > 0 ? {} : clear();
        },
        inverse: 'notificationGroupViewOwner',
    }),
});
