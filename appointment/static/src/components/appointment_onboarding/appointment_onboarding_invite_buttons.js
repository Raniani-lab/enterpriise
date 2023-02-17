/** @odoo-module **/

import { browser } from "@web/core/browser/browser";
import { registry } from '@web/core/registry';
import { standardWidgetProps } from "@web/views/widgets/standard_widget_props";
import { useService } from "@web/core/utils/hooks";

const { Component } = owl;

export class AppointmentOnboardingInviteButtons extends Component {
    setup() {
        super.setup();
        this.notification = useService("notification");
        this.orm = useService('orm');
    }
    /**
     *
     * @param ev
     */
    async onSaveAndCopy (ev) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        const { bookUrl, wasFirstValidation } = await this._getInviteURL();
        setTimeout(async () => await browser.navigator.clipboard.writeText(bookUrl));
        this.notification.add(
            this.env._t("Link copied to clipboard."),
            {type: "success"}
        );
        this.env.dialogData.close();
        if (wasFirstValidation){
            window.location.reload();
        }
    }
    /**
     *
     * @param ev
     */
    async onPreview (ev) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        const { bookUrl } = await this._getInviteURL();
        window.location = bookUrl;
    }
    /**
     * Create invite with slug as shortcode both for copying to clipboard and to redirect.
     *
     * @return {Promise<String>} bookUrl
     * @private
     */
    async _getInviteURL () {
        if (!await this.props.record.save({stayInEdition: true})) {
            return Promise.reject();
        }
        return this.orm.call(
            this.props.record.resModel,
            'search_or_create_onboarding_invite',
            [this.props.record.resId]
        );
    }
}
AppointmentOnboardingInviteButtons.props = {
    ...standardWidgetProps,
};
AppointmentOnboardingInviteButtons.template = 'appointment.AppointmentOnboardingInviteButtons';

export const appointmentOnboardingInviteButtons = {
    component: AppointmentOnboardingInviteButtons,
};
registry
    .category("view_widgets")
    .add("appointment_onboarding_invite_buttons", appointmentOnboardingInviteButtons);
