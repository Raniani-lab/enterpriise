/** @odoo-module **/

import { DynamicPlaceholderPopover } from "@web/views/fields/dynamic_placeholder_popover";
import { useLoadFieldInfo } from "@web/core/model_field_selector/utils";

export class StudioDynamicPlaceholderPopover extends DynamicPlaceholderPopover {
    setup() {
        super.setup();
        this.loadFieldInfo = useLoadFieldInfo();
    }

    async validate() {
        const fieldInfo = (await this.loadFieldInfo(this.props.resModel, this.state.path)).fieldDef;
        const filename_exists = (
            await this.loadFieldInfo(this.props.resModel, this.state.path + "_filename")
        ).fieldDef;
        const is_image = fieldInfo.type == "binary" && !filename_exists;
        this.props.close();
        this.props.validate(this.state.path, this.state.defaultValue, is_image);
    }
}
