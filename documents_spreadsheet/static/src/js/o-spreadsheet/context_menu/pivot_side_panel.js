odoo.define("documents_spreadsheet.pivot_side_panel", function (require) {
    "use strict";

    const core = require("web.core");
    const { ComponentAdapter } = require("web.OwlCompatibility");
    const DomainSelector = require("web.DomainSelector");
    const spreadsheet = require("documents_spreadsheet.spreadsheet_extended");
    const pivotUtils = require("documents_spreadsheet.pivot_utils");

    const _t = core._t;
    const sidePanelRegistry = spreadsheet.registries.sidePanelRegistry;
    const { useState } = owl.hooks;

    /**
     * ComponentAdapter to allow using DomainSelector in a owl Component
     */
    class DomainComponentAdapter extends ComponentAdapter {
        get widgetArgs() {
            return [this.props.model, this.props.domain, { readonly: true, filters: {} }];
        }
    }

    class PivotSidePanel extends owl.Component {
        constructor(parent, props) {
            super(...arguments);
            this.state = useState({
                pivotId: undefined,
            });
            this.pivot = props.pivot;
            this.DomainSelector = DomainSelector;
            this.periods = {
                day: _t("Day"),
                week: _t("Week"),
                month: _t("Month"),
                quarter: _t("Quarter"),
                year: _t("Year"),
            };
        }

        async willUpdateProps(nextProps) {
            this.pivot = nextProps.pivot;
        }

        /**
         * Format the given groupby
         * @param {string} gp Groupby to format
         *
         * @returns groupby formatted
         */
        formatGroupBy(gp) {
            return pivotUtils.formatGroupBy(this.pivot, gp);
        }

        /**
         * Format the given measure
         * @param {string} measure Measure to format
         *
         * @returns measure formatted
         */
        formatMeasure(measure) {
            return this.pivot.cache.getField(measure.field).string || _t("Count");
        }
    }
    PivotSidePanel.template = "documents_spreadsheet.PivotSidePanel";
    PivotSidePanel.components = { DomainComponentAdapter };

    sidePanelRegistry.add("PIVOT_PROPERTIES_PANEL", {
        title: (env) => {
            const pivot = env.getters.getSelectedPivot();
            return _.str.sprintf(_t("Pivot properties (#%s)"), pivot && pivot.id);
        },
        Body: PivotSidePanel,
    });
});
