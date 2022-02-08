odoo.define('pos_settle_due.PartnerListScreen', function (require) {
    'use strict';

    const PartnerListScreen = require('point_of_sale.PartnerListScreen');
    const Registries = require('point_of_sale.Registries');
    const { useListener } = require("@web/core/utils/hooks");

    const POSSettleDuePartnerListScreen = (PartnerListScreen) =>
        class extends PartnerListScreen {
            setup() {
                super.setup();
                // trigger to close this screen (from being shown as tempScreen)
                useListener('discard', this.back);
            }
            async refreshTotalDue() {
                const partnersWithUpdatedFields = await this.rpc({
                    model: 'res.partner',
                    method: 'search_read',
                    args: [[['id', 'in', this.env.pos.db.partner_sorted]], ['total_due']],
                });
                this.env.pos.db.update_partners(partnersWithUpdatedFields);
                this.render();
            }
        };

    Registries.Component.extend(PartnerListScreen, POSSettleDuePartnerListScreen);

    return PartnerListScreen;
});
