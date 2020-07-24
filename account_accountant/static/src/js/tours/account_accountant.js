odoo.define('account_accountant.tour', function (require) {
    "use strict";

    const core = require('web.core');
    const tour = require('web_tour.tour');

    const _t = core._t;

    tour.register('account_accountant_tour_upload', 
        {
            skip_enabled: true,
            url: "/web",
            rainbowManMessage: _t("Congratulation, your first bill is validated !\n" +
                "Odoo’s Artificial Intelligence saved your precious time."),
        }, 
        [
            ...tour.stepUtils.goToAppSteps('account_accountant.menu_accounting', _t('Let’s automate your bills, bank transactions and accounting processes..')),
            {
                trigger: 'a[data-method="setting_upload_bill_wizard"].o_onboarding_step_action',
                content: _t('Create your first vendor bill.<br/><br/><i>Tip: If you don’t have one on hand, use our sample bill.</i>'),
                position: 'bottom',
            }, {
                trigger: 'button[name="apply"]',
                content: _t('Great! Let’s continue.'),
                position: 'top',
            }, {
                trigger: '.o_data_cell',
                extra_trigger: 'tr:not(.o_sample_data_disabled)>td:has(span[name="payment_state"])',
                content: _t('Let’s see how a bill look like in form view.'),
                position: 'top',
            }, {
                trigger: 'button.btn-primary[name="action_post"]',
                extra_trigger: 'body:has(div[name="waiting_extraction"].o_invisible_modifier)',
                content: _t('Check & validate the bill. If no vendor has been found, add one before validating.'),
                position: 'bottom',
            }, {
                trigger: '.breadcrumb-item:not(.active):first',
                extra_trigger: 'button[data-value="posted"].btn-primary',
                content: _t('Let’s go back to the dashboard using your previous path…'),
                position: 'bottom',
            }
        ]
    );

    tour.register('account_accountant_tour_upload_ocr_step', {
            skip_enabled: true,
            rainbowMan: false,
        },
        [
            {
                trigger: 'button.btn-primary[name="check_status"]',
                content: _t('Let’s use AI to fill in the form<br/><br/><i>Tip: If the OCR is not done yet, wait a few more seconds and try again.</i>'),
                position: 'bottom',
            }
        ]
    )
});
