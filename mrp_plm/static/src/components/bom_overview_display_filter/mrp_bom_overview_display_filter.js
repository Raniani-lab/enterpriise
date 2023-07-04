/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { BomOverviewDisplayFilter } from "@mrp/components/bom_overview_display_filter/mrp_bom_overview_display_filter";

patch(BomOverviewDisplayFilter.prototype, {
    setup() {
        super.setup();
        if (this.props.showOptions.ecoAllowed) {
            this.displayOptions.ecos = this.env._t('ECOs');
        }
    },
});

patch(BomOverviewDisplayFilter, {
    props: {
        ...BomOverviewDisplayFilter.props,
        showOptions: { 
            ...BomOverviewDisplayFilter.showOptions,
            ecos: Boolean,
            ecoAllowed: Boolean,
        },
    },
});
