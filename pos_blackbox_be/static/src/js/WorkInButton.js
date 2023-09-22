/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";
    import PosComponent from "point_of_sale.PosComponent";
    import ProductScreen from "point_of_sale.ProductScreen";
    import Registries from "point_of_sale.Registries";

    const { onWillStart, useState } = owl;

    class WorkInButton extends PosComponent {
        // TODO: add the clock in/out ticket and push it to the blackbox.
        setup() {
            super.setup();
            this.state = useState({ status: 0 });
            this.orm = useService("orm");
            onWillStart(this.onWillStart);
        }
        async onWillStart() {
            this.state.status = await this.get_user_session_status(this.env.pos.pos_session.id, this.env.pos.pos_session.user_id[0]);
        }
        async onClick() {
            let clocked = await this.get_user_session_status(this.env.pos.pos_session.id, this.env.pos.pos_session.user_id[0]);
            if(!this.state.status && !clocked)
                this.ClockIn();
            if(this.state.status && clocked)
                this.ClockOut();
        }
        async ClockIn() {
            let users_logged = await this.set_user_session_status(this.env.pos.pos_session.id, this.env.pos.pos_session.user_id[0], true);
            if(users_logged) {
                this.env.pos.pos_session.users_clocked_ids = users_logged;
                this.state.status = true;
            }
        }
        async ClockOut() {
            let unpaid_tables = this.env.pos.db.load('unpaid_orders', []).filter(function (order) { return order.data.amount_total > 0; }).map(function (order) { return order.data.table; });
            if(unpaid_tables.length > 0) {
                await this.showPopup('ErrorPopup', {
                    title: _t("Fiscal Data Module error"),
                    body: _t("Tables %s still have unpaid orders. You will not be able to clock out until all orders have been paid."),
                });
                return;
            }

            let userLogOut = await this.set_user_session_status(this.env.pos.pos_session.id, this.env.pos.pos_session.user_id[0], false);
            if(userLogOut) {
                this.env.pos.pos_session.users_clocked_ids = userLogOut;
                this.state.status = false;
            }
        }
        async set_user_session_status(session, user, status) {
            return await this.orm.call(
                'pos.session',
                'set_user_session_work_status',
                [session, user, status],
            );
        }
        async get_user_session_status(session, user) {
            return await this.orm.call(
                'pos.session',
                'get_user_session_work_status',
                [session, user],
            );
        }
    }
    WorkInButton.template = 'WorkInButton';

    ProductScreen.addControlButton({
        component: WorkInButton,
        condition: function() {
            return true;
        },
    });

    Registries.Component.add(WorkInButton);

    export default WorkInButton;
