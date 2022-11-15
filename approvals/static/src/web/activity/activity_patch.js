/** @odoo-module */

import { Activity } from "@mail/web/activity/activity";

import { Approval } from "@approvals/web/activity/approval";

Object.assign(Activity.components, { Approval });
