/** @odoo-module */

import { _t } from "web.core";
import DomainSelector from "web.DomainSelector";
import { time_to_str } from "web.time";
import DomainComponentAdapter from "../../legacy/domain_component_adapter";

const { Component, onWillStart } = owl;

export default class PivotDetailsSidePanel extends Component {
    setup() {
        this.DomainSelector = DomainSelector;
        this.spreadsheetModel = undefined;
        this.pivotDefinition = {};

        onWillStart(async () => {
            this.spreadsheetModel = await this.env.model.getters.getAsyncSpreadsheetPivotModel(
                this.props.pivotId
            );
            const definition = this.env.model.getters.getPivotDefinition(this.props.pivotId);
            this.pivotDefinition = {
                model: definition.model,
                modelDisplayName: this.spreadsheetModel.getModelLabel(),
                pivotDisplayName: this.env.model.getters.getPivotDisplayName(this.props.pivotId),
                domain: definition.domain,
                dimensions: [...definition.rowGroupBys, ...definition.colGroupBys],
                measures: definition.measures.map((measure) =>
                    this.spreadsheetModel.getPivotHeaderValue("measure", measure)
                ),
            };
        });
    }

    /**
     * Get the last update date, formatted
     *
     * @returns {string} date formatted
     */
    getLastUpdate() {
        const lastUpdate = this.env.model.getters
            .getSpreadsheetPivotDataSource(this.props.pivotId)
            .lastUpdate;
        if (lastUpdate) {
            return time_to_str(new Date(lastUpdate));
        }
        return _t("never");
    }

    /**
     * Refresh the cache of the current pivot
     *
     */
    refresh() {
        this.env.model.dispatch("REFRESH_PIVOT", { id: this.props.pivotId });
    }
}
PivotDetailsSidePanel.template = "documents_spreadsheet.PivotDetailsSidePanel";
PivotDetailsSidePanel.components = { DomainComponentAdapter };
PivotDetailsSidePanel.props = {
    pivotId: {
        type: String,
        optional: true,
    },
};
