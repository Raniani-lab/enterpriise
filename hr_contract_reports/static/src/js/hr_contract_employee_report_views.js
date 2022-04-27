/** @odoo-module **/

import { registry } from '@web/core/registry';
import { graphView } from '@web/views/graph/graph_view';
import { pivotView } from '@web/views/pivot/pivot_view';
import { useService } from "@web/core/utils/hooks";

import Widget from 'web.Widget';
import PieChart from 'web.PieChart';
import { loadLegacyViews } from '@web/legacy/legacy_views';
import view_registry from 'web.view_registry';
import widget_registry from 'web.widget_registry';

const viewRegistry = registry.category('views');

/**
 * Open the hr.contract instead of the report list view.
 */
function openView(title, domain, context, orm, actionService) {
    orm.call('hr.contract.employee.report', 'search_read', [], {
            context: context,
            domain: domain,
            fields: ['id'], // id is equal to contract_id
        },
    ).then((res) => {
        const contractDomain = [['id', 'in', res.map((r) => r.id)]];
        actionService.doAction({
            type: "ir.actions.act_window",
            name: title,
            res_model: 'hr.contract',
            views: [[false, "list"], [false, "form"]],
            view_mode: "list",
            target: "current",
            context,
            domain: contractDomain,
        });
    })
}

export class HrContractEmployeeReportGraphController extends graphView.Controller {
    /**
     * @override
     */
    setup() {
        this.orm = useService('orm');
        super.setup();
    }
    /**
     * @override
     */
    openView(domain, views, context) {
        openView(this.model.metaData.title, domain,
            context, this.orm, this.actionService);
    }
}

viewRegistry.add("contract_employee_report_graph", {
    ...graphView,
    Controller: HrContractEmployeeReportGraphController,
});

export class HrContractEmployeeReportPivotController extends pivotView.Controller {
    /**
     * @override
     */
    setup() {
        this.orm = useService('orm');
        super.setup();
    }
    /**
     * @override
     */
     openView(domain, views, context) {
        openView(this.model.metaData.title, domain,
            context, this.orm, this.actionService);
    }
}

viewRegistry.add("contract_employee_report_pivot", {
    ...pivotView,
    Controller: HrContractEmployeeReportPivotController
});

export const HrContractEmployeeReportPieChart = PieChart.extend({
    /**
     * Due to the fact that the widget uses the legacy graph view we can not use
     *  our owl graph view easily in the pieChart (importing the legacy view does not work).
     *
     * @override
     */
     willStart: async function () {
        // Skip PieChart.willStart
        const _super = Widget.prototype.willStart.bind(this, ...arguments);
        await loadLegacyViews({ rpc: this._rpc.bind(this) });
        const def1 = _super();

        const SubView = view_registry.get('graph');
        const ReportGraphController = SubView.prototype.config.Controller.extend({
            /**
             * @override
             */
            _onOpenView(ev) {
                ev.stopPropagation();
                const state = this.model.get();
                const context = Object.assign({}, state.context);
                Object.keys(context).forEach(x => {
                    if (x === 'group_by' || x.startsWith('search_default_')) {
                        delete context[x];
                    }
                });
                this._rpc({
                    model: 'hr.contract.employee.report',
                    method: 'search_read',
                    context: context,
                    kwargs: {
                        domain: ev.data.domain,
                        fields: ['id'], // id is equal to contract_id
                    }
                }).then((res) => {
                    const contractDomain = [['id', 'in', res.map((r) => r.id)]];
                    this.do_action({
                        type: "ir.actions.act_window",
                        name: this.title,
                        res_model: 'hr.contract',
                        views: [[false, "list"], [false, "form"]],
                        view_mode: "list",
                        target: "current",
                        context,
                        domain: contractDomain,
                    });
                });
            },
        });
        const ReportGraphView = SubView.extend({
            config: Object.assign({}, SubView.prototype.config, {
                Controller: ReportGraphController,
            }),
        })
        const subView = new ReportGraphView(this.viewInfo, this.subViewParams);
        const def2 = subView.getController(this).then((controller) => {
            this.controller = controller;
            return this.controller.appendTo(document.createDocumentFragment());
        });
        return Promise.all([def1, def2]);
    },
});

widget_registry.add("contract_employee_report_pie_chart", HrContractEmployeeReportPieChart);
