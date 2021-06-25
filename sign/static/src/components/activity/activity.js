odoo.define('sign/static/src/components/activity/activity.js', function (require) {
'use strict';

const { Activity } = require('@mail/components/activity/activity');

const components = {
    Activity,
    SignRequest: require('sign/static/src/components/sign_request/sign_request.js'),
};

Object.assign(components.Activity.components, {
    SignRequest: components.SignRequest,
});

});
