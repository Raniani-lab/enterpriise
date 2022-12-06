/** @odoo-module **/

import { registry } from "@web/core/registry";
import { RadioField, radioField } from "@web/views/fields/radio/radio_field";

const { onWillStart, onMounted, useState } = owl;
import { useService } from '@web/core/utils/hooks';

class OnlineAccountRadio extends RadioField {
    static template = "account_online_synchronization.OnlineAccountRadio";
    setup() {
        super.setup();
        this.orm = useService("orm");
        this.state = useState({balances: {}});
        onWillStart(async () => {
            this.state.balances = await this.loadData();
        });
        // Make sure the first option is selected by default.
        onMounted(() => {
            this.onChange(this.items[0]);
        });
    }

    async loadData() {
        const ids = this.items.map(i => i[0]);
        return await this.orm.call('account.online.account', 'get_formatted_balances', [ids]);
    }
}

registry.category("fields").add("online_account_radio", {
    ...radioField,
    component: OnlineAccountRadio,
});
