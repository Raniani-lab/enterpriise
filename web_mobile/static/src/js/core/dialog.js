/** @odoo-module **/
    
    import Dialog from "web.Dialog";
    import mobileMixins from "web_mobile.mixins";

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
