/** @odoo-module */
import { Component, useState } from "@odoo/owl";

import { Record } from "@web/views/record";
import { Many2OneField } from "@web/views/fields/many2one/many2one_field";
import { Pager } from "@web/core/pager/pager";

export class ReportRecordNavigation extends Component {
    static components = { Record, Pager, Many2OneField };
    static template = "web_studio.ReportEditor.ReportRecordNavigation";
    static props = {};

    setup() {
        this.reportEditorModel = useState(this.env.reportEditorModel);
        this.searchRecordFields = {
            record_id: { type: "many2one", relation: this.reportEditorModel.reportResModel },
        };
        this.m2oSelectorContext = "{ 'studio': False }";
    }

    get pagerProps() {
        const { reportEnv } = this.reportEditorModel;
        const { ids, currentId } = reportEnv;
        return {
            limit: 1,
            offset: ids.indexOf(currentId),
            total: ids.length,
        };
    }

    get searchRecordProps() {
        const currentId = this.reportEditorModel.reportEnv.currentId;
        return {
            fields: this.searchRecordFields,
            activeFields: this.searchRecordFields,
            values: {
                record_id: currentId ? [currentId] : false,
            },
        };
    }

    updatePager({ offset }) {
        const ids = this.reportEditorModel.reportEnv.ids;
        const resId = ids[offset];
        this.reportEditorModel.loadReportHtml({ resId });
    }

    updateSearch(rec) {
        const resId = rec.data.record_id && rec.data.record_id[0];
        this.reportEditorModel.loadReportHtml({ resId });
    }
}
