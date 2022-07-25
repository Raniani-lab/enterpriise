/** @odoo-module **/

import { FormController } from "@web/views/form/form_controller";

import { useService } from "@web/core/utils/hooks";

const { onWillUpdateProps, useSubEnv } = owl;

export class ShareFormController extends FormController {
    setup() {
        super.setup(...arguments);
        const notificationService = useService('notification');
        const _t = this.env._t;
        
        this.props.setShareResId(this.props.resId);
        onWillUpdateProps((nextProps) => {
            this.props.setShareResId(nextProps.resId);
        });
        // Override onClickViewButton to copy the data to the clipboard
        const previousOnClickViewButton = this.env.onClickViewButton;
        const self = this;
        useSubEnv({
            async onClickViewButton({ clickParams }) {
                if (clickParams.special === "save") {
                    // Copy the share link to the clipboard
                    navigator.clipboard.writeText(self.model.root.data.full_url);
                    // Show a notification to the user about the copy to clipboard
                    notificationService.add(
                        _t("The share url has been copied to your clipboard."),
                        {
                            type: "success",
                        },
                    );
                    self.props.setShouldDelete(false);
                }
                return previousOnClickViewButton(...arguments);
            }
        });
    }
};
ShareFormController.props = {
    ...FormController.props,
    setShareResId:  { type: Function },
    setShouldDelete: { type: Function },
}
