/** @odoo-module **/

    import Dialog from "@web/legacy/js/core/dialog";
    import mobileMixins from "@web_mobile/js/core/mixins";

    Dialog.include(
        Object.assign({}, mobileMixins.BackButtonEventMixin, {
            //--------------------------------------------------------------------------
            // Handlers
            //--------------------------------------------------------------------------

            /**
             * Close the current dialog on 'backbutton' event.
             *
             * @private
             * @override
             * @param {Event} ev
             */
            _onBackButton: function () {
                this.close();
            },
        })
    );
