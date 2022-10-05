/** @odoo-module **/

import { useUpdateToModel } from '@mail/component_hooks/use_update_to_model';
import { registerMessagingComponent } from '@mail/utils/messaging_component';

import { ActionSwiper } from '@web/core/action_swiper/action_swiper';

const { Component } = owl;

export class SwiperView extends Component {

    setup() {
        useUpdateToModel({ methodName: 'onComponentUpdate' });
    }

    /**
     * @returns {SwiperView}
     */
    get swiperView() {
        return this.props.record;
    }

}

Object.assign(SwiperView, {
    components: { ActionSwiper },
    props: { record: Object },
    template: 'mail_enterprise.SwiperView',
});

registerMessagingComponent(SwiperView);
