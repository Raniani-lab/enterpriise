/* @odoo-module */

import { download } from "@web/core/network/download";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { ControlPanel } from "@web/search/control_panel/control_panel";
import { SearchPanel } from "@web/search/search_panel/search_panel";
import { useModel } from "@web/views/helpers/model";
import { useSetupView } from "@web/views/helpers/view_hook";
import { CohortArchParser } from "@web_cohort/cohort_view/cohort_arch_parser";
import { CohortModel, INTERVALS } from "@web_cohort/cohort_view/cohort_model";
import { CohortRenderer } from "@web_cohort/cohort_view/cohort_renderer";

class CohortView extends owl.Component {
    setup() {
        this.actionService = useService("action");
        this.intervals = INTERVALS;
        let { state: localState } = this.props;
        if (!localState) {
            const { arch, fields } = this.props;
            const archInfo = new CohortArchParser().parse(arch, fields);
            localState = {
                ...archInfo,
                measure: archInfo.measure,
                interval: archInfo.interval,
            };
        }

        const { additionalMeasures, resModel, useSampleModel, fields, info } = this.props;
        const modelParams = Object.assign(
            { additionalMeasures, resModel, useSampleModel, fields, info },
            localState
        );
        this.model = useModel(CohortModel, modelParams);

        useSetupView({
            exportLocalState: () => ({
                ...localState,
                measure: this.model.metaData.measure,
                interval: this.model.metaData.interval,
            }),
            saveParams: () => this.saveParams(),
        });
    }

    /**
     * @param {CustomEvent} ev
     */
    onOpenView(ev) {
        const row = ev.detail;
        if (row.value === undefined) {
            return;
        }

        const context = Object.assign({}, this.model.searchParams.context);
        const domain = row.domain;
        const views = {};
        for (const [viewId, viewType] of this.props.info.views || []) {
            views[viewType] = viewId;
        }
        function getView(viewType) {
            return [context[`${viewType}_view_id`] || views[viewType] || false, viewType];
        }
        const actionViews = [getView("list"), getView("form")];
        this.actionService.doAction({
            type: "ir.actions.act_window",
            name: this.model.metaData.title,
            res_model: this.model.metaData.resModel,
            views: actionViews,
            view_mode: "list",
            target: "current",
            context: context,
            domain: domain,
        });
    }

    /**
     * Export cohort data in Excel file
     */
    async downloadExcel() {
        const {
            title,
            resModel,
            interval,
            measure,
            measures,
            dateStartString,
            dateStopString,
            timeline,
        } = this.model.metaData;
        const { domains } = this.model.searchParams;
        const data = {
            title: title,
            model: resModel,
            interval_string: this.intervals[interval].toString(), // intervals are lazy-translated
            measure_string: measures[measure].string,
            date_start_string: dateStartString,
            date_stop_string: dateStopString,
            timeline: timeline,
            rangeDescription: domains[0].description,
            report: this.model.data[0],
            comparisonRangeDescription: domains[1] && domains[1].description,
            comparisonReport: this.model.data[1],
        };
        this.env.services.ui.block();
        try {
            // FIXME: [SAD/JPP] some data seems to be missing from the export in master. (check the python)
            await download({
                url: "/web/cohort/export",
                data: { data: JSON.stringify(data) },
            });
        } finally {
            this.env.services.ui.unblock();
        }
    }

    saveParams() {
        const { measure, interval } = this.model.metaData;
        return { context: { cohort_measure: measure, cohort_interval: interval } };
    }

    /**
     * @param {CustomEvent} ev
     */
    onDropDownSelected(ev) {
        this.model.updateMetaData(ev.detail.payload);
    }
}
CohortView.type = "cohort";
CohortView.display_name = "Cohort";
CohortView.icon = "fa-signal";
CohortView.multiRecord = true;
CohortView.template = "web_cohort.CohortView";
CohortView.buttonTemplate = "web_cohort.CohortView.Buttons";
CohortView.components = { ControlPanel, Renderer: CohortRenderer, SearchPanel };

CohortView.searchMenuTypes = ["filter", "comparison", "favorite"];

registry.category("views").add("cohort", CohortView);
