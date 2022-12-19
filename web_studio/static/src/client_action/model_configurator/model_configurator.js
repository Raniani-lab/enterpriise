/** @odoo-module **/
import Dialog from "web.Dialog";
import { ComponentWrapper, WidgetAdapterMixin } from "web.OwlCompatibility";

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
            await this.props.onConfirmOptions({ ...this.options });
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

/**
 * Wrapper to make the ModelConfigurator usable as a standalone dialog. Used notably
 * by the 'NewMenuDialog' in Studio. Note that since the ModelConfigurator does not
 * have its own modal, I choose to use the classic Dialog and use it as an adapter
 * instead of using an owlDialog + another adapter on top of it. Don't @ me.
 *
 * I've taken a few liberties with the standard Dialog: removed the footer
 * (there's no need for it, the modelconfigurator has its own footer), it's a single
 * size, etc. Nothing crazy.
 */
export const ModelConfiguratorDialog = Dialog.extend(WidgetAdapterMixin, {
    /**
     * @override
     */
    init(parent, options) {
        const res = this._super.apply(this, arguments);
        this.renderFooter = false;
        (this.title = _t("Suggested features for your new model")),
            (this.confirmLabel = options.confirmLabel);
        this.onForceClose = () => this.trigger_up("cancel_options");
        return res;
    },

    /**
     * Owl Wrapper override, as described in web.OwlCompatibility
     * @override
     */
    async start() {
        const res = await this._super.apply(this, arguments);
        this.component = new ComponentWrapper(this, ModelConfigurator, {
            label: this.confirmLabel,
            embed: true,
            onPrevious: this.onPrevious.bind(this),
            onConfirmOptions: (payload) => this.trigger_up("confirm_options", payload),
        });
        this.component.mount(this.el);
        return res;
    },

    /**
     * Proper handler calling since Dialog doesn't seem to do it
     * @override
     */
    close() {
        this.on_detach_callback();
        return this._super.apply(this, arguments);
    },

    /**
     * Needed because of the WidgetAdapterMixin
     * @override
     */
    destroy() {
        WidgetAdapterMixin.destroy.call(this);
        return this._super();
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    on_attach_callback() {
        WidgetAdapterMixin.on_attach_callback.call(this);
        return this._super.apply(this, arguments);
    },

    /**
     * @override
     */
    on_detach_callback() {
        WidgetAdapterMixin.on_detach_callback.call(this);
        return this._super.apply(this, arguments);
    },

    /**
     * Handle the 'previous' button, which in this case should close the Dialog.
     * @private
     */
    onPrevious() {
        this.trigger_up("cancel_options");
        this.close();
    },
});
