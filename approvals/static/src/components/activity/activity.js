odoo.define('approvals/static/src/components/activity/activity.js', function (require) {
'use strict';

const { Activity } = require('@mail/components/activity/activity');

const components = {
    Activity,
    Approval: require('approvals/static/src/components/approval/approval.js'),
};

Object.assign(components.Activity.components, {
    Approval: components.Approval,
});

});
