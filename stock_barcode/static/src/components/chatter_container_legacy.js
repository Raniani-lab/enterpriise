/** @odoo-module **/

// ensure component is registered before-hand
import '@mail/components/chatter_container/chatter_container';
import { getMessagingComponent } from "@mail/utils/messaging_component";
const { Component } = owl;

const ChatterContainer = getMessagingComponent('ChatterContainer');

class ChatterContainerWithLegacyEnv extends Component {
    setup() {
        this.__owl__.childEnv = Component.env;
    }
}
ChatterContainerWithLegacyEnv.template = owl.xml`
    <t>
        <ChatterContainer t-props="props"/>
    </t>`;
ChatterContainerWithLegacyEnv.components = { ChatterContainer };

export default ChatterContainerWithLegacyEnv;
