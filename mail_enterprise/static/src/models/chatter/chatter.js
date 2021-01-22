odoo.define('mail_enterprise/static/src/models/chatter/chatter.js', function (require) {
'use strict';

const { attr } = require('mail/static/src/model/model_field.js');
const { registerFieldPatchModel } = require('mail/static/src/model/model_core.js');

/**
 * This should be moved inside the mail_enterprise
 * mail_enterprise/static/src/models/chatter/chatter.js
 */
registerFieldPatchModel('mail.chatter', 'mail/static/src/models/chatter/chatter.js', {
    /**
     * The chatter is inside .form_sheet_bg class
     */
    isInFormSheetBg: attr({
        default: false,
    }),
});

});
