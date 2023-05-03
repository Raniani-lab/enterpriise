/** @odoo-module **/
import { Dialog } from "@web/core/dialog/dialog";
import { Component, useState } from "@odoo/owl";
import { _lt, _t } from "@web/core/l10n/translation";
import { session } from "@web/session";

/** You might wonder why I defined all these strings here and not in the template.
 * The reason is that I wanted clear templates that use a single element to render an option,
 * meaning that the label and helper text had to be defined here in the code.
 */
function getModelOptions() {
    const modelOptions = {
        use_partner: {
            label: _lt("Contact details"),
            help: _lt("Get contact, phone and email fields on records"),
            value: false,
        },
        use_responsible: {
            label: _lt("User assignment"),
            help: _lt("Assign a responsible to each record"),
            value: false,
        },
        use_date: {
            label: _lt("Date & Calendar"),
            help: _lt("Assign dates and visualize records in a calendar"),
            value: false,
        },
        use_double_dates: {
            label: _lt("Date range & Gantt"),
            help: _lt("Define start/end dates and visualize records in a Gantt chart"),
            value: false,
        },
        use_stages: {
            label: _lt("Pipeline stages"),
            help: _lt("Stage and visualize records in a custom pipeline"),
            value: false,
        },
        use_ltags: {
            label: _lt("Tags"),
            help: _lt("Categorize records with custom tags"),
            value: false,
        },
        use_image: {
            label: _lt("Picture"),
            help: _lt("Attach a picture to a record"),
            value: false,
        },
        lines: {
            label: _lt("Lines"),
            help: _lt("Add details to your records with an embedded list view"),
            value: false,
        },
        use_notes: {
            label: _lt("Notes"),
            help: _lt("Write additional notes or comments"),
            value: false,
        },
        use_value: {
            label: _lt("Monetary value"),
            help: _lt("Set a price or cost on records"),
            value: false,
        },
        use_company: {
            label: _lt("Company"),
            help: _lt("Restrict a record to a specific company"),
            value: false,
        },
        use_sequence: {
            label: _lt("Custom Sorting"),
            help: _lt("Manually sort records in the list view"),
            value: true,
        },
        use_mail: {
            label: _lt("Chatter"),
            help: _lt("Send messages, log notes and schedule activities"),
            value: true,
        },
        use_active: {
            label: _lt("Archiving"),
            help: _lt("Archive deprecated records"),
            value: true,
        },
    };
    if (!session.display_switch_company_menu) {
        delete modelOptions.use_company;
    }
    return modelOptions;
}

export class ModelConfigurator extends Component {
    setup() {
        this.state = useState({ saving: false });
        this.options = useState(getModelOptions());
    }

    /**
     * Handle the confirmation of the dialog, just fires an event
     * to whoever instanciated it.
     */
    async onConfirm() {
        try {
            this.state.saving = true;

            const mappedOptions = Object.entries(this.options)
                .filter((opt) => opt[1].value)
                .map((opt) => opt[0]);

            await this.props.onConfirmOptions(mappedOptions);
        } finally {
            this.state.saving = false;
        }
    }
}

ModelConfigurator.template = "web_studio.ModelConfigurator";
ModelConfigurator.components = {};
ModelConfigurator.props = {
    embed: { type: Boolean, optional: true },
    label: { type: String },
    onConfirmOptions: Function,
    onPrevious: Function,
};

export class ModelConfiguratorDialog extends Component {
    static components = { Dialog, ModelConfigurator };
    static template = "web_studio.ModelConfiguratorDialog";

    static props = {
        confirm: { type: Function },
        close: { type: Function },
        confirmLabel: { type: String, optional: true },
    };

    async onConfirm(data) {
        await this.props.confirm(data);
        this.props.close();
    }

    onPrevious() {
        this.props.close();
    }

    get title() {
        return _t("Suggested features for your new model");
    }
}
