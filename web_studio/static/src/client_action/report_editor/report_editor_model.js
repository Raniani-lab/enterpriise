/** @odoo-module */
import { Reactive } from "@web_studio/client_action/utils";
import { EventBus, markRaw, onWillStart, reactive, toRaw, useState, useSubEnv } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { omit } from "@web/core/utils/objects";
import { _t } from "@web/core/l10n/translation";
import { useEditorBreadcrumbs } from "@web_studio/client_action/editor/edition_flow";
import { KeepLast } from "@web/core/utils/concurrency";
import { renderToMarkup } from "@web/core/utils/render";
import { makeActiveField } from "@web/model/relational_model/utils";

const notificationErrorTemplate = "web_studio.ReportEditor.NotificationError";

export class ReportEditorModel extends Reactive {
    constructor({ services, resModel }) {
        super();
        this.bus = markRaw(new EventBus());
        this.mode = "wysiwyg";
        this._isDirty = false;
        this._isInEdition = false;
        this._services = markRaw(services);
        this.paperFormat = {
            margin_top: 0,
            margin_left: 0,
            margin_right: 0,
            print_page_width: 210,
            print_page_height: 297,
        };
        this.reportFields = markRaw({
            id: { name: "id", type: "number" },
            name: { name: "name", type: "char" },
            model: { name: "model", type: "char" },
            report_name: { name: "report_name", type: "char" },
            groups_id: {
                name: "groups_id",
                type: "many2many",
                relation: "res.groups",
                relatedFields: {
                    display_name: { type: "char" },
                },
            },
            paperformat_id: {
                name: "paperformat_id",
                type: "many2one",
                relation: "report.paperformat",
            },
            binding_model_id: { name: "binding_model_id", type: "many2one", relation: "ir.model" },
            attachment_use: { name: "attachment_use", type: "boolean" },
            attachment: { name: "attachment", type: "char" },
            // fake field
            display_in_print_menu: { name: "display_in_print_menu", type: "boolean" },
        });
        this.reportActiveFields = markRaw({
            id: makeActiveField(),
            name: makeActiveField(),
            model: makeActiveField(),
            report_name: makeActiveField(),
            groups_id: {
                ...makeActiveField(),
                related: {
                    fields: { display_name: { name: "display_name", type: "char" } },
                    activeFields: { display_name: makeActiveField() },
                },
            },
            paperformat_id: makeActiveField(),
            binding_model_id: makeActiveField(),
            attachment_use: makeActiveField(),
            attachment: makeActiveField(),
            // fake field
            display_in_print_menu: makeActiveField(),
        });
        this.reportEnv = {};
        this.loadHtmlKeepLast = markRaw(new KeepLast());

        this._reportArchs = {};
        this.renderKey = 1;
    }

    get reportData() {
        return this._reportChanges || this._reportData;
    }

    set reportData(_data) {
        const fields = this.reportFields;
        const data = { ..._data };
        for (const [fName, value] of Object.entries(data)) {
            const field = fields[fName];
            if (field.type === "many2many") {
                data[fName] = [...value.currentIds];
            }
        }
        this._reportChanges = data;
    }

    get reportResModel() {
        return this._services.studio.editedAction.res_model;
    }

    get editedReportId() {
        return this._services.studio.editedReport.res_id;
    }

    get reportQweb() {
        return this._reportArchs.reportQweb;
    }

    get reportHtml() {
        return this._reportArchs.reportHtml;
    }

    get isDirty() {
        return this._reportChanges || this._isDirty;
    }

    set isDirty(bool) {
        this._isDirty = bool;
    }

    get isInEdition() {
        return this._isInEdition;
    }

    set isInEdition(value) {
        value = !!value; // enforce boolean
        if (this._isInEdition === value) {
            return;
        }
        this._isInEdition = value;
        if (value) {
            this._services.ui.block();
        } else {
            this._services.ui.unblock();
        }
    }

    _resetInternalArchs() {
        // We do this by explicitly bypassing reactivity, we don't want any re-render doing this.
        // _reportsArchs acts as flag, meaning that if one of the arch is not present
        // the relevant function will fetch them. see @loadReportQweb and @loadReportHtml
        toRaw(this)._reportArchs = {};
    }

    async loadReportEditor() {
        return Promise.all([this.loadReportData(), this.loadModelEnv()]);
    }

    async loadReportData() {
        const data = await this._services.rpc("/web_studio/load_report_editor", {
            report_id: this.editedReportId,
            fields: Object.keys(omit(this.reportActiveFields, "display_in_print_menu")),
        });
        this._reportData = this._parseFakeFields(data.report_data);
        Object.assign(this.paperFormat, data.paperformat);

        this._reportArchs.reportQweb = data.report_qweb;
        this._isLoaded = true;
    }

    async loadReportQweb() {
        if (!this._isLoaded) {
            return;
        }
        if (this._reportArchs.reportQweb) {
            return;
        }

        try {
            const reportQweb = await this.loadHtmlKeepLast.add(
                this._services.rpc("/web_studio/get_report_qweb", {
                    report_id: this.editedReportId,
                })
            );
            this._reportArchs.reportQweb = reportQweb;
        } catch {
            // TODO: display some sort of intelligible error
            this._reportArchs.reportQweb = "";
        }
        this.isInEdition = false;
    }

