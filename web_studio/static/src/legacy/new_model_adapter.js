/** @odoo-module */

import NewModel from "web_studio.NewModel";
import { ComponentAdapter } from "web.OwlCompatibility";
import { useService } from "@web/core/utils/hooks";

const { Component, onWillUpdateProps, xml } = owl;

export class NewModelItem extends Component {
    setup() {
        this.NewModel = NewModel;
        this.menus = useService("menu");
        this.studio = useService("studio");
        this.action = useService("action");
        this.localId = 0;
        onWillUpdateProps(() => this.localId++);
    }

    async editNewModel(ev) {
        const { action_id, options } = ev.detail;
        const action = await this.action.loadAction(action_id);
        this.studio.setParams({ action, viewType: (options && options.viewType) || "form" });
    }
}
NewModelItem.template = xml`
  <t>
    <t t-set="currentApp" t-value="menus.getCurrentApp()" />
    <t t-if="currentApp"
       t-component="ComponentAdapter"
       Component="NewModel.NewModelItem"
       widgetArgs="[currentApp and currentApp.id]"
       t-key="localId"
       t-on-reload-menu-data="menus.reload()"
       t-on-menu-clicked="editNewModel" />
    <div t-else="" />
  </t>
`;
NewModelItem.components.ComponentAdapter = class extends ComponentAdapter {
    setup() {
        super.setup();
        this.env = Component.env;
    }
};
