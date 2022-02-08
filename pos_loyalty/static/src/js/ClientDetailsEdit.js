odoo.define('pos_loyalty.PartnerDetailsEdit', function(require) {

    const PartnerDetailsEdit = require('point_of_sale.PartnerDetailsEdit');
    const Registries = require('point_of_sale.Registries');

    const LoyaltyPartnerDetailsEdit = PartnerDetailsEdit => class extends PartnerDetailsEdit {
        get isNotManager() {
            return this.env.pos.user.role !== "manager";
        }
    };

    Registries.Component.extend(PartnerDetailsEdit, LoyaltyPartnerDetailsEdit);

    return PartnerDetailsEdit;
});
