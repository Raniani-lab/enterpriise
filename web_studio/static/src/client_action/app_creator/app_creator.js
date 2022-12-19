/** @odoo-module **/

import { Component, useExternalListener, useState } from "@odoo/owl";
import { useAutofocus, useService } from "@web/core/utils/hooks";
import { BG_COLORS, COLORS, ICONS } from "@web_studio/utils";
import { Record } from "@web/views/record";
import { ModelConfigurator } from "@web_studio/client_action/model_configurator/model_configurator";
import { IconCreator } from "../icon_creator/icon_creator";
import { _lt } from "@web/core/l10n/translation";
import { Many2OneField } from "@web/views/fields/many2one/many2one_field";

class AppCreatorState {
    /**
     * @param {Function} onFinished
     */
    constructor({ onFinished }) {
        // ================== Fields ==================
        this.fieldsInfo = {
            modelId: {
                relation: "ir.model",
                domain: [
                    ["transient", "=", false],
                    ["abstract", "=", false],
                ],
                type: "many2one",
            },
            modelChoice: {
                type: "selection",
                selection: [
                    ["new", _lt("New Model")],
                    ["existing", _lt("Existing Model")],
                ],
            },
        };

        this.fieldsValidators = {
            appName: () => !!this.data.appName,
            menuName: () => !!this.data.menuName,
            modelId: () => this.data.modelChoice === "new" || !!this.data.modelId,
        };

        this.data = {
            appName: "",
            iconData: {
                backgroundColor: BG_COLORS[5],
                color: COLORS[4],
                iconClass: ICONS[0],
                type: "custom_icon",
            },
            menuName: "",
            modelChoice: "new",
            modelId: false,
            modelOptions: [],
        };

        // ================== Steps ==================
        const data = this.data;
        this._steps = {
            welcome: {
                next: "app",
            },
            app: {
                previous: "welcome",
                next: "model",
                fields: ["appName"],
            },
            model: {
                previous: "app",
                get next() {
                    return data.modelChoice === "new" ? "model_configuration" : "";
                },
                fields: ["menuName", "modelId"],
            },
            model_configuration: {
                previous: "model",
            },
        };

        // ==================== Misc ====================
        this._invalidFields = new Set();
        this._onFinished = onFinished;
        this.step = "welcome";
    }

    //--------------------------------------------------------------------------
    // Getters
    //--------------------------------------------------------------------------

    get step() {
        return this._step;
    }

    set step(step) {
        this._step = step;
        this._invalidFields.clear();
    }

    get nextStep() {
        return this._stepInvalidFields.length ? false : this._currentStep.next;
    }

    get hasPrevious() {
        return "previous" in this._currentStep;
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    isFieldValid(fieldName) {
        return !this._invalidFields.has(fieldName);
    }

    validateField(fieldName) {
        if (this.fieldsValidators[fieldName]()) {
            this._invalidFields.delete(fieldName);
        } else {
            this._invalidFields.add(fieldName);
        }
    }

    next() {
        const invalidFields = this._stepInvalidFields;
        if (invalidFields.length) {
            this._invalidFields = new Set(invalidFields);
            return;
        }
        const next = this._currentStep.next;
        if (next) {
            this.step = next;
        } else {
            return this._onFinished();
        }
    }

    previous() {
        if (this._currentStep.previous) {
            this.step = this._currentStep.previous;
        }
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    get _currentStep() {
        return this._steps[this._step];
    }

    get _stepInvalidFields() {
        return (this._currentStep.fields || []).filter((fName) => {
            return !this.fieldsValidators[fName]();
        });
    }
}

export class AppCreator extends Component {
    static template = "web_studio.AppCreator";
    static components = { IconCreator, ModelConfigurator, Record, Many2OneField };
    static props = {
        onNewAppCreated: { type: Function },
    };

    setup() {
        this.state = useState(
            new AppCreatorState({
                onFinished: this.createNewApp.bind(this),
            })
        );

        this.uiService = useService("ui");
        this.rpc = useService("rpc");
        this.user = useService("user");

        useAutofocus();
        useExternalListener(window, "keydown", this.onKeydown);
    }

    /**
     * @returns {Promise}
     */
    async createNewApp() {
        this.uiService.block();
        const data = this.state.data;
        const iconData = data.iconData;

        const iconValue =
            iconData.type === "custom_icon"
                ? // custom icon data
                  [iconData.iconClass, iconData.color, iconData.backgroundColor]
                : // attachment
                  iconData.uploaded_attachment_id;

        try {
            const result = await this.rpc("/web_studio/create_new_app", {
                app_name: data.appName,
                menu_name: data.menuName,
                model_choice: data.modelChoice,
                model_id: data.modelChoice && data.modelId[0],
                model_options: data.modelOptions,
                icon: iconValue,
                context: this.user.context,
            });
            await this.props.onNewAppCreated(result);
        } finally {
            this.uiService.unblock();
        }
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @param {KeyboardEvent} ev
     */
    onKeydown(ev) {
        if (
            ev.key === "Enter" &&
            !(
                ev.target.classList &&
                ev.target.classList.contains("o_web_studio_app_creator_previous")
            )
        ) {
            ev.preventDefault();
            this.state.next();
        }
    }

    /**
     * Handle the confirmation of options in the modelconfigurator
     * @param {Object} options
     */
    onConfirmOptions(options) {
        const mappedOptions = Object.entries(options)
            .filter((opt) => opt[1].value)
            .map((opt) => opt[0]);

        this.state.data.modelOptions = mappedOptions;
        return this.state.next();
    }
}
