/** @odoo-module **/

import { MapView } from "@web_map/map_view/map_view";
import { ProjectControlPanel } from "@project/project_control_panel/project_control_panel";
import { registry } from "@web/core/registry";

const { useSubEnv } = owl;

export class ProjectMapView extends MapView {
    setup() {
        super.setup();
        useSubEnv({
            config: {
                ...this.env.config,
                ControlPanel: ProjectControlPanel,
            },
        });
    }
}

registry.category("views").add("project_map", ProjectMapView);
