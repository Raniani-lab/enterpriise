odoo.define('approvals/static/src/components/activity/activity.js', function (require) {
'use strict';

const components = {
    Activity: require('@mail/components/activity/activity')[Symbol.for("default")],
    Approval: require('approvals/static/src/components/approval/approval.js'),
};

Object.assign(components.Activity.components, {
    Approval: components.Approval,
});

});
