/** @odoo-module **/

    import core from "@web/legacy/js/services/core";
    import Dialog from "@web/legacy/js/core/dialog";
    import framework from "@web/legacy/js/core/misc";
    import localStorage from "@web/legacy/js/core/local_storage";
    const qweb = core.qweb;

    const PromoteStudioDialog = Dialog.extend({
        events: Object.assign({}, Dialog.prototype.events, {
            'click button.o_install_studio': '_onInstallStudio',
        }),
        /**
         * This init function adds a click listener on window to handle
         * modal closing.
         * @override
         */
        init: function (parent, options) {
            options = Object.assign({
                $content: $(qweb.render('web_enterprise.install_web_studio')),
                renderHeader: false,
                renderFooter: false,
                size: 'large',
            }, options || {});
            this._super(parent, options);
        },
        /**
         * This function adds an handler for window clicks at the end of start.
         *
         * @override
         */
        start: async function () {
            await this._super.apply(this, arguments);
            core.bus.on('click', this, this._onWindowClick);
        },
        //--------------------------------------------------------------------------
        // Private
        //--------------------------------------------------------------------------
        /**
         * This function both installs studio and reload the current view in studio mode.
         *
         * @param {Event} ev
         */
        _onInstallStudio: async function (event) {
            event.stopPropagation();
            this.disableClick = true;
            framework.blockUI();
            const modules = await this._rpc({
                model: 'ir.module.module',
                method: 'search_read',
                fields: ['id'],
                domain: [['name', '=', 'web_studio']],
            });
            await this._rpc({
                model: 'ir.module.module',
                method: 'button_immediate_install',
                args: [[modules[0].id]],
            });
            // on rpc call return, the framework unblocks the page
            // make sure to keep the page blocked until the reload ends.
            framework.blockUI();
            localStorage.setItem('openStudioOnReload', 'main');
            this._reloadPage();
        },
        /**
         * Close modal when the user clicks outside the modal WITHOUT propagating
         * the event.
         * We must use this function to keep dropdown menu open when the user clicks in the modal, too.
         * This behaviour cannot be handled by using the modal backdrop.
         *
         * @param {Event} event
         */
        _onWindowClick: function (event) {
            const $modal = $(event.target).closest('.modal-studio');
            if (!$modal.length && !this.disableClick) {
                this._onCloseDialog(event);
            }
            event.stopPropagation();
        },
        //--------------------------------------------------------------------------
        // Utils
        //--------------------------------------------------------------------------
        /**
         * This function isolate location reload in order to easily mock it (in tests for example)
         *
         * @private
         */
        _reloadPage: function () {
            window.location.reload();
        },
    });

    export default PromoteStudioDialog;
