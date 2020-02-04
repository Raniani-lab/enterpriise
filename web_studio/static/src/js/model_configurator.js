odoo.define('web_studio.ModelConfigurator', function (require) {
    "use strict";

    const config = require('web.config');
    const Dialog = require('web.Dialog');
    const { WidgetAdapterMixin, ComponentWrapper} = require('web.OwlCompatibility');


    const { Component, hooks } = owl;
    const { useState } = hooks;

    class ModelConfigurator extends Component {
        constructor(parent, props) {
            super(parent, props);
            this.state = useState({
                /** You might wonder why I defined all these strings here and not in the template.
                 * The reason is that I wanted clear templates that use a single element to render an option,
                 * meaning that the label and helper text had to be defined here in the code.
                */
                options: {
                    use_partner: { label: this.env._t('Partner'), help: this.env._t('Add a contact link, phone and email fields.'), value: false },
                    use_responsible: { label: this.env._t('Responsible'), help: this.env._t('Assign a user to your object.'), value: false },
                    use_date: { label: this.env._t('Date'), help: this.env._t('Set a date (e.g.: deadline, invoice date, etc.).'), viewType: this.env._t('calendar'), value: false },
                    use_double_dates: { label: this.env._t('Dates (Start & End)'), help: this.env._t('Locate your object in time with a date range.'), viewType: this.env._t('gantt'), value: false },
                    use_stages: { label: this.env._t('Stages'), help: this.env._t('Manage and visualize your object with stages.'), viewType: this.env._t('kanban'), value: false },
                    use_tags: { label: this.env._t('Tags'), help: this.env._t('Create and add tags to qualify your records.'), value: false },
                    use_image: { label: this.env._t('Image'), help: this.env._t('Attach an image to identify your records at a glance.'), value: false },
                    use_notes: { label: this.env._t('Notes'), help: this.env._t('Write additional notes or comments.'), value: false },
                    use_value: { label: this.env._t('Value'), help: this.env._t('Set a price, a cost or a value with a currency.'), value: false },
                    use_company: { label: this.env._t('Company'), help: this.env._t('Restrict access to your object by company.'), value: true },
                    use_active: { label: this.env._t('Active'), help: this.env._t('Archive records you do not need anymore.'), value: true, debug: true },
                    use_mail: { label: this.env._t('Chatter'), help: this.env._t('Send messages, log notes and schedule activities.'), value: true, debug: true },
                    use_sequence: { label: this.env._t('Sequence'), help: this.env._t('Order records in the list view.'), value: true, debug: true },
                },
                saving: false,
            });
            this.multiCompany = this.env.session.display_switch_company_menu;
        }

        /**
         * Handle the confirmation of the dialog, just fires an event
         * to whomever instaciated it.
         *
         * @private
         */
        _onConfirm() {
            this.trigger('confirm-options', Object.assign({}, this.state.options));
            this.state.saving = true;
        }

        /**
         * Handle the 'back button'' of the dialog, just fires an event
         * to whomever instaciated it.
         *
         * @private
         */
        _onPrevious() {
            this.trigger('previous');
        }
    }

    class ModelConfiguratorOption extends Component {
    };

    ModelConfigurator.components = { ModelConfiguratorOption };
    ModelConfigurator.props = {
        debug: { type: Boolean, optional: true },
        embed: { type: Boolean, optional: true },
        label: { type: String },
    };

    ModelConfiguratorOption.props = {
        name: String,
        option: {
            type: Object,
            shape: {
                label: String,
                debug: {
                    type: Boolean,
                    optional: true,
                },
                help: String,
                value: Boolean,
                viewType: {
                    type: String,
                    optional: true,
                }
            }
        }
    };


    const _t = require('web.core')._t;
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
    const ModelConfiguratorDialog = Dialog.extend(WidgetAdapterMixin, {
        custom_events: Object.assign({}, Dialog.prototype.custom_events, {
            'previous': '_onPrevious',
        }),

        /**
         * @override
         */
        init(parent, options) {
            const res = this._super.apply(this, arguments);
            this.renderFooter = false;
            this.title = _t('Recommended fields for your object:'),
            this.confirmLabel = options.confirmLabel;
            this.onForceClose = () => this.trigger_up('cancel_options');
            return res;
        },

        /**
         * Owl Wrapper override, as described in web.OwlCompatibility
         * @override
         */
        async start() {
            const res = await this._super.apply(this, arguments);
            this.component = new ComponentWrapper(this, ModelConfigurator, { label: this.confirmLabel, embed: true, debug: Boolean(config.isDebug()) });
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
        _onPrevious(ev) {
            this.trigger_up('cancel_options');
            this.close();
        },
    });

    return {
        ModelConfigurator: ModelConfigurator,
        ModelConfiguratorDialog: ModelConfiguratorDialog,
    };

});
