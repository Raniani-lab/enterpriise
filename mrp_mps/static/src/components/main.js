/** @odoo-module **/

import { MrpMpsControlPanel } from '../search/mrp_mps_control_panel';
import { MrpMpsSearchModel } from '../search/mrp_mps_search_model';
import MpsLineComponent from '@mrp_mps/components/line';
import { MasterProductionScheduleModel } from '@mrp_mps/models/master_production_schedule_model';
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { CheckBox } from "@web/core/checkbox/checkbox";
import { getDefaultConfig } from "@web/views/view";
import { usePager } from "@web/search/pager_hook";
import { useSetupAction } from "@web/webclient/actions/action_hook";
import { WithSearch } from "@web/search/with_search/with_search";

const { Component, onWillStart, useSubEnv } = owl;

class MainComponent extends Component {
    //--------------------------------------------------------------------------
    // Lifecycle
    //--------------------------------------------------------------------------
    setup() {
        this.action = useService("action");
        this.dialog = useService("dialog");
        this.orm = useService("orm");
        this.viewService = useService("view");

        const { orm, action, dialog } = this;
        this.model = new MasterProductionScheduleModel(this.props, { orm, action, dialog });
        this.withSearchProps = null;

        useSubEnv({
            manufacturingPeriods: [],
            model: this.model,
            defaultPageLimit: 20,
            config: {
                ...getDefaultConfig(),
                offset: 0,
                limit: 20,
                mpsImportRecords: true,
            },
        });

        useSetupAction({
            getContext: () => {
                return this.props.action.context;
            },
        });

        onWillStart(async () => {
            this.env.config.setDisplayName(this.env._t("Master Production Schedule"));
            this.withSearchProps = await this._prepareWithSearchProps();
            this.model.on('update', this, () => this.render(true));
            const domain = this.props.action.domain;
            await this.model.load(domain, this.env.config.offset, this.env.config.limit);
        });

        usePager(() => {
            return {
                offset: this.env.config.offset,
                limit: this.env.config.limit,
                total: this.model.data.count,
                onUpdate: async ({ offset, limit }) => {
                    this.env.config.offset = offset;
                    this.env.config.limit = limit;
                    this.model.load(undefined, offset, limit);
                },
            };
        });
    }

    async _prepareWithSearchProps() {
        this.MrpMpsControlPanel = MrpMpsControlPanel;
        const views = await this.viewService.loadViews(
            {
                resModel: "mrp.production.schedule",
                context: this.props.action.context,
                views: [[false, "search"]],
            }
        );
        return {
            SearchModel: MrpMpsSearchModel,
            resModel: "mrp.production.schedule",
            context: this.props.action.context,
            orderBy: ["id"],
            searchMenuTypes: ['filter', 'favorite'],
            searchViewArch: views.views.search.arch,
            searchViewId: views.views.search.id,
            searchViewFields: views.fields,
            loadIrFilters: true
        };
    }

    get lines() {
        return this.model.data.production_schedule_ids;
    }

    get manufacturingPeriods() {
        return this.model.data.dates;
    }

    get groups() {
        return this.model.data.groups[0];
    }

    get isSelected() {
        return this.model.selectedRecords.size === this.lines.length;
    }

    toggleSelection() {
        this.model.toggleSelection();
    }

}

MainComponent.template = 'mrp_mps.mrp_mps';
MainComponent.components = {
    WithSearch,
    MpsLineComponent,
    CheckBox,
};

registry.category("actions").add("mrp_mps_client_action", MainComponent);

export default MainComponent;
