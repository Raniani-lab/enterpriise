/** @odoo-module **/
import { useService } from "@web/core/utils/hooks";
import { loadAssets } from "@web/core/assets";
import { useSetupAction } from "@web/webclient/actions/action_hook";

import { UNTITLED_SPREADSHEET_NAME } from "../o_spreadsheet/constants"
import { getDataFromTemplate } from "../o_spreadsheet/helpers";
import { initCallbackRegistry } from "../o_spreadsheet/o_spreadsheet_extended";
import { LegacyComponent } from "@web/legacy/legacy_component";

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
        this.isEmptySpreadsheet = !(this.params.spreadsheet_id ||
            this.params.active_id);
        this.resId = this.params.spreadsheet_id ||
            this.params.active_id || // backward compatibility. spreadsheet_id used to be active_id
            this.props.state && this.props.state.resId; // used when going back to a spreadsheet via breadcrumb
        this.router = useService("router");
        this.actionService = useService("action");
        this.notifications = useService("notification");
        this.orm = useService("orm");
        useSetupAction({
            getLocalState: () => {
                return {
                    resId: this.resId,
                }
            },
        });
        this.state = useState({
            spreadsheetName: UNTITLED_SPREADSHEET_NAME,
        });

        onWillStart(() => this.onWillStart());
        onMounted(() => this.onMounted());
    }

    async onWillStart() {
        const chartLibPromise = loadAssets({
            jsLibs: ["/web/static/lib/Chart/Chart.js"],
        });

        // if we are returning to the spreadsheet via the breadcrumb, we don't want
        // to do all the "creation" options of the actions
        if (!this.props.state) {
            [this.resId, ] = await Promise.all([this._createAddSpreadsheetData(), chartLibPromise]);
        }
        const [record, ] = await Promise.all([this._fetchData(), chartLibPromise]);
        this._initializeWith(record);
    }

    async _createAddSpreadsheetData() {
        let resId = this.resId;
        if (this.params.alwaysCreate) {
            const data = this.params.createFromTemplateId
                ? await getDataFromTemplate(this.orm, this.params.createFromTemplateId)
                : {};
            resId = await this.orm.create("documents.document", {
                name: this.params.createFromTemplateName || UNTITLED_SPREADSHEET_NAME,
                mimetype: "application/o-spreadsheet",
                handler: "spreadsheet",
                raw: JSON.stringify(data),
                folder_id: this.params.folder_id,
            });
        }
        if (this.params.preProcessingAction) {
            const initCallbackGenerator = initCallbackRegistry.get(this.params.preProcessingAction).bind(this);
            this.initCallback = await initCallbackGenerator(this.params.preProcessingActionData);
        }
        return resId;
    }

    onMounted() {
        this.router.pushState({ spreadsheet_id: this.resId });
        this.env.config.setDisplayName(this.state.spreadsheetName)
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
