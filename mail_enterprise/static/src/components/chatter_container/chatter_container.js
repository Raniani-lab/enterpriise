odoo.define('mail_enterprise/static/src/components/chatter_container/chatter_container.js', function (require) {
'use strict';

const ChatterContainer = require('@mail/components/chatter_container/chatter_container')[Symbol.for("default")];

Object.assign(ChatterContainer, {
    defaultProps: Object.assign(ChatterContainer.defaultProps || {}, {
        isInFormSheetBg: false,
    }),
    props: Object.assign(ChatterContainer.props, {
        isInFormSheetBg: {
            type: Boolean,
        },
    })
});

});
