odoo.define('sign/static/src/components/activity/activity.js', function (require) {
'use strict';

const components = {
    Activity: require('@mail/components/activity/activity')[Symbol.for("default")],
    SignRequest: require('sign/static/src/components/sign_request/sign_request.js'),
};

Object.assign(components.Activity.components, {
    SignRequest: components.SignRequest,
});

});
