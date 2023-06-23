/** @odoo-module **/

/**
 * In this file, we override some relational fields to improve the UX in mobile.
 */

import config from "@web/legacy/js/services/config";
import relational_fields from "@web/legacy/js/fields/relational_fields";

if (config.device.isMobile) {
    var FieldMany2One = relational_fields.FieldMany2One;

    /**
     * Override the Many2One to prevent autocomplete and open kanban view in mobile for search.
     */

    FieldMany2One.include({

        start: function () {
            var superRes = this._super.apply(this, arguments);
            this.$input.prop('readonly', true);
            return superRes;
        },
        //--------------------------------------------------------------------------
        // Private
        //--------------------------------------------------------------------------

        /**
         * Don't bind autocomplete in the mobile as it uses a different mechanism
         * On clicking Many2One will directly open popup with kanban view
         *
         * @private
         * @override
         */
        _bindAutoComplete: function () {},

        /**
         * override to add selectionMode option to search create popup option
         *
         * @private
         * @override
         */
        _getSearchCreatePopupOptions: function () {
            var self = this;
            var searchCreatePopupOptions = this._super.apply(this, arguments);
            Object.assign(searchCreatePopupOptions, {
                selectionMode: true,
                on_clear: function () {
                    self.reinitialize(false);
                },
            });
            return searchCreatePopupOptions;
        },

        /**
         * We always open Many2One search dialog for select/update field value
         * instead of autocomplete
         *
         * @private
         * @override
         */
        _toggleAutoComplete: function () {
            this._searchCreatePopup("search");
        },
    });
}
