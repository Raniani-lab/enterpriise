/** @odoo-module **/

import { settingsFormView } from "@web/webclient/settings_form_view/settings_form_view";
import { SettingsFormRenderer } from "@web/webclient/settings_form_view/settings_form_renderer";
import { SettingsPage } from "@web/webclient/settings_form_view/settings/settings_page";
import { registry } from "@web/core/registry";
import { ActionSwiper } from "@web/core/action_swiper/action_swiper";

export class EnterpriseSettingsPage extends SettingsPage {
    getCurrentIndex() {
        return this.props.modules.findIndex((object) => {
            return object.key === this.state.selectedTab;
        });
    }

    hasRightSwipe() {
        return this.env.isSmall && this.getCurrentIndex() !== 0;
    }
    hasLeftSwipe() {
        return this.env.isSmall && this.getCurrentIndex() !== this.props.modules.length - 1;
    }
    onRightSwipe() {
        this.state.selectedTab = this.props.modules[this.getCurrentIndex() - 1].key;
    }
    onLeftSwipe() {
        this.state.selectedTab = this.props.modules[this.getCurrentIndex() + 1].key;
    }
}
EnterpriseSettingsPage.template = "web_enterprise.EnterpriseSettingsPage";
EnterpriseSettingsPage.components = { ActionSwiper };

class EnterpriseSettingsFormRenderer extends SettingsFormRenderer {}
EnterpriseSettingsFormRenderer.components = {
    ...SettingsFormRenderer.components,
    SettingsPage: EnterpriseSettingsPage,
};

const enterpriseSettingsFormView = {
    ...settingsFormView,
    Renderer: EnterpriseSettingsFormRenderer,
};

registry.category("views").add("base_settings", enterpriseSettingsFormView, { force: true });
