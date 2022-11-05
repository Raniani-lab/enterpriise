/** @odoo-module **/

import { clear, one, registerPatch } from '@mail/model';

registerPatch({
    name: 'ThreadNeedactionPreviewView',
    fields: {
        /**
         * Determines whether this thread needaction preview view should have
         * the swiper feature, and if so contains the component managing this
         * feature.
         */
        swiperView: one('SwiperView', {
            compute() {
                return this.messaging.device.isSmall ? {} : clear();
            },
            inverse: 'threadNeedactionPreviewViewOwner',
        }),
    },
});