    async loadReportHtml({ resId } = {}) {
        if (!this._isLoaded) {
            return;
        }
        if (resId === undefined && this._reportArchs.reportHtml) {
            return;
        }
        this.reportEnv.currentId = resId !== undefined ? resId : this.reportEnv.currentId;
        try {
            const reportHtml = await this.loadHtmlKeepLast.add(
                this._services.rpc("/web_studio/get_report_html", {
                    report_id: this.editedReportId,
                    record_id: this.reportEnv.currentId || 0,
                })
            );
            this._reportArchs.reportHtml = reportHtml;
        } catch {
            // TODO: display some sort of intelligible error
            this._reportArchs.reportHtml = "";
        }
        this.isInEdition = false;
    }

    async saveReport({ htmlParts, urgent, xmlVerbatim } = {}) {
        const hasPartsToSave = htmlParts && Object.keys(htmlParts).length;
        const hasVerbatimToSave = xmlVerbatim && Object.keys(xmlVerbatim).length;
        const hasDataToSave = this.isDirty;
        if (hasVerbatimToSave && hasPartsToSave) {
            throw new Error(_t("Saving both some report's parts and full xml is not permitted."));
        }
        if (!hasVerbatimToSave && !hasPartsToSave && !hasDataToSave) {
            return;
        }
        if (!urgent) {
            this.isInEdition = true;
        }

        let result;
        try {
            result = await this._services.unProtectedRpc(
                "/web_studio/save_report",
                {
                    report_id: this.editedReportId,
                    report_changes: this._reportChanges || null,
                    html_parts: htmlParts || null,
                    xml_verbatim: xmlVerbatim || null,
                    record_id: this.reportEnv.currentId || null,
                },
                { silent: urgent }
            );
        } catch {
            this.isInEdition = false;
            if (!urgent) {
                this.isDirty = false;
                this.renderKey++;
            }
            const message = renderToMarkup(notificationErrorTemplate, {
                reportName: this._reportData.name,
                recordId: this.reportEnv.currentId,
            });
            this._services.unProtectedNotification.add(message, {
                type: "warning",
                title: _t("Report edition failed"),
            });
            return;
        }
        if (hasPartsToSave || hasVerbatimToSave) {
            this._resetInternalArchs();
        }
        const { report_data, paperformat, report_html, report_qweb } = result || {};
        if (!urgent && report_data) {
            this._reportData = this._parseFakeFields(report_data);
            this._reportChanges = null;
            this.paperFormat = paperformat;
        }

        this.isDirty = false;
        if (!urgent) {
            this._reportArchs.reportHtml = report_html;
            this._reportArchs.reportQweb = report_qweb;
        }
        this.isInEdition = false;
    }

    /**
     * Load and set the report environment.
     *
     * If the report is associated to the same model as the Studio action, the
     * action ids will be used ; otherwise a search on the report model will be
     * performed.
     *
     * @private
     * @returns {Promise}
     */
    async loadModelEnv() {
        if (this.reportEnv.ids) {
            return;
        }
        const modelName = this.reportResModel;
        const result = await this._services.orm.search(modelName, this.getModelDomain(), {
            context: this._services.user.context,
        });

        this.reportEnv = {
            ids: result,
            currentId: result[0],
        };
    }

    getModelDomain() {
        // TODO: Since 13.0, journal entries are also considered as 'account.move',
        // therefore must filter result to remove them; otherwise not possible
        // to print invoices and hard to lookup for them if lot of journal entries.
        const modelName = this.reportResModel;
        let domain = [];
        if (modelName === "account.move") {
            domain = [["move_type", "!=", "entry"]];
        }
        return domain;
    }

    async resetReport() {
        this.isInEdition = true;
        await this._services.rpc("/web_studio/reset_report_archs", {
            report_id: this.editedReportId,
        });

        this._resetInternalArchs();
        await this.loadReportQweb();
    }

    _parseFakeFields(reportData) {
        reportData.display_in_print_menu = !!reportData.binding_model_id;
        return reportData;
    }
}

export function useReportEditorModel() {
    const services = Object.fromEntries(
        ["orm", "user", "rpc", "ui"].map((name) => {
            return [name, useService(name)];
        })
    );
    const env = owl.useEnv();
    services.studio = { ...env.services.studio };
    services.unProtectedRpc = env.services.rpc;
    services.unProtectedNotification = env.services.notification;
    const reportEditorModel = new ReportEditorModel({ services });
    useSubEnv({ reportEditorModel });

    function getName(rem) {
        return rem.reportData?.name;
    }
    const crumb = reactive({});
    const rem = reactive(reportEditorModel, () => {
        crumb.name = getName(rem);
    });
    crumb.name = getName(rem);
    useEditorBreadcrumbs(crumb);

    onWillStart(() => reportEditorModel.loadReportEditor());

    return useState(reportEditorModel);
}
