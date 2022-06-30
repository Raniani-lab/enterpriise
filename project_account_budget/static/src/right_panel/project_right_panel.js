/** @odoo-module */

import config from 'web.config';
import { patch } from 'web.utils';
import { ProjectRightSidePanelComponent } from '@project/js/right_panel/project_utils';
import ProjectRightPanel from '@project/js/right_panel/project_right_panel';

export class AddBudget extends ProjectRightSidePanelComponent {
    setup() {
        super.setup();
        this.contextValue = Object.assign({}, {
            'project_update': true,
        }, this.contextValue);
    }

    async openLegacyFormDialog(params) {
        return super.openLegacyFormDialog({
            res_model: "crossovered.budget",
            on_saved: this.props.onBudgetUpdate,
            disable_multiple_selection: true,
            save_text: this.env._t('Save & Confirm'),
            ...params,
        });
    }

    /**
     * Handler for Add Budget button click.
     *
     * @param {MouseClick} event
     */
    onAddBudgetClick(event) {
        event.stopPropagation();
        this.openLegacyFormDialog({
            _createContext: () => {
                return this.context;
            },
            title: this.env._t('New Budget'),
            view_id: this.props.form_view_id || false,
        });
    }
}
AddBudget.template = 'project_account_budget.AddBudget';

ProjectRightPanel.components = { ...ProjectRightPanel.components, AddBudget };

if (config.device.isMobile) {
    patch(ProjectRightPanel.prototype, 'project_account_budget.ProjectRightPanel', {
        setup() {
            this._super();
            this.section.budget = {
                closed: true,
            };
        },
    });
}
