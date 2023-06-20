/** @odoo-module **/

import { registry } from "@web/core/registry";
import { LazyComponent } from "@web/core/assets";
import { useService } from "@web/core/utils/hooks";
import { standardActionServiceProps } from "@web/webclient/actions/action_service";

import { Component, xml } from "@odoo/owl";

class StudioActionLoader extends Component {
    setup() {
        this.orm = useService("orm");
    }
}
StudioActionLoader.components = { LazyComponent };
StudioActionLoader.props = {
    ...standardActionServiceProps,
    props: { type: Object, optional: true },
    Component: { type: Function, optional: true },
};
StudioActionLoader.template = xml`
    <LazyComponent bundle="'web_studio.studio_assets'" Component="'StudioClientAction'" props="props"/>
`;
registry.category("actions").add("studio", StudioActionLoader);
