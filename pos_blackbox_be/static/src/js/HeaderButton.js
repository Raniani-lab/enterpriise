/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
    import { useService } from "@web/core/utils/hooks";
    import HeaderButton from "point_of_sale.HeaderButton";
    import Registries from "point_of_sale.Registries";

    const PosBlackBoxBeHeaderButton = HeaderButton =>
        class extends HeaderButton {
            setup() {
                this.orm = useService("orm");
            }

            async onClick() {
                if(this.env.pos.useBlackBoxBe()) {
                    let status = await this.get_user_session_status(this.env.pos.pos_session.id, this.env.pos.pos_session.user_id[0]);
                    if(status) {
                        await this.showPopup('ErrorPopup', {
                            title: _t("POS error"),
                            body: _t("You need to clock out before closing the POS."),
                        });
                        return;
                    }
                }
                super.onClick();
            }
            async get_user_session_status(session, user) {
                return await this.orm.call(
                    'pos.session',
                    'get_user_session_work_status',
                    [session, user],
                );
            }
        }

    Registries.Component.extend(HeaderButton, PosBlackBoxBeHeaderButton);

    export default HeaderButton;
