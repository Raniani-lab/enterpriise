/** @odoo-module **/

import { attr } from '@mail/model/model_field';
import { addFields } from '@mail/model/model_core';
// ensure that the model definition is loaded before the patch
import '@mail/models/chatter';

addFields('Chatter', {
    /**
     * The chatter is inside .form_sheet_bg class
     */
    isInFormSheetBg: attr({
        default: false,
    }),
});
