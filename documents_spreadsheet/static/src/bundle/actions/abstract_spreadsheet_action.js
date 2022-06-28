/** @odoo-module **/
import { useService } from "@web/core/utils/hooks";
import { loadJS } from "@web/core/assets";
import { useSetupAction } from "@web/webclient/actions/action_hook";

import { UNTITLED_SPREADSHEET_NAME } from "@spreadsheet/helpers/constants";
import { getDataFromTemplate } from "@spreadsheet/helpers/helpers";
import spreadsheet, {
    initCallbackRegistry,
} from "@spreadsheet/o_spreadsheet/o_spreadsheet_extended";

import { LegacyComponent } from "@web/legacy/legacy_component";

const { createEmptyWorkbookData } = spreadsheet.helpers;
const { onMounted, onWillStart, useState } = owl;
export class AbstractSpreadsheetAction extends LegacyComponent {
    setup() {
        if (!this.props.action.params) {
            // the action is coming from a this.trigger("do-action", ... ) of owl (not wowl and not legacy)
            this.params = this.props.action.context;
        } else {
            // the action is coming from wowl
            this.params = this.props.action.params;
        }
        this.isEmptySpreadsheet = !(this.params.spreadsheet_id || this.params.active_id);
        this.resId =
            this.params.spreadsheet_id ||
            this.params.active_id || // backward compatibility. spreadsheet_id used to be active_id
            (this.props.state && this.props.state.resId); // used when going back to a spreadsheet via breadcrumb
        this.router = useService("router");
        this.actionService = useService("action");
        this.notifications = useService("notification");
        this.orm = useService("orm");
        useSetupAction({
            getLocalState: () => {
                return {
                    resId: this.resId,
                };
            },
        });
        this.state = useState({
            spreadsheetName: UNTITLED_SPREADSHEET_NAME,
        });

        onWillStart(() => this.onWillStart());
        onMounted(() => this.onMounted());
    }

    async loadChartLibs() {
        await loadJS("/web/static/lib/Chart/Chart.js");
        await loadJS("/documents_spreadsheet/static/lib/chartjs-gauge/chartjs-gauge.js");
    }

    async onWillStart() {
        // if we are returning to the spreadsheet via the breadcrumb, we don't want
        // to do all the "creation" options of the actions
        if (!this.props.state) {
            [this.resId] = await Promise.all([
                this._createAddSpreadsheetData(),
                this.loadChartLibs(),
            ]);
        }
        const [record] = await Promise.all([this._fetchData(), this.loadChartLibs()]);
        this._initializeWith(record);
    }

    async _createAddSpreadsheetData() {
        let resId = this.resId;
        if (this.params.alwaysCreate) {
            const data = this.params.createFromTemplateId
                ? await getDataFromTemplate(this.env, this.orm, this.params.createFromTemplateId)
                : createEmptyWorkbookData(`${this.env._t("Sheet")}1`);
            resId = await this.orm.create("documents.document", {
                name: this.params.createFromTemplateName || UNTITLED_SPREADSHEET_NAME,
                mimetype: "application/o-spreadsheet",
                handler: "spreadsheet",
                raw: JSON.stringify(data),
                folder_id: this.params.createInFolderId,
            });
        }
        if (this.params.preProcessingAction) {
            const initCallbackGenerator = initCallbackRegistry
                .get(this.params.preProcessingAction)
                .bind(this);
            this.initCallback = await initCallbackGenerator(this.params.preProcessingActionData);
        }
        if (this.params.preProcessingAsyncAction) {
            const initCallbackGenerator = initCallbackRegistry
                .get(this.params.preProcessingAsyncAction)
                .bind(this);
            this.asyncInitCallback = await initCallbackGenerator(
                this.params.preProcessingAsyncActionData
            );
        }
        return resId;
    }

    onMounted() {
        this.router.pushState({ spreadsheet_id: this.resId });
        this.env.config.setDisplayName(this.state.spreadsheetName);
    }

    async _onMakeCopy() {
        throw new Error("not implemented by children");
    }
    async _onNewSpreadsheet() {
        throw new Error("not implemented by children");
    }
    async _onSpreadsheetSaved() {
        throw new Error("not implemented by children");
    }
    async _onSpreadSheetNameChanged() {
        throw new Error("not implemented by children");
    }
    async _fetchData() {
        throw new Error("not implemented by children");
    }

    /**
     * Open a spreadsheet
     * @private
     */
    _openSpreadsheet(spreadsheet_id) {
        this.notifications.add(this.notificationMessage, {
            type: "info",
            sticky: false,
        });
        this.actionService.doAction(
            {
                type: "ir.actions.client",
                tag: this.props.action.tag,
                params: { spreadsheet_id },
            },
            { clear_breadcrumbs: true }
        );
    }
}
