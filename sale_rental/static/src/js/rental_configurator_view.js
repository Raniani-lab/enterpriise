odoo.define('sale_rental.RentalConfiguratorFormView', function (require) {
"use strict";

var RentalConfiguratorFormController = require('sale_rental.RentalConfiguratorFormController');
var FormView = require('web.FormView');
var viewRegistry = require('web.view_registry');

/**
 * @see RentalConfiguratorFormController for more information
 */
var RentalConfiguratorFormView = FormView.extend({
    config: _.extend({}, FormView.prototype.config, {
        Controller: RentalConfiguratorFormController
    }),
});

viewRegistry.add('rental_configurator_form', RentalConfiguratorFormView);

return RentalConfiguratorFormView;

});
