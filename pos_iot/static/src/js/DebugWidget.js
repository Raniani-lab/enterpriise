/** @odoo-module */

import DebugWidget from "@point_of_sale/js/ChromeWidgets/DebugWidget";
import Registries from "@point_of_sale/js/Registries";

const PosIotDebugWidget = (DebugWidget) =>
    class extends DebugWidget {
        /**
         * @override
         */
        refreshDisplay(event) {
            event.preventDefault();
            if (this.env.proxy.display) {
                this.env.proxy.display.action({ action: "display_refresh" });
            }
        }
    };

Registries.Component.extend(DebugWidget, PosIotDebugWidget);

export default DebugWidget;
