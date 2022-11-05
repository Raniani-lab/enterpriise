/** @odoo-module **/

import { clear, one, Patch } from '@mail/model';

Patch({
    name: 'NotificationGroupView',
    fields: {
        /**
         * Determines whether this message should have the swiper feature, and
         * if so contains the component managing this feature.
         */
        swiperView: one('SwiperView', {
            compute() {
                return (this.messaging.device.isSmall && this.notificationGroup.notifications.length) > 0 ? {} : clear();
            },
            inverse: 'notificationGroupViewOwner',
        }),
    },
});
