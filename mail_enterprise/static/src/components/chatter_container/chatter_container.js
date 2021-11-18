/** @odoo-module **/

// ensure chatter container is registered before-hand
import '@mail/components/chatter_container/chatter_container';

import { getMessagingComponent } from '@mail/utils/messaging_component';

const ChatterContainer = getMessagingComponent('ChatterContainer');

Object.assign(ChatterContainer, {
    defaultProps: Object.assign(ChatterContainer.defaultProps || {}, {
        isInFormSheetBg: false,
    }),
    props: Object.assign(ChatterContainer.props, {
        isInFormSheetBg: {
            type: Boolean,
        },
    })
});
