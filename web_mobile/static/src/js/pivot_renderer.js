odoo.define('web_mobile.PivotRenderer', async function (require) {
    'use strict';

    const config = require('web.config');

    if (!config.device.isMobile) {
        return;
    }

    const PivotRenderer = require('web.PivotRenderer');

    const utils = require('web.utils');


    utils.patch(PivotRenderer, "pivot_mobile", {
        /**
         * Do not compute the tooltip on mobile
         * @override 
         */
        _updateTooltip() { },

        /**
         * @override 
         */
        _getPadding(cell) {
            return 5 + cell.indent * 5;
        },

        /**
         * @override 
         */
        _onClickMenuGroupBy(field, interval, ev) {
            if (!ev.currentTarget.classList.contains('o_pivot_field_selection')){
                this._super(...arguments);
            } else {
                ev.stopPropagation();
            }
        }

    })
});