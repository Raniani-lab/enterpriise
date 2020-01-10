odoo.define('web_studio.AppCreator', function (require) {
    "use strict";

    const AbstractAction = require('web.AbstractAction');
    const { action_registry } = require('web.core');
    const { COLORS, BG_COLORS, ICONS } = require('web_studio.utils');
    const { FieldMany2One } = require('web.relational_fields');
    const IconCreator = require('web_studio.IconCreator');
    const StandaloneFieldManagerMixin = require('web.StandaloneFieldManagerMixin');
    const { useFocusOnUpdate, useExternalListener } = require('web.custom_hooks');

    const { Component, hooks } = owl;
    const { useState, useRef } = hooks;

    const AppCreatorAdapter = AbstractAction.extend(StandaloneFieldManagerMixin, {

        /**
         * This widget is directly bound to its inner owl component and its sole purpose
         * is to instanciate it with the adequate properties: it will manually
         * mount the component when attached to the dom, will dismount it when detached
         * and destroy it when destroyed itself.
         * @constructor
         */
        init(parent, action, options={}) {
            this._super(...arguments);
            StandaloneFieldManagerMixin.init.call(this);

            if (options.env) {
                AppCreator.env = options.env;
            }
            this.AppCreatorProps = options.props || {};
        },

        /**
         * Generate a legacy many2one field. This has to be done manually since as
         * long as the many2one field is not an owl Component.
         * This is only made in debug mode.
         */
        async willStart() {
            let many2one = false;
            if (AppCreator.env.isDebug()) {
                const recordId = await this.model.makeRecord('ir.actions.act_window', [{
                    name: 'model',
                    relation: 'ir.model',
                    type: 'many2one',
                    domain: [['transient', '=', false], ['abstract', '=', false]]
                }]);
                const record = this.model.get(recordId);
                many2one = new FieldMany2One(this, 'model', record, { mode: 'edit' });
                this._registerWidget(recordId, 'model', many2one);
                await many2one.appendTo(document.createDocumentFragment());
            }
            this._component = new AppCreator(null, Object.assign({ many2one }, this.AppCreatorProps));
        },

        async start() {
            await this._super(...arguments);
            return this._component.mount(this.el);
        },

        destroy() {
            this._component.destroy();
            this._super(...arguments);
        },

        on_attach_callback() {
            return this._component.__callMounted();
        },

        on_detach_callback: function () {
            return this._component.__callWillUnmount();
        },

        //--------------------------------------------------------------------------
        // Handlers
        //--------------------------------------------------------------------------

        /**
         * @private
         * @param {OdooEvent} ev
         * @param {Widget} ev.target
         * @param {Object} ev.data
         */
        async _onFieldChanged({ target, data }) {
            await StandaloneFieldManagerMixin._onFieldChanged.apply(this, arguments);
            const ev = new CustomEvent('field-changed', {
                bubbles: true,
                cancelable: true,
                detail: data,
            });
            target.el.dispatchEvent(ev);
        },
    });

    /**
     * App creator
     *
     * Action handling the complete creation of a new app. It requires the user
     * to enter an app name, to customize the app icon (@see IconCreator) and
     * to finally enter a menu name, with the option to bind the default app
     * model to an existing one.
     *
     * TODO: this component is bound to an action adapter since the action manager
     * cannot yet handle owl component. This file must be reviewed as soon as
     * the action manager is updated.
     * @extends Component
     */
    class AppCreator extends Component {
        constructor() {
            super(...arguments);
            // TODO: Many2one component directly attached in XML. For now we have
            // to toggle it manually according to the state changes.
            this.state = useState({
                step: 'welcome',
                appName: "",
                menuName: "",
                modelChoice: false,
                modelId: false,
                iconData: {
                    backgroundColor: BG_COLORS[5],
                    color: COLORS[4],
                    iconClass: ICONS[0],
                    type: 'custom_icon',
                },
            });

            this.focusOnUpdate = useFocusOnUpdate();
            this.invalid = useState({
                appName: false,
                menuName: false,
                modelId: false,
            });
            this.many2oneContainerRef = useRef('many2one-container');
            useExternalListener(window, 'keydown', this._onKeydown);
        }

        mounted() {
            // Manualy mounts many2one widget if its container is in the DOM.
            // Theoretically, it should never be the case when first mounted, but
            // since we can set a custom state in tests, we need to do it here
            // too anyway.
            if (this.many2oneContainerRef.el) {
                this.many2oneContainerRef.el.appendChild(this.props.many2one.el);
            }
        }

        patched() {
            // Manualy mounts many2one widget if its container is in the DOM.
            if (this.many2oneContainerRef.el) {
                this.many2oneContainerRef.el.appendChild(this.props.many2one.el);
            }
        }

        //--------------------------------------------------------------------------
        // Getters
        //--------------------------------------------------------------------------

        /**
         * @returns {boolean}
         */
        get isReady() {
            return (
                    this.state.step === 'welcome'
                ) || (
                    this.state.step ===  'app' &&
                    this.state.appName
                ) || (
                    this.state.step === 'model' &&
                    this.state.menuName &&
                    (
                        !this.state.modelChoice ||
                        this.state.modelId
                    )
                );
        }

        //--------------------------------------------------------------------------
        // Private
        //--------------------------------------------------------------------------

        /**
         * Switch the current step and clean all invalid keys.
         * @private
         * @param {string} step
         */
        _changeStep(step) {
            this.state.step = step;
            for (const key in this.invalid) {
                this.invalid[key] = false;
            }
            this.focusOnUpdate();
        }

        /**
         * @private
         * @returns {Promise}
         */
        async _createNewApp() {
            this.env.services.blockUI();

            const iconValue = this.state.iconData.type === 'custom_icon' ?
                // custom icon data
                [this.state.iconData.iconClass, this.state.iconData.color, this.state.iconData.backgroundColor] :
                // attachment
                this.state.iconData.uploaded_attachment_id;

            const result = await this.rpc({
                route: '/web_studio/create_new_menu',
                params: {
                    app_name: this.state.appName,
                    menu_name: this.state.menuName,
                    model_id: this.state.modelChoice && this.state.modelId,
                    is_app: true,
                    icon: iconValue,
                    context: this.env.session.user_context,
                },
            }).guardedCatch(() => this.env.services.unblockUI());
            this.trigger('new-app-created', result);
            this.env.services.unblockUI();
        }

        //--------------------------------------------------------------------------
        // Handlers
        //--------------------------------------------------------------------------

        /**
         * @private
         * @param {Event} ev
         */
        _onChecked(ev) {
            this.state.modelChoice = ev.currentTarget.checked;
            if (!ev.currentTarget.checked) {
                this.invalid.modelId = false;
            }
        }

        /**
         * @private
         */
        _onFieldChanged() {
            if (this.props.many2one.value) {
                this.state.modelId = this.props.many2one.value.res_id;
            }
        }

        /**
         * @private
         * @param {OwlEvent} ev
         */
        _onIconChanged(ev) {
            for (const key in this.state.iconData) {
                delete this.state.iconData[key];
            }
            Object.assign(this.state.iconData, ev.detail);
        }

        /**
         * @private
         * @param {InputEvent} ev
         */
        _onInput(ev) {
            const input = ev.currentTarget;
            if (this.invalid[input.id]) {
                this.invalid[input.id] = !input.value;
            }
            this.state[input.id] = input.value;
        }

        /**
         * @private
         * @param {KeyboardEvent} ev
         */
        _onKeydown(ev) {
            if (
                ev.key === 'Enter' && !(
                    ev.target.classList &&
                    ev.target.classList.contains('o_web_studio_app_creator_previous')
                )
            ) {
                ev.preventDefault();
                this._onNext();
            }
        }

        /**
         * @private
         */
        async _onNext() {
            switch (this.state.step) {
                case 'welcome':
                    this._changeStep('app');
                    break;
                case 'app':
                    if (!this.state.appName) {
                        this.invalid.appName = true;
                    } else {
                        this._changeStep('model');
                    }
                    break;
                case 'model':
                    if (!this.state.menuName) {
                        this.invalid.menuName= true;
                    }
                    if (this.state.modelChoice && !this.state.modelId) {
                        this.invalid.modelId = true;
                    }
                    const isValid = Object.values(this.invalid).reduce(
                        (valid, key) => valid && !key,
                        true
                    );
                    if (isValid) {
                        this._createNewApp();
                    }
                    break;
            }
        }

        /**
         * @private
         */
        _onPrevious() {
            switch (this.state.step) {
                case 'app':
                    this._changeStep('welcome');
                    break;
                case 'model':
                    this._changeStep('app');
                    break;
            }
        }
    }

    AppCreator.components = { IconCreator };
    AppCreator.props = {
        many2one: FieldMany2One,
    };
    AppCreator.template = 'AppCreator';

    action_registry.add('action_web_studio_app_creator', AppCreatorAdapter);

    return AppCreatorAdapter;
});
