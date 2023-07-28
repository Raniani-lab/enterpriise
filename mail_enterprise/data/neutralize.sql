-- reset WEB Push Notification:
-- * delete VAPID keys
DELETE FROM ir_config_parameter
    WHERE key IN ('mail_enterprise.web_push_vapid_private_key', 'mail_enterprise.web_push_vapid_public_key');
-- * delete delayed messages (CRON)
TRUNCATE mail_notification_web_push;
-- * delete Devices for each partners
TRUNCATE mail_partner_device CASCADE;
