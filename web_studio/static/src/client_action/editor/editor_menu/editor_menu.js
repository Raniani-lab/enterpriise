/** @odoo-module */
import { useService } from "@web/core/utils/hooks";
import { _lt } from "@web/core/l10n/translation";
import { localization } from "@web/core/l10n/localization";
import { registry } from "@web/core/registry";

import { Component, useState } from "@odoo/owl";
const editorTabRegistry = registry.category("web_studio.editor_tabs");

export class EditorMenu extends Component {
    setup() {
        this.l10n = localization;
        this.editionFlow = useState(this.env.editionFlow);
        this.studio = useService("studio");
        this.rpc = useService("rpc");
        this.nextCrumbId = 1;
    }

    get breadcrumbs() {
        const { editorTab } = this.studio;
        const currentTab = this.editorTabs.find((tab) => tab.id === editorTab);
        const crumbs = [
            {
                name: currentTab.name,
                handler: () => this.openTab(currentTab.id),
            },
        ];
        if (currentTab.id === "reports" && this.studio.editedReport) {
            crumbs.push({
                name: this.studio.editedReport.data.name,
                handler: () => this.studio.setParams({}),
            });
        }

        const breadcrumbs = this.editionFlow.breadcrumbs;
        breadcrumbs.forEach((data) => {
            crumbs.push({ ...data });
        });
        for (const crumb of crumbs) {
            crumb.id = this.nextCrumbId++;
        }
        return crumbs;
    }

    get activeViews() {
        const action = this.studio.editedAction;
        const viewTypes = (action._views || action.views).map(([, type]) => type);
        return this.constructor.viewTypes.filter((vt) => viewTypes.includes(vt.type));
    }

    get editorTabs() {
        const entries = editorTabRegistry.getEntries();
        return entries.map((entry) => Object.assign({}, entry[1], { id: entry[0] }));
    }

    openTab(tab) {
        this.props.switchTab({ tab });
    }
}
EditorMenu.props = {
    switchTab: Function,
    switchView: Function,
};
EditorMenu.template = "web_studio.EditorMenu";
EditorMenu.viewTypes = [
    {
        title: _lt("Form"),
        type: "form",
        iconClasses: "fa fa-address-card",
    },
    {
        title: _lt("List"),
        type: "list",
        iconClasses: "oi oi-view-list",
    },
    {
        title: _lt("Kanban"),
        type: "kanban",
        iconClasses: "oi oi-view-kanban",
    },
    {
        title: _lt("Map"),
        type: "map",
        iconClasses: "fa fa-map-marker",
    },
    {
        title: _lt("Calendar"),
        type: "calendar",
        iconClasses: "fa fa-calendar",
    },
    {
        title: _lt("Graph"),
        type: "graph",
        iconClasses: "fa fa-area-chart",
    },
    {
        title: _lt("Pivot"),
        type: "pivot",
        iconClasses: "oi oi-view-pivot",
    },
    {
        title: _lt("Gantt"),
        type: "gantt",
        iconClasses: "fa fa-tasks",
    },
    {
        title: _lt("Cohort"),
        type: "cohort",
        iconClasses: "oi oi-view-cohort",
    },
    {
        title: _lt("Activity"),
        type: "activity",
        iconClasses: "fa fa-clock-o",
    },
    {
        title: _lt("Search"),
        type: "search",
        iconClasses: "oi oi-search",
    },
];

editorTabRegistry
    .add("views", { name: _lt("Views"), action: "web_studio.action_editor" })
    .add("reports", { name: _lt("Reports") })
    .add("automations", { name: _lt("Automations") })
    .add("acl", { name: _lt("Access Control") })
    .add("filters", { name: _lt("Filter Rules") });
