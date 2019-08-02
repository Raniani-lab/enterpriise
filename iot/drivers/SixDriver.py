# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import ctypes
import logging
import time

try:
    from queue import Queue, Empty
except ImportError:
    from Queue import Queue, Empty  # pylint: disable=deprecated-module

from odoo.addons.hw_drivers.controllers.driver import Driver, event_manager, mpdm

eftapi = ctypes.CDLL("eftapi.so")
EFT_BUSY_ERROR = 801

_logger = logging.getLogger(__name__)


class SixDriver(Driver):
    connection_type = 'mpd'

    def __init__(self, device):
        super(SixDriver, self).__init__(device)
        self._device_type = 'payment'
        self._device_connection = 'network'
        self._device_name = "Six Payment Terminal %s" % self.device_identifier
        self.actions = Queue()

    @classmethod
    def supported(cls, device):
        return True  # All devices with connection_type == 'mpd' are supported

    @property
    def device_identifier(self):
        return self.dev

    def action(self, data):
        try:
            if data['messageType'] == 'Transaction':
                self.open_shift()
                self.actions.put({
                    'type': b'debit',
                    'amount': data['amount'],
                    'currency': data['currency'].encode(),
                })
            elif data['messageType'] == 'OpenShift':
                self.open_shift()
            elif data['messageType'] == 'CloseShift':
                self.close_shift()
            elif data['messageType'] == 'Cancel':
                self.call_eftapi('EFT_Abort')
        except:
            pass

    def open_shift(self):
        """Opens the shift if it was closed (activation_state.value == 0)"""

        activation_state = ctypes.c_long()
        self.call_eftapi('EFT_GetActivationState', ctypes.byref(activation_state))
        self.call_eftapi('EFT_PutPrinterWidth', 45)
        self.call_eftapi('EFT_PutReceiptOptions', 1089)
        if activation_state.value == 0:
            self.call_eftapi('EFT_Open')

    def close_shift(self):
        """Closes the shift if it was open (activation_state.value == 1)"""

        activation_state = ctypes.c_long()
        self.call_eftapi('EFT_GetActivationState', ctypes.byref(activation_state))
        if activation_state.value == 1:
            self.call_eftapi('EFT_Close')

    def run(self):
        """Transactions need to be async to be aborted. Therefore, they cannot
        be executed directly in 'action' so we process them in a queue.
        """

        while True:
            action = self.actions.get()
            self.process_transaction(action)
            time.sleep(2)  # If the delay between transactions is too small, the second one will fail

    def process_transaction(self, transaction):
        """Processes a transaction on the terminal and triggers the required
        updates for the interface to work.

        :param transaction: The transaction to be executed
        :type transaction: dict
        """

        try:
            self.call_eftapi('EFT_PutAsync', 1)
            self.call_eftapi('EFT_PutCurrency', transaction['currency'])
            self.call_eftapi('EFT_Transaction', transaction['type'], transaction['amount'], 0)

            self.send_status(stage='WaitingForCard')

            completed_command = ctypes.c_long()
            while completed_command.value != 3:
                # We check the last command that was completed, if it is the
                # transaction (value=3), we continue the execution
                self.call_eftapi('EFT_Complete', -1)
                self.call_eftapi('EFT_GetCompletedCommand', ctypes.byref(completed_command))

            self.call_eftapi('EFT_PutAsync', 0)
            self.call_eftapi('EFT_Commit', 1)

            self.send_status(
                response="Approved",
                ticket=self.get_customer_receipt(),
                ticket_merchant=self.get_merchant_receipt(),
            )

        except:
            pass

        finally:
            eftapi.EFT_PutAsync(mpdm.mpd_session, 0)

    def get_customer_receipt(self):
        """Gets the transaction receipt destined to the cutomer."""

        receipt_count = ctypes.c_long()
        receipt_text = ctypes.create_string_buffer(4000)
        self.call_eftapi('EFT_GetReceiptCopyCount', ctypes.byref(receipt_count))
        if receipt_count.value:
            self.call_eftapi('EFT_GetReceiptText', ctypes.byref(receipt_text), ctypes.sizeof(receipt_text))
        return receipt_text.value.decode('latin-1')

    def get_merchant_receipt(self):
        """Gets the transaction receipt destined to the merchant."""

        receipt_merchant_count = ctypes.c_long()
        receipt_merchant_text = ctypes.create_string_buffer(4000)
        self.call_eftapi('EFT_GetReceiptMerchantCount', ctypes.byref(receipt_merchant_count))
        if receipt_merchant_count.value:
            self.call_eftapi('EFT_GetReceiptMerchantText', ctypes.byref(receipt_merchant_text), ctypes.sizeof(receipt_merchant_text))
        return receipt_merchant_text.value.decode('latin-1')

    def call_eftapi(self, function, *args):
        """Wrapper for the eftapi calls. If the terminal is busy, waits until
        it's not used anymore. Checks the return value for every call and
        triggers an error if it's different than 0.

        :param function: The name of the eftapi function to be called
        :type function: String
        """

        res = getattr(eftapi, function)(mpdm.mpd_session, *args)
        while res == EFT_BUSY_ERROR:
            res = getattr(eftapi, function)(mpdm.mpd_session, *args)
            time.sleep(1)
        if res != 0:
            self.send_error(res)

    def send_status(self, response=False, stage=False, ticket=False, ticket_merchant=False, error=False):
        """Triggers a device_changed to notify all listeners of the new status.

        :param response: The result of a transaction
        :type response: String
        :param stage: The status of the transaction
        :type stage: String
        :param ticket: The transaction receipt destined to the merchant, if any
        :type ticket: String
        :param ticket_merchant: The transaction receipt destined to the merchant, if any
        :type ticket_merchant: String
        :param error: The error that happened, if any
        :type error: String
        """

        self.data = {
            'value': '',
            'Stage': stage,
            'Response': response,
            'Ticket': ticket,
            'TicketMerchant': ticket_merchant,
            'Error': error,
        }
        event_manager.device_changed(self)

    def send_error(self, error_code):
        """Retrieves the last error message from the mpd server and sends it to
        all listeners. Throws an Exception to stop the function that was being
        processed.

        :param error_code: The error code that was returned by a call to eftapi
        :type error_code: String
        """

        msg = ctypes.create_string_buffer(1000)
        eftapi.EFT_GetExceptionMessage(mpdm.mpd_session, ctypes.byref(msg), ctypes.sizeof(msg))
        error_message = "[%s] %s" % (error_code, msg.value.decode('latin-1'))
        self.send_status(error=error_message)
        _logger.error(error_message)
        raise Exception()
