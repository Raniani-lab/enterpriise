odoo.define('pos_settle_due.models', function (require) {
    'use strict';

    const models = require('point_of_sale.models');
    models.load_fields('res.partner', 'total_due');
});
